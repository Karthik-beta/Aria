import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import { isEffectiveProjectionFinanceBook } from "../asset-finance-book";
import { lockAssetAndFinanceBooks } from "../asset-locking";
import {
	businessYearForSeries,
	dateOnlyFromPersistedDateTime,
	dateOnlyUtcRange,
	normalizeDateOnly,
} from "./depreciation.config";
import type {
	DepreciationJobData,
	DepreciationScope,
	PendingDepreciationPeriod,
	PendingDepreciationSnapshot,
} from "./depreciation.types";

interface Delegate {
	findMany<T>(args: unknown): Promise<T[]>;
	findUnique<T>(args: unknown): Promise<T | null>;
	findFirst<T>(args: unknown): Promise<T | null>;
	count(args: unknown): Promise<number>;
	create<T>(args: unknown): Promise<T>;
	update<T>(args: unknown): Promise<T>;
	updateMany(args: unknown): Promise<{ count: number }>;
}

interface DepreciationTransaction {
	asset: Delegate;
	assetActivity: Delegate;
	assetCategoryAccount: Delegate;
	assetDepreciationJournalEntry: Delegate;
	assetDepreciationScheduleEntry: Delegate;
	assetFinanceBook: Delegate;
	company: Delegate;
	$queryRaw<T>(query: unknown): Promise<T>;
}

interface DepreciationDatabase extends DepreciationTransaction {
	$transaction<T>(
		callback: (transaction: DepreciationTransaction) => Promise<T>,
	): Promise<T>;
}

interface DiscoveryRow {
	id: string;
	scheduleDate: Date;
	scheduleId: string;
	schedule: {
		assetId: string;
		assetFinanceBookId: string;
		assetFinanceBook: { financeBookId: string };
		asset: {
			companyId: string;
			company: { name: string; organizationId: string };
		};
	};
}

interface CompanyFreezeRow {
	id: string;
	name: string;
	accountsFrozenThrough: Date | null;
}

interface WorkerEntry {
	id: string;
	scheduleId: string;
	scheduleDate: Date;
	depreciationAmount: unknown;
	bookValueAfterDepreciation: unknown;
	postingId: string | null;
	schedule: {
		id: string;
		status: string;
		assetId: string;
		assetFinanceBookId: string;
		asset: {
			id: string;
			series: string;
			assetName: string;
			assetCategoryId: string | null;
			companyId: string;
			company: { name: string; organizationId: string };
			calculateDepreciation: boolean;
			status: string;
			financeBooks: Array<{ financeBookId: string }>;
		};
		assetFinanceBook: {
			id: string;
			financeBookId: string;
			financeBook: { name: string };
			openingNumberOfBookedDepreciations: number;
		};
	};
}

interface CompanyPostingConfig {
	id: string;
	name: string;
	defaultFinanceBookId: string | null;
	depreciationEntrySeries: string | null;
	defaultCostCenter: string | null;
	accumulatedDepreciationAccount: string | null;
	depreciationExpenseAccount: string | null;
	accountsFrozenThrough: Date | null;
}

interface CategoryAccountConfig {
	accumulatedDepreciationAccount: string | null;
	depreciationExpenseAccount: string | null;
}

export type PostDepreciationResult =
	| { status: "posted" | "already-posted"; postingId: string }
	| { status: "out-of-order"; earlierScheduleEntryId: string };

export class DepreciationPostingValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DepreciationPostingValidationError";
	}
}

/** Rejects non-finite persisted values before journal or cursor mutation. */
export const assertFinitePostingAmount = (
	name: string,
	value: unknown,
): void => {
	if (
		value === null ||
		value === undefined ||
		!Number.isFinite(Number(value))
	) {
		throw new DepreciationPostingValidationError(
			`Depreciation ${name} must be finite before posting.`,
		);
	}
};

/**
 * Isolates the queue layer from generated Prisma types while schema generation
 * and migrations remain independent build steps.
 */
@Injectable()
export class DepreciationPersistenceService {
	private readonly db: DepreciationDatabase;

	constructor(prisma: PrismaService) {
		this.db = prisma.client as unknown as DepreciationDatabase;
	}

