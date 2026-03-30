import {
	buildStockProjectedQtyRows,
	type StockProjectedQtySourceRow,
} from "./stock-projected-qty-report";

function createProjectedQtyRow(
	overrides: Partial<StockProjectedQtySourceRow> = {},
): StockProjectedQtySourceRow {
	return {
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
		reorderLevel: 10,
		reorderQty: 4,
		lastActivityDate: new Date("2026-03-24T00:00:00.000Z"),
		...overrides,
	};
}

describe("buildStockProjectedQtyRows", () => {
	it("calculates projected and shortage quantities from all contributing buckets", () => {
		const rows = buildStockProjectedQtyRows([
			createProjectedQtyRow({ actualQty: 11 }),
			createProjectedQtyRow({ orderedQty: 45 }),
			createProjectedQtyRow({ reservedQty: 5 }),
			createProjectedQtyRow({ reorderLevel: 60 }),
		]);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			actualQty: 11,
			orderedQty: 45,
			reservedQty: 5,
			projectedQty: 51,
			reorderLevel: 60,
			shortageQty: 9,
		});
	});

	it("keeps zero rows only when explicitly requested", () => {
		const zeroRow = createProjectedQtyRow({ reorderLevel: 0, reorderQty: 0 });

		expect(buildStockProjectedQtyRows([zeroRow])).toHaveLength(0);
		expect(
			buildStockProjectedQtyRows([zeroRow], { includeZeroStockItems: true }),
		).toHaveLength(1);
	});

	it("aggregates company, item, and warehouse partitions independently", () => {
		const rows = buildStockProjectedQtyRows([
			createProjectedQtyRow({ actualQty: 2 }),
			createProjectedQtyRow({ warehouse: "Finished Goods - GH", actualQty: 3 }),
			createProjectedQtyRow({ company: "Nova Gadget House - 2", actualQty: 4 }),
		]);

		expect(rows).toHaveLength(3);
		expect(
			rows.map((row) => row.projectedQty).sort((left, right) => left - right),
		).toEqual([2, 3, 4]);
	});
});
