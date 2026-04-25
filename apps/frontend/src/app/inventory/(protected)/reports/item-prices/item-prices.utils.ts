import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Re-exported type for use in the page component
// ---------------------------------------------------------------------------

export type ItemPricesRow = Inventory.ItemPricesRow;

export type ItemPricesItemsFilter = Inventory.ItemPricesItemsFilter;

// ---------------------------------------------------------------------------
// Filter options (mirrors ERPNext "Items Filter" select)
// ---------------------------------------------------------------------------

export const ITEMS_FILTER_OPTIONS: {
	label: string;
	value: ItemPricesItemsFilter;
}[] = [
	{ label: "Enabled Items only", value: "enabled" },
	{ label: "Disabled Items only", value: "disabled" },
	{ label: "All Items", value: "all" },
];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/**
 * Formats a currency rate value.
 * Returns "—" for null/undefined values. Zero is displayed as a real value
 * (matching ERPNext behaviour where 0.00 is a valid rate).
 */
export function formatRate(value: number | null | undefined): string {
	if (value == null) return "—";
	return CURRENCY_FORMATTER.format(value);
}

/**
 * Returns the optional text value or "—" for empty/null values.
 */
export function formatOptional(value: string | null | undefined): string {
	return value?.trim() || "—";
}
