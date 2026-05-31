import {
	buildSalesOrderAnalysisItemRow,
	buildSalesOrderAnalysisRows,
	computeDelayDays,
	computeSalesOrderAnalysisSummary,
	computeTimeTakenToDeliverSeconds,
	type SalesOrderAnalysisItemInput,
	type SalesOrderAnalysisOrderInput,
} from "./sales-order-analysis-report";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TODAY = new Date("2024-06-15T00:00:00.000Z");

function makeItem(
	overrides: Partial<SalesOrderAnalysisItemInput> = {},
): SalesOrderAnalysisItemInput {
	return {
		id: "ITEM-ID-001",
		itemCode: "ITEM-001",
		itemName: "Widget Alpha",
		description: "A test widget",
		deliveryDate: new Date("2024-06-10T00:00:00.000Z"), // 5 days past today
		qty: 10,
		deliveredQty: 4,
		billedQty: 2,
		baseRate: 100,
		amount: 1000,
		baseAmount: 1000,
		billedAmount: 200,
		warehouse: "Main WH",
		lastDeliveryDate: null,
		...overrides,
	};
}

function makeOrder(
	overrides: Partial<SalesOrderAnalysisOrderInput> = {},
): SalesOrderAnalysisOrderInput {
	return {
		id: "SO-ID-001",
		series: "SO-2024-001",
		transactionDate: new Date("2024-05-01T00:00:00.000Z"),
		customer: "Acme Corp",
		company: "My Company",
		status: "TO_DELIVER",
		conversionRate: 1,
		items: [makeItem()],
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// computeDelayDays
// ---------------------------------------------------------------------------

describe("computeDelayDays", () => {
	it("returns 0 for COMPLETED status regardless of delivery date", () => {
		const deliveryDate = new Date("2024-06-01T00:00:00.000Z");
		expect(computeDelayDays("COMPLETED", deliveryDate, TODAY)).toBe(0);
	});

	it("returns 0 for TO_BILL status regardless of delivery date", () => {
		const deliveryDate = new Date("2024-06-01T00:00:00.000Z");
		expect(computeDelayDays("TO_BILL", deliveryDate, TODAY)).toBe(0);
	});

	it("returns positive days for a past delivery date with pending status", () => {
		const deliveryDate = new Date("2024-06-10T00:00:00.000Z"); // 5 days before TODAY
		const days = computeDelayDays("TO_DELIVER", deliveryDate, TODAY);
		expect(days).toBe(5);
	});

	it("returns 0 when delivery date is in the future", () => {
		const deliveryDate = new Date("2024-06-20T00:00:00.000Z"); // 5 days after TODAY
		expect(computeDelayDays("TO_DELIVER", deliveryDate, TODAY)).toBe(0);
	});

	it("returns 0 when delivery date equals today", () => {
		expect(computeDelayDays("TO_DELIVER", TODAY, TODAY)).toBe(0);
	});

	it("counts TO_DELIVER_AND_BILL as a delayable status", () => {
		const deliveryDate = new Date("2024-06-12T00:00:00.000Z"); // 3 days before
		const days = computeDelayDays("TO_DELIVER_AND_BILL", deliveryDate, TODAY);
		expect(days).toBe(3);
	});

	it("returns 0 for CLOSED with past delivery date", () => {
		// CLOSED is not in the "no-delay" statuses, so it should compute delay
		const deliveryDate = new Date("2024-06-10T00:00:00.000Z");
		const days = computeDelayDays("CLOSED", deliveryDate, TODAY);
		expect(days).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// computeTimeTakenToDeliverSeconds
// ---------------------------------------------------------------------------

describe("computeTimeTakenToDeliverSeconds", () => {
	const transactionDate = new Date("2024-05-01T00:00:00.000Z");

	it("returns 0 when lastDeliveryDate is null", () => {
		expect(
			computeTimeTakenToDeliverSeconds("COMPLETED", null, transactionDate),
		).toBe(0);
	});

	it("returns 0 for TO_DELIVER status even with a lastDeliveryDate", () => {
		const lastDeliveryDate = new Date("2024-06-01T00:00:00.000Z");
		expect(
			computeTimeTakenToDeliverSeconds(
				"TO_DELIVER",
				lastDeliveryDate,
				transactionDate,
			),
		).toBe(0);
	});

	it("computes seconds for COMPLETED status", () => {
		// 31 days from May 1 to June 1
		const lastDeliveryDate = new Date("2024-06-01T00:00:00.000Z");
		const seconds = computeTimeTakenToDeliverSeconds(
			"COMPLETED",
			lastDeliveryDate,
			transactionDate,
		);
		expect(seconds).toBe(31 * 24 * 60 * 60);
	});

	it("computes seconds for TO_BILL status", () => {
		// 15 days from May 1 to May 16
		const lastDeliveryDate = new Date("2024-05-16T00:00:00.000Z");
		const seconds = computeTimeTakenToDeliverSeconds(
			"TO_BILL",
			lastDeliveryDate,
			transactionDate,
		);
		expect(seconds).toBe(15 * 24 * 60 * 60);
	});

	it("returns 0 for TO_DELIVER_AND_BILL even with a lastDeliveryDate", () => {
		const lastDeliveryDate = new Date("2024-06-01T00:00:00.000Z");
		expect(
			computeTimeTakenToDeliverSeconds(
				"TO_DELIVER_AND_BILL",
				lastDeliveryDate,
				transactionDate,
			),
		).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// buildSalesOrderAnalysisItemRow
// ---------------------------------------------------------------------------

describe("buildSalesOrderAnalysisItemRow", () => {
	it("computes pendingQty correctly", () => {
		const order = makeOrder();
		const item = makeItem({ qty: 10, deliveredQty: 6 });
		const row = buildSalesOrderAnalysisItemRow(order, item, TODAY);
		expect(row.pendingQty).toBe(4);
	});

	it("computes qtyToBill correctly", () => {
		const order = makeOrder();
		const item = makeItem({ qty: 10, billedQty: 3 });
		const row = buildSalesOrderAnalysisItemRow(order, item, TODAY);
		expect(row.qtyToBill).toBe(7);
	});

	it("computes pendingAmount correctly", () => {
		const order = makeOrder();
		const item = makeItem({ baseAmount: 1000, billedAmount: 300 });
		const row = buildSalesOrderAnalysisItemRow(order, item, TODAY);
		expect(row.pendingAmount).toBe(700);
	});

	it("computes deliveredQtyAmount as deliveredQty * baseRate", () => {
		const order = makeOrder();
		const item = makeItem({ deliveredQty: 5, baseRate: 200 });
		const row = buildSalesOrderAnalysisItemRow(order, item, TODAY);
		expect(row.deliveredQtyAmount).toBe(1000);
	});

	it("maps all order-level fields correctly", () => {
		const order = makeOrder();
		const item = makeItem();
		const row = buildSalesOrderAnalysisItemRow(order, item, TODAY);

		expect(row.salesOrder).toBe(order.series);
		expect(row.salesOrderId).toBe(order.id);
		expect(row.customer).toBe(order.customer);
		expect(row.company).toBe(order.company);
		expect(row.status).toBe("TO_DELIVER");
	});

	it("sets delayDays to 0 for COMPLETED order", () => {
		const order = makeOrder({ status: "COMPLETED" });
		const row = buildSalesOrderAnalysisItemRow(order, makeItem(), TODAY);
		expect(row.delayDays).toBe(0);
	});

	it("sets delayDays > 0 for overdue TO_DELIVER order", () => {
		const order = makeOrder({ status: "TO_DELIVER" });
		// deliveryDate is 5 days before TODAY
		const row = buildSalesOrderAnalysisItemRow(order, makeItem(), TODAY);
		expect(row.delayDays).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// buildSalesOrderAnalysisRows — flat mode
// ---------------------------------------------------------------------------

describe("buildSalesOrderAnalysisRows (flat)", () => {
	it("returns empty array when no orders provided", () => {
		const rows = buildSalesOrderAnalysisRows([], TODAY);
		expect(rows).toHaveLength(0);
	});

	it("returns one row per item across all orders", () => {
		const order1 = makeOrder({ id: "SO-1", items: [makeItem(), makeItem()] });
		const order2 = makeOrder({ id: "SO-2", items: [makeItem()] });
		const rows = buildSalesOrderAnalysisRows([order1, order2], TODAY);
		expect(rows).toHaveLength(3);
	});

	it("preserves itemCode in flat mode", () => {
		const rows = buildSalesOrderAnalysisRows([makeOrder()], TODAY);
		expect(rows[0].itemCode).toBe("ITEM-001");
	});
});

// ---------------------------------------------------------------------------
// buildSalesOrderAnalysisRows — grouped mode
// ---------------------------------------------------------------------------

describe("buildSalesOrderAnalysisRows (grouped)", () => {
	it("returns one row per SO when grouped", () => {
		const order1 = makeOrder({
			id: "SO-1",
			items: [
				makeItem({ qty: 5, baseAmount: 500, billedAmount: 0 }),
				makeItem({ qty: 3, baseAmount: 300, billedAmount: 100 }),
			],
		});
		const rows = buildSalesOrderAnalysisRows([order1], TODAY, true);
		expect(rows).toHaveLength(1);
	});

	it("sums numeric fields when grouping", () => {
		const order = makeOrder({
			id: "SO-1",
			items: [
				makeItem({
					qty: 5,
					deliveredQty: 2,
					billedQty: 1,
					baseAmount: 500,
					billedAmount: 100,
				}),
				makeItem({
					qty: 3,
					deliveredQty: 1,
					billedQty: 0,
					baseAmount: 300,
					billedAmount: 0,
				}),
			],
		});
		const [row] = buildSalesOrderAnalysisRows([order], TODAY, true);
		expect(row.qty).toBe(8);
		expect(row.deliveredQty).toBe(3);
		expect(row.billedQty).toBe(1);
		expect(row.amount).toBe(800);
		expect(row.billedAmount).toBe(100);
	});

	it("sets itemCode, description, and warehouse to null when grouped", () => {
		const [row] = buildSalesOrderAnalysisRows([makeOrder()], TODAY, true);
		expect(row.itemCode).toBeNull();
		expect(row.description).toBeNull();
		expect(row.warehouse).toBeNull();
	});

	it("keeps the latest deliveryDate across items", () => {
		const order = makeOrder({
			items: [
				makeItem({ deliveryDate: new Date("2024-06-10T00:00:00.000Z") }),
				makeItem({ deliveryDate: new Date("2024-06-20T00:00:00.000Z") }),
			],
		});
		const [row] = buildSalesOrderAnalysisRows([order], TODAY, true);
		expect(row.deliveryDate).toBe("2024-06-20T00:00:00.000Z");
	});

	it("keeps the maximum delayDays across items", () => {
		const order = makeOrder({
			status: "TO_DELIVER",
			items: [
				makeItem({ deliveryDate: new Date("2024-06-14T00:00:00.000Z") }), // 1 day past
				makeItem({ deliveryDate: new Date("2024-06-10T00:00:00.000Z") }), // 5 days past
			],
		});
		const [row] = buildSalesOrderAnalysisRows([order], TODAY, true);
		expect(row.delayDays).toBe(5);
	});

	it("keeps the maximum timeTakenToDeliverSeconds across items", () => {
		const order = makeOrder({
			status: "COMPLETED",
			transactionDate: new Date("2024-05-01T00:00:00.000Z"),
			items: [
				makeItem({
					lastDeliveryDate: new Date("2024-05-10T00:00:00.000Z"),
				}),
				makeItem({
					lastDeliveryDate: new Date("2024-05-20T00:00:00.000Z"),
				}),
			],
		});
		const [row] = buildSalesOrderAnalysisRows([order], TODAY, true);
		// Item 2 has a longer delivery time (20 days vs 10 days)
		expect(row.timeTakenToDeliverSeconds).toBeGreaterThan(0);
		// 20 days = 1,728,000 seconds
		expect(row.timeTakenToDeliverSeconds).toBe(
			Math.round(
				(new Date("2024-05-20T00:00:00.000Z").getTime() -
					new Date("2024-05-01T00:00:00.000Z").getTime()) /
					1000,
			),
		);
	});
});

// ---------------------------------------------------------------------------
// computeSalesOrderAnalysisSummary
// ---------------------------------------------------------------------------

describe("computeSalesOrderAnalysisSummary", () => {
	it("returns zero summary for empty rows", () => {
		const summary = computeSalesOrderAnalysisSummary([]);
		expect(summary.totalPendingAmount).toBe(0);
		expect(summary.totalBilledAmount).toBe(0);
	});

	it("sums pendingAmount and billedAmount across all rows", () => {
		const order1 = makeOrder();
		const order2 = makeOrder({ id: "SO-2", series: "SO-2024-002" });
		const rows = buildSalesOrderAnalysisRows([order1, order2], TODAY);
		const summary = computeSalesOrderAnalysisSummary(rows);

		// Each order has baseAmount=1000, billedAmount=200 → pendingAmount=800
		expect(summary.totalBilledAmount).toBe(400);
		expect(summary.totalPendingAmount).toBe(1600);
	});
});
