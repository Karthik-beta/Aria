/** BullMQ queue used for deferred CWIP-to-fixed-asset postings. */
export const ASSET_CWIP_CAPITALIZATION_QUEUE =
	"asset-cwip-capitalization" as const;

/** The only job accepted by the CWIP capitalization worker. */
export const POST_ASSET_CWIP_CAPITALIZATION_JOB =
	"post-asset-cwip-capitalization" as const;

export const CWIP_CAPITALIZATION_JOB_VERSION = 1 as const;
export const CWIP_CAPITALIZATION_DISCOVERY_PAGE_SIZE = 500;

/** Produces a stable BullMQ id; database state remains authoritative. */
export function cwipCapitalizationJobId(assetId: string): string {
	return `asset-cwip-capitalization-${assetId}`;
}
