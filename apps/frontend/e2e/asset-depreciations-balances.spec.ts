import { expect, type Page, test } from "./fixtures";

const balancesResponse = {
	rows: [
		{
			groupingKey: "ACME Corp::cat-001",
			groupingLabel: "Machinery",
			company: "ACME Corp",
			assetCount: 2,
			assetId: null,
			assetSeries: null,
			assetName: null,
			assetCategoryId: "cat-001",
			assetCategoryName: "Machinery",
			valueAsOnFromDate: 170000,
			valueOfNewPurchase: 0,
			valueOfSoldAsset: 60000,
			valueOfScrappedAsset: 0,
			valueOfCapitalizedAsset: 0,
			valueAdjustmentDuringPeriod: -5000,
			valueAsOnToDate: 105000,
			accumulatedDepreciationAsOnFromDate: 30000,
			depreciationAmountDuringPeriod: 30000,
			depreciationEliminatedDuringPeriod: 10000,
			accumulatedDepreciationAsOnToDate: 50000,
			depreciationEliminatedViaReversal: 0,
			netAssetValueAsOnFromDate: 140000,
			netAssetValueAsOnToDate: 55000,
		},
	],
	summary: {
		matchedAssetCount: 2,
		rowCount: 1,
		totalValueAsOnFromDate: 170000,
		totalValueAsOnToDate: 105000,
		totalNetAssetValueAsOnFromDate: 140000,
		totalNetAssetValueAsOnToDate: 55000,
		totalDepreciationAmountDuringPeriod: 30000,
		totalValueAdjustmentDuringPeriod: -5000,
	},
};

async function mockBalancesQuery(page: Page) {
	await page.route(
		"**/trpc/asset.listAssetDepreciationsAndBalances**",
		async (route) => {
			await route.fulfill({
				contentType: "application/json",
				body: JSON.stringify({ result: { data: balancesResponse } }),
			});
		},
	);
}

test.describe("Asset depreciations and balances", () => {
	test.beforeEach(async ({ page }) => {
		await mockBalancesQuery(page);
	});

	test("renders the report route", async ({ page }) => {
		await page.goto("/asset/reports/depreciations-balances", {
			waitUntil: "domcontentloaded",
		});

		await expect(
			page.getByRole("heading", {
				name: /asset depreciations and balances/i,
			}),
		).toBeVisible({ timeout: 30_000 });
		await expect(page.getByLabel(/filter by asset category/i)).toBeVisible();
		await expect(page.getByText(/Machinery/i)).toBeVisible();
	});
});
