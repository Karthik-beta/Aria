import { describe, expect, it, vi } from "vitest";
import {
	formatCompactDate,
	formatOptionalText,
	formatProjectedQtyCurrency,
	formatProjectedQtyQuantity,
	formatRelativeAge,
} from "./stock-projected-qty.utils";

describe("stock-projected-qty.utils", () => {
	it("formats quantities with three decimal places", () => {
		expect(formatProjectedQtyQuantity(42)).toBe("42.000");
		expect(formatProjectedQtyQuantity(0)).toBe("0.000");
		expect(formatProjectedQtyQuantity(-10.5)).toBe("-10.500");
	});

	it("formats currencies with the configured locale", () => {
		expect(formatProjectedQtyCurrency(1234.5, "USD")).toContain("1,234.50");
		expect(formatProjectedQtyCurrency(0, "INR")).toContain("0.00");
	});

	it("formats dates and fallback text safely", () => {
		expect(formatCompactDate(new Date("2026-03-24T00:00:00.000Z"))).toBe(
			"24/03/2026",
		);
		expect(formatCompactDate(null)).toBe("-");
		expect(formatCompactDate(undefined)).toBe("-");
		expect(formatOptionalText("   ")).toBe("-");
		expect(formatOptionalText(null)).toBe("-");
		expect(formatOptionalText(undefined)).toBe("-");
		expect(formatOptionalText("  test  ")).toBe("test");
	});

	it("formats relative age values", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-24T00:00:00.000Z"));

		expect(formatRelativeAge(new Date("2026-03-22T00:00:00.000Z"))).toBe("2 d");
		expect(formatRelativeAge(new Date("2026-03-24T00:00:00.000Z"))).toBe(
			"Today",
		);
		expect(formatRelativeAge(new Date("2025-11-24T00:00:00.000Z"))).toBe("4 m");
		expect(formatRelativeAge(null)).toBe("-");

		vi.useRealTimers();
	});
});
