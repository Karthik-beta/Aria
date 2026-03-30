import { describe, expect, it } from "vitest";
import {
	formatOptional,
	formatQty,
	formatRate,
} from "./item-variant-details.utils";

// ---------------------------------------------------------------------------
// formatRate
// ---------------------------------------------------------------------------

describe("formatRate", () => {
	it("returns dash for null", () => {
		expect(formatRate(null)).toBe("—");
	});

	it("returns dash for undefined", () => {
		expect(formatRate(undefined)).toBe("—");
	});

	it("returns dash for zero", () => {
		expect(formatRate(0)).toBe("—");
	});

	it("formats a positive value with Indian grouping", () => {
		const result = formatRate(1234.5);
		expect(result).toContain("1,234.50");
	});

	it("formats a small decimal value", () => {
		const result = formatRate(9.9);
		expect(result).toContain("9.90");
	});
});

// ---------------------------------------------------------------------------
// formatQty
// ---------------------------------------------------------------------------

describe("formatQty", () => {
	it("formats zero", () => {
		expect(formatQty(0)).toBe("0");
	});

	it("formats an integer", () => {
		expect(formatQty(1000)).toBe("1,000");
	});

	it("formats a decimal up to 3 places", () => {
		expect(formatQty(1.234)).toBe("1.234");
	});

	it("trims unnecessary trailing decimals", () => {
		expect(formatQty(5.1)).toBe("5.1");
	});
});

// ---------------------------------------------------------------------------
// formatOptional
// ---------------------------------------------------------------------------

describe("formatOptional", () => {
	it("returns dash for null", () => {
		expect(formatOptional(null)).toBe("—");
	});

	it("returns dash for undefined", () => {
		expect(formatOptional(undefined)).toBe("—");
	});

	it("returns dash for empty string", () => {
		expect(formatOptional("")).toBe("—");
	});

	it("returns dash for whitespace-only string", () => {
		expect(formatOptional("   ")).toBe("—");
	});

	it("returns the value for a non-empty string", () => {
		expect(formatOptional("Red")).toBe("Red");
	});
});
