import { describe, expect, it } from "vitest";
import {
	buildAssetCategoryListInput,
	getDepreciationMethodLabel,
	getRelativeAge,
	toAssetCategoryMutationInput,
} from "./asset-category.utils";

describe("asset-category.utils", () => {
	describe("getDepreciationMethodLabel", () => {
		it("returns 'Straight Line' for STRAIGHT_LINE", () => {
			expect(getDepreciationMethodLabel("STRAIGHT_LINE")).toBe("Straight Line");
		});

		it("returns 'Double Declining Balance' for DOUBLE_DECLINING_BALANCE", () => {
			expect(getDepreciationMethodLabel("DOUBLE_DECLINING_BALANCE")).toBe(
				"Double Declining Balance",
			);
		});

		it("returns 'Written Down Value' for WRITTEN_DOWN_VALUE", () => {
			expect(getDepreciationMethodLabel("WRITTEN_DOWN_VALUE")).toBe(
				"Written Down Value",
			);
		});

		it("returns 'Manual' for MANUAL", () => {
			expect(getDepreciationMethodLabel("MANUAL")).toBe("Manual");
		});

		it("returns '-' for null", () => {
			expect(getDepreciationMethodLabel(null)).toBe("-");
		});

		it("returns '-' for undefined", () => {
			expect(getDepreciationMethodLabel(undefined)).toBe("-");
		});
	});

	describe("getRelativeAge", () => {
		it("returns 'Today' for dates within the last 24 hours", () => {
			const now = new Date();
			expect(getRelativeAge(now)).toBe("Today");
		});

		it("returns days for dates 1-29 days ago", () => {
			const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(date)).toBe("5 d");
		});

		it("returns months for dates 1-11 months ago", () => {
			const date = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(date)).toBe("1 m");
		});

		it("returns years for dates 1+ year ago", () => {
			const date = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
			expect(getRelativeAge(date)).toBe("1 y");
		});
	});

	describe("toAssetCategoryMutationInput", () => {
		it("maps form values to mutation payload for a depreciable category", () => {
			expect(
				toAssetCategoryMutationInput({
					name: "  Vehicles  ",
					nonDepreciableCategory: false,
					enableCwipAccounting: true,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 60,
					frequencyOfDepreciation: 12,
				}),
			).toEqual({
				name: "Vehicles",
				nonDepreciableCategory: false,
				enableCwipAccounting: true,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 60,
				frequencyOfDepreciation: 12,
				dailyProrataBased: false,
				shiftBased: false,
				rateOfDepreciation: null,
				expectedValueAfterUsefulLife: null,
				financeBooks: [],
				accounts: [],
			});
		});

		it("nulls out depreciation fields for non-depreciable category", () => {
			const result = toAssetCategoryMutationInput({
				name: "Land",
				nonDepreciableCategory: true,
				enableCwipAccounting: false,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 10,
				frequencyOfDepreciation: 12,
			});
			expect(result.depreciationMethod).toBeNull();
			expect(result.totalNumberOfDepreciations).toBeNull();
			expect(result.frequencyOfDepreciation).toBeNull();
			expect(result.nonDepreciableCategory).toBe(true);
		});

		it("normalizes empty depreciationMethod to null", () => {
			const result = toAssetCategoryMutationInput({
				name: "Equipment",
				nonDepreciableCategory: false,
				enableCwipAccounting: false,
				depreciationMethod: "",
				totalNumberOfDepreciations: 12,
				frequencyOfDepreciation: 1,
			});
			expect(result.depreciationMethod).toBeNull();
		});

		it("trims whitespace from name", () => {
			const result = toAssetCategoryMutationInput({
				name: "  Office Equipment  ",
				nonDepreciableCategory: false,
				enableCwipAccounting: false,
				depreciationMethod: "MANUAL",
				totalNumberOfDepreciations: 5,
				frequencyOfDepreciation: 3,
			});
			expect(result.name).toBe("Office Equipment");
		});

		it("preserves enableCwipAccounting for non-depreciable category", () => {
			const result = toAssetCategoryMutationInput({
				name: "Land",
				nonDepreciableCategory: true,
				enableCwipAccounting: true,
				depreciationMethod: "",
				totalNumberOfDepreciations: null,
				frequencyOfDepreciation: null,
			});
			expect(result.enableCwipAccounting).toBe(true);
		});
	});

	describe("buildAssetCategoryListInput", () => {
		it("builds list input with search filter", () => {
			expect(
				buildAssetCategoryListInput({
					search: "  Vehicles  ",
					pageIndex: 0,
					pageSize: 20,
				}),
			).toEqual({
				skip: 0,
				take: 20,
				search: "Vehicles",
			});
		});

		it("omits search when empty", () => {
			const result = buildAssetCategoryListInput({
				search: "   ",
				pageIndex: 0,
				pageSize: 20,
			});
			expect(result.search).toBeUndefined();
		});

		it("calculates correct skip based on page index and size", () => {
			expect(
				buildAssetCategoryListInput({
					search: "",
					pageIndex: 3,
					pageSize: 20,
				}),
			).toMatchObject({ skip: 60, take: 20 });
		});

		it("handles first page correctly", () => {
			const result = buildAssetCategoryListInput({
				search: "",
				pageIndex: 0,
				pageSize: 20,
			});
			expect(result.skip).toBe(0);
			expect(result.take).toBe(20);
		});

		it("handles different page sizes", () => {
			expect(
				buildAssetCategoryListInput({
					search: "",
					pageIndex: 2,
					pageSize: 50,
				}),
			).toMatchObject({ skip: 100, take: 50 });
		});
	});
});
