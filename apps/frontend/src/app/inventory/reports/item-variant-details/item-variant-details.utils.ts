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
