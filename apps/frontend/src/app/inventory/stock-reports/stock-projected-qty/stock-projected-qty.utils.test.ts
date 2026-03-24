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
	});

	it("formats currencies with the configured locale", () => {
		expect(formatProjectedQtyCurrency(1234.5, "USD")).toContain("1,234.50");
	});

	it("formats dates and fallback text safely", () => {
		expect(formatCompactDate(new Date("2026-03-24T00:00:00.000Z"))).toBe(
			"24/03/2026",
		);
		expect(formatOptionalText("   ")).toBe("-");
	});

	it("formats relative age values", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-24T00:00:00.000Z"));

		expect(formatRelativeAge(new Date("2026-03-22T00:00:00.000Z"))).toBe("2 d");

		vi.useRealTimers();
	});
});
