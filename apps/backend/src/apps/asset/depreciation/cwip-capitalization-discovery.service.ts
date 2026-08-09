import { Injectable, Logger } from "@nestjs/common";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	CWIP_CAPITALIZATION_DISCOVERY_PAGE_SIZE,
	CWIP_CAPITALIZATION_JOB_VERSION,
	cwipCapitalizationJobId,
	POST_ASSET_CWIP_CAPITALIZATION_JOB,
} from "./cwip-capitalization.constants";
import type { CwipCapitalizationDiscoveryResult } from "./cwip-capitalization.types";
import type {
	CwipCapitalizationBulkJob,
	CwipCapitalizationJob,
	CwipCapitalizationQueueClient,
} from "./cwip-capitalization-queue.client";
import { dateOnlyUtc, normalizeDateOnly } from "./depreciation.config";

interface CwipDiscoveryCandidate {
	id: string;
	company: string;
	availableForUseDate: Date;
	assetCategory: {
		enableCwipAccounting: boolean;
		accounts: Array<{
			fixedAssetAccount: string;
			capitalWorkInProgressAccount: string | null;
			company: { name: string };
		}>;
	} | null;
}

interface CwipDiscoveryDatabase {
	asset: {
		findMany<T>(args: unknown): Promise<T[]>;
	};
}

/** Finds qualified CWIP assets and only enqueues durable worker jobs. */
@Injectable()
export class CwipCapitalizationDiscoveryService {
	private readonly logger = new Logger(CwipCapitalizationDiscoveryService.name);
	private readonly db: CwipDiscoveryDatabase;

	constructor(
		prisma: PrismaService,
		private readonly queue: CwipCapitalizationQueueClient,
	) {
		this.db = prisma.client as unknown as CwipDiscoveryDatabase;
	}

	async discover(
		throughDate: Date | string,
	): Promise<CwipCapitalizationDiscoveryResult> {
		const normalizedThroughDate = normalizeDateOnly(throughDate);
		const throughEnd = dateOnlyUtc(normalizedThroughDate);
		throughEnd.setUTCHours(23, 59, 59, 999);

		let cursor: string | undefined;
		let discovered = 0;
		let qualified = 0;
		let enqueued = 0;
		let duplicateSkipped = 0;

		for (;;) {
			const page = await this.db.asset.findMany<CwipDiscoveryCandidate>({
				where: {
					status: "SUBMITTED",
					availableForUseDate: { not: null, lte: throughEnd },
					netPurchaseAmount: { gt: 0 },
					cwipAccountingEntryId: null,
					assetCategory: { is: { enableCwipAccounting: true } },
				},
				select: {
					id: true,
					company: true,
					availableForUseDate: true,
					assetCategory: {
						select: {
							enableCwipAccounting: true,
							accounts: {
								select: {
									fixedAssetAccount: true,
									capitalWorkInProgressAccount: true,
									company: { select: { name: true } },
								},
							},
						},
					},
				},
				orderBy: { id: "asc" },
				take: CWIP_CAPITALIZATION_DISCOVERY_PAGE_SIZE,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
			});
			discovered += page.length;

			const actionable = page.filter((asset) => this.isQualified(asset));
			qualified += actionable.length;
			const prepared = await Promise.all(
				actionable.map(async (asset) => {
					const jobId = cwipCapitalizationJobId(asset.id);
					const existing = await this.queue.getJob(jobId);
					if (existing && !(await this.removeTerminalJob(existing))) {
						return null;
					}
					return {
						name: POST_ASSET_CWIP_CAPITALIZATION_JOB,
						data: {
							version: CWIP_CAPITALIZATION_JOB_VERSION,
							assetId: asset.id,
							availableForUseDate: normalizeDateOnly(asset.availableForUseDate),
						},
						opts: { jobId },
					} satisfies CwipCapitalizationBulkJob;
				}),
			);
			const additions = prepared.filter(
				(addition): addition is CwipCapitalizationBulkJob => addition !== null,
			);
			duplicateSkipped += prepared.length - additions.length;
			if (additions.length > 0) {
				await this.queue.addBulk(additions);
				enqueued += additions.length;
			}

			if (page.length < CWIP_CAPITALIZATION_DISCOVERY_PAGE_SIZE) break;
			cursor = page.at(-1)?.id;
		}

		this.logger.log({
			event: "asset_cwip_capitalization_discovery_completed",
			throughDate: normalizedThroughDate,
			discovered,
			qualified,
			enqueued,
			duplicateSkipped,
		});
		return { discovered, qualified, enqueued, duplicateSkipped };
	}

	private isQualified(asset: CwipDiscoveryCandidate): boolean {
		if (!asset.assetCategory?.enableCwipAccounting) return false;
		return asset.assetCategory.accounts.some(
			(account) =>
				account.company.name === asset.company &&
				account.fixedAssetAccount.trim().length > 0 &&
				Boolean(account.capitalWorkInProgressAccount?.trim()),
		);
	}

	private async removeTerminalJob(
		job: CwipCapitalizationJob,
	): Promise<boolean> {
		const state = await job.getState();
		if (state !== "completed" && state !== "failed") return false;
		try {
			await job.remove();
			return true;
		} catch {
			return false;
		}
	}
}
