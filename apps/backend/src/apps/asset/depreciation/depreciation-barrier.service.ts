import { Injectable } from "@nestjs/common";
import {
	depreciationBarrierTimeoutMs,
	normalizeDateOnly,
} from "./depreciation.config";
import {
	DEPRECIATION_DISCOVERY_PAGE_SIZE,
	depreciationJobId,
} from "./depreciation.constants";
import {
	DepreciationBarrierError,
	type DepreciationScope,
	type EnsureDepreciationPostedResult,
	type PendingDepreciationPeriod,
} from "./depreciation.types";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationDiscoveryService } from "./depreciation-discovery.service";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationPersistenceService } from "./depreciation-persistence.service";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationQueueClient } from "./depreciation-queue.client";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationQueueSignal } from "./depreciation-queue-events";

/** Fail-closed synchronization point for reports, closes, and disposals. */
@Injectable()
export class DepreciationBarrierService {
	constructor(
		private readonly queue: DepreciationQueueClient,
		private readonly discovery: DepreciationDiscoveryService,
		private readonly persistence: DepreciationPersistenceService,
		private readonly signal: DepreciationQueueSignal,
	) {}

	async ensureDepreciationPosted(
		scope: DepreciationScope,
	): Promise<EnsureDepreciationPostedResult> {
		const startedAt = Date.now();
		const timeoutMs = depreciationBarrierTimeoutMs();
		const deadline = startedAt + timeoutMs;
		let nextRediscoveryAt = startedAt + 5_000;
		await this.discovery.discover(scope, "barrier");

		for (;;) {
			const snapshot = await this.persistence.pendingSnapshot(
				scope,
				DEPRECIATION_DISCOVERY_PAGE_SIZE,
			);
			if (snapshot.frozen > 0) {
				throw new DepreciationBarrierError(
					"DEPRECIATION_PERIOD_FROZEN",
					`${snapshot.frozen} due depreciation period(s) are in a frozen accounting period.`,
					snapshot.periods.length,
					0,
					snapshot.frozen,
				);
			}
			if (snapshot.periods.length === 0) {
				return {
					throughDate: normalizeDateOnly(scope.throughDate),
					posted: true,
					waitedMs: Date.now() - startedAt,
				};
			}

			const failed = await this.failedPeriods(snapshot.periods);
			if (failed.length) {
				throw new DepreciationBarrierError(
					"DEPRECIATION_FAILED",
					`Depreciation posting failed for ${failed.length} period(s): ${failed[0]?.reason ?? "unknown error"}`,
					snapshot.periods.length,
					failed.length,
					0,
				);
			}

			const remainingMs = deadline - Date.now();
			if (remainingMs <= 0) {
				throw new DepreciationBarrierError(
					"DEPRECIATION_TIMEOUT",
					`Timed out waiting ${timeoutMs}ms for ${snapshot.periods.length} depreciation period(s).`,
					snapshot.periods.length,
					0,
					0,
				);
			}
			await this.signal.wait(Math.min(1_000, remainingMs));
			if (Date.now() >= nextRediscoveryAt) {
				await this.discovery.discover(scope, "barrier");
				nextRediscoveryAt = Date.now() + 5_000;
			}
		}
	}

	private async failedPeriods(
		periods: PendingDepreciationPeriod[],
	): Promise<Array<{ scheduleEntryId: string; reason: string }>> {
		const failed: Array<{ scheduleEntryId: string; reason: string }> = [];
		for (const period of periods) {
			const job = await this.queue.getJob(
				depreciationJobId(period.scheduleEntryId),
			);
			if (job && (await job.getState()) === "failed") {
				failed.push({
					scheduleEntryId: period.scheduleEntryId,
					reason: job.failedReason || "unknown worker failure",
				});
			}
		}
		return failed;
	}
}
