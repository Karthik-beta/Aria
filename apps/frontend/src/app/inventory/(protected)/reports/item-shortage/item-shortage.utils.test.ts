import { describe, expect, it } from "vitest";
import {
	buildBarChartData,
	formatQty,
	type ItemShortageRow,
} from "./item-shortage.utils";

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<ItemShortageRow> = {}): ItemShortageRow {
	return {
		id: "Company::ITEM-001::Stores",
		company: "Company",
		warehouse: "Stores",
		itemCode: "ITEM-001",
		itemName: null,
		description: null,
		actualQty: 5,
		orderedQty: 0,
		plannedQty: 0,
		requestedQty: 0,
		reservedQty: 10,
		reservedQtyForProduction: 0,
		projectedQty: -5,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// formatQty
// ---------------------------------------------------------------------------

describe("formatQty", () => {
	it("formats whole numbers without decimal places", () => {
		expect(formatQty(10)).toBe("10");
	});

	it("formats fractional numbers removing trailing zeros", () => {
		expect(formatQty(12.5)).toBe("12.5");
	});

	it("formats up to 3 decimal places", () => {
		expect(formatQty(1.123)).toBe("1.123");
	});

	it("rounds at 3 decimal places", () => {
		expect(formatQty(1.1239)).toBe("1.124");
	});

	it("handles zero", () => {
		expect(formatQty(0)).toBe("0");
	});

	it("handles negative numbers", () => {
		expect(formatQty(-5)).toBe("-5");
	});
});

// ---------------------------------------------------------------------------
// buildBarChartData
// ---------------------------------------------------------------------------

describe("buildBarChartData", () => {
	it("returns empty array for empty input", () => {
		expect(buildBarChartData([])).toEqual([]);
	});

	it("maps each row to a chart entry with correct fields", () => {
		const rows = [makeRow({ itemCode: "ITEM-A", projectedQty: -7 })];
		const chart = buildBarChartData(rows);

		expect(chart[0]).toMatchObject({
			label: "ITEM-A",
			projectedQty: -7,
			shortfall: 7,
		});
	});

	it("shortfall is always the absolute value of projectedQty", () => {
		const rows = [
			makeRow({ itemCode: "A", projectedQty: -3 }),
			makeRow({ itemCode: "B", projectedQty: -20 }),
		];
		const chart = buildBarChartData(rows);

		expect(chart[0].shortfall).toBe(3);
		expect(chart[1].shortfall).toBe(20);
	});

	it("limits results to at most 10 entries by default", () => {
		const rows = Array.from({ length: 15 }, (_, i) =>
			makeRow({ id: `k${i}`, itemCode: `ITEM-${i}`, projectedQty: -(i + 1) }),
		);

		expect(buildBarChartData(rows)).toHaveLength(10);
	});

	it("respects a custom limit", () => {
		const rows = Array.from({ length: 8 }, (_, i) =>
			makeRow({ id: `k${i}`, itemCode: `ITEM-${i}`, projectedQty: -(i + 1) }),
		);

		expect(buildBarChartData(rows, 5)).toHaveLength(5);
	});

	it("preserves input order (caller is responsible for sorting)", () => {
		const rows = [
			makeRow({ itemCode: "FIRST", projectedQty: -30 }),
			makeRow({ itemCode: "SECOND", projectedQty: -5 }),
		];
		const chart = buildBarChartData(rows);

		expect(chart[0].label).toBe("FIRST");
		expect(chart[1].label).toBe("SECOND");
	});
});
