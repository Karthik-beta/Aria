import * as z from "zod";
import { parseGeolocationText } from "./location.utils";

export const locationFormSchema = z
	.object({
		name: z.string().min(1, "Location name is required").max(255).trim(),
		parentLocationId: z.string().default(""),
		isGroup: z.boolean().default(false),
		isContainer: z.boolean().default(false),
		// Numeric text inputs: blank means "not set".
		latitude: z
			.string()
			.default("")
			.refine(
				(value) => isCoordinateInRange(value, 90),
				"Latitude must be a number between -90 and 90",
			),
		longitude: z
			.string()
			.default("")
			.refine(
				(value) => isCoordinateInRange(value, 180),
				"Longitude must be a number between -180 and 180",
			),
		areaUom: z
			.string()
			.max(50, "Area UOM must be 50 characters or fewer")
			.default(""),
		// GeoJSON FeatureCollection pasted as text; validated server-side as well.
		geolocation: z.string().default(""),
	})
	.superRefine((values, ctx) => {
		const parsed = parseGeolocationText(values.geolocation);
		if ("error" in parsed) {
			ctx.addIssue({
				code: "custom",
				path: ["geolocation"],
				message: parsed.error,
			});
		}
	});

export type LocationFormValues = z.input<typeof locationFormSchema>;

export const getLocationFormDefaults = (): LocationFormValues => ({
	name: "",
	parentLocationId: "",
	isGroup: false,
	isContainer: false,
	latitude: "",
	longitude: "",
	areaUom: "",
	geolocation: "",
});

function isCoordinateInRange(value: string, limit: number): boolean {
	const trimmed = value.trim();
	if (!trimmed) return true;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) && Math.abs(parsed) <= limit;
}
