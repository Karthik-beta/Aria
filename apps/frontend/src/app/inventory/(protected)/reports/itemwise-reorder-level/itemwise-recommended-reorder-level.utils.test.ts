import { describe, expect, it } from "vitest";
import {
	formatOptionalText,
	formatQty,
	getDefaultFromDate,
	getDefaultToDate,
	INITIAL_FILTERS,
	validateFilters,
} from "./itemwise-recommended-reorder-level.utils";

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
// formatOptionalText
// ---------------------------------------------------------------------------

describe("formatOptionalText", () => {
	it("returns the trimmed value for non-empty string", () => {
		expect(formatOptionalText("Raw Material")).toBe("Raw Material");
	});

	it("returns dash for null", () => {
		expect(formatOptionalText(null)).toBe("—");
	});

	it("returns dash for undefined", () => {
		expect(formatOptionalText(undefined)).toBe("—");
	});

	it("returns dash for empty string", () => {
		expect(formatOptionalText("")).toBe("—");
	});

	it("returns dash for whitespace-only string", () => {
		expect(formatOptionalText("   ")).toBe("—");
	});
});

// ---------------------------------------------------------------------------
// getDefaultFromDate / getDefaultToDate
// ---------------------------------------------------------------------------

describe("getDefaultFromDate", () => {
	it("returns a YYYY-MM-DD string", () => {
		expect(getDefaultFromDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns January 1st of the current year", () => {
		const year = new Date().getFullYear();
		expect(getDefaultFromDate()).toBe(`${year}-01-01`);
	});
});

describe("getDefaultToDate", () => {
	it("returns a YYYY-MM-DD string", () => {
		expect(getDefaultToDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("returns today's date", () => {
		const today = new Date().toISOString().slice(0, 10);
		expect(getDefaultToDate()).toBe(today);
	});
});

// ---------------------------------------------------------------------------
// validateFilters
// ---------------------------------------------------------------------------

describe("validateFilters", () => {
	it("returns null when all required fields are valid", () => {
		expect(
			validateFilters({
				fromDate: "2024-01-01",
				toDate: "2024-12-31",
				itemGroup: "",
				brand: "",
			}),
		).toBeNull();
	});

	it("returns error when fromDate is empty", () => {
		expect(
			validateFilters({
				fromDate: "",
				toDate: "2024-12-31",
				itemGroup: "",
				brand: "",
			}),
		).toBe("From Date is required.");
	});

	it("returns error when toDate is empty", () => {
		expect(
			validateFilters({
				fromDate: "2024-01-01",
				toDate: "",
				itemGroup: "",
				brand: "",
			}),
		).toBe("To Date is required.");
	});

	it("returns error when fromDate is after toDate", () => {
		expect(
			validateFilters({
				fromDate: "2024-06-01",
				toDate: "2024-01-01",
				itemGroup: "",
				brand: "",
			}),
		).toBe("From Date must not be later than To Date.");
	});

	it("allows fromDate equal to toDate", () => {
		expect(
			validateFilters({
				fromDate: "2024-06-15",
				toDate: "2024-06-15",
				itemGroup: "",
				brand: "",
			}),
		).toBeNull();
	});

	it("allows optional filters to be empty", () => {
		expect(
			validateFilters({
				...INITIAL_FILTERS,
				itemGroup: "",
				brand: "",
			}),
		).toBeNull();
	});

	it("allows optional filters to have values", () => {
		expect(
			validateFilters({
				fromDate: "2024-01-01",
				toDate: "2024-12-31",
				itemGroup: "Raw Material",
				brand: "BrandX",
			}),
		).toBeNull();
	});
});
