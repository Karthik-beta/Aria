import { Inventory } from "@aria/types";
import * as z from "zod";

export const batchFormSchema = z.object({
	batchId: z.string().min(1, "Batch ID is required").max(120).trim(),
	itemId: z.string().min(1, "Item is required"),
	company: z.string().min(1, "Company is required").max(255).trim(),
	currentWarehouseId: z.string().optional().default(""),
	purchaseReceiptId: z.string().optional().default(""),
	deliveryNoteId: z.string().optional().default(""),
	stockEntryId: z.string().optional().default(""),
	useBatchWiseValuation: z.boolean().default(false),
	manufacturingDate: z.string().optional().default(""),
	expiryDate: z.string().optional().default(""),
	description: z.string().max(65_535).optional().default(""),
	quantity: z.number().min(0, "Quantity cannot be negative").default(0),
	isDisabled: z.boolean().default(false),
});

export type BatchFormValues = z.input<typeof batchFormSchema>;

export function getBatchFormDefaults(): BatchFormValues {
	return {
		batchId: "",
		itemId: "",
		company: "",
		currentWarehouseId: "",
		purchaseReceiptId: "",
		deliveryNoteId: "",
		stockEntryId: "",
		useBatchWiseValuation: false,
		manufacturingDate: "",
		expiryDate: "",
		description: "",
		quantity: 0,
		isDisabled: false,
	};
}

export const batchStatusOptions = Inventory.batchStatusSchema.options;
