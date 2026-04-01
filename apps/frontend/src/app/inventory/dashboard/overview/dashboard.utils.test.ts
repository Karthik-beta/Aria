import { describe, expect, it } from "vitest";
import {
	getActiveItemsInsight,
	getLowStockInsight,
	getPendingRequestsInsight,
	getStockValueInsight,
} from "./dashboard.utils";

// ── getStockValueInsight ──────────────────────────────────────────────

describe("getStockValueInsight", () => {
	it("returns no-items message when totalItems is 0", () => {
		const result = getStockValueInsight(0, 0, 0);
		expect(result.text).toBe("No items in catalogue yet");
		expect(result.subtext).toBe("Add items to begin tracking value");
		expect(result.colorClass).toBeUndefined();
	});

	it("returns no-committed-stock message when qty is 0 but items exist", () => {
		const result = getStockValueInsight(0, 0, 5);
		expect(result.text).toBe("No committed stock yet");
		expect(result.subtext).toBe("5 items in catalogue");
	});

	it("uses singular 'item' when totalItems is 1 and qty is 0", () => {
		const result = getStockValueInsight(0, 0, 1);
		expect(result.subtext).toBe("1 item in catalogue");
	});

	it("computes average per unit and uses plural item type label", () => {
		const result = getStockValueInsight(300_000, 100, 10);
		// avg = 300_000 / 100 = 3_000 → formatCompactCurrency(3000) = "₹3.0K"
		expect(result.text).toBe("~₹3.0K avg per unit");
		expect(result.subtext).toBe("Across 10 active item types");
	});

	it("uses singular 'item type' when totalItems is 1", () => {
		const result = getStockValueInsight(500, 10, 1);
		expect(result.subtext).toBe("Across 1 active item type");
	});

	it("has no colorClass for normal state", () => {
		const result = getStockValueInsight(100_000, 50, 5);
		expect(result.colorClass).toBeUndefined();
	});
});

// ── getActiveItemsInsight ─────────────────────────────────────────────

describe("getActiveItemsInsight", () => {
	it("returns no-warehouses message when activeWarehouses is 0", () => {
		const result = getActiveItemsInsight(10, 0);
		expect(result.text).toBe("No warehouses configured");
		expect(result.subtext).toBe("Set up warehouses to track stock");
	});

	it("computes per-warehouse ratio and uses plural labels", () => {
		const result = getActiveItemsInsight(38, 8);
		// Math.round(38 / 8) = 5
		expect(result.text).toBe("~5 items per warehouse");
		expect(result.subtext).toBe("Tracking 8 storage locations");
	});

	it("uses singular forms when values are 1", () => {
		const result = getActiveItemsInsight(1, 1);
		expect(result.text).toBe("~1 item per warehouse");
		expect(result.subtext).toBe("Tracking 1 storage location");
	});

	it("rounds non-integer ratios", () => {
		const result = getActiveItemsInsight(10, 3);
		// Math.round(10 / 3) = 3
		expect(result.text).toBe("~3 items per warehouse");
	});

	it("has no colorClass", () => {
		const result = getActiveItemsInsight(10, 2);
		expect(result.colorClass).toBeUndefined();
	});
});

// ── getLowStockInsight ────────────────────────────────────────────────

describe("getLowStockInsight", () => {
	it("returns all-clear state when lowStockItemCount is 0", () => {
		const result = getLowStockInsight(0, 38);
		expect(result.text).toBe("All items within safe limits");
		expect(result.subtext).toBe("No reorder action needed");
		expect(result.colorClass).toBe("text-green-600 dark:text-green-400");
	});

	it("returns all-clear even when totalItems is 0 and lowCount is 0", () => {
		const result = getLowStockInsight(0, 0);
		expect(result.text).toBe("All items within safe limits");
	});

	it("computes percentage when items are below safety stock", () => {
		const result = getLowStockInsight(10, 40);
		// Math.round(10/40 * 100) = 25
		expect(result.text).toBe("25% of items need reorder");
		expect(result.subtext).toBe("Below safety stock threshold");
		expect(result.colorClass).toBe("text-destructive");
	});

	it("shows 100% when totalItems is 0 but lowStockCount > 0 (edge case)", () => {
		const result = getLowStockInsight(5, 0);
		expect(result.text).toBe("100% of items need reorder");
	});

	it("rounds percentage correctly", () => {
		// 1 of 3 = 33.33... → rounds to 33
		const result = getLowStockInsight(1, 3);
		expect(result.text).toBe("33% of items need reorder");
	});
});

// ── getPendingRequestsInsight ─────────────────────────────────────────

describe("getPendingRequestsInsight", () => {
	it("returns up-to-date state when count is 0", () => {
		const result = getPendingRequestsInsight(0);
		expect(result.text).toBe("Procurement up to date");
		expect(result.subtext).toBe("No open material requests");
		expect(result.colorClass).toBe("text-green-600 dark:text-green-400");
	});

	it("returns singular 'request' when count is 1", () => {
		const result = getPendingRequestsInsight(1);
		expect(result.text).toBe("1 request awaiting action");
		expect(result.subtext).toBe("Check material request queue");
		expect(result.colorClass).toBeUndefined();
	});

	it("returns plural 'requests' when count is > 1", () => {
		const result = getPendingRequestsInsight(5);
		expect(result.text).toBe("5 requests awaiting action");
	});
});
