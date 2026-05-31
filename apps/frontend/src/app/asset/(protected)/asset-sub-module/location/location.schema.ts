import * as z from "zod";

export const locationFormSchema = z.object({
	name: z.string().min(1, "Location name is required").max(255).trim(),
	parentLocationId: z.string().default(""),
	isGroup: z.boolean().default(false),
});

export type LocationFormValues = z.input<typeof locationFormSchema>;

export const getLocationFormDefaults = (): LocationFormValues => ({
	name: "",
	parentLocationId: "",
	isGroup: false,
});
