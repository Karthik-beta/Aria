import { describe, expect, it } from "vitest";
import {
	applyWarehouseWiseFilterRules,
	formatWarehouseWiseStockCurrency,
	formatWarehouseWiseStockQuantity,
	groupWarehouseWiseRows,
	sortWarehouseWiseRows,
	type WarehouseWiseFilterRule,
	type WarehouseWiseStockBalanceRow,
} from "./warehouse-wise-stock-balance.utils";

function createRow(
	overrides: Partial<WarehouseWiseStockBalanceRow> = {},
): WarehouseWiseStockBalanceRow {
	return {
		id: "item-1:Stores - GH:IN",
		stockEntryId: "stock-entry-1",
		stockEntryItemId: "item-1",
		company: "Aria Corp",
		itemCode: "ITEM-001",
		itemName: "Item 1",
		warehouse: "Stores - GH",
		postingDate: new Date("2026-03-24T00:00:00.000Z"),
		voucherNo: "MAT-STE-2026-00001",
		qtyChange: 5,
		incomingRate: 100,
		movementType: "IN",
		createdAt: new Date("2026-03-24T09:00:00.000Z"),
		updatedAt: new Date("2026-03-24T10:00:00.000Z"),
		...overrides,
	};
}

describe("warehouse-wise-stock-balance.utils", () => {
	it("formats quantity and currency", () => {
		expect(formatWarehouseWiseStockQuantity(12.5)).toBe("12.500");
		expect(formatWarehouseWiseStockCurrency(1234.5, "USD")).toContain(
			"1,234.50",
		);
	});

	it("applies filter rules against text and numeric fields", () => {
		const rows = [
			createRow(),
			createRow({
				id: "item-2:Stores - WH2:OUT",
				warehouse: "Stores - WH2",
				itemCode: "ITEM-002",
				qtyChange: -2,
				incomingRate: 0,
				movementType: "OUT",
			}),
		];

		const rules: WarehouseWiseFilterRule[] = [
			{ id: "r1", field: "itemCode", operator: "contains", value: "ITEM-00" },
			{ id: "r2", field: "qtyChange", operator: "gt", value: "0" },
		];

		const filtered = applyWarehouseWiseFilterRules(rows, rules);
		expect(filtered).toHaveLength(1);
		expect(filtered[0]?.itemCode).toBe("ITEM-001");
	});

	it("sorts rows by selected strategy", () => {
		const rows = [
			createRow({ id: "b", qtyChange: 1, incomingRate: 50 }),
			createRow({ id: "a", qtyChange: 10, incomingRate: 200 }),
		];

		expect(sortWarehouseWiseRows(rows, "ID")[0]?.id).toBe("a");
		expect(sortWarehouseWiseRows(rows, "QTY_CHANGE")[0]?.qtyChange).toBe(10);
		expect(sortWarehouseWiseRows(rows, "INCOMING_RATE")[0]?.incomingRate).toBe(
			200,
		);
	});

	it("groups rows by selected field", () => {
		const groups = groupWarehouseWiseRows(
			[
				createRow({
					warehouse: "Stores - GH",
					qtyChange: 5,
					incomingRate: 100,
				}),
				createRow({
					id: "item-2",
					warehouse: "Stores - GH",
					qtyChange: -1,
					incomingRate: 80,
				}),
				createRow({
					id: "item-3",
					warehouse: "WH2",
					qtyChange: 2,
					incomingRate: 0,
				}),
			],
			"warehouse",
		);

		expect(groups).toHaveLength(2);
		const stores = groups.find((group) => group.groupValue === "Stores - GH");
		expect(stores).toMatchObject({
			count: 2,
			totalQtyChange: 4,
			averageIncomingRate: 90,
		});
	});
});
