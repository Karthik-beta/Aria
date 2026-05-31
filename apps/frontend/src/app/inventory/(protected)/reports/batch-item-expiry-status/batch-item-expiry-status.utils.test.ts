import { describe, expect, it } from "vitest";
import {
	formatDate,
	formatOptional,
	formatQty,
	getDefaultFromDate,
	getDefaultToDate,
	getExpiryStatus,
} from "./batch-item-expiry-status.utils";

// ---------------------------------------------------------------------------
// formatQty
// ---------------------------------------------------------------------------

describe("formatQty", () => {
	it("formats whole numbers without unnecessary decimals", () => {
		expect(formatQty(100)).toBe("100");
	});

	it("formats decimal numbers with up to 3 decimal places", () => {
		expect(formatQty(12.345)).toBe("12.345");
	});

	it("returns — for null", () => {
		expect(formatQty(null)).toBe("—");
	});

	it("returns — for undefined", () => {
		expect(formatQty(undefined)).toBe("—");
	});

	it("handles zero", () => {
		expect(formatQty(0)).toBe("0");
	});
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
	it("returns — for null", () => {
		expect(formatDate(null)).toBe("—");
	});

	it("returns — for undefined", () => {
		expect(formatDate(undefined)).toBe("—");
	});

	it("returns — for invalid date string", () => {
		expect(formatDate("not-a-date")).toBe("—");
	});

	it("formats a valid Date object", () => {
		const result = formatDate(new Date("2026-03-15T00:00:00.000Z"));
		expect(result).toBeTruthy();
		expect(result).not.toBe("—");
	});

	it("formats a valid date string", () => {
		const result = formatDate("2026-03-15T00:00:00.000Z");
		expect(result).toBeTruthy();
		expect(result).not.toBe("—");
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

// ---------------------------------------------------------------------------
// getDefaultFromDate / getDefaultToDate
// ---------------------------------------------------------------------------

describe("getDefaultFromDate", () => {
	it("returns a YYYY-MM-DD string", () => {
		expect(getDefaultFromDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("getDefaultToDate", () => {
	it("returns a YYYY-MM-DD string", () => {
		expect(getDefaultToDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("is not earlier than getDefaultFromDate", () => {
		expect(getDefaultToDate() >= getDefaultFromDate()).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// getExpiryStatus
// ---------------------------------------------------------------------------

describe("getExpiryStatus", () => {
	it("returns 'none' for null expiryInDays", () => {
		expect(getExpiryStatus(null)).toBe("none");
	});

	it("returns 'expired' for 0 days", () => {
		expect(getExpiryStatus(0)).toBe("expired");
	});

	it("returns 'critical' for 1 day", () => {
		expect(getExpiryStatus(1)).toBe("critical");
	});

	it("returns 'critical' for 30 days", () => {
		expect(getExpiryStatus(30)).toBe("critical");
	});

	it("returns 'warning' for 31 days", () => {
		expect(getExpiryStatus(31)).toBe("warning");
	});

	it("returns 'warning' for 90 days", () => {
		expect(getExpiryStatus(90)).toBe("warning");
	});

	it("returns 'ok' for 91 days", () => {
		expect(getExpiryStatus(91)).toBe("ok");
	});

	it("returns 'ok' for large values", () => {
		expect(getExpiryStatus(365)).toBe("ok");
	});
});
