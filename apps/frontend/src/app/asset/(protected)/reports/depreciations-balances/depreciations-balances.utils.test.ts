import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildAssetDepreciationsAndBalancesInput,
	formatCurrency,
	formatDateLabel,
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

const ZONES = [
	"Asia/Kolkata",
	"Pacific/Auckland",
	"UTC",
	"America/Los_Angeles",
	"Pacific/Kiritimati",
] as const;

describe.each(ZONES)("date labels in %s", (zone) => {
	const originalTz = process.env.TZ;

	beforeEach(() => {
		process.env.TZ = zone;
	});

	afterEach(() => {
		if (originalTz === undefined) {
			delete process.env.TZ;
		} else {
			process.env.TZ = originalTz;
		}
	});

	it("shows the selected calendar dates", () => {
		expect(getClosingDateLabel("2026-04-30")).toBe("30 Apr 2026");
		expect(getOpeningDateLabel("2026-03-01")).toBe("28 Feb 2026");
	});

	it("handles month, leap day and year boundaries", () => {
		expect(getClosingDateLabel("2026-01-01")).toBe("01 Jan 2026");
		expect(getClosingDateLabel("2026-01-31")).toBe("31 Jan 2026");
		expect(getClosingDateLabel("2028-02-29")).toBe("29 Feb 2028");
		expect(getOpeningDateLabel("2028-03-01")).toBe("29 Feb 2028");
		expect(getOpeningDateLabel("2026-04-01")).toBe("31 Mar 2026");
		expect(getClosingDateLabel("2026-12-31")).toBe("31 Dec 2026");
		expect(getOpeningDateLabel("2027-01-01")).toBe("31 Dec 2026");
	});

	it("formats Date and ISO timestamp values by their UTC day", () => {
		expect(formatDateLabel(new Date("2026-04-30T23:59:59.999Z"))).toBe(
			"30 Apr 2026",
		);
		expect(formatDateLabel("2026-05-01T00:00:00.000Z")).toBe("01 May 2026");
		expect(formatDateLabel("invalid")).toBe("-");
	});
});
