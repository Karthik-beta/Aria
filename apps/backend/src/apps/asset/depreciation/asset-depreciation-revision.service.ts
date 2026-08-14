import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client";
import { lockAssetAndFinanceBooks } from "../asset-locking";
import {
	type AssetOrganizationId,
	assertAssetOrganizationId,
	assetWhereForOrganization,
} from "../asset-organization-scope";
import {
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
} from "./depreciation.config";
import {
	buildDepreciationSchedule,
	type DepreciationBookInput,
} from "./depreciation-schedule-engine";

export interface AssetDepreciationRevisionInput {
	assetId: string;
	/** Limit the revision to the asset row for this named finance book. */
	financeBookId?: string;
	effectiveDate: Date;
	/** Change in the carrying value being depreciated. */
	valueDelta: number;
	/** Change in the configured salvage value. */
	salvageValueDelta?: number;
	/** Change in useful life, in calendar months, as stored by ERPNext. */
	usefulLifeDeltaMonths: number;
	/** Link the successor schedule to the document that caused the revision. */
	adjustmentId?: string;
	notes?: string | null;
}

export interface AssetDepreciationRevisionResult {
	assetFinanceBookId: string;
	previousScheduleId: string;
	scheduleId: string;
	carryingValue: number;
	totalNumberOfDepreciations: number;
	increaseInAssetLife: number;
	remainingDepreciations: number;
}

export interface RestoreAssetDepreciationRevisionInput {
	assetId: string;
	financeBookId: string;
	scheduleId: string;
	/** Exact finance-book carrying value captured before the revision. */
	previousValueAfterDepreciation: number;
}

export class AssetDepreciationRevisionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AssetDepreciationRevisionError";
	}
}

type RevisionTransaction = Prisma.TransactionClient;

type ActiveSchedule = {
	id: string;
	revisionNumber: number;
};

type RevisionBook = {
	id: string;
	financeBookId: string;
	depreciationMethod: DepreciationBookInput["method"];
	totalNumberOfDepreciations: number;
	increaseInAssetLife: number;
	frequencyOfDepreciation: number;
	dailyProrataBased: boolean;
	shiftBased: boolean;
	rateOfDepreciation: unknown;
	expectedValueAfterUsefulLife: unknown;
	openingAccumulatedDepreciation: unknown;
	openingNumberOfBookedDepreciations: number;
	valueAfterDepreciation: unknown;
	totalNumberOfBookedDepreciations: number;
	lastPostedDepreciationDate: Date | null;
	schedules: ActiveSchedule[];
};

type PostedEntry = {
	scheduleDate: Date;
	accumulatedDepreciationAmount: unknown;
};

const decimalNumber = (value: unknown): number => Number(value ?? 0);

const assertFinite = (name: string, value: number): void => {
	if (!Number.isFinite(value)) {
		throw new AssetDepreciationRevisionError(`${name} must be finite.`);
	}
};

const laterDate = (left: Date | null, right: Date | null): Date | null => {
	if (!left) return right;
	if (!right) return left;
	return left > right ? left : right;
};

/**
 * Creates immutable successor schedules inside a caller-owned transaction.
 *
 * The service deliberately does not mirror default-finance-book values onto
 * Asset: callers own that cross-book presentation concern.
 */
