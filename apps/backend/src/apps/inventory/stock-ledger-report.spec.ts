import {
	buildStockLedgerRows,
	type StockLedgerReportItem,
} from "./stock-ledger-report";

function createReportItem(
	overrides: Partial<StockLedgerReportItem> = {},
): StockLedgerReportItem {
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
			postingDate: new Date("2026-01-10T00:00:00.000Z"),
			company: "Aria Corp",
			status: "DRAFT",
			project: null,
			defaultSourceWarehouse: null,
			defaultTargetWarehouse: "Stores - GH",
			isOpening: false,
			remarks: "Initial receipt",
			printHeading: null,
			letterHead: null,
			inspectionRequired: false,
			createdAt: new Date("2026-01-10T08:00:00.000Z"),
			updatedAt: new Date("2026-01-10T08:00:00.000Z"),
		},
		...overrides,
	} as StockLedgerReportItem;
}

describe("buildStockLedgerRows", () => {
	it("creates inward rows using header default warehouse and accumulates running balance", () => {
		const firstItem = createReportItem();
		const secondItem = createReportItem({
			id: "stock-entry-item-2",
			stockEntryId: "stock-entry-2",
			qty: 5,
			basicAmount: 500,
			stockEntry: {
				...createReportItem().stockEntry,
				id: "stock-entry-2",
				series: "MAT-STE-2026-00002",
				postingDate: new Date("2026-01-11T00:00:00.000Z"),
				createdAt: new Date("2026-01-11T08:00:00.000Z"),
				updatedAt: new Date("2026-01-11T08:00:00.000Z"),
			},
		});

		const rows = buildStockLedgerRows([firstItem, secondItem]);

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			warehouse: "Stores - GH",
			movementType: "IN",
			qtyIn: 10,
			qtyOut: 0,
			balanceQty: 10,
		});
		expect(rows[1]).toMatchObject({
			warehouse: "Stores - GH",
			movementType: "IN",
			qtyIn: 5,
			qtyOut: 0,
			balanceQty: 15,
		});
	});

	it("expands transfer items into outward and inward rows", () => {
		const transferItem = createReportItem({
			id: "stock-entry-item-transfer",
			sourceWarehouse: "Stores - GH",
			targetWarehouse: "Stores - WH2",
			qty: 4,
			basicAmount: 400,
			stockEntry: {
				...createReportItem().stockEntry,
				series: "MAT-STE-2026-00003",
				stockEntryType: "MATERIAL_TRANSFER",
			},
		});

		const rows = buildStockLedgerRows([transferItem]);

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			warehouse: "Stores - GH",
			movementType: "OUT",
			qtyIn: 0,
			qtyOut: 4,
			balanceQty: -4,
		});
		expect(rows[1]).toMatchObject({
			warehouse: "Stores - WH2",
			movementType: "IN",
			qtyIn: 4,
			qtyOut: 0,
			balanceQty: 4,
		});
	});

	it("applies warehouse filtering before row expansion", () => {
		const transferItem = createReportItem({
			sourceWarehouse: "Stores - GH",
			targetWarehouse: "Stores - WH2",
			stockEntry: {
				...createReportItem().stockEntry,
				stockEntryType: "MATERIAL_TRANSFER",
			},
		});

		const rows = buildStockLedgerRows([transferItem], {
			warehouse: "Stores - WH2",
		});

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			warehouse: "Stores - WH2",
			movementType: "IN",
			qtyIn: 10,
			qtyOut: 0,
			balanceQty: 10,
		});
	});
});
