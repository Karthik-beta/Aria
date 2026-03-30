import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Re-export row type for use in page component
// ---------------------------------------------------------------------------

export type ItemwiseRecommendedReorderLevelRow =
	Inventory.ItemwiseRecommendedReorderLevelRow;

// ---------------------------------------------------------------------------
// Default date helpers
// ---------------------------------------------------------------------------

/** Start of the current fiscal year (1 Jan by default). */
export function getDefaultFromDate(): string {
	const d = new Date();
	d.setMonth(0, 1);
	return d.toISOString().slice(0, 10);
}

/** Today. */
export function getDefaultToDate(): string {
	return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Quantity / number formatting
// ---------------------------------------------------------------------------

const COMPACT_NUMBER = new Intl.NumberFormat("en-IN", {
	maximumFractionDigits: 3,
	minimumFractionDigits: 0,
});

/**
 * Formats a floating-point quantity with up to 3 decimal places, removing
 * trailing zeros, e.g. 12.500 → "12.5", 10.000 → "10".
 */
export function formatQty(value: number): string {
	return COMPACT_NUMBER.format(value);
}

export function formatOptionalText(value: string | null | undefined): string {
	return value?.trim() || "—";
}

// ---------------------------------------------------------------------------
// Filter validation
// ---------------------------------------------------------------------------

export interface ReorderLevelFilterState {
	fromDate: string;
	toDate: string;
	itemGroup: string;
	brand: string;
}

export const INITIAL_FILTERS: ReorderLevelFilterState = {
	fromDate: getDefaultFromDate(),
	toDate: getDefaultToDate(),
	itemGroup: "",
	brand: "",
};

export function validateFilters(
	filters: ReorderLevelFilterState,
): string | null {
	if (!filters.fromDate) return "From Date is required.";
	if (!filters.toDate) return "To Date is required.";
	if (filters.fromDate > filters.toDate) {
		return "From Date must not be later than To Date.";
	}
	return null;
}
