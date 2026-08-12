import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import type { AssetAccountingService } from "../asset-accounting.service";
import { CwipCapitalizationPersistenceService } from "./cwip-capitalization-persistence.service";

const COMPANY_ID = "company-1";

const job = {
	version: 1 as const,
	assetId: "asset-1",
	availableForUseDate: "2026-08-09",
};

function qualifiedAsset(overrides: Record<string, unknown> = {}) {
	return {
		id: "asset-1",
		series: "ACC-ASS-2026-00001",
		companyId: COMPANY_ID,
		status: "SUBMITTED",
		availableForUseDate: new Date("2026-08-09T00:00:00.000Z"),
		netPurchaseAmount: "5250.000000",
		cwipAccountingEntryId: null,
		assetCategory: {
			enableCwipAccounting: true,
			accounts: [
				{
					fixedAssetAccount: "Plant and Machinery - PTPL",
					capitalWorkInProgressAccount: "CWIP - PTPL",
					companyId: COMPANY_ID,
					company: { name: "Pivotr Technologies Private Limited" },
				},
			],
		},
		...overrides,
	};
}

function createHarness(asset: Record<string, unknown>) {
	const events: string[] = [];
	const queryRaw = mock(async () => [{ locked: true }]);
	const findUnique = mock(async () => asset);
	const updateMany = mock(async () => {
		events.push("asset-linked");
		return { count: 1 };
	});
	const transaction = {
		asset: { findUnique, updateMany },
		$queryRaw: queryRaw,
	};
	const prisma = {
		client: {
			...transaction,
			$transaction: async <T>(
				callback: (tx: typeof transaction) => Promise<T>,
			) => callback(transaction),
		},
	} as unknown as PrismaService;
	const createPostedEntry = mock(async () => {
		events.push("accounting-posted");
		return {
			id: "accounting-1",
			series: "AAE-2026-00001",
			status: "POSTED" as const,
		};
	});
	const accounting = {
		createPostedEntry,
	} as unknown as AssetAccountingService;
	return {
		service: new CwipCapitalizationPersistenceService(prisma, accounting),
		queryRaw,
		findUnique,
		updateMany,
		createPostedEntry,
		events,
	};
}

describe("CwipCapitalizationPersistenceService", () => {
	it("locks, revalidates, posts balanced fixed-asset/CWIP lines, then links the asset", async () => {
		const harness = createHarness(qualifiedAsset());

		await expect(harness.service.post(job)).resolves.toEqual({
			status: "posted",
			accountingEntryId: "accounting-1",
		});
		expect(harness.queryRaw).toHaveBeenCalledTimes(1);
		expect(harness.createPostedEntry).toHaveBeenCalledWith(expect.anything(), {
			companyId: COMPANY_ID,
			assetId: "asset-1",
			sourceType: "CWIP_CAPITALIZATION",
			sourceId: "asset-1",
			postingDate: new Date("2026-08-09T00:00:00.000Z"),
			remarks: "CWIP capitalization for ACC-ASS-2026-00001",
			lines: [
				{
					account: "Plant and Machinery - PTPL",
					debitAmount: 5250,
					creditAmount: 0,
				},
				{
					account: "CWIP - PTPL",
					debitAmount: 0,
					creditAmount: 5250,
				},
			],
		});
		expect(harness.events).toEqual(["accounting-posted", "asset-linked"]);
		expect(harness.updateMany).toHaveBeenCalledWith({
			where: {
				id: "asset-1",
				status: "SUBMITTED",
				cwipAccountingEntryId: null,
			},
			data: {
				cwipAccountingEntryId: "accounting-1",
				cwipBookedAt: expect.any(Date),
			},
		});
	});

	it("treats a retry linked to the original entry as already posted", async () => {
		const harness = createHarness(
			qualifiedAsset({ cwipAccountingEntryId: "accounting-existing" }),
		);

		await expect(harness.service.post(job)).resolves.toEqual({
			status: "already-posted",
			accountingEntryId: "accounting-existing",
		});
		expect(harness.createPostedEntry).not.toHaveBeenCalled();
		expect(harness.updateMany).not.toHaveBeenCalled();
	});

	it("skips a stale job when the asset is no longer SUBMITTED", async () => {
		const harness = createHarness(qualifiedAsset({ status: "SOLD" }));

		await expect(harness.service.post(job)).resolves.toEqual({
			status: "skipped-stale",
			reason: "Asset ACC-ASS-2026-00001 is SOLD, not SUBMITTED",
		});
		expect(harness.createPostedEntry).not.toHaveBeenCalled();
		expect(harness.updateMany).not.toHaveBeenCalled();
	});

	it("skips a stale job when the available-for-use date changed", async () => {
		const harness = createHarness(
			qualifiedAsset({
				availableForUseDate: new Date("2026-08-10T00:00:00.000Z"),
			}),
		);

		await expect(harness.service.post(job)).resolves.toEqual({
			status: "skipped-stale",
			reason:
				"Asset ACC-ASS-2026-00001 available-for-use date changed after discovery",
		});
		expect(harness.createPostedEntry).not.toHaveBeenCalled();
	});
});
