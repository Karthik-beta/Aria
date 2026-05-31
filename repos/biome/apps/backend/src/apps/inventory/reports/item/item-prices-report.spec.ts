import {
	buildItemPricesRows,
	type ItemPricesSourceItem,
} from "./item-prices-report";

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeItem(
	overrides: Partial<ItemPricesSourceItem> = {},
): ItemPricesSourceItem {
	return {
		code: "ITEM-001",
		name: "Widget Alpha",
		description: "A sturdy aluminium widget",
		disabled: false,
		itemGroup: { groupName: "Electronics" },
		brand: { name: "Acme Corp" },
		defaultUnitOfMeasure: { name: "Nos" },
		valuationRate: 350.0,
		standardSellingRate: 499.99,
		...overrides,
	};
}

const NO_PURCHASE_RATES = new Map<string, number>();

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

describe("buildItemPricesRows – output shape", () => {
	it("maps all fields from a fully-populated source item", () => {
		const lastPurchaseRates = new Map([["ITEM-001", 320.0]]);
		const rows = buildItemPricesRows([makeItem()], lastPurchaseRates);

		expect(rows).toHaveLength(1);
		const row = rows[0];
		expect(row.id).toBe("ITEM-001");
		expect(row.itemCode).toBe("ITEM-001");
		expect(row.itemName).toBe("Widget Alpha");
		expect(row.itemGroupName).toBe("Electronics");
		expect(row.brandName).toBe("Acme Corp");
		expect(row.description).toBe("A sturdy aluminium widget");
		expect(row.stockUom).toBe("Nos");
		expect(row.valuationRate).toBe(350.0);
		expect(row.standardSellingRate).toBe(499.99);
		expect(row.lastPurchaseRate).toBe(320.0);
	});

	it("returns empty array for empty input", () => {
		expect(buildItemPricesRows([], NO_PURCHASE_RATES)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Last purchase rate
// ---------------------------------------------------------------------------

describe("buildItemPricesRows – lastPurchaseRate", () => {
	it("returns null when no purchase history exists for the item", () => {
		const rows = buildItemPricesRows([makeItem()], NO_PURCHASE_RATES);
		expect(rows[0].lastPurchaseRate).toBeNull();
	});

	it("returns the mapped purchase rate when one is present", () => {
		const lastPurchaseRates = new Map([["ITEM-001", 275.5]]);
		const rows = buildItemPricesRows([makeItem()], lastPurchaseRates);
		expect(rows[0].lastPurchaseRate).toBe(275.5);
	});

	it("returns null for an item not present in the purchase rate map even when other items have rates", () => {
		const lastPurchaseRates = new Map([["ITEM-DIFFERENT", 100.0]]);
		const rows = buildItemPricesRows([makeItem()], lastPurchaseRates);
		expect(rows[0].lastPurchaseRate).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Valuation and selling rate defaults
// ---------------------------------------------------------------------------

describe("buildItemPricesRows – rate defaults", () => {
	it("defaults valuationRate to 0 when null", () => {
		const rows = buildItemPricesRows(
			[makeItem({ valuationRate: null })],
			NO_PURCHASE_RATES,
		);
		expect(rows[0].valuationRate).toBe(0);
	});

	it("defaults standardSellingRate to 0 when null", () => {
		const rows = buildItemPricesRows(
			[makeItem({ standardSellingRate: null })],
			NO_PURCHASE_RATES,
		);
		expect(rows[0].standardSellingRate).toBe(0);
	});

	it("preserves zero valuationRate as 0", () => {
		const rows = buildItemPricesRows(
			[makeItem({ valuationRate: 0 })],
			NO_PURCHASE_RATES,
		);
		expect(rows[0].valuationRate).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Null / optional field handling
// ---------------------------------------------------------------------------

describe("buildItemPricesRows – null fields", () => {
	it("returns null itemName when item has no name", () => {
		const rows = buildItemPricesRows(
			[makeItem({ name: null })],
			NO_PURCHASE_RATES,
		);
		expect(rows[0].itemName).toBeNull();
	});

	it("returns null itemGroupName when item has no group", () => {
		const rows = buildItemPricesRows(
			[makeItem({ itemGroup: null })],
			NO_PURCHASE_RATES,
		);
		expect(rows[0].itemGroupName).toBeNull();
	});

	it("returns null brandName when item has no brand", () => {
		const rows = buildItemPricesRows(
			[makeItem({ brand: null })],
			NO_PURCHASE_RATES,
		);
		expect(rows[0].brandName).toBeNull();
	});

	it("returns null description when item has no description", () => {
		const rows = buildItemPricesRows(
			[makeItem({ description: null })],
			NO_PURCHASE_RATES,
		);
		expect(rows[0].description).toBeNull();
	});

	it("returns null stockUom when item has no UOM", () => {
		const rows = buildItemPricesRows(
			[makeItem({ defaultUnitOfMeasure: null })],
			NO_PURCHASE_RATES,
		);
		expect(rows[0].stockUom).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

describe("buildItemPricesRows – sorting", () => {
	it("sorts rows alphabetically by item code ascending", () => {
		const items = [
			makeItem({ code: "ITEM-003", name: "Gamma" }),
			makeItem({ code: "ITEM-001", name: "Alpha" }),
			makeItem({ code: "ITEM-002", name: "Beta" }),
		];
		const rows = buildItemPricesRows(items, NO_PURCHASE_RATES);
		expect(rows.map((row) => row.itemCode)).toEqual([
			"ITEM-001",
			"ITEM-002",
			"ITEM-003",
		]);
	});

	it("handles a single item without error", () => {
		const rows = buildItemPricesRows([makeItem()], NO_PURCHASE_RATES);
		expect(rows).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Multiple items with mixed purchase rates
// ---------------------------------------------------------------------------

describe("buildItemPricesRows – multiple items", () => {
	it("correctly assigns purchase rates to the right items", () => {
		const items = [
			makeItem({
				code: "ITEM-A",
				valuationRate: 100,
				standardSellingRate: 150,
			}),
			makeItem({
				code: "ITEM-B",
				valuationRate: 200,
				standardSellingRate: 300,
			}),
			makeItem({ code: "ITEM-C", valuationRate: 50, standardSellingRate: 75 }),
		];
		const lastPurchaseRates = new Map([
			["ITEM-A", 90.0],
			["ITEM-C", 45.0],
			// ITEM-B intentionally has no purchase rate
		]);
		const rows = buildItemPricesRows(items, lastPurchaseRates);
		expect(rows).toHaveLength(3);

		const rowA = rows.find((r) => r.itemCode === "ITEM-A");
		const rowB = rows.find((r) => r.itemCode === "ITEM-B");
		const rowC = rows.find((r) => r.itemCode === "ITEM-C");

		expect(rowA?.lastPurchaseRate).toBe(90.0);
		expect(rowB?.lastPurchaseRate).toBeNull();
		expect(rowC?.lastPurchaseRate).toBe(45.0);
	});
});
