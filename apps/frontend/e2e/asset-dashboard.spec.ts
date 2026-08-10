import { expect, type Locator, type Page, test } from "./fixtures";

function createDashboardData() {
	return {
		kpis: {
			totalAssets: 13,
			activeAssets: 8,
			totalAssetValue: 950_000,
			totalPurchaseValue: 1_500_000,
			totalDepreciation: 350_000,
			maintenanceDueCount: 2,
			pendingAdjustments: 1,
			locationCount: 5,
		},
		statusDistribution: [
			{ status: "SUBMITTED", count: 4, value: 400_000 },
			{ status: "PARTIALLY_DEPRECIATED", count: 3, value: 350_000 },
			{ status: "FULLY_DEPRECIATED", count: 2, value: 0 },
			{ status: "IN_MAINTENANCE", count: 1, value: 100_000 },
			{ status: "SOLD", count: 2, value: 0 },
			{ status: "SCRAPPED", count: 1, value: 0 },
		],
		depreciationTrend: [
			{ month: "2025-01", amount: 25_000 },
			{ month: "2025-02", amount: 28_000 },
			{ month: "2025-03", amount: 27_500 },
		],
		categoryValues: [
			{
				category: "SMT & PCB Assembly Equipment",
				purchaseValue: 800_000,
				currentValue: 500_000,
				assetCount: 5,
			},
			{
				category: "IT Infrastructure",
				purchaseValue: 300_000,
				currentValue: 200_000,
				assetCount: 4,
			},
		],
		locationDistribution: [
			{
				location: "Peenya Phase 2 - Building A",
				assetCount: 6,
				totalValue: 600_000,
			},
			{
				location: "Electronic City - Tower B",
				assetCount: 4,
				totalValue: 250_000,
			},
		],
		maintenanceDue: [
			{
				taskId: "task-1",
				assetName: "SMT Pick & Place - Yamaha YSM20R",
				maintenanceTask: "Nozzle Calibration",
				maintenanceType: "PREVENTIVE",
				assignToName: "Rajesh K.",
				nextDueDate: "2025-06-01T00:00:00.000Z",
				daysUntilDue: -2,
				periodicity: "MONTHLY",
			},
			{
				taskId: "task-2",
				assetName: "HP ProBook 450 G10 (Batch)",
				maintenanceTask: "Software Update",
				maintenanceType: "PREVENTIVE",
				assignToName: null,
				nextDueDate: "2025-07-01T00:00:00.000Z",
				daysUntilDue: 14,
				periodicity: "QUARTERLY",
			},
		],
		recentActivity: [
			{
				id: "act-1",
				assetId: "asset-1",
				assetName: "SMT Pick & Place - Yamaha YSM20R",
				assetSeries: "AST-2025-00001",
				activity: "Created",
				createdAt: "2025-06-01T08:00:00.000Z",
			},
			{
				id: "act-2",
				assetId: "asset-2",
				assetName: "Reflow Oven - Heller 1913 MK5",
				assetSeries: "AST-2025-00002",
				activity: "Submitted",
				createdAt: "2025-06-02T10:30:00.000Z",
			},
		],
		adjustmentSummary: [
			{ status: "DRAFT", count: 1, totalAmount: 25_000 },
			{ status: "SUBMITTED", count: 3, totalAmount: 150_000 },
		],
		insuranceExpiry: [
			{
				assetId: "asset-1",
				assetName: "Reflow Oven - Heller 1913 MK5",
				insurer: "ICICI Lombard",
				policyNumber: "POL-2025-001",
				insuredValue: 800_000,
				insuranceEndDate: "2025-07-15T00:00:00.000Z",
				daysUntilExpiry: 15,
			},
		],
	};
}

async function mockDashboardQuery(page: Page) {
	await page.route("**/trpc/asset.getDashboardData**", async (route) => {
		await route.fulfill({
			contentType: "application/json",
			body: JSON.stringify({
				result: {
					data: createDashboardData(),
				},
			}),
		});
	});
}

async function gotoAssetOverview(page: Page) {
	await page.goto("/asset/dashboard/overview");
	await expect(
		page.getByRole("heading", { name: /asset dashboard/i }),
	).toBeVisible({ timeout: 15_000 });

	const retryButton = page.getByRole("button", { name: /retry/i });
	await expect(async () => {
		if ((await retryButton.count()) > 0) {
			await retryButton.click();
		}

		await expect(
			page.getByText("Total Asset Value", { exact: true }).first(),
		).toBeVisible({ timeout: 3_000 });
	}).toPass({ timeout: 20_000, intervals: [500, 1_000, 2_000] });
}

function cardByTitle(page: Page, title: string): Locator {
	return page
		.locator('[data-slot="card"]')
		.filter({ has: page.getByText(title, { exact: true }) })
		.first();
}

async function expectChartCardToRender(
	page: Page,
	title: string,
	emptyStateMatcher?: RegExp,
) {
	const card = cardByTitle(page, title);
	await card.scrollIntoViewIfNeeded();
	await expect(card).toBeVisible();

	const box = await card.boundingBox();
	expect(box?.height ?? 0).toBeGreaterThan(180);

	const chartCount = await card.locator('[data-slot="chart"]').count();
	if (chartCount > 0) {
		await expect(card.locator('[data-slot="chart"]').first()).toBeVisible();
		return;
	}

	if (emptyStateMatcher) {
		await expect(card).toContainText(emptyStateMatcher);
		return;
	}

	throw new Error(`Expected chart or empty state for "${title}"`);
}

test.describe("Asset dashboard overview", () => {
	test.beforeEach(async ({ page }) => {
		await mockDashboardQuery(page);
	});

	test("renders the bento dashboard cards on desktop", async ({ page }) => {
		await gotoAssetOverview(page);

		for (const title of [
			"Total Asset Value",
			"Active Assets",
			"Maintenance Due",
			"Pending Adjustments",
			"Depreciation Trend",
			"Status Distribution",
			"Value by Category",
			"Asset Value by Location",
			"Recent Asset Activity",
			"Insurance Expiry",
			"Value Adjustments",
		]) {
			await expect(
				page.getByText(title, { exact: true }).first(),
			).toBeVisible();
		}

		await expectChartCardToRender(page, "Depreciation Trend");
		await expectChartCardToRender(page, "Status Distribution");
		await expectChartCardToRender(page, "Value by Category");
		await expectChartCardToRender(page, "Asset Value by Location");
	});

	test("remains usable at a narrower viewport", async ({ page }) => {
		await page.setViewportSize({ width: 960, height: 1400 });
		await gotoAssetOverview(page);

		await expect(page.getByRole("button", { name: /refresh/i })).toBeVisible();

		for (const title of [
			"Recent Asset Activity",
			"Insurance Expiry",
			"Value Adjustments",
		]) {
			const card = cardByTitle(page, title);
			await card.scrollIntoViewIfNeeded();
			await expect(card).toBeVisible();
			const box = await card.boundingBox();
			expect(box?.height ?? 0).toBeGreaterThan(160);
		}
	});
});
