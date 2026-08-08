import { expect, type Page, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const adjustmentListResponse = {
	items: [
		{
			id: "adj-001",
			series: "AVA-2026-00001",
			assetId: "asset-001",
			assetSeries: "AST-2026-00001",
			assetName: "Hydraulic Pump A",
			assetCategoryName: "Machinery",
			company: "ACME Corp",
			adjustmentDate: "2026-04-15T00:00:00.000Z",
			currentAssetValue: 80000,
			newAssetValue: 90000,
			differenceAmount: 10000,
			differenceAccount: "Asset Revaluation Reserve",
			fixedAssetAccount: "Machinery Fixed Asset",
			costCenter: "Main Plant",
			notes: "Annual valuation uplift",
			status: "DRAFT",
			direction: "INCREASE",
			previousAssetStatus: "SUBMITTED",
			previousIsFullyDepreciated: false,
			submittedAt: null,
			cancelledAt: null,
			revaluationEntry: null,
			depreciationSchedule: null,
			createdAt: "2026-04-15T10:00:00.000Z",
			updatedAt: "2026-04-15T10:00:00.000Z",
		},
	],
	totalCount: 1,
};

const assetsResponse = {
	items: [
		{
			id: "asset-001",
			series: "AST-2026-00001",
			assetName: "Hydraulic Pump A",
			itemCode: "HYD-PMP-001",
			assetCategoryId: "cat-001",
			assetCategoryName: "Machinery",
			company: "ACME Corp",
			locationId: null,
			locationName: null,
			custodian: null,
			department: null,
			purchaseDate: "2026-01-01T00:00:00.000Z",
			availableForUseDate: "2026-01-15T00:00:00.000Z",
			disposalDate: null,
			netPurchaseAmount: 100000,
			assetQuantity: 1,
			calculateDepreciation: true,
			openingAccumulatedDepreciation: 20000,
			openingNumberOfBookedDepreciations: 2,
			isFullyDepreciated: false,
			valueAfterDepreciation: 80000,
			maintenanceRequired: false,
			assetOwner: "COMPANY",
			assetOwnerCompany: null,
			supplier: null,
			customer: null,
			policyNumber: null,
			insurer: null,
			insuredValue: null,
			insuranceStartDate: null,
			insuranceEndDate: null,
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: 10,
			frequencyOfDepreciation: 1,
			purchaseReceipt: null,
			purchaseInvoice: null,
			status: "SUBMITTED",
			activities: [],
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-15T00:00:00.000Z",
		},
	],
	totalCount: 1,
};

const previewResponse = {
	assetId: "asset-001",
	assetSeries: "AST-2026-00001",
	assetName: "Hydraulic Pump A",
	assetCategoryName: "Machinery",
	company: "ACME Corp",
	adjustmentDate: "2026-04-15T00:00:00.000Z",
	currentAssetValue: 80000,
	newAssetValue: 90000,
	differenceAmount: 10000,
	direction: "INCREASE",
	fixedAssetAccount: "Machinery Fixed Asset",
	resultingStatus: "PARTIALLY_DEPRECIATED",
	resultingIsFullyDepreciated: false,
	validationMessages: [],
	depreciationSchedule: null,
};

async function mockValueAdjustmentQueries(page: Page) {
	await page.route(
		"**/trpc/asset.listAssetValueAdjustments**",
		async (route) => {
			await route.fulfill({
				contentType: "application/json",
				body: JSON.stringify({ result: { data: adjustmentListResponse } }),
			});
		},
	);

	await page.route("**/trpc/asset.listAssets**", async (route) => {
		await route.fulfill({
			contentType: "application/json",
			body: JSON.stringify({ result: { data: assetsResponse } }),
		});
	});

	await page.route(
		"**/trpc/asset.previewAssetValueAdjustment**",
		async (route) => {
			await route.fulfill({
				contentType: "application/json",
				body: JSON.stringify({ result: { data: previewResponse } }),
			});
		},
	);
	await page.route(
		"**/trpc/asset.getAssetValueAdjustmentById**",
		async (route) => {
			await route.fulfill({
				contentType: "application/json",
				body: JSON.stringify({ result: { data: null } }),
			});
		},
	);
}

test.describe("Asset value adjustment", () => {
	test.beforeEach(async ({ page }) => {
		await mockValueAdjustmentQueries(page);
	});

	test("renders the adjustment list on canonical route", async ({ page }) => {
		await page.goto("/asset/value-adjustments", {
			waitUntil: "domcontentloaded",
		});

		await expect(page).toHaveURL(
			/\/asset\/value-adjustments\/?$/,
		);
		await expect(
			page.getByRole("heading", { name: /asset value adjustment/i }),
		).toBeVisible({ timeout: 30_000 });
		await expect(page.getByPlaceholder(/search adjustments/i)).toBeVisible();
	});

	test("renders the new adjustment form route", async ({ page }) => {
		await page.goto("/asset/value-adjustments/form?assetId=asset-001", {
			waitUntil: "domcontentloaded",
		});

		await expect(
			page.getByRole("heading", { name: /new asset value adjustment/i }),
		).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByLabel(/new asset value/i)).toBeVisible();
		await expect(page.getByLabel(/difference account/i)).toBeVisible();
	});
});
