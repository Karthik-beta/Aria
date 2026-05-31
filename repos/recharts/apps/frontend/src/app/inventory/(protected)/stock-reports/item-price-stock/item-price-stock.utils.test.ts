import { describe, expect, it, vi } from "vitest";
import {
	formatCompactDate,
	formatItemPriceStockCurrency,
	formatItemPriceStockQuantity,
	formatOptionalText,
	formatRelativeAge,
} from "./item-price-stock.utils";

describe("item-price-stock.utils", () => {
	it("formats quantities with three decimal places", () => {
		expect(formatItemPriceStockQuantity(42)).toBe("42.000");
		expect(formatItemPriceStockQuantity(0)).toBe("0.000");
		expect(formatItemPriceStockQuantity(1234.5678)).toBe("1,234.568");
	});

	it("formats currency for selected locale", () => {
		expect(formatItemPriceStockCurrency(1234.5, "USD")).toContain("1,234.50");
		expect(formatItemPriceStockCurrency(0, "INR")).toContain("0.00");
		expect(formatItemPriceStockCurrency(99.999, "EUR")).toContain("100.00");
	});

	it("normalizes optional text values", () => {
		expect(formatOptionalText("  Apple  ")).toBe("Apple");
		expect(formatOptionalText(" ")).toBe("-");
		expect(formatOptionalText(null)).toBe("-");
		expect(formatOptionalText(undefined)).toBe("-");
		expect(formatOptionalText("")).toBe("-");
	});

	it("formats dates in compact dd/mm/yyyy format", () => {
		expect(formatCompactDate(new Date("2026-03-24T00:00:00.000Z"))).toBe(
			"24/03/2026",
		);
		expect(formatCompactDate(null)).toBe("-");
		expect(formatCompactDate(undefined)).toBe("-");
	});

	it("formats relative age values", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-24T12:00:00.000Z"));

		expect(formatRelativeAge(new Date("2026-03-24T06:00:00.000Z"))).toBe(
			"Today",
		);
		expect(formatRelativeAge(new Date("2026-03-20T00:00:00.000Z"))).toBe("4 d");
		expect(formatRelativeAge(new Date("2026-01-10T00:00:00.000Z"))).toBe("2 m");
		expect(formatRelativeAge(new Date("2024-09-24T00:00:00.000Z"))).toBe("1 y");
		expect(formatRelativeAge(null)).toBe("-");
		expect(formatRelativeAge(undefined)).toBe("-");

		vi.useRealTimers();
	});
});
