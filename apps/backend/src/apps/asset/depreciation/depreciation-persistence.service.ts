import type { Asset } from "@aria/types";
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	ASSET_DEPRECIATING_STATUSES,
	deriveAssetStatus,
	isOperationalAssetStatus,
} from "../asset-status";
import { dateOnlyUtc, normalizeDateOnly } from "./depreciation.config";
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
		asset: { company: string };
	};
}

interface CompanyFreezeRow {
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
			company: string;
			calculateDepreciation: boolean;
			status: string;
			netPurchaseAmount: unknown;
		};
		assetFinanceBook: {
			id: string;
			financeBookId: string;
			expectedValueAfterUsefulLife: unknown;
			financeBook: { name: string };
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
		const throughDate = dateOnlyUtc(scope.throughDate);
		const assetFilter: Record<string, unknown> = {
			calculateDepreciation: true,
			status: { in: [...ASSET_DEPRECIATING_STATUSES] },
		};
		if (scope.company) assetFilter.company = scope.company;
		if (scope.assetIds?.length) assetFilter.id = { in: [...scope.assetIds] };

		const financeBookFilter: Record<string, unknown> = {};
		if (scope.financeBookId) {
			financeBookFilter.financeBookId = scope.financeBookId;
		}

		const rows =
			await this.db.assetDepreciationScheduleEntry.findMany<DiscoveryRow>({
				where: {
					postingId: null,
					scheduleDate: { lte: throughDate },
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
							asset: { select: { company: true } },
						},
					},
				},
				orderBy: [{ scheduleDate: "asc" }, { id: "asc" }],
				take,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			});

		const companies = [
			...new Set(rows.map((row) => row.schedule.asset.company)),
		];
		const companyRows = companies.length
			? await this.db.company.findMany<CompanyFreezeRow>({
					where: { name: { in: companies } },
					select: { name: true, accountsFrozenThrough: true },
				})
			: [];
		const freezes = new Map(
			companyRows.map((company) => [
				company.name,
				company.accountsFrozenThrough,
			]),
		);

		return rows.map((row) => {
			const frozenThrough = freezes.get(row.schedule.asset.company);
			return {
				assetId: row.schedule.assetId,
				assetFinanceBookId: row.schedule.assetFinanceBookId,
				financeBookId: row.schedule.assetFinanceBook.financeBookId,
				scheduleId: row.scheduleId,
				scheduleEntryId: row.id,
				depreciationDate: row.scheduleDate,
				company: row.schedule.asset.company,
				blockedByFreeze:
					frozenThrough !== null &&
					frozenThrough !== undefined &&
					row.scheduleDate.getTime() <= frozenThrough.getTime(),
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
			await tx.$queryRaw(Prisma.sql`
				SELECT pg_advisory_xact_lock(hashtext(${job.assetFinanceBookId})) IS NULL AS "locked"
			`);

			const entry =
				await tx.assetDepreciationScheduleEntry.findUnique<WorkerEntry>({
					where: { id: job.scheduleEntryId },
					include: {
						schedule: {
							include: {
								asset: true,
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

			if (entry.postingId) {
				return { status: "already-posted", postingId: entry.postingId };
			}

			const existing = await tx.assetDepreciationJournalEntry.findUnique<{
				id: string;
				status: string;
			}>({
				where: {
					assetFinanceBookId_postingDate: {
						assetFinanceBookId: job.assetFinanceBookId,
						postingDate: entry.scheduleDate,
					},
				},
				select: { id: true, status: true },
			});
			if (existing?.status === "REVERSED") {
				// A reversed posting is not a posting: never link it to the schedule
				// entry. Legitimate flows cancel the schedule on reversal.
				throw new DepreciationPostingValidationError(
					`Depreciation for ${normalizeDateOnly(entry.scheduleDate)} was reversed and cannot be posted again.`,
				);
			}
			if (existing) {
				await tx.assetDepreciationScheduleEntry.update({
					where: { id: entry.id },
					data: { postingId: existing.id, postedAt: new Date() },
				});
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
					},
				},
				select: { id: true },
				orderBy: [{ scheduleDate: "asc" }, { sequence: "asc" }],
			});
			if (earlier) {
				return { status: "out-of-order", earlierScheduleEntryId: earlier.id };
			}

			const company = await tx.company.findUnique<CompanyPostingConfig>({
				where: { name: entry.schedule.asset.company },
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
					`Company ${entry.schedule.asset.company} does not exist.`,
				);
			}
			if (
				company.accountsFrozenThrough &&
				entry.scheduleDate <= company.accountsFrozenThrough
			) {
				throw new DepreciationPostingValidationError(
					`Accounting is frozen through ${normalizeDateOnly(company.accountsFrozenThrough)} for ${company.name}.`,
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
				entry.scheduleDate,
			);
			const posting = await tx.assetDepreciationJournalEntry.create<{
				id: string;
			}>({
				data: {
					series,
					assetId: entry.schedule.assetId,
					assetFinanceBookId: entry.schedule.assetFinanceBookId,
					company: company.name,
					financeBookName: entry.schedule.assetFinanceBook.financeBook.name,
					postingDate: entry.scheduleDate,
					depreciationAmount: entry.depreciationAmount,
					remarks: `Depreciation for ${entry.schedule.asset.series} on ${normalizeDateOnly(entry.scheduleDate)}`,
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

			await tx.assetDepreciationScheduleEntry.update({
				where: { id: entry.id },
				data: { postingId: posting.id, postedAt: new Date() },
			});
			const [remaining, booked] = await Promise.all([
				tx.assetDepreciationScheduleEntry.count({
					where: {
						postingId: null,
						schedule: {
							status: "ACTIVE",
							assetFinanceBookId: job.assetFinanceBookId,
						},
					},
				}),
				tx.assetDepreciationScheduleEntry.count({
					where: {
						postingId: { not: null },
						schedule: { assetFinanceBookId: job.assetFinanceBookId },
					},
				}),
			]);
			const fullyDepreciated = remaining === 0;
			await tx.assetFinanceBook.update({
				where: { id: job.assetFinanceBookId },
				data: {
					valueAfterDepreciation: entry.bookValueAfterDepreciation,
					totalNumberOfBookedDepreciations: booked,
					postingStatus: fullyDepreciated
						? "FULLY_DEPRECIATED"
						: "PARTIALLY_DEPRECIATED",
					lastPostedDepreciationDate: entry.scheduleDate,
				},
			});

			if (
				company.defaultFinanceBookId ===
				entry.schedule.assetFinanceBook.financeBookId
			) {
				await tx.asset.update({
					where: { id: entry.schedule.assetId },
					data: {
						valueAfterDepreciation: entry.bookValueAfterDepreciation,
						isFullyDepreciated: fullyDepreciated,
						status: this.assetStatusAfterPosting(entry),
					},
				});
			}
			await tx.assetActivity.create({
				data: {
					assetId: entry.schedule.assetId,
					activity: `Depreciation ${series} posted for ${normalizeDateOnly(entry.scheduleDate)} in ${entry.schedule.assetFinanceBook.financeBook.name}.`,
				},
			});
			return { status: "posted", postingId: posting.id };
		});
	}

	/**
	 * Status of the asset after a posting on its default finance book. An
	 * operational overlay (`IN_MAINTENANCE`/`OUT_OF_ORDER`) is kept: depreciation
	 * continues underneath it and the maintenance flows own that status.
	 * Otherwise the status engine derives it from the new book value.
	 */
	private assetStatusAfterPosting(entry: WorkerEntry): Asset.AssetStatus {
		const asset = entry.schedule.asset;
		const currentStatus = asset.status as Asset.AssetStatus;
		if (isOperationalAssetStatus(currentStatus)) return currentStatus;
		const valueAfterDepreciation = Number(entry.bookValueAfterDepreciation);
		return deriveAssetStatus({
			currentStatus,
			calculateDepreciation: true,
			isFullyDepreciated: false,
			netPurchaseAmount: Number(asset.netPurchaseAmount),
			valueAfterDepreciation,
			defaultBook: {
				valueAfterDepreciation,
				expectedValueAfterUsefulLife: Number(
					entry.schedule.assetFinanceBook.expectedValueAfterUsefulLife ?? 0,
				),
			},
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
			normalizeDateOnly(entry.scheduleDate) !== job.depreciationDate
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
			!ASSET_DEPRECIATING_STATUSES.includes(
				entry.schedule.asset.status as Asset.AssetStatus,
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
		postingDate: Date,
	): Promise<string> {
		const year = String(postingDate.getUTCFullYear());
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
