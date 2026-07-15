import { Asset } from "@aria/types";
import * as z from "zod";

export const assetCategoryFormSchema = z
	.object({
		name: z.string().min(1, "Category name is required").max(255).trim(),
		nonDepreciableCategory: z.boolean().default(false),
		enableCwipAccounting: z.boolean().default(false),
		depreciationMethod: z.string().default(""),
		totalNumberOfDepreciations: z.number().int().min(1).nullable().optional(),
		frequencyOfDepreciation: z.number().int().min(1).nullable().optional(),
		dailyProrataBased: z.boolean().nullable().optional(),
		shiftBased: z.boolean().nullable().optional(),
		rateOfDepreciation: z.number().min(0).nullable().optional(),
		expectedValueAfterUsefulLife: z.number().min(0).nullable().optional(),
		financeBooks: z
			.array(
				z.object({
					financeBookId: z.string().min(1),
					depreciationMethod: Asset.depreciationMethodSchema,
					totalNumberOfDepreciations: z.number().int().min(1),
					frequencyOfDepreciation: z.number().int().min(1),
					dailyProrataBased: z.boolean().default(false),
					shiftBased: z.boolean().default(false),
					rateOfDepreciation: z.number().min(0).nullable().optional(),
					expectedValueAfterUsefulLife: z.number().min(0).nullable().optional(),
				}),
			)
			.default([]),
		accounts: z
			.array(
				z.object({
					companyId: z.string().min(1),
					fixedAssetAccount: z.string().min(1),
					accumulatedDepreciationAccount: z.string().nullable().optional(),
					depreciationExpenseAccount: z.string().nullable().optional(),
					capitalWorkInProgressAccount: z.string().nullable().optional(),
				}),
			)
			.default([]),
	})
	.superRefine((data, ctx) => {
		if (!data.nonDepreciableCategory) {
			if (!data.depreciationMethod) {
				ctx.addIssue({
					path: ["depreciationMethod"],
					code: z.ZodIssueCode.custom,
					message: "Depreciation method is required",
				});
			}
			if (
				data.totalNumberOfDepreciations === null ||
				data.totalNumberOfDepreciations === undefined ||
				data.totalNumberOfDepreciations < 1
			) {
				ctx.addIssue({
					path: ["totalNumberOfDepreciations"],
					code: z.ZodIssueCode.custom,
					message: "Total number of depreciations must be at least 1",
				});
			}
			if (
				data.frequencyOfDepreciation === null ||
				data.frequencyOfDepreciation === undefined ||
				data.frequencyOfDepreciation < 1
			) {
				ctx.addIssue({
					path: ["frequencyOfDepreciation"],
					code: z.ZodIssueCode.custom,
					message: "Frequency of depreciation (months) must be at least 1",
				});
			}
		}
	});

export type AssetCategoryFormValues = z.input<typeof assetCategoryFormSchema>;

export const DEPRECIATION_METHOD_OPTIONS: {
	value: Asset.DepreciationMethod;
	label: string;
}[] = [
	{ value: "STRAIGHT_LINE", label: "Straight Line" },
	{ value: "DOUBLE_DECLINING_BALANCE", label: "Double Declining Balance" },
	{ value: "WRITTEN_DOWN_VALUE", label: "Written Down Value" },
	{ value: "MANUAL", label: "Manual" },
];

export const getAssetCategoryFormDefaults = (): AssetCategoryFormValues => ({
	name: "",
	nonDepreciableCategory: false,
	enableCwipAccounting: false,
	depreciationMethod: "",
	totalNumberOfDepreciations: null,
	frequencyOfDepreciation: null,
	dailyProrataBased: null,
	shiftBased: null,
	rateOfDepreciation: null,
	expectedValueAfterUsefulLife: null,
	financeBooks: [],
	accounts: [],
});
