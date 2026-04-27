import { describe, expect, it } from "vitest";
import {
	formatCurrency,
	formatDate,
	formatOptional,
	formatQty,
	formatRate,
	getDefaultFromDate,
	getDefaultToDate,
} from "./batch-wise-balance.utils";

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

	it('returns "—" for null', () => {
		expect(formatQty(null)).toBe("—");
	});

	it('returns "—" for undefined', () => {
		expect(formatQty(undefined)).toBe("—");
	});
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe("formatCurrency", () => {
	it("formats a positive amount with 2 decimals and currency symbol", () => {
		const result = formatCurrency(1234.5);
		expect(result).toContain("1,234.50");
		expect(result).toContain("₹");
	});

	it("formats zero", () => {
		const result = formatCurrency(0);
		expect(result).toContain("0.00");
		expect(result).toContain("₹");
	});

	it('returns "—" for null', () => {
		expect(formatCurrency(null)).toBe("—");
	});

	it('returns "—" for undefined', () => {
		expect(formatCurrency(undefined)).toBe("—");
	});
});

// ---------------------------------------------------------------------------
// formatRate
// ---------------------------------------------------------------------------

describe("formatRate", () => {
	it("formats a non-zero rate with currency symbol", () => {
		const result = formatRate(99.9);
		expect(result).toContain("99.90");
		expect(result).toContain("₹");
	});

	it('returns "—" for zero', () => {
		expect(formatRate(0)).toBe("—");
	});

	it('returns "—" for null', () => {
		expect(formatRate(null)).toBe("—");
	});

	it('returns "—" for undefined', () => {
		expect(formatRate(undefined)).toBe("—");
	});
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
	it("formats a Date object as a locale date string", () => {
		const result = formatDate(new Date("2024-03-15T00:00:00.000Z"));
		// en-IN locale: "15 Mar 2024" (exact format may vary by runtime)
		expect(result).toMatch(/15/);
		expect(result).toMatch(/Mar/);
		expect(result).toMatch(/2024/);
	});

	it("formats an ISO date string", () => {
		const result = formatDate("2024-06-01T00:00:00.000Z");
		expect(result).toMatch(/Jun/);
		expect(result).toMatch(/2024/);
	});

	it('returns "—" for null', () => {
		expect(formatDate(null)).toBe("—");
	});

	it('returns "—" for undefined', () => {
		expect(formatDate(undefined)).toBe("—");
	});

	it('returns "—" for an invalid date string', () => {
		expect(formatDate("not-a-date")).toBe("—");
	});
});

// ---------------------------------------------------------------------------
// formatOptional
// ---------------------------------------------------------------------------

describe("formatOptional", () => {
	it("returns the trimmed string when present", () => {
		expect(formatOptional("hello")).toBe("hello");
	});

	it("trims whitespace", () => {
		expect(formatOptional("  padded  ")).toBe("padded");
	});

	it('returns "—" for null', () => {
		expect(formatOptional(null)).toBe("—");
	});

	it('returns "—" for undefined', () => {
		expect(formatOptional(undefined)).toBe("—");
	});

	it('returns "—" for empty string', () => {
		expect(formatOptional("")).toBe("—");
	});

	it('returns "—" for whitespace-only string', () => {
		expect(formatOptional("   ")).toBe("—");
	});
});

// ---------------------------------------------------------------------------
// getDefaultFromDate
// ---------------------------------------------------------------------------

describe("getDefaultFromDate", () => {
	it("returns a valid ISO date string (YYYY-MM-DD)", () => {
		const result = getDefaultFromDate();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns January 1st of the current year", () => {
		const result = getDefaultFromDate();
		const currentYear = new Date().getUTCFullYear();
		expect(result).toBe(`${currentYear}-01-01`);
	});
});

// ---------------------------------------------------------------------------
// getDefaultToDate
// ---------------------------------------------------------------------------

describe("getDefaultToDate", () => {
	it("returns a valid ISO date string (YYYY-MM-DD)", () => {
		const result = getDefaultToDate();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns today's date", () => {
		const result = getDefaultToDate();
		const today = new Date().toISOString().slice(0, 10);
		expect(result).toBe(today);
	});
});
