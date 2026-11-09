import {
	buildItemPriceStockRows,
	type ItemPriceStockSourceRow,
} from "./item-price-stock-report";

function createItemPriceStockSource(
	overrides: Partial<ItemPriceStockSourceRow> = {},
): ItemPriceStockSourceRow {
	return {
		id: "Nova Gadget House::ITEM-001::Stores - GH",
		company: "Nova Gadget House",
		itemCode: "ITEM-001",
		itemName: "iPhone 13",
		itemGroupName: "Phones",
		brandName: "Apple",
		warehouse: "Stores - GH",
		actualQty: 25,
		buyingRate: 45000,
		sellingRate: 64999,
		lastActivityDate: new Date("2026-03-24T00:00:00.000Z"),
		...overrides,
	};
}

describe("buildItemPriceStockRows", () => {
	it("maps projected stock rows into item price stock rows", () => {
		const rows = buildItemPriceStockRows([createItemPriceStockSource()]);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			itemCode: "ITEM-001",
			availableQty: 25,
			buyingPriceList: "Standard Buying",
			buyingRate: 45000,
			sellingPriceList: "Standard Selling",
			sellingRate: 64999,
		});
	});

	it("filters zero-stock rows when includeZeroStockItems is disabled", () => {
		const rows = buildItemPriceStockRows(
			[
				createItemPriceStockSource({ id: "a", actualQty: 0 }),
				createItemPriceStockSource({ id: "b", actualQty: 2 }),
			],
			{ includeZeroStockItems: false },
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.id).toBe("b");
	});

	it("sorts rows deterministically by company, item code, and warehouse", () => {
		const rows = buildItemPriceStockRows([
			createItemPriceStockSource({
				id: "3",
				company: "Beta Corp",
				itemCode: "ITEM-002",
				warehouse: "W2",
			}),
			createItemPriceStockSource({
				id: "2",
				company: "Alpha Corp",
				itemCode: "ITEM-002",
				warehouse: "W1",
			}),
			createItemPriceStockSource({
				id: "1",
				company: "Alpha Corp",
				itemCode: "ITEM-001",
				warehouse: "W9",
			}),
		]);

		expect(rows.map((row) => row.id)).toEqual(["1", "2", "3"]);
	});
});
