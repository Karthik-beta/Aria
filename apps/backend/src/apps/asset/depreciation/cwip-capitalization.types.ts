import type {
	ASSET_CWIP_CAPITALIZATION_QUEUE,
	CWIP_CAPITALIZATION_JOB_VERSION,
	POST_ASSET_CWIP_CAPITALIZATION_JOB,
} from "./cwip-capitalization.constants";

export type CwipCapitalizationQueueName =
	typeof ASSET_CWIP_CAPITALIZATION_QUEUE;
export type CwipCapitalizationJobName =
	typeof POST_ASSET_CWIP_CAPITALIZATION_JOB;

/** Serializable payload for one asset's deferred CWIP posting. */
export interface CwipCapitalizationJobData {
	version: typeof CWIP_CAPITALIZATION_JOB_VERSION;
	/** Organization persisted on the Asset's Company at discovery time. */
	organizationId: string;
	assetId: string;
	availableForUseDate: string;
}

/** Explicit trusted boundary for scheduler-owned all-organization discovery. */
export interface CwipCapitalizationSystemScope {
	kind: "system";
}

export type CwipCapitalizationJobResult =
	| { status: "posted" | "already-posted"; accountingEntryId: string }
	| { status: "skipped-stale"; reason: string };

export interface CwipCapitalizationDiscoveryResult {
	discovered: number;
	qualified: number;
	enqueued: number;
	duplicateSkipped: number;
}
