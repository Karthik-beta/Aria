import { expect, type Locator, type Page, test } from "@playwright/test";

function createDashboardData() {
	return {
		kpis: {
			totalItems: 38,
			activeWarehouses: 8,
			pendingMaterialRequests: 1,
			lowStockItemCount: 3,
			totalStockValue: 375000,
			totalStockQuantity: 2400,
		},
		stockMovements: [
			{ date: "2026-03-01", inbound: 120, outbound: 20 },
			{ date: "2026-03-02", inbound: 180, outbound: 75 },
			{ date: "2026-03-03", inbound: 90, outbound: 35 },
		],
		warehouseStock: [
			{ warehouse: "Peenya Main Warehouse", itemCount: 20, totalQty: 1800 },
			{ warehouse: "Peenya Raw Material", itemCount: 12, totalQty: 850 },
		],
		itemGroupDistribution: [
			{ group: "Electronic Components", value: 180000, itemCount: 12 },
			{ group: "Raw Materials", value: 95000, itemCount: 9 },
			{ group: "Finished Goods", value: 100000, itemCount: 7 },
		],
		recentActivity: [
			{
				id: "entry-1",
				series: "MAT-STE-2026-0001",
				type: "MATERIAL_RECEIPT",
				itemCode: "PCB-FR4-01",
				itemName: "FR-4 PCB",
				qty: 200,
				warehouse: "Peenya Main Warehouse",
				postingDate: "2026-03-20T08:00:00.000Z",
			},
			{
				id: "entry-2",
				series: "MAT-STE-2026-0002",
				type: "MATERIAL_TRANSFER",
				itemCode: "RAW-SOLDER-01",
				itemName: "Solder Wire",
				qty: 60,
				warehouse: "Peenya Raw Material",
				postingDate: "2026-03-22T11:30:00.000Z",
			},
		],
		lowStockItems: [
			{
				itemCode: "LOW-001",
				itemName: "Critical Resistor",
				currentQty: 5,
				safetyStock: 25,
				deficit: 20,
				warehouse: "All Warehouses",
			},
			{
				itemCode: "LOW-002",
				itemName: "Relay Module",
				currentQty: 12,
				safetyStock: 20,
				deficit: 8,
				warehouse: "Peenya Main Warehouse",
			},
		],
		batchExpiry: [
			{
				batchId: "BATCH-001",
				itemCode: "RAW-SOLDER-01",
				itemName: "Solder Wire",
				warehouse: "Peenya Main Warehouse",
				quantity: 10,
				expiryDate: "2026-05-01T00:00:00.000Z",
				daysUntilExpiry: 30,
			},
		],
		deliveryStatus: [
			{ status: "DRAFT", count: 1, totalAmount: 1000 },
			{ status: "TO_BILL", count: 1, totalAmount: 2400 },
			{ status: "COMPLETED", count: 4, totalAmount: 25000 },
		],
		topMovingItems: [
			{
				itemCode: "PCB-FR4-01",
				itemName: "FR-4 PCB",
				totalQty: 400,
				transactionCount: 9,
			},
			{
				itemCode: "RAW-SOLDER-01",
				itemName: "Solder Wire",
				totalQty: 260,
				transactionCount: 6,
			},
		],
		stockEntryTypeBreakdown: [
			{ type: "MATERIAL_RECEIPT", count: 8, totalQty: 500 },
			{ type: "MATERIAL_TRANSFER", count: 3, totalQty: 120 },
			{ type: "REPACK", count: 1, totalQty: 30 },
		],
	};
}

async function mockDashboardQuery(page: Page) {
	await page.route("**/trpc/inventory.getDashboardData**", async (route) => {
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

async function gotoInventoryOverview(page: Page) {
	await page.goto("/inventory/dashboard/overview");
	await expect(
		page.getByRole("heading", { name: /inventory dashboard/i }),
	).toBeVisible({ timeout: 15_000 });

	const retryButton = page.getByRole("button", { name: /retry/i });
	await expect(async () => {
		if ((await retryButton.count()) > 0) {
			await retryButton.click();
		}

		await expect(
			page.getByText("Total Stock Value", { exact: true }).first(),
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

test.describe("Inventory dashboard overview", () => {
	test.beforeEach(async ({ page }) => {
		await mockDashboardQuery(page);
	});

	test("renders the bento dashboard cards on desktop", async ({ page }) => {
		await gotoInventoryOverview(page);

		for (const title of [
			"Total Stock Value",
			"Active Items",
			"Low Stock Alerts",
			"Pending Material Requests",
			"Stock Movements",
			"Warehouse Distribution",
			"Stock Value by Category",
			"Top Moving Items",
			"Recent Stock Activity",
			"Stock Entry Breakdown",
			"Batch Expiry Tracker",
			"Delivery Status",
		]) {
			await expect(
				page.getByText(title, { exact: true }).first(),
			).toBeVisible();
		}

		await expectChartCardToRender(page, "Stock Movements");
		await expectChartCardToRender(page, "Warehouse Distribution");
		await expectChartCardToRender(page, "Stock Value by Category");
		await expectChartCardToRender(page, "Top Moving Items");
		await expectChartCardToRender(page, "Stock Entry Breakdown");
	});

	test("remains usable at a narrower viewport", async ({ page }) => {
		await page.setViewportSize({ width: 960, height: 1400 });
		await gotoInventoryOverview(page);

		await expect(page.getByRole("button", { name: /refresh/i })).toBeVisible();

		for (const title of [
			"Top Moving Items",
			"Recent Stock Activity",
			"Batch Expiry Tracker",
			"Delivery Status",
		]) {
			const card = cardByTitle(page, title);
			await card.scrollIntoViewIfNeeded();
			await expect(card).toBeVisible();
			const box = await card.boundingBox();
			expect(box?.height ?? 0).toBeGreaterThan(160);
		}
	});
});
