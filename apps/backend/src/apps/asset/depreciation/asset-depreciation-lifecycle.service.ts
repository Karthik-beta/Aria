import type { Asset } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import { lockAssetAndFinanceBooks } from "../asset-locking";
import {
	type AssetOrganizationId,
	assertAssetOrganizationId,
	assetWhereForOrganization,
} from "../asset-organization-scope";
import {
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
	normalizeDateOnly,
} from "./depreciation.config";
import {
	assertFiniteDepreciationSchedule,
	assertFiniteDepreciationValue,
	assertSupportedDepreciationOptions,
	buildDepreciationSchedule,
	type DepreciationBookInput,
} from "./depreciation-schedule-engine";

const BACKFILL_PAGE_SIZE = 100;
const SUBMITTED_ASSET_STATUSES = new Set([
	"SUBMITTED",
	"PARTIALLY_DEPRECIATED",
	"FULLY_DEPRECIATED",
]);
const CANCELLABLE_ASSET_STATUSES = new Set([
	"SUBMITTED",
	"PARTIALLY_DEPRECIATED",
	"FULLY_DEPRECIATED",
]);

type BookConfiguration = Asset.AssetFinanceBookInput;

/**
 * Owns depreciation-book and schedule generation during the asset lifecycle.
 * Discovery invokes only the backfill entry point before looking for due rows;
 * all amounts are calculated and persisted here, never in the scheduler.
 */
