import {
	buildStockSummaryRows,
	type StockSummarySourceRow,
} from "./stock-summary-report";

function createStockSummaryRow(
	overrides: Partial<StockSummarySourceRow> = {},
): StockSummarySourceRow {
	return {
		id: "Nova Gadget House::ITEM-001::Stores - GH",
		company: "Nova Gadget House",
		itemCode: "ITEM-001",
		itemName: "iPhone 13",
		description: "128 GB",
		itemGroupName: "Phones",
		brandName: "Apple",
		warehouse: "Stores - GH",
		unitOfMeasure: "Nos",
		actualQty: 0,
		plannedQty: 0,
		requestedQty: 0,
		orderedQty: 0,
		reservedQty: 0,
		reservedQtyForProduction: 0,
		reservedQtyForSubcontracting: 0,
		reservedQtyForProductionPlan: 0,
		projectedQty: 0,
		reorderLevel: 10,
		reorderQty: 5,
		shortageQty: 10,
		lastActivityDate: new Date("2026-03-24T00:00:00.000Z"),
		...overrides,
	};
}

describe("buildStockSummaryRows", () => {
	it("derives primary metric, health, and recommended actions", () => {
		const rows = buildStockSummaryRows([
			createStockSummaryRow({
				actualQty: 12,
				projectedQty: 18,
				shortageQty: 0,
			}),
			createStockSummaryRow({
				id: "Nova Gadget House::ITEM-002::Stores - GH",
				itemCode: "ITEM-002",
				projectedQty: -2,
				shortageQty: 12,
			}),
		]);

		expect(rows[0]).toMatchObject({
			primaryMetric: "PROJECTED_QTY",
			primaryMetricValue: 18,
			stockHealth: "SURPLUS",
			recommendedAction: "MOVE_AND_ADD",
		});
		expect(rows[1]).toMatchObject({
			stockHealth: "CRITICAL",
			recommendedAction: "ADD",
		});
	});

	it("sorts by the requested metric and direction", () => {
		const rows = buildStockSummaryRows(
			[
				createStockSummaryRow({ itemCode: "ITEM-001", reservedQty: 3 }),
				createStockSummaryRow({
					id: "Nova Gadget House::ITEM-002::Stores - GH",
					itemCode: "ITEM-002",
					reservedQty: 9,
				}),
			],
			{ metric: "RESERVED_QTY", sortDirection: "asc" },
		);

		expect(rows.map((row) => row.itemCode)).toEqual(["ITEM-001", "ITEM-002"]);
		expect(rows.map((row) => row.primaryMetricValue)).toEqual([3, 9]);
	});
});
