import { describe, expect, it } from "vitest";
import { getLocationFormDefaults, locationFormSchema } from "./location.schema";
import {
	formatArea,
	formatGeolocationText,
	parseGeolocationText,
	toLocationMutationInput,
} from "./location.utils";

const emptyCollection = '{"type":"FeatureCollection","features":[]}';

describe("parseGeolocationText", () => {
	it("treats blank text as no geolocation", () => {
		expect(parseGeolocationText("")).toEqual({ value: null });
		expect(parseGeolocationText("   ")).toEqual({ value: null });
		expect(parseGeolocationText(undefined)).toEqual({ value: null });
	});

	it("accepts a FeatureCollection", () => {
		expect(parseGeolocationText(emptyCollection)).toEqual({
			value: { type: "FeatureCollection", features: [] },
		});
	});

	it("rejects text that is not JSON", () => {
		expect(parseGeolocationText("{nope")).toEqual({
			error: "Geolocation must be valid JSON",
		});
	});

	it("rejects JSON that is not a FeatureCollection", () => {
		const result = parseGeolocationText('{"type":"Feature"}');
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toMatch(
			/GeoJSON FeatureCollection/,
		);
	});
});

describe("toLocationMutationInput geo fields", () => {
	it("maps coordinates, uom, container flag and geolocation", () => {
		expect(
			toLocationMutationInput({
				...getLocationFormDefaults(),
				name: "Farm",
				isContainer: true,
				latitude: " 19.1 ",
				longitude: "-72.5",
				areaUom: " Square Meter ",
				geolocation: emptyCollection,
			}),
		).toEqual({
			name: "Farm",
			parentLocationId: null,
			isGroup: false,
			isContainer: true,
			latitude: 19.1,
			longitude: -72.5,
			areaUom: "Square Meter",
			geolocation: { type: "FeatureCollection", features: [] },
		});
	});

	it("sends null for blank geo fields so they can be cleared", () => {
		expect(toLocationMutationInput(getLocationFormDefaults())).toMatchObject({
			isContainer: false,
			latitude: null,
			longitude: null,
			areaUom: null,
			geolocation: null,
		});
	});

	it("never sends an area", () => {
		expect(
			toLocationMutationInput({ ...getLocationFormDefaults(), name: "X" }),
		).not.toHaveProperty("area");
	});
});

describe("locationFormSchema geo validation", () => {
	const parse = (values: Record<string, unknown>) =>
		locationFormSchema.safeParse({ name: "HQ", ...values });

	it("accepts blank and in-range coordinates", () => {
		expect(parse({}).success).toBe(true);
		expect(parse({ latitude: "-90", longitude: "180" }).success).toBe(true);
	});

	it.each([
		["latitude", "90.5"],
		["latitude", "-91"],
		["latitude", "abc"],
		["longitude", "180.1"],
		["longitude", "-181"],
	])("rejects %s %s", (field, value) => {
		expect(parse({ [field]: value }).success).toBe(false);
	});

	it("rejects malformed GeoJSON text and accepts a FeatureCollection", () => {
		expect(parse({ geolocation: "{nope" }).success).toBe(false);
		expect(parse({ geolocation: '{"type":"Feature"}' }).success).toBe(false);
		expect(parse({ geolocation: emptyCollection }).success).toBe(true);
	});
});

describe("formatArea / formatGeolocationText", () => {
	it("formats square metres and falls back to a dash", () => {
		expect(formatArea(12345.678)).toBe("12,345.68 m²");
		expect(formatArea(0)).toBe("-");
		expect(formatArea(undefined)).toBe("-");
	});

	it("pretty-prints stored geolocation", () => {
		expect(formatGeolocationText(null)).toBe("");
		expect(
			formatGeolocationText({ type: "FeatureCollection", features: [] }),
		).toBe(
			JSON.stringify({ type: "FeatureCollection", features: [] }, null, 2),
		);
	});
});
