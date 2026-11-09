import { describe, expect, it } from "vitest";
import {
	formatRelativeAge,
	formatStockEntryStatus,
	formatStockEntryType,
	getStockEntryStatusBadgeClass,
	toDateInputValue,
} from "./stock-entry.utils";

describe("stock-entry.utils", () => {
	it("formats stock entry type labels", () => {
		expect(formatStockEntryType("MATERIAL_RECEIPT")).toBe("Material Receipt");
		expect(formatStockEntryType("MATERIAL_ISSUE")).toBe("Material Issue");
		expect(formatStockEntryType("MATERIAL_TRANSFER")).toBe("Material Transfer");
		expect(formatStockEntryType("MATERIAL_TRANSFER_FOR_MANUFACTURE")).toBe(
			"Material Transfer for Manufacture",
		);
		expect(formatStockEntryType("MANUFACTURE")).toBe("Manufacture");
		expect(formatStockEntryType("REPACK")).toBe("Repack");
		expect(formatStockEntryType("SEND_TO_SUBCONTRACTOR")).toBe(
			"Send to Subcontractor",
		);
	});

	it("formats stock entry status labels", () => {
		expect(formatStockEntryStatus("DRAFT")).toBe("Draft");
		expect(formatStockEntryStatus("SUBMITTED")).toBe("Submitted");
		expect(formatStockEntryStatus("CANCELLED")).toBe("Cancelled");
	});

	it("returns the correct badge class for each status", () => {
		expect(getStockEntryStatusBadgeClass("DRAFT")).toContain("bg-zinc");
		expect(getStockEntryStatusBadgeClass("SUBMITTED")).toContain("bg-green");
		expect(getStockEntryStatusBadgeClass("CANCELLED")).toContain("bg-red");
	});

	it("formats date values for date input", () => {
		expect(toDateInputValue(new Date("2026-03-23T10:00:00.000Z"))).toBe(
			"2026-03-23",
		);
		expect(toDateInputValue("invalid")).toBe("");
		expect(toDateInputValue(null)).toBe("");
		expect(toDateInputValue(undefined)).toBe("");
	});

	it("formats relative age from Date", () => {
		const now = new Date();
		expect(formatRelativeAge(now)).toBe("Today");

		const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
		expect(formatRelativeAge(twoDaysAgo)).toBe("2 d");

		const twoMonthsAgo = new Date(now.getTime() - 62 * 24 * 60 * 60 * 1000);
		expect(formatRelativeAge(twoMonthsAgo)).toBe("2 m");

		const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
		expect(formatRelativeAge(twoYearsAgo)).toBe("2 y");
	});
});
