import {
	buildPurchaseOrderAnalysisItemRow,
	buildPurchaseOrderAnalysisRows,
	computePurchaseOrderAnalysisSummary,
	type PurchaseOrderAnalysisItemInput,
	type PurchaseOrderAnalysisOrderInput,
} from "./purchase-order-analysis-report";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(
	overrides: Partial<PurchaseOrderAnalysisItemInput> = {},
): PurchaseOrderAnalysisItemInput {
	return {
		id: "ITEM-ID-001",
		itemCode: "ITEM-001",
		itemName: "Widget Alpha",
		requiredDate: new Date("2024-06-10T00:00:00.000Z"),
		qty: 10,
		receivedQty: 4,
		billedQty: 2,
		baseRate: 100,
		amount: 1000,
		baseAmount: 1000,
		billedAmount: 200,
		receivedQtyAmount: 400,
		warehouse: "Main WH",
		project: null,
		...overrides,
	};
}

function makeOrder(
	overrides: Partial<PurchaseOrderAnalysisOrderInput> = {},
): PurchaseOrderAnalysisOrderInput {
	return {
		id: "PO-ID-001",
		series: "PO-2024-001",
		transactionDate: new Date("2024-05-01T00:00:00.000Z"),
		supplier: "Acme Supplies",
		company: "My Company",
		status: "TO_RECEIVE",
		conversionRate: 1,
		items: [makeItem()],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// buildPurchaseOrderAnalysisItemRow
// ---------------------------------------------------------------------------

describe("buildPurchaseOrderAnalysisItemRow", () => {
	it("computes pendingQty correctly", () => {
		const order = makeOrder();
		const item = makeItem({ qty: 10, receivedQty: 6 });
		const row = buildPurchaseOrderAnalysisItemRow(order, item);
		expect(row.pendingQty).toBe(4);
	});

	it("computes qtyToBill correctly", () => {
		const order = makeOrder();
		const item = makeItem({ qty: 10, billedQty: 3 });
		const row = buildPurchaseOrderAnalysisItemRow(order, item);
		expect(row.qtyToBill).toBe(7);
	});

	it("computes pendingAmount correctly", () => {
		const order = makeOrder();
		const item = makeItem({ baseAmount: 1000, billedAmount: 300 });
		const row = buildPurchaseOrderAnalysisItemRow(order, item);
		expect(row.pendingAmount).toBe(700);
	});

	it("maps receivedQtyAmount from the item", () => {
		const order = makeOrder();
		const item = makeItem({ receivedQtyAmount: 750 });
		const row = buildPurchaseOrderAnalysisItemRow(order, item);
		expect(row.receivedQtyAmount).toBe(750);
	});

	it("maps all order-level fields correctly", () => {
		const order = makeOrder();
		const item = makeItem();
		const row = buildPurchaseOrderAnalysisItemRow(order, item);

		expect(row.purchaseOrder).toBe(order.series);
		expect(row.purchaseOrderId).toBe(order.id);
		expect(row.supplier).toBe(order.supplier);
		expect(row.company).toBe(order.company);
		expect(row.status).toBe("TO_RECEIVE");
	});

	it("maps project from item level", () => {
		const order = makeOrder();
		const item = makeItem({ project: "Project-Alpha" });
		const row = buildPurchaseOrderAnalysisItemRow(order, item);
		expect(row.project).toBe("Project-Alpha");
	});

	it("returns null project when item project is null", () => {
		const order = makeOrder();
		const item = makeItem({ project: null });
		const row = buildPurchaseOrderAnalysisItemRow(order, item);
		expect(row.project).toBeNull();
	});

	it("uses baseAmount for amount field", () => {
		const order = makeOrder();
		const item = makeItem({ baseAmount: 1200, amount: 1100 });
		const row = buildPurchaseOrderAnalysisItemRow(order, item);
		expect(row.amount).toBe(1200);
	});

	it("serialises dates to ISO strings", () => {
		const order = makeOrder();
		const item = makeItem();
		const row = buildPurchaseOrderAnalysisItemRow(order, item);
		expect(row.date).toBe("2024-05-01T00:00:00.000Z");
		expect(row.requiredDate).toBe("2024-06-10T00:00:00.000Z");
	});
});

// ---------------------------------------------------------------------------
// buildPurchaseOrderAnalysisRows — flat mode
// ---------------------------------------------------------------------------

describe("buildPurchaseOrderAnalysisRows (flat)", () => {
	it("returns empty array when no orders provided", () => {
		const rows = buildPurchaseOrderAnalysisRows([]);
		expect(rows).toHaveLength(0);
	});

	it("returns one row per item across all orders", () => {
		const order1 = makeOrder({ id: "PO-1", items: [makeItem(), makeItem()] });
		const order2 = makeOrder({ id: "PO-2", items: [makeItem()] });
		const rows = buildPurchaseOrderAnalysisRows([order1, order2]);
		expect(rows).toHaveLength(3);
	});

	it("preserves itemCode in flat mode", () => {
		const rows = buildPurchaseOrderAnalysisRows([makeOrder()]);
		expect(rows[0].itemCode).toBe("ITEM-001");
	});

	it("preserves project in flat mode", () => {
		const order = makeOrder({
			items: [makeItem({ project: "Project-Beta" })],
		});
		const rows = buildPurchaseOrderAnalysisRows([order]);
		expect(rows[0].project).toBe("Project-Beta");
	});

	it("preserves warehouse in flat mode", () => {
		const rows = buildPurchaseOrderAnalysisRows([makeOrder()]);
		expect(rows[0].warehouse).toBe("Main WH");
	});
});

// ---------------------------------------------------------------------------
// buildPurchaseOrderAnalysisRows — grouped mode
// ---------------------------------------------------------------------------

describe("buildPurchaseOrderAnalysisRows (grouped)", () => {
	it("returns one row per PO when grouped", () => {
		const order1 = makeOrder({
			id: "PO-1",
			items: [
				makeItem({ qty: 5, baseAmount: 500, billedAmount: 0 }),
				makeItem({ qty: 3, baseAmount: 300, billedAmount: 100 }),
			],
		});
		const rows = buildPurchaseOrderAnalysisRows([order1], true);
		expect(rows).toHaveLength(1);
	});

	it("sums numeric fields when grouping", () => {
		const order = makeOrder({
			id: "PO-1",
			items: [
				makeItem({
					qty: 5,
					receivedQty: 2,
					billedQty: 1,
					baseAmount: 500,
					billedAmount: 100,
					receivedQtyAmount: 200,
				}),
				makeItem({
					qty: 3,
					receivedQty: 1,
					billedQty: 0,
					baseAmount: 300,
					billedAmount: 0,
					receivedQtyAmount: 100,
				}),
			],
		});
		const [row] = buildPurchaseOrderAnalysisRows([order], true);
		expect(row.qty).toBe(8);
		expect(row.receivedQty).toBe(3);
		expect(row.billedQty).toBe(1);
		expect(row.amount).toBe(800);
		expect(row.billedAmount).toBe(100);
		expect(row.receivedQtyAmount).toBe(300);
	});

	it("sets itemCode, project, and warehouse to null when grouped", () => {
		const [row] = buildPurchaseOrderAnalysisRows([makeOrder()], true);
		expect(row.itemCode).toBeNull();
		expect(row.project).toBeNull();
		expect(row.warehouse).toBeNull();
	});

	it("keeps the earliest requiredDate across items", () => {
		const order = makeOrder({
			items: [
				makeItem({ requiredDate: new Date("2024-06-20T00:00:00.000Z") }),
				makeItem({ requiredDate: new Date("2024-06-10T00:00:00.000Z") }),
			],
		});
		const [row] = buildPurchaseOrderAnalysisRows([order], true);
		expect(row.requiredDate).toBe("2024-06-10T00:00:00.000Z");
	});

	it("returns separate rows for different POs even in grouped mode", () => {
		const order1 = makeOrder({ id: "PO-1", series: "PO-2024-001" });
		const order2 = makeOrder({ id: "PO-2", series: "PO-2024-002" });
		const rows = buildPurchaseOrderAnalysisRows([order1, order2], true);
		expect(rows).toHaveLength(2);
	});

	it("handles PO with no items gracefully in grouped mode", () => {
		const order = makeOrder({ items: [] });
		const rows = buildPurchaseOrderAnalysisRows([order], true);
		expect(rows).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// computePurchaseOrderAnalysisSummary
// ---------------------------------------------------------------------------

describe("computePurchaseOrderAnalysisSummary", () => {
	it("returns zero summary for empty rows", () => {
		const summary = computePurchaseOrderAnalysisSummary([]);
		expect(summary.totalPendingAmount).toBe(0);
		expect(summary.totalBilledAmount).toBe(0);
	});

	it("sums pendingAmount and billedAmount across all rows", () => {
		const order1 = makeOrder();
		const order2 = makeOrder({ id: "PO-2", series: "PO-2024-002" });
		const rows = buildPurchaseOrderAnalysisRows([order1, order2]);
		const summary = computePurchaseOrderAnalysisSummary(rows);

		// Each order has baseAmount=1000, billedAmount=200 → pendingAmount=800
		expect(summary.totalBilledAmount).toBe(400);
		expect(summary.totalPendingAmount).toBe(1600);
	});

	it("handles rows with zero pending amount correctly", () => {
		const rows = buildPurchaseOrderAnalysisRows([
			makeOrder({
				items: [makeItem({ baseAmount: 500, billedAmount: 500 })],
			}),
		]);
		const summary = computePurchaseOrderAnalysisSummary(rows);
		expect(summary.totalPendingAmount).toBe(0);
		expect(summary.totalBilledAmount).toBe(500);
	});
});
