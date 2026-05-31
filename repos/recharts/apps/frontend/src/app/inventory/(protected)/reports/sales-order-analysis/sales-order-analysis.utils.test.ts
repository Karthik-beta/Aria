import { describe, expect, it } from "vitest";
import {
	buildDonutChartData,
	formatAmount,
	formatDurationSeconds,
	formatQty,
	getChartColor,
	getDefaultFromDate,
	getDefaultToDate,
	getDelayClass,
	getDeliveredClass,
	type SalesOrderAnalysisSummary,
} from "./sales-order-analysis.utils";

// ---------------------------------------------------------------------------
// formatQty
// ---------------------------------------------------------------------------

describe("formatQty", () => {
	it("formats a positive integer", () => {
		expect(formatQty(100)).toBe("100");
	});

	it("formats a decimal", () => {
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
	it("includes rupee symbol for a positive value", () => {
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
// formatDurationSeconds
// ---------------------------------------------------------------------------

describe("formatDurationSeconds", () => {
	it("returns em-dash for 0 seconds", () => {
		expect(formatDurationSeconds(0)).toBe("—");
	});

	it("returns em-dash for negative seconds", () => {
		expect(formatDurationSeconds(-1)).toBe("—");
	});

	it("formats a duration less than 1 hour as minutes", () => {
		expect(formatDurationSeconds(300)).toBe("5m");
	});

	it("formats a duration with days, hours, and minutes", () => {
		expect(formatDurationSeconds(90061)).toBe("1d 1h 1m");
	});

	it("formats exactly 1 day", () => {
		expect(formatDurationSeconds(86400)).toBe("1d");
	});

	it("formats 1 hour exactly", () => {
		expect(formatDurationSeconds(3600)).toBe("1h");
	});

	it("formats 1 day and 30 minutes (no hours part when 0)", () => {
		expect(formatDurationSeconds(86400 + 1800)).toBe("1d 30m");
	});
});

// ---------------------------------------------------------------------------
// getDelayClass
// ---------------------------------------------------------------------------

describe("getDelayClass", () => {
	it("returns destructive class for positive delay", () => {
		expect(getDelayClass(1)).toContain("text-destructive");
		expect(getDelayClass(30)).toContain("text-destructive");
	});

	it("returns empty string for zero delay", () => {
		expect(getDelayClass(0)).toBe("");
	});

	it("returns empty string for negative delay", () => {
		expect(getDelayClass(-1)).toBe("");
	});
});

// ---------------------------------------------------------------------------
// getDeliveredClass
// ---------------------------------------------------------------------------

describe("getDeliveredClass", () => {
	it("returns green class for positive qty", () => {
		expect(getDeliveredClass(1)).toContain("text-green");
		expect(getDeliveredClass(100)).toContain("text-green");
	});

	it("returns empty string for zero qty", () => {
		expect(getDeliveredClass(0)).toBe("");
	});
});

// ---------------------------------------------------------------------------
// getDefaultFromDate / getDefaultToDate
// ---------------------------------------------------------------------------

describe("getDefaultFromDate", () => {
	it("returns a valid ISO date string", () => {
		const result = getDefaultFromDate();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns a date approximately 1 month before today", () => {
		const from = new Date(getDefaultFromDate());
		const to = new Date(getDefaultToDate());
		const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
		expect(diffDays).toBeGreaterThanOrEqual(27);
		expect(diffDays).toBeLessThanOrEqual(32);
	});
});

describe("getDefaultToDate", () => {
	it("returns a valid ISO date string", () => {
		const result = getDefaultToDate();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns today's date", () => {
		const today = new Date().toISOString().slice(0, 10);
		expect(getDefaultToDate()).toBe(today);
	});
});

// ---------------------------------------------------------------------------
// getChartColor
// ---------------------------------------------------------------------------

describe("getChartColor", () => {
	it("returns a CSS variable reference for index 0", () => {
		expect(getChartColor(0)).toBe("hsl(var(--chart-1))");
	});

	it("returns slot 2 for index 1", () => {
		expect(getChartColor(1)).toBe("hsl(var(--chart-2))");
	});

	it("wraps around after 5 colors", () => {
		expect(getChartColor(5)).toBe("hsl(var(--chart-1))");
	});
});

// ---------------------------------------------------------------------------
// buildDonutChartData
// ---------------------------------------------------------------------------

describe("buildDonutChartData", () => {
	const summary: SalesOrderAnalysisSummary = {
		totalPendingAmount: 8000,
		totalBilledAmount: 2000,
	};

	it("returns exactly two segments", () => {
		const data = buildDonutChartData(summary);
		expect(data).toHaveLength(2);
	});

	it("maps totalPendingAmount to Amount to Bill", () => {
		const data = buildDonutChartData(summary);
		const segment = data.find((d) => d.name === "Amount to Bill");
		expect(segment?.value).toBe(8000);
	});

	it("maps totalBilledAmount to Billed Amount", () => {
		const data = buildDonutChartData(summary);
		const segment = data.find((d) => d.name === "Billed Amount");
		expect(segment?.value).toBe(2000);
	});

	it("returns two zero-value segments for empty summary", () => {
		const data = buildDonutChartData({
			totalPendingAmount: 0,
			totalBilledAmount: 0,
		});
		expect(data[0].value).toBe(0);
		expect(data[1].value).toBe(0);
	});
});
