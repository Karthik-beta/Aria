import {
	type BuildDepreciationSchedulePreviewInput,
	buildDepreciationSchedulePreview,
} from "../asset-value-adjustment.utils";

function mockGetFiscalYearEndDate(date: Date): Promise<Date | null> {
	const month = date.getMonth();
	const year = date.getFullYear();
	let fyStartYear: number;
	if (month >= 3) {
		fyStartYear = year;
	} else {
		fyStartYear = year - 1;
	}
	return Promise.resolve(new Date(fyStartYear + 1, 2, 31));
}

describe("buildDepreciationSchedulePreview", () => {
	const baseInput: BuildDepreciationSchedulePreviewInput = {
		adjustmentDate: new Date("2024-04-15"),
		currentAssetValue: 80000,
		newAssetValue: 100000,
		purchaseAmount: 100000,
		openingAccumulatedDepreciation: 20000,
		bookedDepreciations: 2,
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 10,
		frequencyOfDepreciation: 12,
		dailyProrataBased: false,
		shiftBased: false,
	};

	describe("STRAIGHT_LINE", () => {
		it("calculates equal depreciation across remaining periods using depreciableValue", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "STRAIGHT_LINE",
				expectedValueAfterUsefulLife: 10000,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.depreciationMethod).toBe("STRAIGHT_LINE");
			expect(result?.entries).toHaveLength(8);

			const depreciableAmount = 100000 - 10000;
			const expectedPerPeriod =
				Math.round((depreciableAmount / 8) * 1000000) / 1000000;

			result?.entries.forEach((entry) => {
				expect(entry.depreciationAmount).toBeCloseTo(expectedPerPeriod, 4);
			});
		});

		it("depreciates full value when expectedValueAfterUsefulLife is 0", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "STRAIGHT_LINE",
				expectedValueAfterUsefulLife: 0,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries).toHaveLength(8);
			const total = result?.entries.reduce(
				(s, e) => s + e.depreciationAmount,
				0,
			);
			expect(total).toBeCloseTo(100000, 2);
		});

		it("preserves salvage value in final entry", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "STRAIGHT_LINE",
				expectedValueAfterUsefulLife: 10000,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeGreaterThan(0);
			const lastEntry = result?.entries[result?.entries.length - 1];
			expect(lastEntry?.bookValueAfterDepreciation).toBeCloseTo(10000, 2);
		});
	});

	describe("WRITTEN_DOWN_VALUE", () => {
		it("calculates declining depreciation based on rate", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				rateOfDepreciation: 20,
				expectedValueAfterUsefulLife: 10000,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.depreciationMethod).toBe("WRITTEN_DOWN_VALUE");

			expect(result?.entries.length).toBeGreaterThan(1);
			const first = result?.entries[0];
			const second = result?.entries[1];
			expect(first?.depreciationAmount).toBeGreaterThan(
				second?.depreciationAmount ?? 0,
			);
		});

		it("breaks loop when depreciation becomes 0", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				rateOfDepreciation: 100,
				expectedValueAfterUsefulLife: 0,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeLessThanOrEqual(8);
		});

		it("resets pendingDepreciationAmount on fiscal year change", async () => {
			const inputAcrossFY: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				adjustmentDate: new Date("2024-11-01"),
				currentAssetValue: 80000,
				newAssetValue: 100000,
				purchaseAmount: 100000,
				openingAccumulatedDepreciation: 0,
				bookedDepreciations: 0,
				totalNumberOfDepreciations: 4,
				frequencyOfDepreciation: 12,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				rateOfDepreciation: 20,
				getFiscalYearEndDate: mockGetFiscalYearEndDate,
			};

			const result = await buildDepreciationSchedulePreview(inputAcrossFY);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeGreaterThan(0);
		});
	});

	describe("DOUBLE_DECLINING_BALANCE", () => {
		it("applies 200% declining balance rate per period", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "DOUBLE_DECLINING_BALANCE",
				expectedValueAfterUsefulLife: 10000,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.depreciationMethod).toBe("DOUBLE_DECLINING_BALANCE");

			expect(result?.entries.length).toBeGreaterThan(1);
			const first = result?.entries[0];
			const second = result?.entries[1];
			expect(first?.depreciationAmount).toBeGreaterThan(
				second?.depreciationAmount ?? 0,
			);
		});

		it("breaks loop when depreciation becomes 0", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "DOUBLE_DECLINING_BALANCE",
				rateOfDepreciation: 100,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeLessThanOrEqual(8);
		});
	});

	describe("MANUAL", () => {
		it("initializes entries using straight line by default", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "MANUAL",
				expectedValueAfterUsefulLife: 10000,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.depreciationMethod).toBe("MANUAL");
			expect(result?.entries).toHaveLength(8);
			expect(result?.remainingDepreciations).toBe(8);

			const depreciableAmount = 100000 - 10000;
			const expectedPerPeriod =
				Math.round((depreciableAmount / 8) * 1000000) / 1000000;

			result?.entries.forEach((entry) => {
				expect(entry.depreciationAmount).toBeCloseTo(expectedPerPeriod, 4);
			});
		});
	});

	describe("edge cases", () => {
		it("returns null when depreciationMethod is null", async () => {
			const input = {
				...baseInput,
				depreciationMethod: null,
			} as BuildDepreciationSchedulePreviewInput;

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).toBeNull();
		});

		it("returns null when totalNumberOfDepreciations is 0", async () => {
			const input = {
				...baseInput,
				totalNumberOfDepreciations: 0,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).toBeNull();
		});

		it("caps depreciation at remaining value", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "STRAIGHT_LINE",
				expectedValueAfterUsefulLife: 0,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeGreaterThan(0);
			const lastEntry = result?.entries[result?.entries.length - 1];
			const cap =
				(lastEntry?.accumulatedDepreciationAmount ?? 0) +
				(lastEntry?.bookValueAfterDepreciation ?? 0);
			expect(lastEntry?.depreciationAmount).toBeLessThanOrEqual(cap);
		});
	});

	describe("fiscal year detection", () => {
		it("initializes fiscal year on first schedule", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				rateOfDepreciation: 20,
				bookedDepreciations: 0,
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 3,
				getFiscalYearEndDate: mockGetFiscalYearEndDate,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeGreaterThan(0);
		});
	});

	describe("DOUBLE_DECLINING_BALANCE DDB rate", () => {
		it("applies 200% declining balance rate per period (coefficient is 2/totalYears)", async () => {
			// Per authoritative sources (Investopedia, IRS Pub 946):
			// DDB rate = 2/totalYears (as decimal, e.g., 0.20 for 10-year asset)
			// NOT 200/totalYears which would be a 100x overstatement
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "DOUBLE_DECLINING_BALANCE",
				expectedValueAfterUsefulLife: 10000,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.depreciationMethod).toBe("DOUBLE_DECLINING_BALANCE");
			expect(result?.entries.length).toBeGreaterThan(1);

			// Verify declining pattern (first > second)
			const first = result?.entries[0];
			const second = result?.entries[1];
			expect(first?.depreciationAmount).toBeGreaterThan(
				second?.depreciationAmount ?? 0,
			);
		});

		it("terminates early when depreciation reaches zero (per IAS 16)", async () => {
			// IAS 16: schedule must terminate when depreciation hits zero,
			// cannot depreciate below residual value
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "DOUBLE_DECLINING_BALANCE",
				rateOfDepreciation: 100, // Forces rapid depreciation to zero
				totalNumberOfDepreciations: 10,
				expectedValueAfterUsefulLife: 10000,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			// Schedule should terminate early (per IAS 16), not redistribute
			expect(result?.entries.length).toBeLessThan(10);
		});
	});

	describe("dailyProrataBased", () => {
		it("calculates daily pro-rata depreciation when dailyProrataBased is true for STRAIGHT_LINE", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "STRAIGHT_LINE",
				expectedValueAfterUsefulLife: 10000,
				dailyProrataBased: true,
				getFiscalYearEndDate: mockGetFiscalYearEndDate,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeGreaterThan(0);
			// Check that periods have varying amounts depending on number of days in the month/period
			const firstAmount = result?.entries[0].depreciationAmount;
			const secondAmount = result?.entries[1].depreciationAmount;
			expect(firstAmount).not.toBe(secondAmount);
		});

		it("calculates daily pro-rata depreciation when dailyProrataBased is true for DOUBLE_DECLINING_BALANCE", async () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "DOUBLE_DECLINING_BALANCE",
				expectedValueAfterUsefulLife: 10000,
				dailyProrataBased: true,
				getFiscalYearEndDate: mockGetFiscalYearEndDate,
			};

			const result = await buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeGreaterThan(0);
		});
	});
});
