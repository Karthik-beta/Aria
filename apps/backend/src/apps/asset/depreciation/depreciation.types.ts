import type {
	ASSET_DEPRECIATION_QUEUE,
	DEPRECIATION_JOB_VERSION,
	POST_ASSET_DEPRECIATION_JOB,
} from "./depreciation.constants";

export type DepreciationQueueName = typeof ASSET_DEPRECIATION_QUEUE;
export type DepreciationJobName = typeof POST_ASSET_DEPRECIATION_JOB;

/** Serializable payload for one asset, finance-book, and schedule period. */
export interface DepreciationJobData {
	version: typeof DEPRECIATION_JOB_VERSION;
	assetId: string;
	assetFinanceBookId: string;
	scheduleId: string;
	scheduleEntryId: string;
	depreciationDate: string;
}

export interface DepreciationJobResult {
	status: "posted" | "already-posted";
	postingId: string;
}

/** Optional filters used by discovery and financial-operation barriers. */
export interface DepreciationScope {
	throughDate: Date | string;
	/** Stable Company ID filter used by internal callers when available. */
	companyId?: string;
	/** Presentation-name filter retained for report query compatibility. */
	company?: string;
	assetIds?: readonly string[];
	financeBookId?: string;
}

export interface DepreciationDiscoveryResult {
	discovered: number;
	enqueued: number;
	duplicateSkipped: number;
	frozen: number;
	oldestUnpostedDate: Date | null;
}

export interface EnsureDepreciationPostedResult {
	throughDate: string;
	posted: true;
	waitedMs: number;
}

export interface PendingDepreciationPeriod {
	assetId: string;
	assetFinanceBookId: string;
	financeBookId: string;
	scheduleId: string;
	scheduleEntryId: string;
	depreciationDate: Date;
	companyId: string;
	company: string;
	blockedByFreeze: boolean;
}

export interface PendingDepreciationSnapshot {
	periods: PendingDepreciationPeriod[];
	frozen: number;
	oldestUnpostedDate: Date | null;
}

export class DepreciationBarrierError extends Error {
	readonly retryable = true;

	constructor(
		readonly code:
			| "DEPRECIATION_TIMEOUT"
			| "DEPRECIATION_FAILED"
			| "DEPRECIATION_PERIOD_FROZEN",
		message: string,
		readonly pendingCount: number,
		readonly failedCount: number,
		readonly frozenCount: number,
	) {
		super(message);
		this.name = "DepreciationBarrierError";
	}
}
