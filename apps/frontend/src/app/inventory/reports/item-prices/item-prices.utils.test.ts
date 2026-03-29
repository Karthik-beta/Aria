import { describe, expect, it } from "vitest";
import { formatOptional, formatRate } from "./item-prices.utils";

// ---------------------------------------------------------------------------
// formatRate
// ---------------------------------------------------------------------------

describe("formatRate", () => {
	it("formats a positive rate with currency symbol and 2 decimal places", () => {
		expect(formatRate(1000)).toBe("₹\u00A01,000.00");
	});

	it("returns — for null", () => {
		expect(formatRate(null)).toBe("—");
	});

	it("returns — for undefined", () => {
		expect(formatRate(undefined)).toBe("—");
	});

	it("returns — for zero (no rate set)", () => {
		expect(formatRate(0)).toBe("—");
	});

	it("formats a fractional rate correctly", () => {
		expect(formatRate(49.5)).toBe("₹\u00A049.50");
	});

	it("formats large values with grouping separators (en-IN style)", () => {
		const result = formatRate(150000);
		expect(result).toContain("1,50,000.00");
	});
});

// ---------------------------------------------------------------------------
// formatOptional
// ---------------------------------------------------------------------------

describe("formatOptional", () => {
	it("returns the value when present", () => {
		expect(formatOptional("Electronics")).toBe("Electronics");
	});

	it("returns — for null", () => {
		expect(formatOptional(null)).toBe("—");
	});

	it("returns — for undefined", () => {
		expect(formatOptional(undefined)).toBe("—");
	});

	it("returns — for empty string", () => {
		expect(formatOptional("")).toBe("—");
	});

	it("returns — for whitespace-only string", () => {
		expect(formatOptional("   ")).toBe("—");
	});
});
