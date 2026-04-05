import { describe, expect, it } from "vitest";
import {
	buildAssetDepreciationsAndBalancesInput,
	formatCurrency,
	getClosingDateLabel,
	getDateRangeError,
	getDefaultFromDate,
	getDefaultToDate,
	getOpeningDateLabel,
	getSignedAmountClassName,
	renderOptionalText,
} from "./depreciations-balances.utils";

describe("depreciations-balances.utils", () => {
	it("builds trimmed query input with inclusive date bounds", () => {
		const result = buildAssetDepreciationsAndBalancesInput({
			company: "  ACME Corp  ",
			fromDate: "2026-03-01",
			toDate: "2026-04-30",
			groupBy: "ASSET_CATEGORY",
			asset: "  AST-2026-00001  ",
			assetCategory: "  Machinery  ",
		});

		expect(result).toMatchObject({
			company: "ACME Corp",
			groupBy: "ASSET_CATEGORY",
			asset: "AST-2026-00001",
			assetCategory: "Machinery",
		});
		expect(result.fromDate.toISOString()).toBe("2026-03-01T00:00:00.000Z");
		expect(result.toDate.toISOString()).toBe("2026-04-30T23:59:59.999Z");
	});

	it("validates the requested date range", () => {
		expect(
			getDateRangeError({ fromDate: "2026-04-30", toDate: "2026-04-01" }),
		).toBe("From date must be on or before to date.");
		expect(
			getDateRangeError({ fromDate: "2026-03-01", toDate: "2026-04-30" }),
		).toBeNull();
	});

	it("formats labels and display helpers", () => {
		expect(getOpeningDateLabel("2026-03-01")).toContain("Feb");
		expect(getClosingDateLabel("2026-04-30")).toContain("Apr");
		expect(renderOptionalText("   ")).toBe("-");
		expect(getSignedAmountClassName(100)).toContain("emerald");
		expect(getSignedAmountClassName(-100)).toContain("rose");
	});

	it("formats currency and default dates", () => {
		expect(formatCurrency(12500)).toContain("12,500.00");
		expect(getDefaultFromDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(getDefaultToDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
