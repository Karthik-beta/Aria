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
	/** Organization persisted on the Asset's Company at discovery time. */
	organizationId: string;
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

interface DepreciationScopeFilters {
	throughDate: Date | string;
	/** Stable Company ID filter used by internal callers when available. */
	companyId?: string;
	/** Presentation-name filter retained for report query compatibility. */
	company?: string;
	assetIds?: readonly string[];
	financeBookId?: string;
}

/** Authenticated organization scope for user-triggered depreciation work. */
export interface OrganizationDepreciationScope
	extends DepreciationScopeFilters {
	kind: "organization";
	organizationId: string;
}

/** Explicit scheduler/demo boundary for trusted all-organization processing. */
export interface SystemDepreciationScope extends DepreciationScopeFilters {
	kind: "system";
}

export type DepreciationScope =
	| OrganizationDepreciationScope
	| SystemDepreciationScope;

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
	organizationId: string;
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
