import { describe, expect, it, vi } from "vitest";
import { invalidateAssetDomain } from "./asset-invalidation";

describe("invalidateAssetDomain", () => {
	it("invalidates the complete Asset router after a successful mutation", async () => {
		const invalidate = vi.fn().mockResolvedValue(undefined);
		const utils = {
			asset: { invalidate },
		} as unknown as Parameters<typeof invalidateAssetDomain>[0];

		await invalidateAssetDomain(utils);

		expect(invalidate).toHaveBeenCalledOnce();
	});
});
