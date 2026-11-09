import { describe, expect, it } from "vitest";
import {
	buildDonutChartData,
	formatAmount,
	formatQty,
	getBilledClass,
	getChartColor,
	getDefaultFromDate,
	getDefaultToDate,
	getReceivedClass,
	type PurchaseOrderAnalysisSummary,
} from "./purchase-order-analysis.utils";

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
// getReceivedClass
// ---------------------------------------------------------------------------

describe("getReceivedClass", () => {
	it("returns a highlight class when qty > 0", () => {
		expect(getReceivedClass(5)).toContain("text-green-600");
	});

	it("returns empty string when qty is 0", () => {
		expect(getReceivedClass(0)).toBe("");
	});

	it("returns empty string when qty is negative", () => {
		expect(getReceivedClass(-1)).toBe("");
	});
});

// ---------------------------------------------------------------------------
// getBilledClass
// ---------------------------------------------------------------------------

describe("getBilledClass", () => {
	it("returns a highlight class when amount > 0", () => {
		expect(getBilledClass(100)).toContain("text-green-600");
	});

	it("returns empty string when amount is 0", () => {
		expect(getBilledClass(0)).toBe("");
	});
});

// ---------------------------------------------------------------------------
// getDefaultFromDate / getDefaultToDate
// ---------------------------------------------------------------------------

describe("getDefaultFromDate", () => {
	it("returns a valid ISO date string", () => {
		const date = getDefaultFromDate();
		expect(/^\d{4}-\d{2}-\d{2}$/.test(date)).toBe(true);
	});

	it("is approximately one month before today", () => {
		const from = new Date(getDefaultFromDate());
		const today = new Date();
		const diffDays = (today.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
		expect(diffDays).toBeGreaterThanOrEqual(28);
		expect(diffDays).toBeLessThanOrEqual(32);
	});
});

describe("getDefaultToDate", () => {
	it("returns today's date as an ISO date string", () => {
		const today = new Date().toISOString().slice(0, 10);
		expect(getDefaultToDate()).toBe(today);
	});
});

// ---------------------------------------------------------------------------
// buildDonutChartData
// ---------------------------------------------------------------------------

describe("buildDonutChartData", () => {
	it("builds two segments from summary", () => {
		const summary: PurchaseOrderAnalysisSummary = {
			totalPendingAmount: 8000,
			totalBilledAmount: 2000,
		};
		const data = buildDonutChartData(summary);
		expect(data).toHaveLength(2);
		expect(data[0]).toEqual({ name: "Amount to Bill", value: 8000 });
		expect(data[1]).toEqual({ name: "Billed Amount", value: 2000 });
	});

	it("returns zero-value segments for an all-zero summary", () => {
		const summary: PurchaseOrderAnalysisSummary = {
			totalPendingAmount: 0,
			totalBilledAmount: 0,
		};
		const data = buildDonutChartData(summary);
		expect(data.every((d) => d.value === 0)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getChartColor
// ---------------------------------------------------------------------------

describe("getChartColor", () => {
	it("returns an HSL CSS variable string", () => {
		const color = getChartColor(0);
		expect(color).toMatch(/^hsl\(var\(--chart-\d+\)\)$/);
	});

	it("cycles through 5 palette slots", () => {
		const colors = Array.from({ length: 6 }, (_, i) => getChartColor(i));
		// Slot 0 and slot 5 should use the same palette slot (index % 5 = 0)
		expect(colors[0]).toBe(colors[5]);
	});

	it("returns different colors for indices 0–4", () => {
		const colors = Array.from({ length: 5 }, (_, i) => getChartColor(i));
		const unique = new Set(colors);
		expect(unique.size).toBe(5);
	});
});
