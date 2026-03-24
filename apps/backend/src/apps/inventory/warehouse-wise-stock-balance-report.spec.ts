import { buildWarehouseWiseStockBalanceRows } from "./warehouse-wise-stock-balance-report";

describe("buildWarehouseWiseStockBalanceRows", () => {
	it("maps ledger rows into warehouse-wise report rows", () => {
		const rows = buildWarehouseWiseStockBalanceRows([
			{
				id: "item-1:Stores - GH:IN",
				stockEntryId: "stock-entry-1",
				stockEntryItemId: "item-1",
				company: "Aria Corp",
				itemCode: "ITEM-001",
				itemName: "Item One",
				warehouse: "Stores - GH",
				postingDate: new Date("2026-03-20T00:00:00.000Z"),
				voucherNo: "MAT-STE-2026-00020",
				qtyIn: 5,
				qtyOut: 0,
				basicRate: 120,
				movementType: "IN",
				createdAt: new Date("2026-03-20T08:00:00.000Z"),
				updatedAt: new Date("2026-03-20T08:00:00.000Z"),
			},
			{
				id: "item-2:Stores - GH:OUT",
				stockEntryId: "stock-entry-2",
				stockEntryItemId: "item-2",
				company: "Aria Corp",
				itemCode: "ITEM-001",
				itemName: "Item One",
				warehouse: "Stores - GH",
				postingDate: new Date("2026-03-21T00:00:00.000Z"),
				voucherNo: "MAT-STE-2026-00021",
				qtyIn: 0,
				qtyOut: 2,
				basicRate: 120,
				movementType: "OUT",
				createdAt: new Date("2026-03-21T08:00:00.000Z"),
				updatedAt: new Date("2026-03-21T08:00:00.000Z"),
			},
		]);

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			id: "item-2:Stores - GH:OUT",
			qtyChange: -2,
			incomingRate: 0,
			movementType: "OUT",
		});
		expect(rows[1]).toMatchObject({
			id: "item-1:Stores - GH:IN",
			qtyChange: 5,
			incomingRate: 120,
			movementType: "IN",
		});
	});

	it("falls back itemName to null", () => {
		const rows = buildWarehouseWiseStockBalanceRows([
			{
				id: "item-1:Stores - GH:IN",
				stockEntryId: "stock-entry-1",
				stockEntryItemId: "item-1",
				company: "Aria Corp",
				itemCode: "ITEM-001",
				itemName: null,
				warehouse: "Stores - GH",
				postingDate: new Date("2026-03-20T00:00:00.000Z"),
				voucherNo: "MAT-STE-2026-00020",
				qtyIn: 1,
				qtyOut: 0,
				basicRate: 120,
				movementType: "IN",
				createdAt: new Date("2026-03-20T08:00:00.000Z"),
				updatedAt: new Date("2026-03-20T08:00:00.000Z"),
			},
		]);

		expect(rows[0]?.itemName).toBeNull();
	});
});
