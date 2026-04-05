import { describe, expect, it } from "vitest";
import {
	buildAssetActivityReportInput,
	formatAssetStatus,
	formatDateTime,
	getDateRangeError,
	getDefaultFromDate,
	getDefaultToDate,
	renderOptionalText,
} from "./activity.utils";

describe("activity.utils", () => {
	it("builds trimmed query input with inclusive date bounds", () => {
		const result = buildAssetActivityReportInput({
			company: "  ACME Corp  ",
			fromDate: "2026-04-01",
			toDate: "2026-04-30",
			asset: "  AST-2026-00001  ",
			assetCategory: "  Machinery  ",
			activity: "  submitted  ",
		});

		expect(result).toMatchObject({
			company: "ACME Corp",
			asset: "AST-2026-00001",
			assetCategory: "Machinery",
			activity: "submitted",
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

	it("formats display values for the activity report", () => {
		expect(formatAssetStatus("PARTIALLY_DEPRECIATED")).toBe(
			"Partially Depreciated",
		);
		expect(formatDateTime("2026-04-30T10:15:00.000Z")).toContain("2026");
		expect(renderOptionalText("   ")).toBe("-");
		expect(getDefaultFromDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(getDefaultToDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
