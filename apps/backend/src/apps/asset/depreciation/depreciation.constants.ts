/** BullMQ queue used for durable, per-period asset depreciation posting. */
export const ASSET_DEPRECIATION_QUEUE = "asset-depreciation" as const;

/** The only job name accepted by the depreciation worker. */
export const POST_ASSET_DEPRECIATION_JOB = "post-asset-depreciation" as const;

export const DEPRECIATION_JOB_VERSION = 1 as const;
export const DEPRECIATION_DISCOVERY_PAGE_SIZE = 500;
export const DEPRECIATION_JOB_ATTEMPTS = 5;
export const DEPRECIATION_RETRY_DELAY_MS = 30_000;
export const DEPRECIATION_COMPLETED_REDISCOVERY_COOLDOWN_MS = 15 * 60_000;
export const DEPRECIATION_COMPLETED_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const DEPRECIATION_COMPLETED_RETENTION_COUNT = 10_000;
export const DEPRECIATION_DEFAULT_WORKER_CONCURRENCY = 5;
export const DEPRECIATION_DEFAULT_BARRIER_TIMEOUT_MS = 120_000;
export const DEPRECIATION_DEFAULT_QUEUE_OPERATION_TIMEOUT_MS = 5_000;
export const DEPRECIATION_DEFAULT_RECONCILIATION_INTERVAL_MS = 15 * 60_000;
export const DEPRECIATION_OUT_OF_ORDER_MAX_STARTS = 100;
export const DEPRECIATION_OUT_OF_ORDER_DELAY_MS = 30_000;

/** Produces a stable BullMQ id; database uniqueness remains authoritative. */
export function depreciationJobId(scheduleEntryId: string): string {
	return `asset-depreciation-${scheduleEntryId}`;
}
