import type { Asset } from "@aria/types";
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
 * Converts form values to the mutation payload expected by the API.
 * Empty string parentLocationId is normalized to null.
 */
export function toLocationMutationInput(
	values: LocationFormValues,
): Omit<Asset.CreateLocationInput, never> {
	return {
		name: values.name.trim(),
		parentLocationId: (values.parentLocationId ?? "").trim() || null,
		isGroup: values.isGroup,
	};
}

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
