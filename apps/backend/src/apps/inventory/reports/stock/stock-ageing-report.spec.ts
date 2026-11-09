import {
	buildStockAgeingRows,
	type StockAgeingReportItem,
} from "./stock-ageing-report";

function createReportItem(
	overrides: Partial<StockAgeingReportItem> = {},
): StockAgeingReportItem {
	return {
		id: "stock-entry-item-1",
		stockEntryId: "stock-entry-1",
		sourceWarehouse: null,
		targetWarehouse: null,
		itemCode: "ITEM-001",
		itemName: "Item One",
		description: "Primary test item",
		qty: 10,
		basicRate: 100,
		basicAmount: 1000,
		unitOfMeasure: "Nos",
		stockEntry: {
			id: "stock-entry-1",
			series: "MAT-STE-2026-00001",
			stockEntryType: "MATERIAL_RECEIPT",
			postingDate: new Date("2026-01-01T00:00:00.000Z"),
			company: "Aria Corp",
			status: "SUBMITTED",
			project: null,
			defaultSourceWarehouse: null,
			defaultTargetWarehouse: "Stores - GH",
			isOpening: false,
			remarks: null,
			printHeading: null,
			letterHead: null,
			inspectionRequired: false,
			createdAt: new Date("2026-01-01T08:00:00.000Z"),
			updatedAt: new Date("2026-01-01T08:00:00.000Z"),
		},
		...overrides,
	} as StockAgeingReportItem;
}

describe("buildStockAgeingRows", () => {
	it("allocates remaining stock into ageing buckets and computes average age", () => {
		const receipt = createReportItem();
		const issue = createReportItem({
			id: "stock-entry-item-2",
			stockEntryId: "stock-entry-2",
			sourceWarehouse: "Stores - GH",
			targetWarehouse: null,
			qty: 4,
			basicAmount: 400,
			stockEntry: {
				...createReportItem().stockEntry,
				id: "stock-entry-2",
				series: "MAT-STE-2026-00002",
				stockEntryType: "MATERIAL_ISSUE",
				postingDate: new Date("2026-01-20T00:00:00.000Z"),
				createdAt: new Date("2026-01-20T08:00:00.000Z"),
				updatedAt: new Date("2026-01-20T08:00:00.000Z"),
				defaultTargetWarehouse: null,
				defaultSourceWarehouse: "Stores - GH",
			},
		});

		const rows = buildStockAgeingRows([receipt, issue], {
			asOfDate: new Date("2026-02-10T00:00:00.000Z"),
			bucketRanges: [
				{ minAge: 0, maxAge: 30 },
				{ minAge: 31, maxAge: 60 },
				{ minAge: 61, maxAge: null },
			],
			showWarehouseWiseStock: true,
		});

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			itemCode: "ITEM-001",
			warehouse: "Stores - GH",
			availableQty: 6,
			averageAge: 40,
			averageRate: 100,
		});
		expect(rows[0]?.buckets).toEqual([
			{ index: 0, minAge: 0, maxAge: 30, quantity: 0, value: 0 },
			{ index: 1, minAge: 31, maxAge: 60, quantity: 6, value: 600 },
			{ index: 2, minAge: 61, maxAge: null, quantity: 0, value: 0 },
		]);
	});

	it("preserves original acquisition age when stock is transferred", () => {
		const receipt = createReportItem({
			qty: 8,
			stockEntry: {
				...createReportItem().stockEntry,
				defaultTargetWarehouse: "Stores - GH",
			},
		});
		const transfer = createReportItem({
			id: "stock-entry-item-2",
			stockEntryId: "stock-entry-2",
			sourceWarehouse: "Stores - GH",
			targetWarehouse: "Stores - WH2",
			qty: 5,
			basicAmount: 500,
			stockEntry: {
				...createReportItem().stockEntry,
				id: "stock-entry-2",
				series: "MAT-STE-2026-00002",
				stockEntryType: "MATERIAL_TRANSFER",
				postingDate: new Date("2026-01-15T00:00:00.000Z"),
				createdAt: new Date("2026-01-15T08:00:00.000Z"),
				updatedAt: new Date("2026-01-15T08:00:00.000Z"),
			},
		});

		const rows = buildStockAgeingRows([receipt, transfer], {
			asOfDate: new Date("2026-02-01T00:00:00.000Z"),
			bucketRanges: [
				{ minAge: 0, maxAge: 20 },
				{ minAge: 21, maxAge: null },
			],
			showWarehouseWiseStock: true,
		});

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			warehouse: "Stores - GH",
			availableQty: 3,
			averageAge: 31,
		});
		expect(rows[1]).toMatchObject({
			warehouse: "Stores - WH2",
			availableQty: 5,
			averageAge: 31,
		});
		expect(rows[1]?.buckets[1]).toMatchObject({
			quantity: 5,
			value: 500,
		});
	});

	it("aggregates warehouse layers back to item level when warehouse-wise mode is off", () => {
		const firstReceipt = createReportItem({
			qty: 3,
			stockEntry: {
				...createReportItem().stockEntry,
				defaultTargetWarehouse: "Stores - GH",
			},
		});
		const secondReceipt = createReportItem({
			id: "stock-entry-item-2",
			stockEntryId: "stock-entry-2",
			qty: 2,
			basicRate: 120,
			basicAmount: 240,
			stockEntry: {
				...createReportItem().stockEntry,
				id: "stock-entry-2",
				series: "MAT-STE-2026-00002",
				postingDate: new Date("2026-01-10T00:00:00.000Z"),
				defaultTargetWarehouse: "Stores - WH2",
				createdAt: new Date("2026-01-10T08:00:00.000Z"),
				updatedAt: new Date("2026-01-10T08:00:00.000Z"),
			},
		});

		const rows = buildStockAgeingRows([firstReceipt, secondReceipt], {
			asOfDate: new Date("2026-01-20T00:00:00.000Z"),
			bucketRanges: [
				{ minAge: 0, maxAge: 15 },
				{ minAge: 16, maxAge: null },
			],
			showWarehouseWiseStock: false,
		});

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			itemCode: "ITEM-001",
			warehouse: null,
			availableQty: 5,
			averageRate: 108,
		});
		expect(rows[0]?.buckets).toEqual([
			{ index: 0, minAge: 0, maxAge: 15, quantity: 2, value: 240 },
			{ index: 1, minAge: 16, maxAge: null, quantity: 3, value: 300 },
		]);
	});
});