	async pendingPage(
		scope: DepreciationScope,
		cursor: string | undefined,
		take: number,
	): Promise<PendingDepreciationPeriod[]> {
		const normalizedThroughDate =
			typeof scope.throughDate === "string"
				? normalizeDateOnly(scope.throughDate)
				: dateOnlyFromPersistedDateTime(scope.throughDate);
		const throughWindow = dateOnlyUtcRange(
			normalizedThroughDate,
			normalizedThroughDate,
		);
		const assetFilter: Record<string, unknown> = {
			calculateDepreciation: true,
			status: { in: ["SUBMITTED", "PARTIALLY_DEPRECIATED"] },
		};
		if (scope.companyId) assetFilter.companyId = scope.companyId;
		const companyFilter: Record<string, unknown> = {};
		if (scope.kind === "organization") {
			companyFilter.organizationId = scope.organizationId;
		}
		if (scope.company) {
			companyFilter.name = { equals: scope.company, mode: "insensitive" };
		}
		if (Object.keys(companyFilter).length > 0) {
			assetFilter.company = { is: companyFilter };
		}
		if (scope.assetIds?.length) assetFilter.id = { in: [...scope.assetIds] };

		const financeBookFilter: Record<string, unknown> = {};
		if (scope.financeBookId) {
			financeBookFilter.financeBookId = scope.financeBookId;
		}

		const rows =
			await this.db.assetDepreciationScheduleEntry.findMany<DiscoveryRow>({
				where: {
					postingId: null,
					scheduleDate: { lt: throughWindow.endExclusive },
					schedule: {
						status: "ACTIVE",
						asset: assetFilter,
						assetFinanceBook: financeBookFilter,
					},
				},
				select: {
					id: true,
					scheduleDate: true,
					scheduleId: true,
					schedule: {
						select: {
							assetId: true,
							assetFinanceBookId: true,
							assetFinanceBook: { select: { financeBookId: true } },
							asset: {
								select: {
									companyId: true,
									company: {
										select: { name: true, organizationId: true },
									},
								},
							},
						},
					},
				},
				orderBy: [{ scheduleDate: "asc" }, { id: "asc" }],
				take,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			});

		const companies = [
			...new Set(rows.map((row) => row.schedule.asset.companyId)),
		];
		const companyRows = companies.length
			? await this.db.company.findMany<CompanyFreezeRow>({
					where: {
						id: { in: companies },
						...(scope.kind === "organization"
							? { organizationId: scope.organizationId }
							: {}),
					},
					select: { id: true, name: true, accountsFrozenThrough: true },
				})
			: [];
		const freezes = new Map(
			companyRows.map((company) => [company.id, company.accountsFrozenThrough]),
		);

		return rows.map((row) => {
			const frozenThrough = freezes.get(row.schedule.asset.companyId);
			return {
				organizationId: row.schedule.asset.company.organizationId,
				assetId: row.schedule.assetId,
				assetFinanceBookId: row.schedule.assetFinanceBookId,
				financeBookId: row.schedule.assetFinanceBook.financeBookId,
				scheduleId: row.scheduleId,
				scheduleEntryId: row.id,
				depreciationDate: row.scheduleDate,
				companyId: row.schedule.asset.companyId,
				company: row.schedule.asset.company.name,
				blockedByFreeze:
					frozenThrough !== null &&
					frozenThrough !== undefined &&
					dateOnlyFromPersistedDateTime(row.scheduleDate) <=
						dateOnlyFromPersistedDateTime(frozenThrough),
			};
		});
	}

	async pendingSnapshot(
		scope: DepreciationScope,
		pageSize: number,
	): Promise<PendingDepreciationSnapshot> {
		const periods: PendingDepreciationPeriod[] = [];
		let cursor: string | undefined;
		for (;;) {
			const page = await this.pendingPage(scope, cursor, pageSize);
			periods.push(...page);
			if (page.length < pageSize) break;
			cursor = page.at(-1)?.scheduleEntryId;
		}
		const actionable = periods.filter((period) => !period.blockedByFreeze);
		const oldest = actionable.reduce<Date | null>(
			(current, period) =>
				current === null || period.depreciationDate < current
					? period.depreciationDate
					: current,
			null,
		);
		return {
			periods,
			frozen: periods.length - actionable.length,
			oldestUnpostedDate: oldest,
		};
	}

