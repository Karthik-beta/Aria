import { describe, expect, it } from "vitest";
import {
	buildChartData,
	formatOptionalText,
	formatPeriodValue,
	getDefaultFromDate,
	getDefaultToDate,
	getSeriesColor,
	type StockAnalyticsPeriod,
	type StockAnalyticsRow,
} from "./stock-analytics.utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePeriod(label: string, key: string): StockAnalyticsPeriod {
	return {
		from: new Date("2024-01-01T00:00:00.000Z"),
		to: new Date("2024-01-31T00:00:00.000Z"),
		label,
		key,
	};
}

function makeRow(
	itemCode: string,
	periodValues: Record<string, number | null>,
): StockAnalyticsRow {
	return {
		id: itemCode,
		itemCode,
		itemName: null,
		itemGroup: null,
		brand: null,
		unitOfMeasure: null,
		periodValues,
	};
}

// ---------------------------------------------------------------------------
// formatPeriodValue
// ---------------------------------------------------------------------------

describe("formatPeriodValue", () => {
	it("returns em-dash for null", () => {
		expect(formatPeriodValue(null, "Quantity")).toBe("—");
		expect(formatPeriodValue(null, "Value")).toBe("—");
	});

	it("returns em-dash for undefined", () => {
		expect(formatPeriodValue(undefined, "Quantity")).toBe("—");
	});

	it("formats value with rupee symbol", () => {
		expect(formatPeriodValue(12345.67, "Value")).toContain("₹");
		expect(formatPeriodValue(12345.67, "Value")).toContain("12,345.67");
	});

	it("formats quantity without rupee symbol", () => {
		const result = formatPeriodValue(500, "Quantity");
		expect(result).not.toContain("₹");
		expect(result).toContain("500");
	});

	it("formats zero quantity as 0 not em-dash", () => {
		expect(formatPeriodValue(0, "Quantity")).toBe("0");
	});

	it("formats negative quantity", () => {
		const result = formatPeriodValue(-10, "Quantity");
		expect(result).toContain("-10");
	});
});

// ---------------------------------------------------------------------------
// formatOptionalText
// ---------------------------------------------------------------------------

describe("formatOptionalText", () => {
	it("returns the string when provided", () => {
		expect(formatOptionalText("Apple")).toBe("Apple");
	});

	it("returns em-dash for null", () => {
		expect(formatOptionalText(null)).toBe("—");
	});

	it("returns em-dash for undefined", () => {
		expect(formatOptionalText(undefined)).toBe("—");
	});

	it("returns em-dash for whitespace only", () => {
		expect(formatOptionalText("   ")).toBe("—");
	});
});

// ---------------------------------------------------------------------------
// getDefaultFromDate / getDefaultToDate
// ---------------------------------------------------------------------------

describe("getDefaultFromDate", () => {
	it("returns a date string in YYYY-MM-DD format", () => {
		expect(getDefaultFromDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns Jan 01 of the current year", () => {
		const result = getDefaultFromDate();
		const year = new Date().getUTCFullYear();
		expect(result).toBe(`${year}-01-01`);
	});
});

describe("getDefaultToDate", () => {
	it("returns a date string in YYYY-MM-DD format", () => {
		expect(getDefaultToDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns Dec 31 of the current year", () => {
		const result = getDefaultToDate();
		const year = new Date().getUTCFullYear();
		expect(result).toBe(`${year}-12-31`);
	});
});

// ---------------------------------------------------------------------------
// getSeriesColor
// ---------------------------------------------------------------------------

describe("getSeriesColor", () => {
	it("returns a CSS variable string", () => {
		expect(getSeriesColor(0)).toBe("hsl(var(--chart-1))");
		expect(getSeriesColor(1)).toBe("hsl(var(--chart-2))");
		expect(getSeriesColor(4)).toBe("hsl(var(--chart-5))");
	});

	it("wraps around after 5 palette slots", () => {
		expect(getSeriesColor(5)).toBe(getSeriesColor(0));
		expect(getSeriesColor(6)).toBe(getSeriesColor(1));
	});
});

// ---------------------------------------------------------------------------
// buildChartData
// ---------------------------------------------------------------------------

describe("buildChartData", () => {
	const periods: StockAnalyticsPeriod[] = [
		makePeriod("Jan 2024", "jan_2024"),
		makePeriod("Feb 2024", "feb_2024"),
	];

	const rows: StockAnalyticsRow[] = [
		makeRow("ITEM-001", { jan_2024: 10, feb_2024: 15 }),
		makeRow("ITEM-002", { jan_2024: 5, feb_2024: 5 }),
	];

	it("returns one data point per period", () => {
		const data = buildChartData(new Set(["ITEM-001"]), rows, periods);
		expect(data).toHaveLength(2);
	});

	it("adds label key for each period", () => {
		const data = buildChartData(new Set(["ITEM-001"]), rows, periods);
		expect(data[0].label).toBe("Jan 2024");
		expect(data[1].label).toBe("Feb 2024");
	});

	it("includes a key per selected item only", () => {
		const data = buildChartData(new Set(["ITEM-001"]), rows, periods);
		expect(Object.keys(data[0])).toContain("ITEM-001");
		expect(Object.keys(data[0])).not.toContain("ITEM-002");
	});

	it("includes values for all selected items", () => {
		const data = buildChartData(
			new Set(["ITEM-001", "ITEM-002"]),
			rows,
			periods,
		);
		expect(data[0]["ITEM-001"]).toBe(10);
		expect(data[0]["ITEM-002"]).toBe(5);
	});

	it("returns null for missing period values", () => {
		const partialRow = makeRow("ITEM-003", { jan_2024: 7 });
		const data = buildChartData(new Set(["ITEM-003"]), [partialRow], periods);
		expect(data[0]["ITEM-003"]).toBe(7);
		expect(data[1]["ITEM-003"]).toBeNull();
	});

	it("returns empty data points (label only) when no items selected", () => {
		const data = buildChartData(new Set(), rows, periods);
		expect(data).toHaveLength(2);
		expect(Object.keys(data[0])).toEqual(["label"]);
	});

	it("returns empty array when periods is empty", () => {
		const data = buildChartData(new Set(["ITEM-001"]), rows, []);
		expect(data).toHaveLength(0);
	});
});
