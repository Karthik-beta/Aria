import { Asset } from "@aria/types";
import type { LocationFormValues } from "./location.schema";

export const LOCATION_PAGE_SIZE = 20;

/**
 * Returns a human-readable relative age string for a date.
 * e.g. "3 d", "2 m", "1 y", "Today"
 */
export function getRelativeAge(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}

/**
 * Returns the display label for a location's group status.
 */
export function getLocationGroupLabel(isGroup: boolean): string {
	return isGroup ? "Group" : "Leaf";
}

/**
 * Parses the GeoJSON textarea. Blank text means "no geolocation"; anything
 * else must be a FeatureCollection (same rule as the API).
 */
export function parseGeolocationText(
	text: string | undefined,
): { value: Asset.GeoJsonFeatureCollection | null } | { error: string } {
	const trimmed = (text ?? "").trim();
	if (!trimmed) return { value: null };

	let json: unknown;
	try {
		json = JSON.parse(trimmed);
	} catch {
		return { error: "Geolocation must be valid JSON" };
	}

	const parsed = Asset.geoJsonFeatureCollectionSchema.safeParse(json);
	if (!parsed.success) {
		const detail = parsed.error.issues[0]?.message;
		return {
			error: `Geolocation must be a GeoJSON FeatureCollection${detail ? ` (${detail})` : ""}`,
		};
	}
	return { value: parsed.data };
}

function parseCoordinate(text: string | undefined): number | null {
	const trimmed = (text ?? "").trim();
	if (!trimmed) return null;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converts form values to the mutation payload expected by the API.
 * Empty string parentLocationId is normalized to null. The container, geo
 * and UOM fields are only included when the form supplied them. `area` is
 * never sent: the server computes it from the geolocation.
 */
export function toLocationMutationInput(
	values: LocationFormValues,
): Omit<Asset.CreateLocationInput, never> {
	const input: Asset.CreateLocationInput = {
		name: values.name.trim(),
		parentLocationId: (values.parentLocationId ?? "").trim() || null,
		isGroup: values.isGroup,
	};
	if (values.isContainer !== undefined) input.isContainer = values.isContainer;
	if (values.latitude !== undefined) {
		input.latitude = parseCoordinate(values.latitude);
	}
	if (values.longitude !== undefined) {
		input.longitude = parseCoordinate(values.longitude);
	}
	if (values.areaUom !== undefined) {
		input.areaUom = values.areaUom.trim() || null;
	}
	if (values.geolocation !== undefined) {
		const parsed = parseGeolocationText(values.geolocation);
		input.geolocation = "value" in parsed ? parsed.value : null;
	}
	return input;
}

/**
 * Formats a computed area (square metres) for display; "-" when not set.
 */
export function formatArea(area: number | null | undefined): string {
	if (!area) return "-";
	return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(area)} m²`;
}

/**
 * Pretty-prints a stored GeoJSON FeatureCollection for the form textarea.
 */
export function formatGeolocationText(
	geolocation: Asset.GeoJsonFeatureCollection | null | undefined,
): string {
	return geolocation ? JSON.stringify(geolocation, null, 2) : "";
}

export type LocationView = "table" | "tree";

export const LOCATION_VIEW_STORAGE_KEY = "asset-location-view";

/**
 * Builds the list query input from the current filter/pagination state.
 */
export function buildLocationListInput(params: {
	search: string;
	group: "all" | "group" | "leaf";
	pageIndex: number;
	pageSize: number;
}): NonNullable<Asset.ListLocationsInput> {
	return {
		skip: params.pageIndex * params.pageSize,
		take: params.pageSize,
		search: params.search.trim() || undefined,
		isGroup: params.group === "all" ? undefined : params.group === "group",
	};
}
