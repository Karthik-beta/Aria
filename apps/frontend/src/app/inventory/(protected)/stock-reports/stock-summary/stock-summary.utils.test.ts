import { describe, expect, it, vi } from "vitest";
import {
	formatCompactDate,
	formatOptionalText,
	formatRelativeAge,
	formatStockSummaryHealth,
	formatStockSummaryMetric,
	formatStockSummaryQuantity,
	getStockSummaryBarWidth,
} from "./stock-summary.utils";

describe("stock-summary.utils", () => {
	it("formats quantities with three decimal places", () => {
		expect(formatStockSummaryQuantity(42)).toBe("42.000");
	});

	it("formats labels and fallback text safely", () => {
		expect(formatStockSummaryMetric("RESERVED_QTY_FOR_PRODUCTION")).toBe(
			"Reserved for manufacturing",
		);
		expect(formatStockSummaryHealth("LOW")).toBe("Low stock");
		expect(formatOptionalText("   ")).toBe("-");
		expect(formatCompactDate(new Date("2026-03-24T00:00:00.000Z"))).toBe(
			"24/03/2026",
		);
	});

	it("formats relative age values", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-24T00:00:00.000Z"));

		expect(formatRelativeAge(new Date("2026-03-22T00:00:00.000Z"))).toBe("2 d");

		vi.useRealTimers();
	});

	it("caps bar widths at 100 percent", () => {
		expect(getStockSummaryBarWidth(25, 50)).toBe("50%");
		expect(getStockSummaryBarWidth(125, 50)).toBe("100%");
	});
});
