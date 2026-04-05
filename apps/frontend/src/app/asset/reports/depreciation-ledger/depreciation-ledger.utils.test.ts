import { describe, expect, it } from "vitest";
import {
	buildAssetDepreciationLedgerInput,
	formatAssetStatus,
	formatCurrency,
	formatDepreciationMethod,
	formatRevisionLabel,
	getDateRangeError,
	getDefaultFromDate,
	getDefaultToDate,
	renderOptionalText,
} from "./depreciation-ledger.utils";

describe("depreciation-ledger.utils", () => {
	it("builds trimmed query input with inclusive date bounds", () => {
		const result = buildAssetDepreciationLedgerInput({
			company: "  ACME Corp  ",
			fromDate: "2026-04-01",
			toDate: "2026-04-30",
			asset: "  AST-2026-00001  ",
			assetCategory: "  Machinery  ",
			costCenter: "  Main Plant  ",
		});

		expect(result).toMatchObject({
			company: "ACME Corp",
			asset: "AST-2026-00001",
			assetCategory: "Machinery",
			costCenter: "Main Plant",
		});
		expect(result.fromDate.toISOString()).toBe("2026-04-01T00:00:00.000Z");
		expect(result.toDate.toISOString()).toBe("2026-04-30T23:59:59.999Z");
	});

	it("validates the requested date range", () => {
		expect(
			getDateRangeError({ fromDate: "2026-04-30", toDate: "2026-04-01" }),
		).toBe("From date must be on or before to date.");
		expect(
			getDateRangeError({ fromDate: "2026-04-01", toDate: "2026-04-30" }),
		).toBeNull();
	});

	it("formats domain values for display", () => {
		expect(formatDepreciationMethod("DOUBLE_DECLINING_BALANCE")).toBe(
			"Double Declining Balance",
		);
		expect(formatAssetStatus("PARTIALLY_DEPRECIATED")).toBe(
			"Partially Depreciated",
		);
		expect(formatRevisionLabel(3)).toBe("R3");
		expect(renderOptionalText("   ")).toBe("-");
	});

	it("formats currency and default dates", () => {
		expect(formatCurrency(12500)).toContain("12,500.00");
		expect(getDefaultFromDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(getDefaultToDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
