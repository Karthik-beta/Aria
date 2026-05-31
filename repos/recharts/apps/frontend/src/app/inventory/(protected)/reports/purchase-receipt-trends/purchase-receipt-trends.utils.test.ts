import { describe, expect, it } from "vitest";
import {
	buildBarChartData,
	formatAmount,
	formatDimensionText,
	formatPeriodCellValue,
	formatQty,
	getDefaultFromDate,
	getDefaultToDate,
	getSeriesColor,
	type PurchaseReceiptTrendsRow,
} from "./purchase-receipt-trends.utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(
	overrides: Partial<PurchaseReceiptTrendsRow> = {},
): PurchaseReceiptTrendsRow {
	return {
		id: "ITEM-001",
		dimensionKey: "ITEM-001",
		dimensionLabel: "Test Item",
		periodQty: { jan_2024: 10, feb_2024: 5 },
		periodAmount: { jan_2024: 1000, feb_2024: 500 },
		totalQty: 15,
		totalAmount: 1500,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// formatQty
// ---------------------------------------------------------------------------

describe("formatQty", () => {
	it("formats a positive number", () => {
		expect(formatQty(100)).toBe("100");
	});

	it("formats a decimal number", () => {
		expect(formatQty(1234.5)).toBe("1,234.5");
	});

	it("returns em-dash for null", () => {
		expect(formatQty(null)).toBe("—");
	});

	it("returns em-dash for undefined", () => {
		expect(formatQty(undefined)).toBe("—");
	});

	it("formats zero", () => {
		expect(formatQty(0)).toBe("0");
	});
});

// ---------------------------------------------------------------------------
// formatAmount
// ---------------------------------------------------------------------------

describe("formatAmount", () => {
	it("formats a positive number with rupee symbol", () => {
		expect(formatAmount(1000)).toContain("₹");
		expect(formatAmount(1000)).toContain("1,000");
	});

	it("returns em-dash for null", () => {
		expect(formatAmount(null)).toBe("—");
	});

	it("returns em-dash for undefined", () => {
		expect(formatAmount(undefined)).toBe("—");
	});
});

// ---------------------------------------------------------------------------
// formatPeriodCellValue
// ---------------------------------------------------------------------------

describe("formatPeriodCellValue", () => {
	it("formats qty metric without rupee symbol", () => {
		const result = formatPeriodCellValue(50, "qty");
		expect(result).not.toContain("₹");
		expect(result).toBe("50");
	});

	it("formats amount metric with rupee symbol", () => {
		const result = formatPeriodCellValue(5000, "amount");
		expect(result).toContain("₹");
	});
});

// ---------------------------------------------------------------------------
// formatDimensionText
// ---------------------------------------------------------------------------

describe("formatDimensionText", () => {
	it("returns the value when it is non-empty", () => {
		expect(formatDimensionText("Supplier A")).toBe("Supplier A");
	});

	it("returns em-dash for null", () => {
		expect(formatDimensionText(null)).toBe("—");
	});

	it("returns em-dash for undefined", () => {
		expect(formatDimensionText(undefined)).toBe("—");
	});

	it("returns em-dash for whitespace-only string", () => {
		expect(formatDimensionText("   ")).toBe("—");
	});
});

// ---------------------------------------------------------------------------
// getDefaultFromDate / getDefaultToDate
// ---------------------------------------------------------------------------

describe("getDefaultFromDate", () => {
	it("returns the first day of the current year", () => {
		const result = getDefaultFromDate();
		expect(result).toMatch(/^\d{4}-01-01$/);
	});
});

describe("getDefaultToDate", () => {
	it("returns the last day of the current year", () => {
		const result = getDefaultToDate();
		expect(result).toMatch(/^\d{4}-12-31$/);
	});

	it("has the same year as getDefaultFromDate", () => {
		const from = getDefaultFromDate();
		const to = getDefaultToDate();
		expect(from.slice(0, 4)).toBe(to.slice(0, 4));
	});
});

// ---------------------------------------------------------------------------
// getSeriesColor
// ---------------------------------------------------------------------------

describe("getSeriesColor", () => {
	it("returns a CSS variable reference", () => {
		expect(getSeriesColor(0)).toBe("hsl(var(--chart-1))");
		expect(getSeriesColor(1)).toBe("hsl(var(--chart-2))");
		expect(getSeriesColor(4)).toBe("hsl(var(--chart-5))");
	});

	it("wraps around at palette boundary", () => {
		expect(getSeriesColor(5)).toBe("hsl(var(--chart-1))");
		expect(getSeriesColor(10)).toBe("hsl(var(--chart-1))");
	});
});

// ---------------------------------------------------------------------------
// buildBarChartData
// ---------------------------------------------------------------------------

describe("buildBarChartData", () => {
	it("returns up to 10 entries", () => {
		const rows = Array.from({ length: 15 }, (_, i) =>
			makeRow({
				id: `ITEM-${i.toString()}`,
				dimensionKey: `ITEM-${i.toString()}`,
				totalAmount: 1000 - i * 10,
			}),
		);

		const result = buildBarChartData(rows);
		expect(result).toHaveLength(10);
	});

	it("uses custom maxItems limit", () => {
		const rows = Array.from({ length: 8 }, (_, i) =>
			makeRow({
				id: `ITEM-${i.toString()}`,
				dimensionKey: `ITEM-${i.toString()}`,
			}),
		);

		const result = buildBarChartData(rows, 5);
		expect(result).toHaveLength(5);
	});

	it("returns all rows when fewer than maxItems", () => {
		const rows = [
			makeRow(),
			makeRow({ id: "ITEM-002", dimensionKey: "ITEM-002" }),
		];
		const result = buildBarChartData(rows);
		expect(result).toHaveLength(2);
	});

	it("includes dimensionLabel in the label when present", () => {
		const row = makeRow({
			dimensionKey: "SUP-001",
			dimensionLabel: "Acme Supplies",
		});
		const result = buildBarChartData([row]);
		expect(result[0].label).toContain("SUP-001");
		expect(result[0].label).toContain("Acme Supplies");
	});

	it("uses only dimensionKey as label when no dimensionLabel", () => {
		const row = makeRow({
			dimensionKey: "Supplier A",
			dimensionLabel: null,
		});
		const result = buildBarChartData([row]);
		expect(result[0].label).toBe("Supplier A");
	});

	it("uses totalAmount as the chart value", () => {
		const row = makeRow({ totalAmount: 9876 });
		const result = buildBarChartData([row]);
		expect(result[0].amount).toBe(9876);
	});

	it("returns an empty array for an empty input", () => {
		expect(buildBarChartData([])).toHaveLength(0);
	});
});
