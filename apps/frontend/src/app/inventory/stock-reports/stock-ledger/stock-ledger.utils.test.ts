import { describe, expect, it, vi } from "vitest";
import {
	formatCompactDate,
	formatLedgerCurrency,
	formatLedgerQuantity,
	formatRelativeAge,
	formatStockLedgerMovement,
	formatStockLedgerStatus,
	formatStockLedgerType,
	getStockLedgerMovementBadgeClass,
	getStockLedgerStatusBadgeClass,
	toDateInputValue,
} from "./stock-ledger.utils";

describe("stock-ledger.utils", () => {
	it("formats stock entry types and movement labels", () => {
		expect(formatStockLedgerType("MATERIAL_RECEIPT")).toBe("Material Receipt");
		expect(formatStockLedgerType("MATERIAL_ISSUE")).toBe("Material Issue");
		expect(formatStockLedgerType("MATERIAL_TRANSFER")).toBe(
			"Material Transfer",
		);
		expect(formatStockLedgerType("MANUFACTURE")).toBe("Manufacture");
		expect(formatStockLedgerType("REPACK")).toBe("Repack");
		expect(formatStockLedgerType("SEND_TO_SUBCONTRACTOR")).toBe(
			"Send to Subcontractor",
		);
		expect(formatStockLedgerMovement("IN")).toBe("Inward");
		expect(formatStockLedgerMovement("OUT")).toBe("Outward");
		expect(formatStockLedgerStatus("SUBMITTED")).toBe("Submitted");
		expect(formatStockLedgerStatus("DRAFT")).toBe("Draft");
		expect(formatStockLedgerStatus("CANCELLED")).toBe("Cancelled");
	});

	it("formats compact dates in dd/mm/yyyy format", () => {
		expect(formatCompactDate(new Date("2026-03-24T00:00:00.000Z"))).toBe(
			"24/03/2026",
		);
	});

	it("formats quantities and currency with fixed precision", () => {
		expect(formatLedgerQuantity(3)).toBe("3.000");
		expect(formatLedgerQuantity(0)).toBe("0.000");
		expect(formatLedgerQuantity(1234.5678)).toBe("1,234.568");
		expect(formatLedgerCurrency(45000)).toContain("45,000.00");
		expect(formatLedgerCurrency(45000, "AED")).toContain("45,000.00");
		expect(formatLedgerCurrency(0, "USD")).toContain("0.00");
		expect(formatLedgerCurrency(99.999, "EUR")).toContain("100.00");
	});

	it("returns correct badge classes for each status", () => {
		expect(getStockLedgerStatusBadgeClass("DRAFT")).toContain("muted");
		expect(getStockLedgerStatusBadgeClass("SUBMITTED")).toContain("emerald");
		expect(getStockLedgerStatusBadgeClass("CANCELLED")).toContain(
			"destructive",
		);
	});

	it("returns correct badge classes for each movement type", () => {
		expect(getStockLedgerMovementBadgeClass("IN")).toContain("emerald");
		expect(getStockLedgerMovementBadgeClass("OUT")).toContain("amber");
	});

	it("formats relative age values", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-24T12:00:00.000Z"));

		expect(formatRelativeAge(new Date("2026-03-24T06:00:00.000Z"))).toBe(
			"Today",
		);
		expect(formatRelativeAge(new Date("2026-03-22T00:00:00.000Z"))).toBe("2 d");
		expect(formatRelativeAge(new Date("2026-01-20T00:00:00.000Z"))).toBe("2 m");
		expect(formatRelativeAge(new Date("2024-03-24T00:00:00.000Z"))).toBe("2 y");

		vi.useRealTimers();
	});

	it("converts dates to input value strings", () => {
		expect(toDateInputValue(new Date("2026-03-24T00:00:00.000Z"))).toBe(
			"2026-03-24",
		);
		expect(toDateInputValue("2026-03-24T12:00:00.000Z")).toBe("2026-03-24");
		expect(toDateInputValue(null)).toBe("");
		expect(toDateInputValue(undefined)).toBe("");
		expect(toDateInputValue("invalid-date")).toBe("");
	});
});
