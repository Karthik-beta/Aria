import { Inventory } from "@aria/types";
import * as z from "zod";

export const serialNoFormSchema = z.object({
	serialNo: z.string().min(1, "Serial number is required").max(120).trim(),
	itemId: z.string().min(1, "Item is required"),
	company: z.string().min(1, "Company is required").max(255).trim(),
	status: Inventory.serialNoStatusSchema.default("DRAFT"),
	currentWarehouseId: z.string().optional().default(""),
	purchaseReceiptId: z.string().optional().default(""),
	deliveryNoteId: z.string().optional().default(""),
	stockEntryId: z.string().optional().default(""),
	pickListId: z.string().optional().default(""),
	workOrder: z.string().max(255).optional().default(""),
	purchaseDate: z.string().optional().default(""),
	warrantyExpiryDate: z.string().optional().default(""),
	serviceContractExpiryDate: z.string().optional().default(""),
	maintenanceStatus: z.string().max(255).optional().default(""),
	notes: z.string().max(65_535).optional().default(""),
	isDisabled: z.boolean().default(false),
});

export type SerialNoFormValues = z.input<typeof serialNoFormSchema>;

export function getSerialNoFormDefaults(): SerialNoFormValues {
	return {
		serialNo: "",
		itemId: "",
		company: "",
		status: "DRAFT",
		currentWarehouseId: "",
		purchaseReceiptId: "",
		deliveryNoteId: "",
		stockEntryId: "",
		pickListId: "",
		workOrder: "",
		purchaseDate: "",
		warrantyExpiryDate: "",
		serviceContractExpiryDate: "",
		maintenanceStatus: "",
		notes: "",
		isDisabled: false,
	};
}
