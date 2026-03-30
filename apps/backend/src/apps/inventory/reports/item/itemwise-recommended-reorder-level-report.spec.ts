import {
	buildItemwiseRecommendedReorderLevelRows,
	type ReorderLevelItemSource,
} from "./itemwise-recommended-reorder-level-report";

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeItem(
	overrides: Partial<ReorderLevelItemSource> = {},
): ReorderLevelItemSource {
	return {
		code: "ITEM-001",
		name: "Widget Alpha",
		description: "Standard widget",
		safetyStock: 10,
		leadTimeDays: 5,
		itemGroupName: "Raw Material",
		brandName: "BrandX",
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// buildItemwiseRecommendedReorderLevelRows — core computation
// ---------------------------------------------------------------------------

describe("buildItemwiseRecommendedReorderLevelRows – core computation", () => {
	it("returns empty array when numberOfDays is zero", () => {
		const rows = buildItemwiseRecommendedReorderLevelRows(
			[makeItem()],
			new Map(),
			new Map(),
			0,
		);
		expect(rows).toHaveLength(0);
	});

	it("returns empty array when numberOfDays is negative", () => {
		const rows = buildItemwiseRecommendedReorderLevelRows(
			[makeItem()],
			new Map(),
			new Map(),
			-5,
		);
		expect(rows).toHaveLength(0);
	});

	it("returns empty array for empty item list", () => {
		const rows = buildItemwiseRecommendedReorderLevelRows(
			[],
			new Map(),
			new Map(),
			30,
		);
		expect(rows).toHaveLength(0);
	});

	it("calculates reorder level correctly with both consumed and delivered", () => {
		// consumed=150, delivered=50, totalOutgoing=200, days=20
		// avgDailyOutgoing = 200 / 20 = 10
		// reorderLevel = (10 * 5) + 10 = 60
		const items = [makeItem({ safetyStock: 10, leadTimeDays: 5 })];
		const consumed = new Map([["ITEM-001", 150]]);
		const delivered = new Map([["ITEM-001", 50]]);

		const rows = buildItemwiseRecommendedReorderLevelRows(
			items,
			consumed,
			delivered,
			20,
		);

		expect(rows).toHaveLength(1);
		expect(rows[0].consumed).toBe(150);
		expect(rows[0].delivered).toBe(50);
		expect(rows[0].totalOutgoing).toBe(200);
		expect(rows[0].avgDailyOutgoing).toBe(10);
		expect(rows[0].reorderLevel).toBe(60);
	});

	it("calculates reorder level with only consumed items (no delivered)", () => {
		// consumed=60, delivered=0, totalOutgoing=60, days=30
		// avgDailyOutgoing = 60 / 30 = 2
		// reorderLevel = (2 * 5) + 10 = 20
		const items = [makeItem({ safetyStock: 10, leadTimeDays: 5 })];
		const consumed = new Map([["ITEM-001", 60]]);

		const rows = buildItemwiseRecommendedReorderLevelRows(
			items,
			consumed,
			new Map(),
			30,
		);

		expect(rows[0].consumed).toBe(60);
		expect(rows[0].delivered).toBe(0);
		expect(rows[0].totalOutgoing).toBe(60);
		expect(rows[0].avgDailyOutgoing).toBe(2);
		expect(rows[0].reorderLevel).toBe(20);
	});

	it("calculates reorder level with only delivered items (no consumed)", () => {
		// consumed=0, delivered=90, totalOutgoing=90, days=30
		// avgDailyOutgoing = 90 / 30 = 3
		// reorderLevel = (3 * 5) + 10 = 25
		const items = [makeItem({ safetyStock: 10, leadTimeDays: 5 })];
		const delivered = new Map([["ITEM-001", 90]]);

		const rows = buildItemwiseRecommendedReorderLevelRows(
			items,
			new Map(),
			delivered,
			30,
		);

		expect(rows[0].consumed).toBe(0);
		expect(rows[0].delivered).toBe(90);
		expect(rows[0].totalOutgoing).toBe(90);
		expect(rows[0].avgDailyOutgoing).toBe(3);
		expect(rows[0].reorderLevel).toBe(25);
	});

	it("handles zero safety stock and zero lead time", () => {
		// consumed=100, delivered=0, totalOutgoing=100, days=10
		// avgDailyOutgoing = 100 / 10 = 10
		// reorderLevel = (10 * 0) + 0 = 0
		const items = [makeItem({ safetyStock: 0, leadTimeDays: 0 })];
		const consumed = new Map([["ITEM-001", 100]]);

		const rows = buildItemwiseRecommendedReorderLevelRows(
			items,
			consumed,
			new Map(),
			10,
		);

		expect(rows[0].avgDailyOutgoing).toBe(10);
		expect(rows[0].reorderLevel).toBe(0);
	});

	it("handles items with no outgoing movements", () => {
		// consumed=0, delivered=0, totalOutgoing=0, days=30
		// avgDailyOutgoing = 0
		// reorderLevel = (0 * 5) + 10 = 10 (just safety stock)
		const items = [makeItem({ safetyStock: 10, leadTimeDays: 5 })];

		const rows = buildItemwiseRecommendedReorderLevelRows(
			items,
			new Map(),
			new Map(),
			30,
		);

		expect(rows[0].consumed).toBe(0);
		expect(rows[0].delivered).toBe(0);
		expect(rows[0].totalOutgoing).toBe(0);
		expect(rows[0].avgDailyOutgoing).toBe(0);
		expect(rows[0].reorderLevel).toBe(10);
	});

	it("rounds values to 3 decimal places by default", () => {
		// consumed=100, delivered=0, days=3
		// avgDailyOutgoing = 100 / 3 ≈ 33.333...
		// reorderLevel = (33.333 * 5) + 0 = 166.667
		const items = [makeItem({ safetyStock: 0, leadTimeDays: 5 })];
		const consumed = new Map([["ITEM-001", 100]]);

		const rows = buildItemwiseRecommendedReorderLevelRows(
			items,
			consumed,
			new Map(),
			3,
		);

		expect(rows[0].avgDailyOutgoing).toBe(33.333);
		// reorderLevel = round(33.333 * 5 + 0, 3) = 166.665
		expect(rows[0].reorderLevel).toBe(166.665);
	});

	it("respects custom float precision", () => {
		const items = [makeItem({ safetyStock: 0, leadTimeDays: 5 })];
		const consumed = new Map([["ITEM-001", 100]]);

		const rows = buildItemwiseRecommendedReorderLevelRows(
			items,
			consumed,
			new Map(),
			3,
			2, // 2 decimal places
		);

		expect(rows[0].avgDailyOutgoing).toBe(33.33);
		// reorderLevel = round(33.33 * 5 + 0, 2) = 166.65
		expect(rows[0].reorderLevel).toBe(166.65);
	});
});

// ---------------------------------------------------------------------------
// buildItemwiseRecommendedReorderLevelRows — field mapping
// ---------------------------------------------------------------------------

describe("buildItemwiseRecommendedReorderLevelRows – field mapping", () => {
	it("maps all metadata fields from item source", () => {
		const items = [
			makeItem({
				code: "WIDGET-001",
				name: "Primary Widget",
				description: "High-grade widget",
				safetyStock: 25,
				leadTimeDays: 7,
				itemGroupName: "Finished Goods",
				brandName: "BrandY",
			}),
		];

		const [row] = buildItemwiseRecommendedReorderLevelRows(
			items,
			new Map(),
			new Map(),
			30,
		);

		expect(row.id).toBe("WIDGET-001");
		expect(row.itemCode).toBe("WIDGET-001");
		expect(row.itemName).toBe("Primary Widget");
		expect(row.description).toBe("High-grade widget");
		expect(row.safetyStock).toBe(25);
		expect(row.leadTimeDays).toBe(7);
		expect(row.itemGroup).toBe("Finished Goods");
		expect(row.brand).toBe("BrandY");
	});

	it("handles null itemGroup and brand", () => {
		const items = [makeItem({ itemGroupName: null, brandName: null })];

		const [row] = buildItemwiseRecommendedReorderLevelRows(
			items,
			new Map(),
			new Map(),
			30,
		);

		expect(row.itemGroup).toBeNull();
		expect(row.brand).toBeNull();
	});

	it("handles null description", () => {
		const items = [makeItem({ description: null })];

		const [row] = buildItemwiseRecommendedReorderLevelRows(
			items,
			new Map(),
			new Map(),
			30,
		);

		expect(row.description).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// buildItemwiseRecommendedReorderLevelRows — sorting
// ---------------------------------------------------------------------------

describe("buildItemwiseRecommendedReorderLevelRows – sorting", () => {
	it("sorts rows by item code alphabetically", () => {
		const items = [
			makeItem({ code: "ITEM-C" }),
			makeItem({ code: "ITEM-A" }),
			makeItem({ code: "ITEM-B" }),
		];

		const rows = buildItemwiseRecommendedReorderLevelRows(
			items,
			new Map(),
			new Map(),
			30,
		);

		expect(rows.map((r) => r.itemCode)).toEqual(["ITEM-A", "ITEM-B", "ITEM-C"]);
	});
});

// ---------------------------------------------------------------------------
// buildItemwiseRecommendedReorderLevelRows — multiple items
// ---------------------------------------------------------------------------

describe("buildItemwiseRecommendedReorderLevelRows – multiple items", () => {
	it("calculates independently for each item", () => {
		const items = [
			makeItem({
				code: "ITEM-A",
				safetyStock: 5,
				leadTimeDays: 2,
			}),
			makeItem({
				code: "ITEM-B",
				safetyStock: 20,
				leadTimeDays: 10,
			}),
		];

		const consumed = new Map([
			["ITEM-A", 30],
			["ITEM-B", 60],
		]);
		const delivered = new Map([["ITEM-A", 10]]);

		const rows = buildItemwiseRecommendedReorderLevelRows(
			items,
			consumed,
			delivered,
			10,
		);

		expect(rows).toHaveLength(2);

		// ITEM-A: total=40, avgDaily=4, reorder=(4*2)+5=13
		const rowA = rows.find((r) => r.itemCode === "ITEM-A");
		if (!rowA) throw new Error("Expected rowA to be defined");
		expect(rowA.totalOutgoing).toBe(40);
		expect(rowA.avgDailyOutgoing).toBe(4);
		expect(rowA.reorderLevel).toBe(13);

		// ITEM-B: total=60, avgDaily=6, reorder=(6*10)+20=80
		const rowB = rows.find((r) => r.itemCode === "ITEM-B");
		if (!rowB) throw new Error("Expected rowB to be defined");
		expect(rowB.totalOutgoing).toBe(60);
		expect(rowB.avgDailyOutgoing).toBe(6);
		expect(rowB.reorderLevel).toBe(80);
	});
});