	async post(job: DepreciationJobData): Promise<PostDepreciationResult> {
		return this.db.$transaction(async (tx) => {
			// The queue payload carries both stable lock identities. Acquire the
			// canonical Asset -> AssetFinanceBook order before reading the schedule
			// row; the identity query below then validates that the payload is still
			// attached to those locked rows.
			await lockAssetAndFinanceBooks(
				tx,
				[job.assetId],
				[job.assetFinanceBookId],
			);
			const identity = await tx.assetDepreciationScheduleEntry.findFirst<{
				schedule: { assetId: string; assetFinanceBookId: string };
			}>({
				where: {
					id: job.scheduleEntryId,
					schedule: {
						asset: {
							company: { is: { organizationId: job.organizationId } },
						},
					},
				},
				select: {
					schedule: { select: { assetId: true, assetFinanceBookId: true } },
				},
			});
			if (!identity) {
				throw new DepreciationPostingValidationError(
					`Depreciation schedule entry ${job.scheduleEntryId} does not exist.`,
				);
			}

			const entry =
				await tx.assetDepreciationScheduleEntry.findFirst<WorkerEntry>({
					where: {
						id: job.scheduleEntryId,
						schedule: {
							asset: {
								company: { is: { organizationId: job.organizationId } },
							},
						},
					},
					include: {
						schedule: {
							include: {
								asset: {
									include: {
										company: {
											select: { name: true, organizationId: true },
										},
										financeBooks: { select: { financeBookId: true } },
									},
								},
								assetFinanceBook: { include: { financeBook: true } },
							},
						},
					},
				});
			if (!entry) {
				throw new DepreciationPostingValidationError(
					`Depreciation schedule entry ${job.scheduleEntryId} does not exist.`,
				);
			}
			this.validatePayloadIdentity(job, entry);
			assertFinitePostingAmount("amount", entry.depreciationAmount);
			assertFinitePostingAmount("book value", entry.bookValueAfterDepreciation);

			if (entry.postingId) {
				return { status: "already-posted", postingId: entry.postingId };
			}

			const existing = await tx.assetDepreciationJournalEntry.findFirst<{
				id: string;
			}>({
				where: {
					assetFinanceBookId: job.assetFinanceBookId,
					postingDate: entry.scheduleDate,
					asset: {
						is: { company: { is: { organizationId: job.organizationId } } },
					},
					company: { is: { organizationId: job.organizationId } },
				},
				select: { id: true },
			});
			if (existing) {
				const linkedEntry = await tx.assetDepreciationScheduleEntry.updateMany({
					where: {
						id: entry.id,
						schedule: {
							asset: {
								company: { is: { organizationId: job.organizationId } },
							},
						},
					},
					data: { postingId: existing.id, postedAt: new Date() },
				});
				if (linkedEntry.count !== 1) {
					throw new DepreciationPostingValidationError(
						`Depreciation schedule entry ${entry.id} changed ownership while linking.`,
					);
				}
				return { status: "already-posted", postingId: existing.id };
			}
			this.validatePostingEligibility(entry);

			const earlier = await tx.assetDepreciationScheduleEntry.findFirst<{
				id: string;
			}>({
				where: {
					postingId: null,
					scheduleDate: { lt: entry.scheduleDate },
					schedule: {
						status: "ACTIVE",
						assetFinanceBookId: job.assetFinanceBookId,
						asset: { company: { is: { organizationId: job.organizationId } } },
					},
				},
				select: { id: true },
				orderBy: [{ scheduleDate: "asc" }, { sequence: "asc" }],
			});
			if (earlier) {
				return { status: "out-of-order", earlierScheduleEntryId: earlier.id };
			}

			const company = await tx.company.findFirst<CompanyPostingConfig>({
				where: {
					id: entry.schedule.asset.companyId,
					organizationId: job.organizationId,
				},
				select: {
					id: true,
					name: true,
					defaultFinanceBookId: true,
					depreciationEntrySeries: true,
					defaultCostCenter: true,
					accumulatedDepreciationAccount: true,
					depreciationExpenseAccount: true,
					accountsFrozenThrough: true,
				},
			});
			if (!company) {
				throw new DepreciationPostingValidationError(
					`Company ${entry.schedule.asset.companyId} does not exist.`,
				);
			}
			if (
				company.accountsFrozenThrough &&
				dateOnlyFromPersistedDateTime(entry.scheduleDate) <=
					dateOnlyFromPersistedDateTime(company.accountsFrozenThrough)
			) {
				throw new DepreciationPostingValidationError(
					`Accounting is frozen through ${dateOnlyFromPersistedDateTime(company.accountsFrozenThrough)} for ${company.name}.`,
				);
			}

			const categoryAccounts = entry.schedule.asset.assetCategoryId
				? await tx.assetCategoryAccount.findUnique<CategoryAccountConfig>({
						where: {
							assetCategoryId_companyId: {
								assetCategoryId: entry.schedule.asset.assetCategoryId,
								companyId: company.id,
							},
						},
						select: {
							accumulatedDepreciationAccount: true,
							depreciationExpenseAccount: true,
						},
					})
				: null;
			const accumulatedAccount =
				categoryAccounts?.accumulatedDepreciationAccount ??
				company.accumulatedDepreciationAccount;
			const expenseAccount =
				categoryAccounts?.depreciationExpenseAccount ??
				company.depreciationExpenseAccount;
			if (!accumulatedAccount || !expenseAccount) {
				throw new DepreciationPostingValidationError(
					`Depreciation accounts are not configured for ${entry.schedule.asset.series}.`,
				);
			}

			const series = await this.allocateSeries(
				tx,
				company.depreciationEntrySeries ?? "DEP-.YYYY.-",
				dateOnlyFromPersistedDateTime(entry.scheduleDate),
			);
			const posting = await tx.assetDepreciationJournalEntry.create<{
				id: string;
			}>({
				data: {
					series,
					assetId: entry.schedule.assetId,
					assetFinanceBookId: entry.schedule.assetFinanceBookId,
					companyId: company.id,
					financeBookName: entry.schedule.assetFinanceBook.financeBook.name,
					postingDate: entry.scheduleDate,
					depreciationAmount: entry.depreciationAmount,
					remarks: `Depreciation for ${entry.schedule.asset.series} on ${dateOnlyFromPersistedDateTime(entry.scheduleDate)}`,
					status: "POSTED",
					lines: {
						create: [
							{
								lineType: "DEBIT",
								account: expenseAccount,
								debitAmount: entry.depreciationAmount,
								creditAmount: 0,
								costCenter: company.defaultCostCenter,
							},
							{
								lineType: "CREDIT",
								account: accumulatedAccount,
								debitAmount: 0,
								creditAmount: entry.depreciationAmount,
								costCenter: company.defaultCostCenter,
							},
						],
					},
				},
				select: { id: true },
			});

			const linkedEntry = await tx.assetDepreciationScheduleEntry.updateMany({
				where: {
					id: entry.id,
					schedule: {
						asset: { company: { is: { organizationId: job.organizationId } } },
					},
				},
				data: { postingId: posting.id, postedAt: new Date() },
			});
			if (linkedEntry.count !== 1) {
				throw new DepreciationPostingValidationError(
					`Depreciation schedule entry ${entry.id} changed ownership while posting.`,
				);
			}
			const [remaining, booked] = await Promise.all([
				tx.assetDepreciationScheduleEntry.count({
					where: {
						postingId: null,
						schedule: {
							status: "ACTIVE",
							assetFinanceBookId: job.assetFinanceBookId,
							asset: {
								company: { is: { organizationId: job.organizationId } },
							},
						},
					},
				}),
				tx.assetDepreciationScheduleEntry.count({
					where: {
						postingId: { not: null },
						schedule: {
							assetFinanceBookId: job.assetFinanceBookId,
							asset: {
								company: { is: { organizationId: job.organizationId } },
							},
						},
					},
				}),
			]);
			const fullyDepreciated = remaining === 0;
			const totalBookedDepreciations =
				entry.schedule.assetFinanceBook.openingNumberOfBookedDepreciations +
				booked;
			assertFinitePostingAmount(
				"total booked depreciations",
				totalBookedDepreciations,
			);
			const updatedBook = await tx.assetFinanceBook.updateMany({
				where: {
					id: job.assetFinanceBookId,
					asset: { company: { is: { organizationId: job.organizationId } } },
				},
				data: {
					valueAfterDepreciation: entry.bookValueAfterDepreciation,
					totalNumberOfBookedDepreciations: totalBookedDepreciations,
					postingStatus: fullyDepreciated
						? "FULLY_DEPRECIATED"
						: "PARTIALLY_DEPRECIATED",
					lastPostedDepreciationDate: entry.scheduleDate,
				},
			});
			if (updatedBook.count !== 1) {
				throw new DepreciationPostingValidationError(
					`Asset finance book ${job.assetFinanceBookId} changed ownership while posting.`,
				);
			}

			if (
				isEffectiveProjectionFinanceBook(
					company.defaultFinanceBookId,
					entry.schedule.asset.financeBooks,
					entry.schedule.assetFinanceBook.financeBookId,
				)
			) {
				const updatedAsset = await tx.asset.updateMany({
					where: {
						id: entry.schedule.assetId,
						company: { is: { organizationId: job.organizationId } },
					},
					data: {
						valueAfterDepreciation: entry.bookValueAfterDepreciation,
						isFullyDepreciated: fullyDepreciated,
						status: fullyDepreciated
							? "FULLY_DEPRECIATED"
							: "PARTIALLY_DEPRECIATED",
					},
				});
				if (updatedAsset.count !== 1) {
					throw new DepreciationPostingValidationError(
						`Asset ${entry.schedule.assetId} changed ownership while posting.`,
					);
				}
			}
			await tx.assetActivity.create({
				data: {
					assetId: entry.schedule.assetId,
					activity: `Depreciation ${series} posted for ${dateOnlyFromPersistedDateTime(entry.scheduleDate)} in ${entry.schedule.assetFinanceBook.financeBook.name}.`,
				},
			});
			return { status: "posted", postingId: posting.id };
		});
	}

