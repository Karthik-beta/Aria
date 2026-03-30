import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Re-export types for use in the page component
// ---------------------------------------------------------------------------

export type ItemVariantDetailsRow = Inventory.ItemVariantDetailsRow;
export type ItemVariantDetailsResult = Inventory.ItemVariantDetailsResult;

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/**
 * Formats a currency rate value.
 * Returns "—" for null/undefined values and for zero (no rate set).
 */
export function formatRate(value: number | null | undefined): string {
	if (value == null || value === 0) return "—";
	return `₹\u00A0${CURRENCY_FORMATTER.format(value)}`;
}

const QTY_FORMATTER = new Intl.NumberFormat("en-IN", {
	minimumFractionDigits: 0,
	maximumFractionDigits: 3,
});

/**
 * Formats a quantity value.
 */
export function formatQty(value: number): string {
	return QTY_FORMATTER.format(value);
}

/**
 * Returns the text value or "—" for empty/null values.
 */
export function formatOptional(value: string | null | undefined): string {
	return value?.trim() || "—";
}
