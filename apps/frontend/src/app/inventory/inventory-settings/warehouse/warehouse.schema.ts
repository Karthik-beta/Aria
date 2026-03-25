import { z } from "zod";

const trimmedOptionalString = (maxLength: number) =>
	z.string().max(maxLength).default("");

export const warehouseFormSchema = z.object({
	name: z.string().min(1, "Warehouse name is required").max(255).trim(),
	disabled: z.boolean().default(false),
	isGroupWarehouse: z.boolean().default(false),
	parentWarehouseId: z.string().default(""),
	company: z.string().min(1, "Company is required").max(255).trim(),
	isRejectedWarehouse: z.boolean().default(false),
	phoneNo: trimmedOptionalString(50),
	mobileNo: trimmedOptionalString(50),
	addressLine1: trimmedOptionalString(255),
	addressLine2: trimmedOptionalString(255),
	city: trimmedOptionalString(255),
	state: trimmedOptionalString(255),
	pin: trimmedOptionalString(20),
	warehouseType: trimmedOptionalString(100),
	defaultInTransitWarehouseId: z.string().default(""),
});

export type WarehouseFormValues = z.input<typeof warehouseFormSchema>;

export const getWarehouseFormDefaults = (): WarehouseFormValues => ({
	name: "",
	disabled: false,
	isGroupWarehouse: false,
	parentWarehouseId: "",
	company: "",
	isRejectedWarehouse: false,
	phoneNo: "",
	mobileNo: "",
	addressLine1: "",
	addressLine2: "",
	city: "",
	state: "",
	pin: "",
	warehouseType: "",
	defaultInTransitWarehouseId: "",
});
