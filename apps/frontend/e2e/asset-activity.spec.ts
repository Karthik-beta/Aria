import { expect, type Page, test } from "@playwright/test";

const activityResponse = {
	rows: [
		{
			activityId: "activity-001",
			assetId: "asset-001",
			assetSeries: "AST-2026-00001",
			assetName: "Hydraulic Pump A",
			assetCategoryId: "cat-001",
			assetCategoryName: "Machinery",
			company: "ACME Corp",
			assetStatus: "PARTIALLY_DEPRECIATED",
			activity: "Asset value adjustment AVA-2026-00003 submitted.",
			createdAt: "2026-04-18T08:30:00.000Z",
		},
	],
	summary: {
		rowCount: 1,
		distinctAssetCount: 1,
		firstActivityAt: "2026-04-18T08:30:00.000Z",
		lastActivityAt: "2026-04-18T08:30:00.000Z",
	},
};

async function mockActivityQuery(page: Page) {
	await page.route("**/trpc/asset.listAssetActivityReport**", async (route) => {
		await route.fulfill({
			contentType: "application/json",
			body: JSON.stringify({ result: { data: activityResponse } }),
		});
	});
}

test.describe("Asset activity", () => {
	test.beforeEach(async ({ page }) => {
		await mockActivityQuery(page);
	});

	test("renders the report route", async ({ page }) => {
		await page.goto("/asset/reports/activity", {
			waitUntil: "domcontentloaded",
		});

		await expect(
			page.getByRole("heading", { name: /asset activity/i }),
		).toBeVisible({ timeout: 30_000 });
		await expect(page.getByLabel(/filter by activity/i)).toBeVisible();
		await expect(page.getByText(/Hydraulic Pump A/i)).toBeVisible();
	});
});
