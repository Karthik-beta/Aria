import { Injectable, Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { normalizeDateOnly } from "./depreciation.config";
import {
	DEPRECIATION_DISCOVERY_PAGE_SIZE,
	DEPRECIATION_FAILED_REDISCOVERY_COOLDOWN_MS,
	DEPRECIATION_JOB_VERSION,
	depreciationJobId,
	POST_ASSET_DEPRECIATION_JOB,
} from "./depreciation.constants";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationMetrics } from "./depreciation.metrics";
import type {
	DepreciationDiscoveryResult,
	DepreciationJobData,
	DepreciationJobName,
	DepreciationJobResult,
	DepreciationScope,
	PendingDepreciationPeriod,
} from "./depreciation.types";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationPersistenceService } from "./depreciation-persistence.service";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import {
	type DepreciationBulkJob,
	DepreciationQueueClient,
} from "./depreciation-queue.client";

export type DepreciationDiscoveryTrigger =
	| "startup"
	| "cron"
	| "barrier"
	| "manual";

/** Discovers due database rows and enqueues them without doing calculations. */
@Injectable()
export class DepreciationDiscoveryService {
	private readonly logger = new Logger(DepreciationDiscoveryService.name);

	constructor(
		private readonly queue: DepreciationQueueClient,
		private readonly persistence: DepreciationPersistenceService,
		private readonly metrics: DepreciationMetrics,
	) {}

	async discover(
		scope: DepreciationScope,
		trigger: DepreciationDiscoveryTrigger = "manual",
	): Promise<DepreciationDiscoveryResult> {
		let cursor: string | undefined;
		let discovered = 0;
		let enqueued = 0;
		let duplicateSkipped = 0;
		let frozen = 0;
		let oldestUnpostedDate: Date | null = null;

		for (;;) {
			const page = await this.persistence.pendingPage(
				scope,
				cursor,
				DEPRECIATION_DISCOVERY_PAGE_SIZE,
			);
			discovered += page.length;
			const actionable = page.filter((period) => !period.blockedByFreeze);
			frozen += page.length - actionable.length;
			for (const period of actionable) {
				if (
					oldestUnpostedDate === null ||
					period.depreciationDate < oldestUnpostedDate
				) {
					oldestUnpostedDate = period.depreciationDate;
				}
			}

			const prepared = await Promise.all(
				actionable.map<Promise<DepreciationBulkJob | null>>(async (period) => {
					const jobId = depreciationJobId(period.scheduleEntryId);
					const existing = await this.queue.getJob(jobId);
					if (existing && !(await this.removeRediscoverableJob(existing))) {
						return null;
					}
					return {
						name: POST_ASSET_DEPRECIATION_JOB,
						data: this.toJobData(period),
						opts: { jobId },
					};
				}),
			);
			const additions = prepared.filter((addition) => addition !== null);
			duplicateSkipped += prepared.length - additions.length;
			if (additions.length) {
				await this.queue.addBulk(additions);
				enqueued += additions.length;
			}

			if (page.length < DEPRECIATION_DISCOVERY_PAGE_SIZE) break;
			cursor = page.at(-1)?.scheduleEntryId;
		}

		this.metrics.recordDiscovery(trigger, discovered, enqueued);
		this.metrics.recordDuplicateSkipped(duplicateSkipped);
		this.metrics.setOldestUnposted(oldestUnpostedDate);
		this.logger.log({
			event: "asset_depreciation_discovery_completed",
			trigger,
			throughDate: normalizeDateOnly(scope.throughDate),
			discovered,
			enqueued,
			duplicateSkipped,
			frozen,
		});

		return {
			discovered,
			enqueued,
			duplicateSkipped,
			frozen,
			oldestUnpostedDate,
		};
	}

	private toJobData(period: PendingDepreciationPeriod): DepreciationJobData {
		return {
			version: DEPRECIATION_JOB_VERSION,
			assetId: period.assetId,
			assetFinanceBookId: period.assetFinanceBookId,
			scheduleId: period.scheduleId,
			scheduleEntryId: period.scheduleEntryId,
			depreciationDate: normalizeDateOnly(period.depreciationDate),
		};
	}

	private async removeRediscoverableJob(
		job: Job<DepreciationJobData, DepreciationJobResult, DepreciationJobName>,
	): Promise<boolean> {
		const state = await job.getState();
		if (state !== "failed" && state !== "completed") return false;
		const terminalAt = job.finishedOn ?? job.timestamp;
		if (Date.now() - terminalAt < DEPRECIATION_FAILED_REDISCOVERY_COOLDOWN_MS) {
			return false;
		}
		try {
			await job.remove();
			return true;
		} catch {
			return false;
		}
	}
}
