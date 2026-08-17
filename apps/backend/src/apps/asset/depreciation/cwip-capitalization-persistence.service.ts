import { HttpException, Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import type { AssetAccountingService } from "../asset-accounting.service";
import { lockAssetAndFinanceBooks } from "../asset-locking";
import type {
	CwipCapitalizationJobData,
	CwipCapitalizationJobResult,
} from "./cwip-capitalization.types";
import { dateOnlyFromPersistedDateTime } from "./depreciation.config";

interface CwipWorkerAsset {
	id: string;
	series: string;
	companyId: string;
	company: { organizationId: string };
	status: string;
	availableForUseDate: Date | null;
	netPurchaseAmount: unknown;
	cwipAccountingEntryId: string | null;
	assetCategory: {
		enableCwipAccounting: boolean;
		accounts: Array<{
			fixedAssetAccount: string;
			capitalWorkInProgressAccount: string | null;
			companyId: string;
		}>;
	} | null;
}

interface CwipDelegate {
	findUnique<T>(args: unknown): Promise<T | null>;
	findFirst<T>(args: unknown): Promise<T | null>;
	updateMany(args: unknown): Promise<{ count: number }>;
}

interface CwipTransaction {
	asset: CwipDelegate;
	$queryRaw<T>(query: unknown): Promise<T>;
}

interface CwipDatabase extends CwipTransaction {
	$transaction<T>(
		callback: (transaction: CwipTransaction) => Promise<T>,
	): Promise<T>;
}

/** Permanent worker validation error that should not consume every retry. */
export class CwipCapitalizationValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CwipCapitalizationValidationError";
	}
}

/** Revalidates and posts one CWIP asset atomically under an asset lock. */
@Injectable()
export class CwipCapitalizationPersistenceService {
	private readonly db: CwipDatabase;

	constructor(
		prisma: PrismaService,
		private readonly accounting: AssetAccountingService,
	) {
		this.db = prisma.client as unknown as CwipDatabase;
	}

	async post(
		job: CwipCapitalizationJobData,
	): Promise<CwipCapitalizationJobResult> {
		return this.db.$transaction(async (tx) => {
			await lockAssetAndFinanceBooks(tx, [job.assetId], []);

			const asset = await tx.asset.findFirst<CwipWorkerAsset>({
				where: {
					id: job.assetId,
					company: { is: { organizationId: job.organizationId } },
				},
				select: {
					id: true,
					series: true,
					companyId: true,
					company: { select: { organizationId: true } },
					status: true,
					availableForUseDate: true,
					netPurchaseAmount: true,
					cwipAccountingEntryId: true,
					assetCategory: {
						select: {
							enableCwipAccounting: true,
							accounts: {
								select: {
									fixedAssetAccount: true,
									capitalWorkInProgressAccount: true,
									companyId: true,
								},
							},
						},
					},
				},
			});
			if (!asset) {
				return {
					status: "skipped-stale",
					reason: `Asset ${job.assetId} no longer exists`,
				};
			}
			if (asset.company.organizationId !== job.organizationId) {
				throw new CwipCapitalizationValidationError(
					`Asset ${job.assetId} does not belong to organization ${job.organizationId}.`,
				);
			}
			if (asset.cwipAccountingEntryId) {
				return {
					status: "already-posted",
					accountingEntryId: asset.cwipAccountingEntryId,
				};
			}

			const staleReason = this.staleReason(asset, job);
			if (staleReason) {
				return { status: "skipped-stale", reason: staleReason };
			}

			const categoryAccount = asset.assetCategory?.accounts.find(
				(account) => account.companyId === asset.companyId,
			);
			const fixedAssetAccount = categoryAccount?.fixedAssetAccount.trim();
			const cwipAccount = categoryAccount?.capitalWorkInProgressAccount?.trim();
			if (!fixedAssetAccount || !cwipAccount) {
				throw new CwipCapitalizationValidationError(
					`Fixed asset and CWIP accounts are not configured for ${asset.series}.`,
				);
			}

			const amount = Number(asset.netPurchaseAmount);
			if (!Number.isFinite(amount) || amount <= 0) {
				throw new CwipCapitalizationValidationError(
					`Asset ${asset.series} must have a positive purchase amount for CWIP capitalization.`,
				);
			}

			let accountingEntry: Awaited<
				ReturnType<AssetAccountingService["createPostedEntry"]>
			>;
			try {
				accountingEntry = await this.accounting.createPostedEntry(
					tx as unknown as Prisma.TransactionClient,
					job.organizationId,
					{
						companyId: asset.companyId,
						assetId: asset.id,
						sourceType: "CWIP_CAPITALIZATION",
						sourceId: asset.id,
						postingDate: dateOnlyFromPersistedDateTime(
							asset.availableForUseDate as Date,
						),
						remarks: `CWIP capitalization for ${asset.series}`,
						lines: [
							{
								account: fixedAssetAccount,
								debitAmount: amount,
								creditAmount: 0,
							},
							{
								account: cwipAccount,
								debitAmount: 0,
								creditAmount: amount,
							},
						],
					},
				);
			} catch (error) {
				if (error instanceof HttpException) {
					throw new CwipCapitalizationValidationError(error.message);
				}
				throw error;
			}

			const linked = await tx.asset.updateMany({
				where: {
					id: asset.id,
					company: { is: { organizationId: job.organizationId } },
					status: "SUBMITTED",
					cwipAccountingEntryId: null,
				},
				data: {
					cwipAccountingEntryId: accountingEntry.id,
					cwipBookedAt: new Date(),
				},
			});
			if (linked.count !== 1) {
				throw new Error(
					`Asset ${asset.series} changed while its CWIP accounting entry was being posted.`,
				);
			}

			return {
				status:
					accountingEntry.status === "POSTED" ? "posted" : "already-posted",
				accountingEntryId: accountingEntry.id,
			};
		});
	}

	private staleReason(
		asset: CwipWorkerAsset,
		job: CwipCapitalizationJobData,
	): string | null {
		if (asset.status !== "SUBMITTED") {
			return `Asset ${asset.series} is ${asset.status}, not SUBMITTED`;
		}
		if (!asset.assetCategory?.enableCwipAccounting) {
			return `CWIP accounting is no longer enabled for ${asset.series}`;
		}
		if (!asset.availableForUseDate) {
			return `Asset ${asset.series} no longer has an available-for-use date`;
		}
		if (
			dateOnlyFromPersistedDateTime(asset.availableForUseDate) !==
			job.availableForUseDate
		) {
			return `Asset ${asset.series} available-for-use date changed after discovery`;
		}
		return null;
	}
}
