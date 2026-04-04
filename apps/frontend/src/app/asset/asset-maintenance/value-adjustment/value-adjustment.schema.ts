import * as z from "zod";

export const assetValueAdjustmentFormSchema = z.object({
	assetId: z.string().min(1, "Asset is required"),
	adjustmentDate: z.string().min(1, "Adjustment date is required"),
	newAssetValue: z
		.string()
		.min(1, "New asset value is required")
		.refine((value) => !Number.isNaN(Number(value)), {
			message: "New asset value is required",
		})
		.refine((value) => Number(value) >= 0, {
			message: "New asset value must be zero or greater",
		}),
	differenceAccount: z
		.string()
		.min(1, "Difference account is required")
		.max(255)
		.trim(),
	costCenter: z.string().max(255).trim().optional(),
	notes: z.string().max(5000).trim().optional(),
});

export type AssetValueAdjustmentFormValues = z.infer<
	typeof assetValueAdjustmentFormSchema
>;

export const getAssetValueAdjustmentFormDefaults = (
	assetId?: string | null,
): AssetValueAdjustmentFormValues => ({
	assetId: assetId ?? "",
	adjustmentDate: new Date().toISOString().split("T")[0] ?? "",
	newAssetValue: "",
	differenceAccount: "",
	costCenter: "",
	notes: "",
});
