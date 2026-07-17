import {
	buildIndianFiscalYears,
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
	});

	it("allows cron to catch up a newly commissioned asset", () => {
		const startDate = resolveDemoDepreciationStartDate(
			new Date("2026-07-16T12:00:00.000Z"),
			new Date("2026-03-25T00:00:00.000Z"),
			0,
			1,
		);

		expect(startDate.toISOString()).toBe("2026-03-31T00:00:00.000Z");
	});

	it("starts after the as-of date when opening depreciation is already booked", () => {
		const monthly = resolveDemoDepreciationStartDate(
			new Date("2026-07-16T12:00:00.000Z"),
			new Date("2024-08-01T00:00:00.000Z"),
			14,
			1,
		);
		const quarterlyAtMonthEnd = resolveDemoDepreciationStartDate(
			new Date("2026-07-31T12:00:00.000Z"),
			new Date("2024-08-01T00:00:00.000Z"),
			8,
			3,
		);

		expect(monthly.toISOString()).toBe("2026-07-31T00:00:00.000Z");
		expect(quarterlyAtMonthEnd.toISOString()).toBe("2026-10-31T00:00:00.000Z");
	});
});
