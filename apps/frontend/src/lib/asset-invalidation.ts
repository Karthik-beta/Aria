import type { trpc } from "@/lib/trpc";

type AssetUtils = ReturnType<typeof trpc.useUtils>["asset"];

/**
 * Invalidates every read model that can be affected by an Asset mutation.
 *
 * Asset state is projected into detail, schedules, lists, and reports. Keeping
 * this list in one seam prevents a mutation from refreshing only its immediate
 * list while leaving a stale schedule or report visible to the user.
 */
export async function invalidateAssetDomain(utils: {
	asset: AssetUtils;
}): Promise<void> {
	// Router-level invalidation covers every Asset list, detail, schedule, and
	// report query, including new read models added without editing this seam.
	await utils.asset.invalidate();
}
