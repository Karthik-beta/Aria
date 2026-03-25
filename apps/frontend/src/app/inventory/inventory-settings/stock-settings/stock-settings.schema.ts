import { Inventory } from "@aria/types";
import { z } from "zod";

export const stockSettingsFormSchema =
	Inventory.updateStockSettingsSchema.extend({
		defaultWarehouse: z.string().max(255).default(""),
		defaultStockUom: z.string().max(50).default(""),
	});

export type StockSettingsFormValues = z.input<typeof stockSettingsFormSchema>;
