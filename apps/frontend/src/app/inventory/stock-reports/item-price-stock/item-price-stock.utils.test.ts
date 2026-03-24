import {
	formatItemPriceStockCurrency,
	formatItemPriceStockQuantity,
	formatOptionalText,
} from "./item-price-stock.utils";

describe("item-price-stock.utils", () => {
	it("formats quantities with three decimal places", () => {
		expect(formatItemPriceStockQuantity(42)).toBe("42.000");
	});

	it("formats currency for selected locale", () => {
		expect(formatItemPriceStockCurrency(1234.5, "USD")).toContain("1,234.50");
	});

	it("normalizes optional text values", () => {
		expect(formatOptionalText("  Apple  ")).toBe("Apple");
		expect(formatOptionalText(" ")).toBe("-");
		expect(formatOptionalText(null)).toBe("-");
	});
});