	private validatePayloadIdentity(
		job: DepreciationJobData,
		entry: WorkerEntry,
	): void {
		if (
			entry.scheduleId !== job.scheduleId ||
			entry.schedule.assetId !== job.assetId ||
			entry.schedule.assetFinanceBookId !== job.assetFinanceBookId ||
			entry.schedule.asset.company.organizationId !== job.organizationId ||
			dateOnlyFromPersistedDateTime(entry.scheduleDate) !== job.depreciationDate
		) {
			throw new DepreciationPostingValidationError(
				`Depreciation job payload does not match schedule entry ${entry.id}.`,
			);
		}
	}

	private validatePostingEligibility(entry: WorkerEntry): void {
		if (entry.schedule.status !== "ACTIVE") {
			throw new DepreciationPostingValidationError(
				`Depreciation schedule ${entry.scheduleId} is not active.`,
			);
		}
		if (
			!entry.schedule.asset.calculateDepreciation ||
			!["SUBMITTED", "PARTIALLY_DEPRECIATED"].includes(
				entry.schedule.asset.status,
			)
		) {
			throw new DepreciationPostingValidationError(
				`Asset ${entry.schedule.asset.series} is not eligible for depreciation.`,
			);
		}
	}

	private async allocateSeries(
		tx: DepreciationTransaction,
		pattern: string,
		postingDate: string,
	): Promise<string> {
		const year = businessYearForSeries(postingDate);
		const prefix = pattern.replace(/\.YYYY\./g, year);
		const rows = await tx.$queryRaw<Array<{ value: number }>>(Prisma.sql`
			INSERT INTO "document_series_counters" ("key", "value", "createdAt", "updatedAt")
			VALUES (${prefix}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			ON CONFLICT ("key") DO UPDATE
			SET "value" = "document_series_counters"."value" + 1,
			    "updatedAt" = CURRENT_TIMESTAMP
			RETURNING "value"
		`);
		const value = rows[0]?.value;
		if (typeof value !== "number" || !Number.isSafeInteger(value)) {
			throw new Error(`Failed to allocate depreciation series ${prefix}.`);
		}
		return `${prefix}${String(value).padStart(5, "0")}`;
	}
}
