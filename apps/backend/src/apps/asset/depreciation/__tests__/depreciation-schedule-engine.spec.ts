import {
	buildDepreciationSchedule,
	buildDepreciationSchedules,
	type DepreciationBookInput,
	DepreciationScheduleCalculationError,
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

	it("uses the remaining carrying basis for opening straight-line depreciation", () => {
		const result = buildDepreciationSchedule({
			financeBookId: "opening-sl-book",
			method: "STRAIGHT_LINE",
			grossBookValue: 1_000,
			availableForUseDate: "2030-01-01",
			depreciationStartDate: "2031-12-31",
			totalPeriods: 3,
			frequencyMonths: 12,
			salvageValue: 100,
			openingBookedPeriods: 1,
			openingAccumulatedDepreciation: 200,
		});

		expect(
			result.entries.map((entry) => [
				entry.depreciationAmount,
				entry.accumulatedDepreciation,
				entry.bookValueAfterDepreciation,
			]),
		).toEqual([
			[350, 550, 450],
			[350, 900, 100],
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

	it("rounds declining-balance rates at the persisted rate precision", () => {
		const result = buildDepreciationSchedule({
			financeBookId: "rate-precision-book",
			method: "WRITTEN_DOWN_VALUE",
			grossBookValue: 10_000,
			availableForUseDate: "2022-02-15",
			depreciationStartDate: "2022-02-28",
			totalPeriods: 5,
			frequencyMonths: 1,
			salvageValue: 5_000,
			ratePercent: 81.054321,
			ratePrecision: 3,
		});

		expect(result.ratePercent).toBe(81.054);
	});

	it("mirrors ERPNext's 100 percent WDV rate for zero salvage without an explicit rate", () => {
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

		expect(result.ratePercent).toBe(100);
		expect(result.entries).toEqual([
			expect.objectContaining({
				depreciationAmount: 100_000,
				bookValueAfterDepreciation: 0,
			}),
		]);
	});

	it("returns a finite terminal state for a fully depreciated zero-salvage WDV book", () => {
		const result = buildDepreciationSchedule({
			financeBookId: "fully-depreciated-wdv-book",
			method: "WRITTEN_DOWN_VALUE",
			grossBookValue: 1_000,
			availableForUseDate: "2030-01-01",
			depreciationStartDate: "2030-12-31",
			totalPeriods: 12,
			frequencyMonths: 1,
			salvageValue: 0,
			openingBookedPeriods: 11,
			openingAccumulatedDepreciation: 1_000,
		});

		expect(result.ratePercent).toBeNull();
		expect(result.entries).toEqual([]);
	});

	it("keeps a residual-value WDV book terminal without adding depreciation", () => {
		const result = buildDepreciationSchedule({
			financeBookId: "residual-wdv-book",
			method: "WRITTEN_DOWN_VALUE",
			grossBookValue: 1_000,
			availableForUseDate: "2030-01-01",
			depreciationStartDate: "2030-12-31",
			totalPeriods: 12,
			frequencyMonths: 1,
			salvageValue: 100,
			openingBookedPeriods: 11,
			openingAccumulatedDepreciation: 900,
		});

		expect(result.ratePercent).toBe(0);
		expect(result.entries).toEqual([]);
	});

	it("rejects an over-accumulated WDV book with positive salvage", () => {
		expect(() =>
			buildDepreciationSchedule({
				financeBookId: "invalid-wdv-book",
				method: "WRITTEN_DOWN_VALUE",
				grossBookValue: 1_000,
				availableForUseDate: "2030-01-01",
				depreciationStartDate: "2030-12-31",
				totalPeriods: 12,
				frequencyMonths: 1,
				salvageValue: 100,
				openingBookedPeriods: 11,
				openingAccumulatedDepreciation: 1_000,
			}),
		).toThrow("opening accumulated depreciation exceeds depreciable value");
	});

	it("rejects negative and non-finite business inputs before depreciation math", () => {
		expect(() =>
			buildDepreciationSchedule({
				...baseBook,
				salvageValue: -1,
			}),
		).toThrow("salvageValue must be between zero and grossBookValue");
		expect(() =>
			buildDepreciationSchedule({
				...baseBook,
				grossBookValue: Number.NaN,
			}),
		).toThrow("grossBookValue must be finite");
		expect(() =>
			buildDepreciationSchedule({
				...baseBook,
				openingAccumulatedDepreciation: Number.POSITIVE_INFINITY,
			}),
		).toThrow("openingAccumulatedDepreciation must be finite");
		expect(() =>
			buildDepreciationSchedule({
				...baseBook,
				method: "WRITTEN_DOWN_VALUE",
				ratePercent: Number.NaN,
			}),
		).toThrow("ratePercent must be finite");
		expect(() =>
			buildDepreciationSchedule({
				...baseBook,
				method: "WRITTEN_DOWN_VALUE",
				ratePercent: -5,
			}),
		).toThrow(DepreciationScheduleCalculationError);
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
		const input: DepreciationBookInput = {
			financeBookId: "daily-book",
			method: "STRAIGHT_LINE",
			grossBookValue: 1096,
			availableForUseDate: "2020-01-15",
			depreciationStartDate: "2020-01-31",
			totalPeriods: 36,
			frequencyMonths: 1,
			dailyProrata: true,
			calculateUsingTotalDays: true,
		};
		const result = buildDepreciationSchedule(input);
		const fiscalYearResult = buildDepreciationSchedule({
			...input,
			calculateUsingTotalDays: false,
		});

		expect(result.entries[0]?.depreciationAmount).toBe(17);
		expect(result.entries[1]?.depreciationAmount).toBe(29);
		expect(fiscalYearResult.entries[0]?.depreciationAmount).not.toBe(17);
		expect(result.entries.at(-1)).toMatchObject({
			date: "2023-01-15",
			depreciationAmount: 14,
			bookValueAfterDepreciation: 0,
		});
	});

	it("rounds the final residual at the selected currency precision", () => {
		const precision3 = buildDepreciationSchedule({
			...baseBook,
			grossBookValue: 1_000,
			salvageValue: 0,
			totalPeriods: 3,
			precision: 3,
		});
		const precision6 = buildDepreciationSchedule({
			...baseBook,
			grossBookValue: 1_000,
			salvageValue: 0,
			totalPeriods: 3,
			precision: 6,
		});

		expect(precision3.entries.map((entry) => entry.depreciationAmount)).toEqual(
			[333.333, 333.333, 333.334],
		);
		expect(precision6.entries.map((entry) => entry.depreciationAmount)).toEqual(
			[333.333333, 333.333333, 333.333334],
		);
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
		const shiftAllocations = Array.from({ length: 12 }, (_, periodIndex) => ({
			periodIndex,
			shift: periodIndex === 4 ? "Triple" : "Single",
			factor: periodIndex === 4 ? 2 : 1,
		}));
		const result = buildDepreciationSchedule({
			financeBookId: "shift-book",
			method: "STRAIGHT_LINE",
			grossBookValue: 120_000,
			availableForUseDate: "2023-01-01",
			depreciationStartDate: "2023-01-31",
			totalPeriods: 12,
			frequencyMonths: 1,
			precision: 3,
			shiftBased: true,
			shiftAllocations,
		});

		expect(result.entries).toHaveLength(12);
		expect(result.entries[4]).toMatchObject({
			date: "2023-05-31",
			depreciationAmount: 18461.538,
			shift: "Triple",
		});
		expect(
			result.entries.reduce(
				(total, entry) => total + entry.depreciationAmount,
				0,
			),
		).toBe(120_000);
		expect(result.entries.at(-1)?.bookValueAfterDepreciation).toBe(0);
	});

	it("retains the default shift identity on a final pro-rata tail", () => {
		const shiftAllocations = Array.from({ length: 12 }, (_, periodIndex) => ({
			periodIndex,
			shift: periodIndex === 4 ? "Double" : "Single",
			factor: periodIndex === 4 ? 2 : 1,
		}));
		const result = buildDepreciationSchedule({
			financeBookId: "shift-tail-book",
			method: "STRAIGHT_LINE",
			grossBookValue: 120_000,
			availableForUseDate: "2023-01-15",
			depreciationStartDate: "2023-01-31",
			totalPeriods: 12,
			frequencyMonths: 1,
			precision: 2,
			shiftBased: true,
			shiftAllocations,
		});

		expect(result.entries).toHaveLength(13);
		expect(result.entries.at(-1)).toMatchObject({
			periodNumber: 13,
			date: "2024-01-15",
			depreciationAmount: 4168.73,
			bookValueAfterDepreciation: 0,
			shift: "Single",
		});
	});

	it("rejects incomplete or conflicting persisted depreciation options", () => {
		expect(() =>
			buildDepreciationSchedule({
				...baseBook,
				shiftBased: true,
				shiftAllocations: [{ periodIndex: 4, shift: "Double", factor: 2 }],
			}),
		).toThrow("one persisted shift allocation for every period");
		expect(() =>
			buildDepreciationSchedule({
				...baseBook,
				shiftBased: false,
				shiftAllocations: [{ periodIndex: 0, shift: "Single", factor: 1 }],
			}),
		).toThrow("shift allocations require shiftBased depreciation");
		expect(() =>
			buildDepreciationSchedule({
				...baseBook,
				calculateUsingTotalDays: true,
			}),
		).toThrow("calculateUsingTotalDays requires daily straight-line");
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

	it("does not share opening depreciation state between finance books", () => {
		const schedules = buildDepreciationSchedules([
			{
				financeBookId: "book-a",
				method: "STRAIGHT_LINE",
				grossBookValue: 1_000,
				availableForUseDate: "2030-01-01",
				depreciationStartDate: "2031-12-31",
				totalPeriods: 3,
				frequencyMonths: 12,
				salvageValue: 100,
				openingBookedPeriods: 1,
				openingAccumulatedDepreciation: 200,
			},
			{
				financeBookId: "book-b",
				method: "STRAIGHT_LINE",
				grossBookValue: 1_000,
				availableForUseDate: "2030-01-01",
				depreciationStartDate: "2031-12-31",
				totalPeriods: 3,
				frequencyMonths: 12,
				salvageValue: 100,
				openingBookedPeriods: 1,
				openingAccumulatedDepreciation: 400,
			},
		]);

		expect(
			schedules[0]?.entries.map((entry) => entry.depreciationAmount),
		).toEqual([350, 350]);
		expect(
			schedules[1]?.entries.map((entry) => entry.depreciationAmount),
		).toEqual([250, 250]);
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
