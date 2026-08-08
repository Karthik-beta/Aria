import {
	buildDepreciationSchedule,
	buildDepreciationSchedules,
	type DepreciationBookInput,
} from "../depreciation-schedule-engine";

const baseBook: DepreciationBookInput = {
	financeBookId: "book-default",
	method: "STRAIGHT_LINE",
	grossBookValue: 100_000,
	availableForUseDate: "2030-01-01",
	depreciationStartDate: "2030-12-31",
	totalPeriods: 3,
	frequencyMonths: 12,
	salvageValue: 10_000,
};

describe("buildDepreciationSchedule", () => {
	it("ports ERPNext's straight-line fixture", () => {
		const result = buildDepreciationSchedule(baseBook);

		expect(
			result.entries.map((entry) => [
				entry.date,
				entry.depreciationAmount,
				entry.accumulatedDepreciation,
			]),
		).toEqual([
			["2030-12-31", 30_000, 30_000],
			["2031-12-31", 30_000, 60_000],
			["2032-12-31", 30_000, 90_000],
		]);
	});

	it("preserves month-end and uses fiscal-year day counts for daily pro-rata", () => {
		const result = buildDepreciationSchedule({
			...baseBook,
			grossBookValue: 12_000,
			availableForUseDate: "2023-01-01",
			depreciationStartDate: "2023-01-31",
			totalPeriods: 12,
			frequencyMonths: 1,
			salvageValue: 0,
			dailyProrata: true,
		});

		expect(result.entries[0]).toMatchObject({
			date: "2023-01-31",
			depreciationAmount: 1019.18,
		});
		expect(result.entries[1]).toMatchObject({
			date: "2023-02-28",
			depreciationAmount: 920.55,
		});
		expect(result.entries.at(-1)).toMatchObject({
			date: "2023-12-31",
			bookValueAfterDepreciation: 0,
		});
	});

	it("ports ERPNext's pro-rated straight-line first and final periods", () => {
		const result = buildDepreciationSchedule({
			...baseBook,
			availableForUseDate: "2030-01-30",
		});

		expect(
			result.entries.map((entry) => [entry.date, entry.depreciationAmount]),
		).toEqual([
			["2030-12-31", 27_616.44],
			["2031-12-31", 30_000],
			["2032-12-31", 30_000],
			["2033-01-30", 2383.56],
		]);
	});

	it("preserves ERPNext's non-month-end anniversary for a partial first year", () => {
		const result = buildDepreciationSchedule({
			...baseBook,
			availableForUseDate: "2020-01-01",
			depreciationStartDate: "2020-07-01",
		});

		expect(
			result.entries.map((entry) => [entry.date, entry.depreciationAmount]),
		).toEqual([
			["2020-07-01", 15_000],
			["2021-07-01", 30_000],
			["2022-07-01", 30_000],
			["2023-01-01", 15_000],
		]);
	});

	it("honors opening booked periods and opening accumulated depreciation", () => {
		const result = buildDepreciationSchedule({
			...baseBook,
			availableForUseDate: "2030-06-06",
			depreciationStartDate: "2032-12-31",
			openingBookedPeriods: 2,
			openingAccumulatedDepreciation: 47_178.08,
		});

		expect(
			result.entries.map((entry) => [
				entry.date,
				entry.depreciationAmount,
				entry.accumulatedDepreciation,
			]),
		).toEqual([
			["2032-12-31", 30_000, 77_178.08],
			["2033-06-06", 12_821.92, 90_000],
		]);
	});

	it("ports ERPNext's double-declining-balance fixture and salvage cap", () => {
		const result = buildDepreciationSchedule({
			...baseBook,
			method: "DOUBLE_DECLINING_BALANCE",
		});

		expect(result.ratePercent).toBe(66.67);
		expect(
			result.entries.map((entry) => [entry.date, entry.depreciationAmount]),
		).toEqual([
			["2030-12-31", 66_670],
			["2031-12-31", 22_221.11],
			["2032-12-31", 1108.89],
		]);
	});

	it("ports ERPNext's monthly written-down-value fixture", () => {
		const result = buildDepreciationSchedule({
			financeBookId: "tax-book",
			method: "WRITTEN_DOWN_VALUE",
			grossBookValue: 10_000,
			availableForUseDate: "2022-02-15",
			depreciationStartDate: "2022-02-28",
			totalPeriods: 5,
			frequencyMonths: 1,
			salvageValue: 5000,
		});

		expect(result.ratePercent).toBe(81.05);
		expect(
			result.entries.map((entry) => [entry.date, entry.depreciationAmount]),
		).toEqual([
			["2022-02-28", 337.71],
			["2022-03-31", 675.42],
			["2022-04-30", 675.42],
			["2022-05-31", 675.42],
			["2022-06-30", 675.42],
			["2022-07-15", 1960.61],
		]);
	});

	it("enforces 5 percent salvage floor for WDV rate when salvage is zero or missing", () => {
		const result = buildDepreciationSchedule({
			financeBookId: "zero-salvage-book",
			method: "WRITTEN_DOWN_VALUE",
			grossBookValue: 100_000,
			availableForUseDate: "2030-01-01",
			depreciationStartDate: "2030-12-31",
			totalPeriods: 3,
			frequencyMonths: 12,
			salvageValue: 0,
		});

		expect(result.ratePercent).toBe(63.16);
		expect(result.entries).toHaveLength(3);
	});

	it("ports ERPNext's daily pro-rata WDV fixture across fiscal years", () => {
		const result = buildDepreciationSchedule({
			financeBookId: "wdv-daily-book",
			method: "WRITTEN_DOWN_VALUE",
			grossBookValue: 100_000,
			availableForUseDate: "2021-02-20",
			depreciationStartDate: "2021-03-31",
			totalPeriods: 6,
			frequencyMonths: 3,
			ratePercent: 40,
			dailyProrata: true,
		});

		expect(
			result.entries.map((entry) => [
				entry.date,
				entry.depreciationAmount,
				entry.accumulatedDepreciation,
			]),
		).toEqual([
			["2021-03-31", 4383.56, 4383.56],
			["2021-06-30", 9972.6, 14_356.16],
			["2021-09-30", 10_082.19, 24_438.35],
			["2021-12-31", 10_082.19, 34_520.54],
			["2022-03-31", 6458.25, 40_978.79],
			["2022-06-30", 6530.01, 47_508.8],
			["2022-08-20", 52_491.2, 100_000],
		]);
	});

	it("uses total-life days when daily total-days accounting is enabled", () => {
		const result = buildDepreciationSchedule({
			financeBookId: "daily-book",
			method: "STRAIGHT_LINE",
			grossBookValue: 1096,
			availableForUseDate: "2020-01-15",
			depreciationStartDate: "2020-01-31",
			totalPeriods: 36,
			frequencyMonths: 1,
			dailyProrata: true,
			calculateUsingTotalDays: true,
		});

		expect(result.entries[0]?.depreciationAmount).toBe(17);
		expect(result.entries[1]?.depreciationAmount).toBe(29);
		expect(result.entries.at(-1)).toMatchObject({
			date: "2023-01-15",
			depreciationAmount: 14,
			bookValueAfterDepreciation: 0,
		});
	});

	it("retains caller-authored manual rows", () => {
		const result = buildDepreciationSchedule({
			...baseBook,
			method: "MANUAL",
			manualEntries: [
				{ date: "2030-06-30", amount: 20_000 },
				{ date: "2030-12-31", amount: 25_000, shift: "Double" },
			],
		});

		expect(result.entries).toEqual([
			{
				periodNumber: 1,
				date: "2030-06-30",
				depreciationAmount: 20_000,
				accumulatedDepreciation: 20_000,
				bookValueAfterDepreciation: 80_000,
				shift: null,
			},
			{
				periodNumber: 2,
				date: "2030-12-31",
				depreciationAmount: 25_000,
				accumulatedDepreciation: 45_000,
				bookValueAfterDepreciation: 55_000,
				shift: "Double",
			},
		]);
	});

	it("applies supplied shift factors using sum of shift factors formula", () => {
		const result = buildDepreciationSchedule({
			financeBookId: "shift-book",
			method: "STRAIGHT_LINE",
			grossBookValue: 120_000,
			availableForUseDate: "2023-01-01",
			depreciationStartDate: "2023-01-31",
			totalPeriods: 12,
			frequencyMonths: 1,
			shiftAllocations: [{ periodIndex: 4, shift: "Triple", factor: 2 }],
		});

		expect(result.entries).toHaveLength(12);
		expect(result.entries[4]).toMatchObject({
			date: "2023-05-31",
			depreciationAmount: 18461.54,
			shift: "Triple",
		});
		expect(result.entries.at(-1)?.bookValueAfterDepreciation).toBe(0);
	});

	it("calculates multiple finance books independently", () => {
		const schedules = buildDepreciationSchedules([
			baseBook,
			{
				...baseBook,
				financeBookId: "tax-book",
				method: "WRITTEN_DOWN_VALUE",
				ratePercent: 50,
				salvageValue: 12_500,
			},
		]);

		expect(schedules.map((schedule) => schedule.financeBookId)).toEqual([
			"book-default",
			"tax-book",
		]);
		expect(schedules[0]?.entries[0]?.depreciationAmount).toBe(30_000);
		expect(schedules[1]?.entries[0]?.depreciationAmount).toBe(50_000);
	});

	it("uses the supplied fiscal-year callback for declining-balance refreshes", () => {
		const visited: string[] = [];
		buildDepreciationSchedule({
			...baseBook,
			method: "WRITTEN_DOWN_VALUE",
			ratePercent: 40,
			frequencyMonths: 6,
			totalPeriods: 4,
			depreciationStartDate: "2030-09-30",
			getFiscalYear: (date) => {
				visited.push(date);
				const year = Number(date.slice(0, 4));
				const month = Number(date.slice(5, 7));
				const startYear = month >= 4 ? year : year - 1;
				return {
					startDate: `${startYear}-04-01`,
					endDate: `${startYear + 1}-03-31`,
				};
			},
		});

		expect(visited).toEqual([
			"2030-09-30",
			"2031-03-31",
			"2031-09-30",
			"2032-03-31",
		]);
	});
});
