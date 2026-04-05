import { expect, type Page, test } from "@playwright/test";

const ledgerResponse = {
	rows: [
		{
			assetId: "asset-001",
			assetSeries: "AST-2026-00001",
			assetName: "Hydraulic Pump A",
			assetCategoryId: "cat-001",
			assetCategoryName: "Machinery",
			company: "ACME Corp",
			purchaseDate: "2026-01-01T00:00:00.000Z",
			purchaseAmount: 100000,
			depreciationDate: "2026-04-30T00:00:00.000Z",
			openingAccumulatedDepreciation: 35000,
			depreciationAmount: 15000,
			accumulatedDepreciationAmount: 50000,
			valueAfterDepreciation: 80000,
			adjustmentId: "adj-002",
			adjustmentSeries: "AVA-2026-00002",
			adjustmentDate: "2026-03-15T00:00:00.000Z",
			revaluationEntrySeries: "JE-AVA-2026-00002",
			scheduleId: "sched-002",
			scheduleRevisionNumber: 2,
			costCenter: "Main Plant",
			depreciationMethod: "STRAIGHT_LINE",
			assetStatus: "PARTIALLY_DEPRECIATED",
		},
	],
	summary: {
		matchedAssetCount: 2,
		assetsWithLedgerCount: 1,
		assetsWithoutLedgerCount: 1,
		rowCount: 1,
		totalDepreciationAmount: 15000,
		closingValueTotal: 80000,
	},
};

async function mockLedgerQuery(page: Page) {
	await page.route(
		"**/trpc/asset.listAssetDepreciationLedger**",
		async (route) => {
			await route.fulfill({
				contentType: "application/json",
				body: JSON.stringify([{ result: { data: ledgerResponse } }]),
			});
		},
	);
}

test.describe("Asset depreciation ledger", () => {
	test.beforeEach(async ({ page }) => {
		await mockLedgerQuery(page);
	});

	test("renders the report route", async ({ page }) => {
		await page.goto("/asset/reports/depreciation-ledger", {
			waitUntil: "domcontentloaded",
		});

		await expect(
			page.getByRole("heading", { name: /asset depreciation ledger/i }),
		).toBeVisible({ timeout: 30_000 });
		await expect(page.getByLabel(/filter by cost center/i)).toBeVisible();
		await expect(page.getByText(/Hydraulic Pump A/i)).toBeVisible();
	});
});