@Injectable()
export class AssetDepreciationRevisionService {
	async revise(
		tx: RevisionTransaction,
		organizationId: AssetOrganizationId,
		input: AssetDepreciationRevisionInput,
	): Promise<AssetDepreciationRevisionResult[]> {
		assertAssetOrganizationId(organizationId);
		this.validateInput(input);
		const effectiveDateOnly = dateOnlyFromPersistedDateTime(
			input.effectiveDate,
		);
		const effectiveDate = dateOnlyUtc(effectiveDateOnly);
		const books = await this.loadLockedBooks(
			tx,
			organizationId,
			input.assetId,
			input.financeBookId,
		);

		const revisions: AssetDepreciationRevisionResult[] = [];
		for (const book of books) {
			const activeSchedule = this.requireSingleActiveSchedule(book);
			const latestPosted = (await tx.assetDepreciationScheduleEntry.findFirst({
				where: {
					postingId: { not: null },
					schedule: {
						assetFinanceBookId: book.id,
						asset: { is: assetWhereForOrganization(organizationId) },
					},
				},
				select: {
					scheduleDate: true,
					accumulatedDepreciationAmount: true,
				},
				orderBy: [{ scheduleDate: "desc" }, { sequence: "desc" }],
			})) as unknown as PostedEntry | null;
			const lastPostedDate = laterDate(
				book.lastPostedDepreciationDate,
				latestPosted?.scheduleDate ?? null,
			);
			if (
				lastPostedDate &&
				effectiveDateOnly < dateOnlyFromPersistedDateTime(lastPostedDate)
			) {
				throw new AssetDepreciationRevisionError(
					`Effective date cannot be before the last posted depreciation for finance book ${book.financeBookId}.`,
				);
			}

			const salvageValue =
				decimalNumber(book.expectedValueAfterUsefulLife) +
				(input.salvageValueDelta ?? 0);
			if (salvageValue < 0) {
				throw new AssetDepreciationRevisionError(
					`Revised salvage value cannot be negative for finance book ${book.financeBookId}.`,
				);
			}
			const carryingValue =
				decimalNumber(book.valueAfterDepreciation) + input.valueDelta;
			if (carryingValue < salvageValue) {
				throw new AssetDepreciationRevisionError(
					`Revised carrying value cannot be below salvage value for finance book ${book.financeBookId}.`,
				);
			}

			const increaseInAssetLife =
				book.increaseInAssetLife + input.usefulLifeDeltaMonths;
			if (increaseInAssetLife < 0) {
				throw new AssetDepreciationRevisionError(
					`Revised useful-life extension cannot be negative for finance book ${book.financeBookId}.`,
				);
			}
			const addedPeriods = Math.ceil(
				increaseInAssetLife / book.frequencyOfDepreciation,
			);
			const totalPeriods = book.totalNumberOfDepreciations + addedPeriods;
			const bookedPeriods = book.totalNumberOfBookedDepreciations;
			if (totalPeriods <= bookedPeriods) {
				throw new AssetDepreciationRevisionError(
					`Revised useful life must leave at least one unbooked period for finance book ${book.financeBookId}.`,
				);
			}
			const remainingPeriods = totalPeriods - bookedPeriods;
			const openingAccumulatedDepreciation = latestPosted
				? decimalNumber(latestPosted.accumulatedDepreciationAmount)
				: decimalNumber(book.openingAccumulatedDepreciation);

			if (book.depreciationMethod === "MANUAL") {
				throw new AssetDepreciationRevisionError(
					"Manual depreciation revisions require caller-supplied future manual entries.",
				);
			}

			// The engine receives the revised carrying value and remaining life as a
			// fresh basis. History remains on the cancelled predecessor; its opening
			// accumulation is re-applied to successor entries before persistence.
			const schedule =
				carryingValue === salvageValue
					? { entries: [], ratePercent: null }
					: buildDepreciationSchedule({
							financeBookId: book.financeBookId,
							method: book.depreciationMethod,
							grossBookValue: carryingValue,
							availableForUseDate: effectiveDateOnly,
							depreciationStartDate: effectiveDateOnly,
							totalPeriods: remainingPeriods,
							frequencyMonths: book.frequencyOfDepreciation,
							salvageValue,
							ratePercent:
								book.rateOfDepreciation == null
									? undefined
									: decimalNumber(book.rateOfDepreciation),
							dailyProrata: book.dailyProrataBased,
						});

			const cancelledSchedule = await tx.assetDepreciationSchedule.updateMany({
				where: {
					id: activeSchedule.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: { status: "CANCELLED" },
			});
			if (cancelledSchedule.count !== 1) {
				throw new AssetDepreciationRevisionError(
					`The active depreciation schedule for finance book ${book.financeBookId} is not available in the active organization.`,
				);
			}
			const updatedBook = await tx.assetFinanceBook.updateMany({
				where: {
					id: book.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: {
					increaseInAssetLife,
					valueAfterDepreciation: carryingValue,
					expectedValueAfterUsefulLife: salvageValue,
					depreciationStartDate: effectiveDate,
					rateOfDepreciation: schedule.ratePercent,
					postingStatus:
						schedule.entries.length === 0
							? "FULLY_DEPRECIATED"
							: bookedPeriods > 0
								? "PARTIALLY_DEPRECIATED"
								: "PENDING",
				},
			});
			if (updatedBook.count !== 1) {
				throw new AssetDepreciationRevisionError(
					`Finance book ${book.financeBookId} is not available in the active organization.`,
				);
			}
			const successor = await tx.assetDepreciationSchedule.create({
				data: {
					adjustmentId: input.adjustmentId,
					assetId: input.assetId,
					assetFinanceBookId: book.id,
					previousScheduleId: activeSchedule.id,
					revisionNumber: activeSchedule.revisionNumber + 1,
					status: "ACTIVE",
					startDate: effectiveDate,
					depreciationMethod: book.depreciationMethod,
					totalNumberOfDepreciations: totalPeriods,
					frequencyOfDepreciation: book.frequencyOfDepreciation,
					dailyProrataBased: book.dailyProrataBased,
					shiftBased: book.shiftBased,
					rateOfDepreciation: schedule.ratePercent,
					expectedValueAfterUsefulLife: salvageValue,
					bookedDepreciations: bookedPeriods,
					remainingDepreciations: schedule.entries.length,
					openingAccumulatedDepreciation,
					baseAssetValue: carryingValue,
					notes: input.notes ?? null,
					entries: {
						create: schedule.entries.map((entry) => ({
							sequence: bookedPeriods + entry.periodNumber,
							scheduleDate: dateOnlyUtc(entry.date),
							depreciationAmount: entry.depreciationAmount,
							accumulatedDepreciationAmount:
								openingAccumulatedDepreciation + entry.accumulatedDepreciation,
							bookValueAfterDepreciation: entry.bookValueAfterDepreciation,
						})),
					},
				},
				select: { id: true },
			});
			revisions.push({
				assetFinanceBookId: book.id,
				previousScheduleId: activeSchedule.id,
				scheduleId: successor.id,
				carryingValue,
				totalNumberOfDepreciations: totalPeriods,
				increaseInAssetLife,
				remainingDepreciations: schedule.entries.length,
			});
		}

		return revisions;
	}

	/**
	 * Cancels one unposted successor revision and restores its predecessor and
	 * finance-book cursor. This is intentionally stricter than a general
	 * reschedule so cancellation cannot rewrite posted depreciation history.
	 */
	async restoreRevision(
		tx: RevisionTransaction,
		organizationId: AssetOrganizationId,
		input: RestoreAssetDepreciationRevisionInput,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		if (!input.assetId.trim() || !input.financeBookId.trim()) {
			throw new AssetDepreciationRevisionError(
				"assetId and financeBookId are required to restore a revision.",
			);
		}
		assertFinite(
			"previousValueAfterDepreciation",
			input.previousValueAfterDepreciation,
		);
		const books = await this.loadLockedBooks(
			tx,
			organizationId,
			input.assetId,
			input.financeBookId,
		);
		const book = books[0];
		if (!book) {
			throw new AssetDepreciationRevisionError(
				`Finance book ${input.financeBookId} is not configured for this asset.`,
			);
		}

		const revision = await tx.assetDepreciationSchedule.findFirst({
			where: {
				id: input.scheduleId,
				asset: { is: assetWhereForOrganization(organizationId) },
				assetFinanceBook: {
					asset: { is: assetWhereForOrganization(organizationId) },
				},
			},
			select: {
				id: true,
				assetId: true,
				assetFinanceBookId: true,
				status: true,
				previousScheduleId: true,
				entries: {
					where: { postingId: { not: null } },
					select: { id: true },
					take: 1,
				},
				previousSchedule: {
					select: {
						id: true,
						status: true,
						startDate: true,
						depreciationMethod: true,
						totalNumberOfDepreciations: true,
						frequencyOfDepreciation: true,
						dailyProrataBased: true,
						shiftBased: true,
						rateOfDepreciation: true,
						expectedValueAfterUsefulLife: true,
						bookedDepreciations: true,
						remainingDepreciations: true,
						baseAssetValue: true,
					},
				},
				nextSchedules: {
					where: { asset: { is: assetWhereForOrganization(organizationId) } },
					select: { id: true },
					take: 1,
				},
			},
		});
		if (
			!revision ||
			revision.assetId !== input.assetId ||
			revision.assetFinanceBookId !== book.id
		) {
			throw new AssetDepreciationRevisionError(
				"The depreciation revision does not belong to the selected asset finance book.",
			);
		}
		if (revision.status !== "ACTIVE") {
			throw new AssetDepreciationRevisionError(
				"Only the active depreciation revision can be restored.",
			);
		}
		if (!revision.previousScheduleId || !revision.previousSchedule) {
			throw new AssetDepreciationRevisionError(
				"The depreciation revision has no predecessor to restore.",
			);
		}
		if (revision.entries.length > 0 || revision.nextSchedules.length > 0) {
			throw new AssetDepreciationRevisionError(
				"The depreciation revision cannot be restored after it was posted or superseded.",
			);
		}

		const predecessor = revision.previousSchedule;
		if (predecessor.status !== "CANCELLED") {
			throw new AssetDepreciationRevisionError(
				"The predecessor depreciation schedule is not closed.",
			);
		}
		if (!predecessor.depreciationMethod) {
			throw new AssetDepreciationRevisionError(
				"The predecessor depreciation schedule has no depreciation method.",
			);
		}
		const remainingEntries = await tx.assetDepreciationScheduleEntry.count({
			where: {
				scheduleId: predecessor.id,
				postingId: null,
				schedule: { asset: { is: assetWhereForOrganization(organizationId) } },
			},
		});
		const cancelledRevision = await tx.assetDepreciationSchedule.updateMany({
			where: {
				id: revision.id,
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			data: { status: "CANCELLED" },
		});
		if (cancelledRevision.count !== 1) {
			throw new AssetDepreciationRevisionError(
				"The depreciation revision is no longer available in the active organization.",
			);
		}
		const reactivatedPredecessor =
			await tx.assetDepreciationSchedule.updateMany({
				where: {
					id: predecessor.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: { status: "ACTIVE" },
			});
		if (reactivatedPredecessor.count !== 1) {
			throw new AssetDepreciationRevisionError(
				"The predecessor depreciation schedule is no longer available in the active organization.",
			);
		}
		const restoredBook = await tx.assetFinanceBook.updateMany({
			where: {
				id: book.id,
				asset: { is: assetWhereForOrganization(organizationId) },
			},
			data: {
				depreciationMethod: predecessor.depreciationMethod,
				totalNumberOfDepreciations: predecessor.totalNumberOfDepreciations,
				frequencyOfDepreciation: predecessor.frequencyOfDepreciation,
				depreciationStartDate: predecessor.startDate,
				dailyProrataBased: predecessor.dailyProrataBased,
				shiftBased: predecessor.shiftBased,
				rateOfDepreciation: predecessor.rateOfDepreciation,
				expectedValueAfterUsefulLife:
					predecessor.expectedValueAfterUsefulLife ?? 0,
				valueAfterDepreciation: input.previousValueAfterDepreciation,
				postingStatus:
					remainingEntries === 0
						? "FULLY_DEPRECIATED"
						: book.totalNumberOfBookedDepreciations > 0
							? "PARTIALLY_DEPRECIATED"
							: "PENDING",
			},
		});
		if (restoredBook.count !== 1) {
			throw new AssetDepreciationRevisionError(
				`Finance book ${book.financeBookId} is no longer available in the active organization.`,
			);
		}
	}

	/** Cancels active schedules for disposal while retaining every schedule row. */
	async closeOpenSchedules(
		tx: RevisionTransaction,
		organizationId: AssetOrganizationId,
		assetId: string,
		financeBookId?: string,
	): Promise<number> {
		assertAssetOrganizationId(organizationId);
		const books = await this.loadLockedBooks(
			tx,
			organizationId,
			assetId,
			financeBookId,
		);
		let closed = 0;
		for (const book of books) {
			const result = await tx.assetDepreciationSchedule.updateMany({
				where: {
					assetFinanceBookId: book.id,
					status: "ACTIVE",
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: { status: "CANCELLED" },
			});
			closed += result.count;
		}
		return closed;
	}

	/** Reactivates the latest closed schedule after a reversible lifecycle close. */
	async reactivateLatestClosedSchedules(
		tx: RevisionTransaction,
		organizationId: AssetOrganizationId,
		assetId: string,
		financeBookId?: string,
	): Promise<number> {
		assertAssetOrganizationId(organizationId);
		const books = await this.loadLockedBooks(
			tx,
			organizationId,
			assetId,
			financeBookId,
		);
		let reactivated = 0;
		for (const book of books) {
			if (book.schedules.length > 0) {
				throw new AssetDepreciationRevisionError(
					`An active depreciation schedule already exists for finance book ${book.financeBookId}.`,
				);
			}
			const latestClosed = await tx.assetDepreciationSchedule.findFirst({
				where: {
					assetFinanceBookId: book.id,
					status: "CANCELLED",
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				select: { id: true, revisionNumber: true },
				orderBy: [{ revisionNumber: "desc" }, { createdAt: "desc" }],
			});
			if (!latestClosed) {
				throw new AssetDepreciationRevisionError(
					`No closed depreciation schedule exists for finance book ${book.financeBookId}.`,
				);
			}
			const newerSchedule = await tx.assetDepreciationSchedule.findFirst({
				where: {
					assetFinanceBookId: book.id,
					revisionNumber: { gt: latestClosed.revisionNumber },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				select: { id: true },
			});
			if (newerSchedule) {
				throw new AssetDepreciationRevisionError(
					`The latest closed schedule for finance book ${book.financeBookId} has a newer successor.`,
				);
			}
			const reactivation = await tx.assetDepreciationSchedule.updateMany({
				where: {
					id: latestClosed.id,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: { status: "ACTIVE" },
			});
			if (reactivation.count !== 1) {
				throw new AssetDepreciationRevisionError(
					`The closed depreciation schedule for finance book ${book.financeBookId} is no longer available in the active organization.`,
				);
			}
			reactivated += 1;
		}
		return reactivated;
	}

	private validateInput(input: AssetDepreciationRevisionInput): void {
		if (!input.assetId.trim()) {
			throw new AssetDepreciationRevisionError("assetId is required.");
		}
		if (Number.isNaN(input.effectiveDate.getTime())) {
			throw new AssetDepreciationRevisionError("effectiveDate is invalid.");
		}
		assertFinite("valueDelta", input.valueDelta);
		assertFinite("salvageValueDelta", input.salvageValueDelta ?? 0);
		assertFinite("usefulLifeDeltaMonths", input.usefulLifeDeltaMonths);
		if (!Number.isInteger(input.usefulLifeDeltaMonths)) {
			throw new AssetDepreciationRevisionError(
				"usefulLifeDeltaMonths must be a whole number of months.",
			);
		}
	}

	private async loadLockedBooks(
		tx: RevisionTransaction,
		organizationId: AssetOrganizationId,
		assetId: string,
		financeBookId?: string,
	): Promise<RevisionBook[]> {
		await lockAssetAndFinanceBooks(tx, [assetId], []);
		const bookIds = await tx.assetFinanceBook.findMany({
			where: {
				assetId,
				asset: { is: assetWhereForOrganization(organizationId) },
				...(financeBookId ? { financeBookId } : {}),
			},
			select: { id: true },
			orderBy: { id: "asc" },
		});
		if (financeBookId && bookIds.length === 0) {
			throw new AssetDepreciationRevisionError(
				`Finance book ${financeBookId} is not configured for this asset.`,
			);
		}
		await lockAssetAndFinanceBooks(
			tx,
			[assetId],
			bookIds.map((book) => book.id),
		);
		return tx.assetFinanceBook.findMany({
			where: {
				assetId,
				asset: { is: assetWhereForOrganization(organizationId) },
				...(financeBookId ? { financeBookId } : {}),
			},
			include: {
				schedules: {
					where: { status: "ACTIVE" },
					select: { id: true, revisionNumber: true },
					orderBy: { revisionNumber: "desc" },
				},
			},
			orderBy: { id: "asc" },
		}) as Promise<RevisionBook[]>;
	}

	private requireSingleActiveSchedule(book: RevisionBook): ActiveSchedule {
		const activeSchedule = book.schedules.at(0);
		if (!activeSchedule) {
			throw new AssetDepreciationRevisionError(
				`No active depreciation schedule exists for finance book ${book.financeBookId}.`,
			);
		}
		if (book.schedules.length > 1) {
			throw new AssetDepreciationRevisionError(
				`More than one active depreciation schedule exists for finance book ${book.financeBookId}.`,
			);
		}
		return activeSchedule;
	}
}
