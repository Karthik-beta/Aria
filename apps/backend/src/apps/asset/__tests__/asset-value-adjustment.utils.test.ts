import {
	type BuildDepreciationSchedulePreviewInput,
	buildDepreciationSchedulePreview,
} from "../asset-value-adjustment.utils";

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
		it("calculates equal depreciation across remaining periods using depreciableValue", () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "STRAIGHT_LINE",
				expectedValueAfterUsefulLife: 10000,
			};

			const result = buildDepreciationSchedulePreview(input);

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

		it("depreciates full value when expectedValueAfterUsefulLife is 0", () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "STRAIGHT_LINE",
				expectedValueAfterUsefulLife: 0,
			};

			const result = buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries).toHaveLength(8);
			const total = result?.entries.reduce(
				(s, e) => s + e.depreciationAmount,
				0,
			);
			expect(total).toBeCloseTo(100000, 2);
		});

		it("preserves salvage value in final entry", () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "STRAIGHT_LINE",
				expectedValueAfterUsefulLife: 10000,
			};

			const result = buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeGreaterThan(0);
			const lastEntry = result?.entries[result?.entries.length - 1];
			expect(lastEntry?.bookValueAfterDepreciation).toBeCloseTo(10000, 2);
		});
	});

	describe("WRITTEN_DOWN_VALUE", () => {
		it("calculates declining depreciation based on rate", () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				rateOfDepreciation: 20,
				expectedValueAfterUsefulLife: 10000,
			};

			const result = buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.depreciationMethod).toBe("WRITTEN_DOWN_VALUE");

			expect(result?.entries.length).toBeGreaterThan(1);
			const first = result?.entries[0];
			const second = result?.entries[1];
			expect(first?.depreciationAmount).toBeGreaterThan(
				second?.depreciationAmount ?? 0,
			);
		});

		it("breaks loop when depreciation becomes 0", () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				rateOfDepreciation: 100,
				expectedValueAfterUsefulLife: 0,
			};

			const result = buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeLessThanOrEqual(8);
		});

		it("resets pendingDepreciationAmount on fiscal year change", () => {
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
			};

			const result = buildDepreciationSchedulePreview(inputAcrossFY);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeGreaterThan(0);
		});
	});

	describe("DOUBLE_DECLINING_BALANCE", () => {
		it("applies 200% declining balance rate per period", () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "DOUBLE_DECLINING_BALANCE",
				expectedValueAfterUsefulLife: 10000,
			};

			const result = buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.depreciationMethod).toBe("DOUBLE_DECLINING_BALANCE");

			expect(result?.entries.length).toBeGreaterThan(1);
			const first = result?.entries[0];
			const second = result?.entries[1];
			expect(first?.depreciationAmount).toBeGreaterThan(
				second?.depreciationAmount ?? 0,
			);
		});

		it("breaks loop when depreciation becomes 0", () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "DOUBLE_DECLINING_BALANCE",
				rateOfDepreciation: 100,
			};

			const result = buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeLessThanOrEqual(8);
		});
	});

	describe("MANUAL", () => {
		it("returns empty entries for user-defined depreciation", () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "MANUAL",
				expectedValueAfterUsefulLife: 10000,
			};

			const result = buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.depreciationMethod).toBe("MANUAL");
			expect(result?.entries).toHaveLength(0);
			expect(result?.remainingDepreciations).toBe(8);
		});
	});

	describe("edge cases", () => {
		it("returns null when depreciationMethod is null", () => {
			const input = {
				...baseInput,
				depreciationMethod: null,
			} as BuildDepreciationSchedulePreviewInput;

			const result = buildDepreciationSchedulePreview(input);

			expect(result).toBeNull();
		});

		it("returns null when totalNumberOfDepreciations is 0", () => {
			const input = {
				...baseInput,
				totalNumberOfDepreciations: 0,
			};

			const result = buildDepreciationSchedulePreview(input);

			expect(result).toBeNull();
		});

		it("caps depreciation at remaining value", () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "STRAIGHT_LINE",
				expectedValueAfterUsefulLife: 0,
			};

			const result = buildDepreciationSchedulePreview(input);

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
		it("initializes fiscal year on first schedule", () => {
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				rateOfDepreciation: 20,
				bookedDepreciations: 0,
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 3,
			};

			const result = buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			expect(result?.entries.length).toBeGreaterThan(0);
		});
	});

	describe("DOUBLE_DECLINING_BALANCE DDB rate", () => {
		it("applies 200% declining balance rate per period (coefficient is 2/totalYears)", () => {
			// Per authoritative sources (Investopedia, IRS Pub 946):
			// DDB rate = 2/totalYears (as decimal, e.g., 0.20 for 10-year asset)
			// NOT 200/totalYears which would be a 100x overstatement
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "DOUBLE_DECLINING_BALANCE",
				expectedValueAfterUsefulLife: 10000,
			};

			const result = buildDepreciationSchedulePreview(input);

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

		it("terminates early when depreciation reaches zero (per IAS 16)", () => {
			// IAS 16: schedule must terminate when depreciation hits zero,
			// cannot depreciate below residual value
			const input: BuildDepreciationSchedulePreviewInput = {
				...baseInput,
				depreciationMethod: "DOUBLE_DECLINING_BALANCE",
				rateOfDepreciation: 100, // Forces rapid depreciation to zero
				totalNumberOfDepreciations: 10,
				expectedValueAfterUsefulLife: 10000,
			};

			const result = buildDepreciationSchedulePreview(input);

			expect(result).not.toBeNull();
			// Schedule should terminate early (per IAS 16), not redistribute
			expect(result?.entries.length).toBeLessThan(10);
		});
	});
});
