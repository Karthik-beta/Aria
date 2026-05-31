import { describe, expect, it } from "vitest";
import {
	computeReturnedPercentage,
	formatCurrency,
	formatPurchaseReceiptStatus,
	toDateInputValue,
} from "./purchase-receipt.utils";

describe("purchase-receipt.utils", () => {
	it("formats purchase receipt status labels", () => {
		expect(formatPurchaseReceiptStatus("TO_BILL")).toBe("To Bill");
		expect(formatPurchaseReceiptStatus("PARTLY_BILLED")).toBe("Partly Billed");
	});

	it("formats date values for date input", () => {
		expect(toDateInputValue(new Date("2026-03-23T10:00:00.000Z"))).toBe(
			"2026-03-23",
		);
		expect(toDateInputValue("invalid")).toBe("");
	});

	it("formats currency with and without prefix", () => {
		expect(formatCurrency(1234.5, "INR")).toContain("INR");
		expect(formatCurrency(1234.5)).toContain("1,234.50");
	});

	it("computes returned percentage from accepted/rejected quantities", () => {
		expect(computeReturnedPercentage(80, 20)).toBe(20);
		expect(computeReturnedPercentage(0, 0)).toBe(0);
	});
});
