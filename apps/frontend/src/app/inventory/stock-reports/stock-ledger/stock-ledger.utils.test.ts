import {
	formatCompactDate,
	formatLedgerCurrency,
	formatLedgerQuantity,
	formatStockLedgerMovement,
	formatStockLedgerStatus,
	formatStockLedgerType,
} from "./stock-ledger.utils";

describe("stock-ledger.utils", () => {
	it("formats stock entry types and movement labels", () => {
		expect(formatStockLedgerType("MATERIAL_RECEIPT")).toBe("Material Receipt");
		expect(formatStockLedgerMovement("OUT")).toBe("Outward");
		expect(formatStockLedgerStatus("SUBMITTED")).toBe("Submitted");
	});

	it("formats compact dates in dd/mm/yyyy format", () => {
		expect(formatCompactDate(new Date("2026-03-24T00:00:00.000Z"))).toBe(
			"24/03/2026",
		);
	});

	it("formats quantities and currency with fixed precision", () => {
		expect(formatLedgerQuantity(3)).toBe("3.000");
		expect(formatLedgerCurrency(45000)).toContain("45,000.00");
		expect(formatLedgerCurrency(45000, "AED")).toContain("45,000.00");
	});
});
