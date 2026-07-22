import {
	buildIndianFiscalYears,
	DEMO_ASSET_DEPRECIATION_CADENCES,
	getIndianFiscalYear,
	normalizeDemoAsOf,
	resolveDemoDepreciationStartDate,
} from "../depreciation/demo-data.utils";

describe("asset demo depreciation data", () => {
	it("builds rolling Indian fiscal years around the demo as-of date", () => {
		const fiscalYears = buildIndianFiscalYears(
			new Date("2026-07-16T12:00:00.000Z"),
		);

		expect(fiscalYears.map((fiscalYear) => fiscalYear.year)).toEqual([
			"2023-24",
			"2024-25",
			"2025-26",
			"2026-27",
			"2027-28",
		]);
		expect(fiscalYears[3]?.yearStartDate.toISOString()).toBe(
			"2026-04-01T00:00:00.000Z",
		);
		expect(fiscalYears[3]?.yearEndDate.toISOString()).toBe(
			"2027-03-31T00:00:00.000Z",
		);
	});

	it("keeps January inside the fiscal year that began the previous April", () => {
		const fiscalYears = buildIndianFiscalYears(
			new Date("2026-01-15T12:00:00.000Z"),
		);

		expect(fiscalYears[3]?.year).toBe("2025-26");
		expect(getIndianFiscalYear("2024-02-29")).toEqual({
			startDate: "2023-04-01",
			endDate: "2024-03-31",
		});
	});

	it("allows cron to catch up a newly commissioned asset", () => {
		const startDate = resolveDemoDepreciationStartDate(
			new Date("2026-03-25T00:00:00.000Z"),
		);

		expect(startDate.toISOString()).toBe("2026-03-31T00:00:00.000Z");
	});

	it("represents every ERPNext month-based demo cadence without weekly values", () => {
		expect(new Set(Object.values(DEMO_ASSET_DEPRECIATION_CADENCES))).toEqual(
			new Set([1, 3, 6, 12]),
		);
		expect(Object.values(DEMO_ASSET_DEPRECIATION_CADENCES)).not.toContain(0);
	});

	it("validates reproducible loader accounting cutoffs", () => {
		expect(normalizeDemoAsOf("2026-07-22")).toBe("2026-07-22");
		expect(() => normalizeDemoAsOf("2026-02-29")).toThrow(
			"not a valid calendar date",
		);
		expect(() => normalizeDemoAsOf("22-07-2026")).toThrow("YYYY-MM-DD");
	});
});
