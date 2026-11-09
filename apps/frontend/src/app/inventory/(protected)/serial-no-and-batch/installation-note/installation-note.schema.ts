import { Inventory } from "@aria/types";
import * as z from "zod";

export const installationNoteItemFormSchema = z.object({
	id: z.string().optional(),
	itemId: z.string().min(1, "Item is required"),
	serialNoId: z.string().optional().default(""),
	description: z.string().max(65_535).optional().default(""),
	installedQty: z
		.number()
		.positive("Installed quantity must be greater than zero"),
});

export const installationNoteFormSchema = z.object({
	seriesPattern: z.string().max(50).optional().default("MAT-INS-.YYYY.-"),
	installationDate: z.string().min(1, "Installation date is required"),
	installationTime: z.string().max(8).optional().default(""),
	customer: z.string().min(1, "Customer is required").max(255).trim(),
	customerName: z.string().max(255).optional().default(""),
	customerAddress: z.string().max(255).optional().default(""),
	contactPerson: z.string().max(255).optional().default(""),
	territory: z.string().min(1, "Territory is required").max(255).trim(),
	customerGroup: z.string().max(255).optional().default(""),
	company: z.string().min(1, "Company is required").max(255).trim(),
	status: Inventory.installationNoteStatusSchema.default("DRAFT"),
	deliveryNoteId: z.string().optional().default(""),
	remarks: z.string().max(65_535).optional().default(""),
	items: z
		.array(installationNoteItemFormSchema)
		.min(1, "At least one installation item is required"),
});

export type InstallationNoteFormValues = z.input<
	typeof installationNoteFormSchema
>;

export function getInstallationNoteFormDefaults(): InstallationNoteFormValues {
	return {
		seriesPattern: "MAT-INS-.YYYY.-",
		installationDate: new Date().toISOString().slice(0, 10),
		installationTime: "",
		customer: "",
		customerName: "",
		customerAddress: "",
		contactPerson: "",
		territory: "All Territories",
		customerGroup: "",
		company: "",
		status: "DRAFT",
		deliveryNoteId: "",
		remarks: "",
		items: [
			{
				itemId: "",
				serialNoId: "",
				description: "",
				installedQty: 1,
			},
		],
	};
}