@Injectable()
export class AssetDepreciationLifecycleService {
	private readonly logger = new Logger(AssetDepreciationLifecycleService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Submits a draft Asset using one lock-held transaction for configuration,
	 * schedule activation, state transition, and activity attribution.
	 */
	async submitAsset(
		assetId: string,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		await this.prisma.$transaction(async (tx) => {
			await this.lockAssetBooks(tx, assetId);
			await this.lockLinkedLifecycleDocuments(tx, assetId);
			let asset = await this.loadAsset(assetId, organizationId, tx);
			if (SUBMITTED_ASSET_STATUSES.has(asset.status)) return;
			if (asset.status !== "DRAFT") {
				throw new BadRequestException(
					`Asset ${assetId} cannot be submitted from status ${asset.status}`,
				);
			}

			await this.validateSubmissionPrerequisites(tx, asset, organizationId);
			await this.configureAssetBooksInTransaction(
				tx,
				assetId,
				undefined,
				organizationId,
				asset,
			);
			asset = await this.loadAsset(assetId, organizationId, tx);
			if (asset.calculateDepreciation && asset.financeBooks.length === 0) {
				throw new BadRequestException(
					"At least one finance book is required for a depreciable asset",
				);
			}
			this.assertScheduleDateContract(
				asset,
				asset.financeBooks.map((book) => ({
					depreciationStartDate: dateOnlyFromPersistedDateTime(
						book.depreciationStartDate,
					),
				})),
			);
			await tx.assetDepreciationSchedule.updateMany({
				where: {
					assetId,
					status: "DRAFT",
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: { status: "ACTIVE" },
			});
			const transitioned = await tx.asset.updateMany({
				where: assetWhereForOrganization(organizationId, {
					id: assetId,
					status: "DRAFT",
				}),
				data: { status: "SUBMITTED" },
			});
			if (transitioned.count !== 1) {
				throw new ConflictException(
					`Asset ${assetId} changed before it could be submitted`,
				);
			}
			await tx.assetActivity.create({
				data: {
					assetId,
					activity: "Asset submitted for depreciation",
					userId: actorId ?? null,
				},
			});
		});
	}

	/**
	 * Cancels an eligible Asset after re-reading its locked state and proving
	 * that no linked posted effect would be orphaned by the transition.
	 */
	async cancelAsset(
		assetId: string,
		organizationId: AssetOrganizationId,
		actorId?: string | null,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		await this.prisma.$transaction(async (tx) => {
			await this.lockAssetBooks(tx, assetId);
			await this.lockLinkedLifecycleDocuments(tx, assetId);
			const asset = await this.loadAsset(assetId, organizationId, tx);
			if (asset.status === "CANCELLED") return;
			if (!CANCELLABLE_ASSET_STATUSES.has(asset.status)) {
				if (
					asset.status === "IN_MAINTENANCE" ||
					asset.status === "OUT_OF_ORDER"
				) {
					throw new BadRequestException(
						"There are active maintenance or repairs against the asset. Complete them before cancelling the asset.",
					);
				}
				throw new BadRequestException(
					`Asset ${asset.series} cannot be cancelled from status ${asset.status}`,
				);
			}
			await this.validateCancellationEffects(
				tx,
				assetId,
				organizationId,
				asset.companyId,
			);
			await tx.assetDepreciationSchedule.updateMany({
				where: {
					assetId,
					status: { in: ["DRAFT", "ACTIVE"] },
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				data: { status: "CANCELLED" },
			});
			const transitioned = await tx.asset.updateMany({
				where: assetWhereForOrganization(organizationId, {
					id: assetId,
					status: {
						in: ["SUBMITTED", "PARTIALLY_DEPRECIATED", "FULLY_DEPRECIATED"],
					},
				}),
				data: { status: "CANCELLED" },
			});
			if (transitioned.count !== 1) {
				throw new ConflictException(
					`Asset ${asset.series} changed before it could be cancelled`,
				);
			}
			await tx.assetActivity.create({
				data: {
					assetId,
					activity: "Asset cancelled",
					userId: actorId ?? null,
				},
			});
		});
	}

	/** Replaces draft book configuration and generates immutable schedule rows. */
	async configureAssetBooks(
		assetId: string,
		books: readonly BookConfiguration[] | undefined,
		organizationId: AssetOrganizationId,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		await this.prisma.$transaction(async (tx) => {
			await this.lockAssetBooks(tx, assetId);
			await this.configureAssetBooksInTransaction(
				tx,
				assetId,
				books,
				organizationId,
			);
		});
	}

	/** Applies book configuration inside a caller-owned locked transaction. */
	async configureAssetBooksWithTransaction(
		tx: Prisma.TransactionClient,
		assetId: string,
		books: readonly BookConfiguration[] | undefined,
		organizationId: AssetOrganizationId,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		await this.configureAssetBooksInTransaction(
			tx,
			assetId,
			books,
			organizationId,
		);
	}

	private async configureAssetBooksInTransaction(
		tx: Prisma.TransactionClient,
		assetId: string,
		books: readonly BookConfiguration[] | undefined,
		organizationId: AssetOrganizationId,
		assetSnapshot?: Awaited<
			ReturnType<AssetDepreciationLifecycleService["loadAsset"]>
		>,
	): Promise<void> {
		const asset =
			assetSnapshot ?? (await this.loadAsset(assetId, organizationId, tx));
		const configurations = books?.length
			? [...books]
			: this.resolveDefaultBooks(asset);

		if (!asset.calculateDepreciation) return;
		if (configurations.length === 0) {
			if (asset.status !== "DRAFT") {
				throw new BadRequestException(
					"A default finance book and depreciation configuration are required before submitting this asset",
				);
			}
			return;
		}
		this.assertScheduleDateContract(asset, configurations);

		const duplicateBook = configurations.find(
			(book, index) =>
				configurations.findIndex(
					(candidate) => candidate.financeBookId === book.financeBookId,
				) !== index,
		);
		if (duplicateBook) {
			throw new BadRequestException(
				`Finance book ${duplicateBook.financeBookId} is configured more than once`,
			);
		}

		const ownedAsset = await tx.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id: assetId }),
			select: { id: true },
		});
		if (!ownedAsset) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}
		if (books !== undefined) {
			const postedCount = await tx.assetDepreciationJournalEntry.count({
				where: {
					assetId,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
			});
			if (postedCount > 0) {
				throw new BadRequestException(
					"Posted depreciation exists; use a supported rescheduling or value-adjustment workflow",
				);
			}
			await tx.assetDepreciationSchedule.deleteMany({
				where: {
					assetId,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
			});
			await tx.assetFinanceBook.deleteMany({
				where: {
					assetId,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
			});
		}

		for (const configuration of configurations) {
			this.validateBookConfiguration(configuration);
			const existing = await tx.assetFinanceBook.findFirst({
				where: {
					assetId,
					financeBookId: configuration.financeBookId,
					asset: { is: assetWhereForOrganization(organizationId) },
				},
				include: {
					schedules: {
						where: { status: { in: ["DRAFT", "ACTIVE"] } },
						select: {
							id: true,
							revisionNumber: true,
							_count: { select: { entries: true } },
						},
						take: 1,
					},
				},
			});
			const existingSchedule = existing?.schedules[0];
			if ((existingSchedule?._count.entries ?? 0) > 0) continue;

			const schedule = this.calculateSchedule(asset, configuration);
			assertFiniteDepreciationSchedule(schedule);
			const effectiveRate = schedule.ratePercent;
			const carryingValue =
				asset.netPurchaseAmount -
				(configuration.openingAccumulatedDepreciation ?? 0);
			assertFiniteDepreciationValue("carrying value", carryingValue);
			const postingStatus =
				schedule.entries.length === 0
					? "FULLY_DEPRECIATED"
					: (configuration.openingNumberOfBookedDepreciations ?? 0) > 0
						? "PARTIALLY_DEPRECIATED"
						: "PENDING";
			const book =
				existing ??
				(await tx.assetFinanceBook.create({
					data: {
						assetId,
						financeBookId: configuration.financeBookId,
						depreciationMethod: configuration.depreciationMethod,
						totalNumberOfDepreciations:
							configuration.totalNumberOfDepreciations,
						frequencyOfDepreciation: configuration.frequencyOfDepreciation,
						dailyProrataBased: configuration.dailyProrataBased ?? false,
						shiftBased: configuration.shiftBased ?? false,
						precision: configuration.precision ?? 2,
						ratePrecision: configuration.ratePrecision ?? 2,
						calculateUsingTotalDays:
							configuration.calculateUsingTotalDays ?? false,
						rateOfDepreciation:
							effectiveRate == null ? null : new Prisma.Decimal(effectiveRate),
						expectedValueAfterUsefulLife: new Prisma.Decimal(
							configuration.expectedValueAfterUsefulLife ?? 0,
						),
						depreciationStartDate: dateOnlyUtc(
							normalizeDateOnly(configuration.depreciationStartDate),
						),
						openingAccumulatedDepreciation: new Prisma.Decimal(
							configuration.openingAccumulatedDepreciation ?? 0,
						),
						openingNumberOfBookedDepreciations:
							configuration.openingNumberOfBookedDepreciations ?? 0,
						valueAfterDepreciation: new Prisma.Decimal(carryingValue),
						totalNumberOfBookedDepreciations:
							configuration.openingNumberOfBookedDepreciations ?? 0,
						postingStatus,
					},
				}));

			if (existing) {
				const updatedBook = await tx.assetFinanceBook.updateMany({
					where: {
						id: existing.id,
						asset: { is: assetWhereForOrganization(organizationId) },
					},
					data: {
						dailyProrataBased: configuration.dailyProrataBased ?? false,
						shiftBased: configuration.shiftBased ?? false,
						rateOfDepreciation: effectiveRate,
						precision: configuration.precision ?? 2,
						ratePrecision: configuration.ratePrecision ?? 2,
						calculateUsingTotalDays:
							configuration.calculateUsingTotalDays ?? false,
						valueAfterDepreciation: new Prisma.Decimal(carryingValue),
						totalNumberOfBookedDepreciations:
							configuration.openingNumberOfBookedDepreciations ?? 0,
						stateVersion: { increment: 1 },
						postingStatus,
					},
				});
				if (updatedBook.count !== 1) {
					throw new BadRequestException(
						"Asset finance book is not available in the active organization",
					);
				}
			}
			await tx.assetFinanceBookShiftAllocation.deleteMany({
				where: { assetFinanceBookId: book.id },
			});
			if (configuration.shiftAllocations?.length) {
				await tx.assetFinanceBookShiftAllocation.createMany({
					data: configuration.shiftAllocations.map((allocation) => ({
						assetFinanceBookId: book.id,
						periodIndex: allocation.periodIndex,
						shift: allocation.shift.trim(),
						factor: new Prisma.Decimal(allocation.factor),
					})),
				});
			}

			const scheduleData: Prisma.AssetDepreciationScheduleUncheckedCreateInput =
				{
					assetId,
					assetFinanceBookId: book.id,
					revisionNumber: existingSchedule?.revisionNumber ?? 1,
					status: asset.status === "DRAFT" ? "DRAFT" : "ACTIVE",
					startDate: dateOnlyUtc(
						normalizeDateOnly(configuration.depreciationStartDate),
					),
					depreciationMethod: configuration.depreciationMethod,
					totalNumberOfDepreciations: configuration.totalNumberOfDepreciations,
					frequencyOfDepreciation: configuration.frequencyOfDepreciation,
					dailyProrataBased: configuration.dailyProrataBased ?? false,
					shiftBased: configuration.shiftBased ?? false,
					precision: configuration.precision ?? 2,
					ratePrecision: configuration.ratePrecision ?? 2,
					calculateUsingTotalDays:
						configuration.calculateUsingTotalDays ?? false,
					rateOfDepreciation: effectiveRate,
					expectedValueAfterUsefulLife:
						configuration.expectedValueAfterUsefulLife ?? 0,
					bookedDepreciations:
						configuration.openingNumberOfBookedDepreciations ?? 0,
					remainingDepreciations: schedule.entries.length,
					openingAccumulatedDepreciation:
						configuration.openingAccumulatedDepreciation ?? 0,
					baseAssetValue: asset.netPurchaseAmount,
					notes: "ERPNext-aligned base depreciation schedule",
					entries: {
						create: schedule.entries.map((entry) => ({
							sequence: entry.periodNumber,
							scheduleDate: dateOnlyUtc(entry.date),
							depreciationAmount: entry.depreciationAmount,
							accumulatedDepreciationAmount: entry.accumulatedDepreciation,
							bookValueAfterDepreciation: entry.bookValueAfterDepreciation,
							shift: entry.shift,
						})),
					},
				};
			if (existingSchedule) {
				await tx.assetDepreciationSchedule.update({
					where: {
						id: existingSchedule.id,
						asset: { is: assetWhereForOrganization(organizationId) },
					},
					data: scheduleData,
				});
			} else {
				await tx.assetDepreciationSchedule.create({ data: scheduleData });
			}
		}

		// Asset.valueAfterDepreciation is a compatibility projection, never a
		// cross-book aggregate. Keep it synchronized in this same transaction so
		// a secondary book can never overwrite the Company's presentation book.
		const projectionState = await tx.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id: assetId }),
			select: {
				status: true,
				calculateDepreciation: true,
				company: { select: { defaultFinanceBookId: true } },
				financeBooks: {
					select: {
						financeBookId: true,
						valueAfterDepreciation: true,
						postingStatus: true,
					},
					orderBy: { createdAt: "asc" },
				},
			},
		});
		if (!projectionState?.calculateDepreciation) return;
		const projectionBook = projectionState.company.defaultFinanceBookId
			? projectionState.financeBooks.find(
					(book) =>
						book.financeBookId === projectionState.company.defaultFinanceBookId,
				)
			: projectionState.financeBooks.length === 1
				? projectionState.financeBooks[0]
				: null;
		if (!projectionBook) {
			throw new BadRequestException(
				`A Company default finance book is required to project asset ${assetId}.`,
			);
		}
		const projected = await tx.asset.updateMany({
			where: assetWhereForOrganization(organizationId, { id: assetId }),
			data: {
				valueAfterDepreciation: projectionBook.valueAfterDepreciation,
				isFullyDepreciated:
					projectionBook.postingStatus === "FULLY_DEPRECIATED",
			},
		});
		if (projected.count !== 1) {
			throw new ConflictException(
				`Asset ${assetId} changed while finance-book state was being configured`,
			);
		}
	}

	/** Generates missing base schedules for migrated submitted assets in pages. */
	async ensureSubmittedSchedules(): Promise<number> {
		let cursor: string | undefined;
		let generated = 0;
		for (;;) {
			const books = await this.prisma.assetFinanceBook.findMany({
				where: {
					asset: {
						status: { in: ["SUBMITTED", "PARTIALLY_DEPRECIATED"] },
						calculateDepreciation: true,
					},
					schedules: {
						none: {
							status: { in: ["DRAFT", "ACTIVE"] },
							entries: { some: {} },
						},
					},
				},
				select: {
					id: true,
					assetId: true,
					asset: { select: { company: { select: { organizationId: true } } } },
				},
				orderBy: { id: "asc" },
				take: BACKFILL_PAGE_SIZE,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			});
			if (books.length === 0) break;
			for (const book of books) {
				await this.configureAssetBooks(
					book.assetId,
					undefined,
					book.asset.company.organizationId,
				);
				generated += 1;
			}
			cursor = books.at(-1)?.id;
		}
		if (generated > 0) {
			this.logger.log(`Generated ${generated} missing depreciation schedules`);
		}
		return generated;
	}

	private async validateSubmissionPrerequisites(
		tx: Prisma.TransactionClient,
		asset: Awaited<ReturnType<AssetDepreciationLifecycleService["loadAsset"]>>,
		organizationId: AssetOrganizationId,
	): Promise<void> {
		if (asset.assetType === "COMPOSITE_ASSET") {
			const activeCapitalization = await tx.assetCapitalization.findFirst({
				where: {
					targetAssetId: asset.id,
					status: "SUBMITTED",
					company: { is: { id: asset.companyId, organizationId } },
				},
				select: { id: true },
			});
			if (!activeCapitalization) {
				throw new BadRequestException(
					"Please capitalize this asset before submitting it.",
				);
			}
		}

		if (
			asset.assetType !== "COMPOSITE_COMPONENT" &&
			!asset.availableForUseDate
		) {
			throw new BadRequestException(
				"Available-for-use date is required before submitting an asset",
			);
		}

		if (asset.calculateDepreciation) {
			this.assertScheduleDateContract(asset, this.resolveDefaultBooks(asset));
		}
	}

	private assertScheduleDateContract(
		asset: Awaited<ReturnType<AssetDepreciationLifecycleService["loadAsset"]>>,
		configurations: readonly Pick<BookConfiguration, "depreciationStartDate">[],
	): void {
		if (!asset.calculateDepreciation) return;
		const availableForUseDate = this.resolveAvailableForUseDate(asset);
		if (!availableForUseDate) return;

		for (const configuration of configurations) {
			const depreciationStartDate = normalizeDateOnly(
				configuration.depreciationStartDate,
			);
			if (depreciationStartDate < availableForUseDate) {
				throw new BadRequestException(
					`Depreciation start date ${depreciationStartDate} cannot be before available-for-use date ${availableForUseDate}`,
				);
			}
		}

		for (const schedule of asset.depreciationSchedules ?? []) {
			const scheduleStartDate = dateOnlyFromPersistedDateTime(
				schedule.startDate,
			);
			if (scheduleStartDate < availableForUseDate) {
				throw new BadRequestException(
					`Depreciation schedule ${scheduleStartDate} cannot begin before available-for-use date ${availableForUseDate}`,
				);
			}
		}
	}

	private resolveAvailableForUseDate(
		asset: Awaited<ReturnType<AssetDepreciationLifecycleService["loadAsset"]>>,
	): string | null {
		if (asset.availableForUseDate) {
			return dateOnlyFromPersistedDateTime(asset.availableForUseDate);
		}
		if (asset.assetType === "COMPOSITE_COMPONENT") {
			return dateOnlyFromPersistedDateTime(asset.purchaseDate);
		}
		return null;
	}

	private async validateCancellationEffects(
		tx: Prisma.TransactionClient,
		assetId: string,
		organizationId: AssetOrganizationId,
		companyId: string,
	): Promise<void> {
		const postedDepreciation = await tx.assetDepreciationJournalEntry.count({
			where: {
				assetId,
				status: "POSTED",
				asset: { is: assetWhereForOrganization(organizationId) },
			},
		});
		const activeRepairs = await tx.assetRepair.count({
			where: {
				assetId,
				repairStatus: { in: ["PENDING", "COMPLETED"] },
				asset: { is: assetWhereForOrganization(organizationId) },
			},
		});
		const activeMaintenanceTasks = await tx.assetMaintenanceTask.count({
			where: {
				maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
				maintenance: {
					is: {
						assetId,
						asset: { is: assetWhereForOrganization(organizationId) },
					},
				},
			},
		});
		const submittedMovements = await tx.assetMovement.count({
			where: {
				status: "SUBMITTED",
				company: { is: { organizationId } },
				items: { some: { assetId } },
			},
		});
		const submittedCapitalizations = await tx.assetCapitalization.count({
			where: {
				status: "SUBMITTED",
				company: { is: { id: companyId, organizationId } },
				OR: [{ targetAssetId: assetId }, { assetItems: { some: { assetId } } }],
			},
		});
		const postedDisposals = await tx.assetDisposal.count({
			where: {
				assetId,
				status: "POSTED",
				asset: { is: assetWhereForOrganization(organizationId) },
			},
		});
		const submittedAdjustments = await tx.assetValueAdjustment.count({
			where: {
				assetId,
				status: "SUBMITTED",
				asset: { is: assetWhereForOrganization(organizationId) },
			},
		});
		const postedRevaluations = await tx.assetRevaluationEntry.count({
			where: {
				assetId,
				status: "POSTED",
				asset: { is: assetWhereForOrganization(organizationId) },
			},
		});
		const postedAccounting = await tx.assetAccountingEntry.count({
			where: {
				assetId,
				status: "POSTED",
				asset: { is: assetWhereForOrganization(organizationId) },
			},
		});

		if (postedDepreciation > 0) {
			throw new BadRequestException(
				"Posted depreciation must be reversed before cancelling the asset",
			);
		}
		if (activeRepairs > 0 || activeMaintenanceTasks > 0) {
			throw new BadRequestException(
				"There are active maintenance or repairs against the asset. Complete them before cancelling the asset.",
			);
		}
		if (submittedMovements > 0) {
			throw new BadRequestException(
				"Submitted asset movements must be cancelled before cancelling the asset",
			);
		}
		if (submittedCapitalizations > 0) {
			throw new BadRequestException(
				"Submitted capitalization effects must be cancelled before cancelling the asset",
			);
		}
		if (postedDisposals > 0) {
			throw new BadRequestException(
				"Posted disposal effects must be reversed before cancelling the asset",
			);
		}
		if (submittedAdjustments > 0 || postedRevaluations > 0) {
			throw new BadRequestException(
				"Submitted value adjustments must be cancelled before cancelling the asset",
			);
		}
		if (postedAccounting > 0) {
			throw new BadRequestException(
				"Posted accounting effects must be reversed before cancelling the asset",
			);
		}
	}

	/** Rejects unsupported option combinations before any book row is written. */
	private validateBookConfiguration(book: BookConfiguration): void {
		try {
			for (const [name, value] of [
				["precision", book.precision ?? 2],
				["ratePrecision", book.ratePrecision ?? 2],
			] as const) {
				if (!Number.isInteger(value) || value < 0 || value > 6) {
					throw new Error(`${name} must be an integer between zero and 6`);
				}
			}
			assertSupportedDepreciationOptions({
				method: book.depreciationMethod,
				totalPeriods: book.totalNumberOfDepreciations,
				dailyProrata: book.dailyProrataBased ?? false,
				shiftBased: book.shiftBased ?? false,
				calculateUsingTotalDays: book.calculateUsingTotalDays ?? false,
				shiftAllocations: book.shiftAllocations,
			});
		} catch (error) {
			throw new BadRequestException(
				error instanceof Error
					? error.message
					: "Unsupported depreciation options",
			);
		}
	}

	private calculateSchedule(
		asset: Awaited<ReturnType<AssetDepreciationLifecycleService["loadAsset"]>>,
		book: BookConfiguration,
	) {
		const availableForUseDate = this.resolveAvailableForUseDate(asset);
		if (!availableForUseDate) {
			throw new BadRequestException(
				"Available-for-use date is required before calculating depreciation",
			);
		}
		const input: DepreciationBookInput = {
			financeBookId: book.financeBookId,
			method: book.depreciationMethod,
			grossBookValue: asset.netPurchaseAmount,
			availableForUseDate,
			depreciationStartDate: normalizeDateOnly(book.depreciationStartDate),
			totalPeriods: book.totalNumberOfDepreciations,
			frequencyMonths: book.frequencyOfDepreciation,
			salvageValue: book.expectedValueAfterUsefulLife ?? 0,
			openingBookedPeriods: book.openingNumberOfBookedDepreciations ?? 0,
			openingAccumulatedDepreciation: book.openingAccumulatedDepreciation ?? 0,
			ratePercent: book.rateOfDepreciation ?? undefined,
			dailyProrata: book.dailyProrataBased ?? false,
			shiftBased: book.shiftBased ?? false,
			calculateUsingTotalDays: book.calculateUsingTotalDays ?? false,
			precision: book.precision ?? 2,
			ratePrecision: book.ratePrecision ?? 2,
			shiftAllocations: book.shiftAllocations,
			manualEntries: book.manualEntries?.map((entry) => ({
				date: normalizeDateOnly(entry.date),
				amount: entry.amount,
				shift: entry.shift,
			})),
		};
		return buildDepreciationSchedule(input);
	}

	private resolveDefaultBooks(
		asset: Awaited<ReturnType<AssetDepreciationLifecycleService["loadAsset"]>>,
	): BookConfiguration[] {
		if (asset.financeBooks.length) {
			return asset.financeBooks.map((book) => ({
				financeBookId: book.financeBookId,
				depreciationMethod: book.depreciationMethod as Asset.DepreciationMethod,
				totalNumberOfDepreciations: book.totalNumberOfDepreciations,
				frequencyOfDepreciation: book.frequencyOfDepreciation,
				depreciationStartDate: dateOnlyFromPersistedDateTime(
					book.depreciationStartDate,
				),
				dailyProrataBased: book.dailyProrataBased,
				shiftBased: book.shiftBased,
				precision: book.precision,
				ratePrecision: book.ratePrecision,
				calculateUsingTotalDays: book.calculateUsingTotalDays,
				shiftAllocations: (book.shiftAllocations ?? []).map((allocation) => ({
					periodIndex: allocation.periodIndex,
					shift: allocation.shift,
					factor: Number(allocation.factor),
				})),
				rateOfDepreciation:
					book.rateOfDepreciation == null
						? null
						: Number(book.rateOfDepreciation),
				expectedValueAfterUsefulLife: Number(book.expectedValueAfterUsefulLife),
				openingAccumulatedDepreciation: Number(
					book.openingAccumulatedDepreciation,
				),
				openingNumberOfBookedDepreciations:
					book.openingNumberOfBookedDepreciations,
			}));
		}

		if (asset.assetCategory?.financeBookDefaults.length) {
			return asset.assetCategory.financeBookDefaults.map((book) => ({
				financeBookId: book.financeBookId,
				depreciationMethod: book.depreciationMethod as Asset.DepreciationMethod,
				totalNumberOfDepreciations: book.totalNumberOfDepreciations,
				frequencyOfDepreciation: book.frequencyOfDepreciation,
				depreciationStartDate: asset.depreciationStartDate
					? dateOnlyFromPersistedDateTime(asset.depreciationStartDate)
					: asset.availableForUseDate
						? dateOnlyFromPersistedDateTime(asset.availableForUseDate)
						: dateOnlyFromPersistedDateTime(asset.purchaseDate),
				dailyProrataBased: book.dailyProrataBased,
				shiftBased: book.shiftBased,
				precision: book.precision,
				ratePrecision: book.ratePrecision,
				calculateUsingTotalDays: book.calculateUsingTotalDays,
				shiftAllocations: (book.shiftAllocations ?? []).map((allocation) => ({
					periodIndex: allocation.periodIndex,
					shift: allocation.shift,
					factor: Number(allocation.factor),
				})),
				rateOfDepreciation:
					book.rateOfDepreciation == null
						? null
						: Number(book.rateOfDepreciation),
				expectedValueAfterUsefulLife:
					book.expectedValueAfterUsefulLife == null
						? null
						: Number(book.expectedValueAfterUsefulLife),
				openingAccumulatedDepreciation: Number(
					asset.openingAccumulatedDepreciation,
				),
				openingNumberOfBookedDepreciations:
					asset.openingNumberOfBookedDepreciations,
			}));
		}

		const financeBookId = asset.company.defaultFinanceBookId;
		const method =
			asset.depreciationMethod ?? asset.assetCategory?.depreciationMethod;
		const total =
			asset.totalNumberOfDepreciations ??
			asset.assetCategory?.totalNumberOfDepreciations;
		const frequency =
			asset.frequencyOfDepreciation ??
			asset.assetCategory?.frequencyOfDepreciation;
		if (!financeBookId || !method || !total || !frequency) return [];
		return [
			{
				financeBookId,
				depreciationMethod: method as Asset.DepreciationMethod,
				totalNumberOfDepreciations: total,
				frequencyOfDepreciation: frequency,
				depreciationStartDate: asset.depreciationStartDate
					? dateOnlyFromPersistedDateTime(asset.depreciationStartDate)
					: asset.availableForUseDate
						? dateOnlyFromPersistedDateTime(asset.availableForUseDate)
						: dateOnlyFromPersistedDateTime(asset.purchaseDate),
				dailyProrataBased: asset.assetCategory?.dailyProrataBased ?? false,
				shiftBased: asset.assetCategory?.shiftBased ?? false,
				precision: 2,
				ratePrecision: 2,
				calculateUsingTotalDays: false,
				shiftAllocations: [],
				rateOfDepreciation: asset.assetCategory?.rateOfDepreciation ?? null,
				expectedValueAfterUsefulLife:
					asset.expectedValueAfterUsefulLife == null
						? 0
						: Number(asset.expectedValueAfterUsefulLife),
				openingAccumulatedDepreciation: Number(
					asset.openingAccumulatedDepreciation,
				),
				openingNumberOfBookedDepreciations:
					asset.openingNumberOfBookedDepreciations,
			},
		];
	}

	private async loadAsset(
		assetId: string,
		organizationId: AssetOrganizationId,
		client: Pick<Prisma.TransactionClient, "asset"> | PrismaService = this
			.prisma,
	) {
		const asset = await client.asset.findFirst({
			where: assetWhereForOrganization(organizationId, { id: assetId }),
			include: {
				company: { select: { defaultFinanceBookId: true } },
				assetCategory: {
					include: {
						financeBookDefaults: { include: { shiftAllocations: true } },
					},
				},
				financeBooks: { include: { shiftAllocations: true } },
				depreciationSchedules: {
					where: { status: { in: ["DRAFT", "ACTIVE"] } },
					select: { startDate: true, status: true },
				},
			},
		});
		if (!asset) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}
		return {
			...asset,
			netPurchaseAmount: Number(asset.netPurchaseAmount),
		};
	}

	/** Locks the canonical Asset row, then every currently configured book row. */
	private async lockAssetBooks(
		tx: Prisma.TransactionClient,
		assetId: string,
	): Promise<void> {
		await lockAssetAndFinanceBooks(tx, [assetId], []);
		const books = await tx.assetFinanceBook.findMany({
			where: { assetId },
			select: { id: true },
		});
		await lockAssetAndFinanceBooks(
			tx,
			[assetId],
			books.map((book) => book.id),
		);
	}

	/**
	 * Locks linked lifecycle documents after the canonical Asset/book locks.
	 * Row locks are intentional: capitalization and disposal owners already use
	 * document advisory locks before acquiring Asset locks, so a second advisory
	 * namespace here would create an avoidable lock-order cycle.
	 */
	private async lockLinkedLifecycleDocuments(
		tx: Prisma.TransactionClient,
		assetId: string,
	): Promise<void> {
		const queries = [
			Prisma.sql`
				SELECT id
				FROM "asset_depreciation_journal_entries"
				WHERE "assetId" = ${assetId}
				ORDER BY id
				FOR UPDATE
			`,
			Prisma.sql`
				SELECT m.id
				FROM "asset_movements" AS m
				JOIN "asset_movement_items" AS i ON i."movementId" = m.id
				WHERE i."assetId" = ${assetId}
				ORDER BY m.id
				FOR UPDATE OF m
			`,
			Prisma.sql`
				SELECT id
				FROM "asset_repairs"
				WHERE "assetId" = ${assetId}
				ORDER BY id
				FOR UPDATE
			`,
			Prisma.sql`
				SELECT id
				FROM "asset_maintenances"
				WHERE "assetId" = ${assetId}
				ORDER BY id
				FOR UPDATE
			`,
			Prisma.sql`
				SELECT t.id
				FROM "asset_maintenance_tasks" AS t
				JOIN "asset_maintenances" AS m ON m.id = t."maintenanceId"
				WHERE m."assetId" = ${assetId}
				ORDER BY t.id
				FOR UPDATE OF t
			`,
			Prisma.sql`
				SELECT c.id
				FROM "asset_capitalizations" AS c
				WHERE c."targetAssetId" = ${assetId}
				   OR EXISTS (
						SELECT 1
						FROM "asset_capitalization_asset_items" AS i
						WHERE i."capitalizationId" = c.id
						  AND i."assetId" = ${assetId}
					)
				ORDER BY c.id
				FOR UPDATE OF c
			`,
			Prisma.sql`
				SELECT id
				FROM "asset_disposals"
				WHERE "assetId" = ${assetId}
				ORDER BY id
				FOR UPDATE
			`,
			Prisma.sql`
				SELECT id
				FROM "asset_value_adjustments"
				WHERE "assetId" = ${assetId}
				ORDER BY id
				FOR UPDATE
			`,
			Prisma.sql`
				SELECT id
				FROM "asset_revaluation_entries"
				WHERE "assetId" = ${assetId}
				ORDER BY id
				FOR UPDATE
			`,
			Prisma.sql`
				SELECT id
				FROM "asset_accounting_entries"
				WHERE "assetId" = ${assetId}
				ORDER BY id
				FOR UPDATE
			`,
		];
		for (const query of queries) {
			await tx.$queryRaw(query);
		}
	}
}
