import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Re-exported type for use in the page component
// ---------------------------------------------------------------------------

export type BatchWiseBalanceRow = Inventory.BatchWiseBalanceRow;

// ---------------------------------------------------------------------------
// Default date helpers (current fiscal year Jan–Dec)
// ---------------------------------------------------------------------------

export function getDefaultFromDate(): string {
	const d = new Date();
	d.setUTCMonth(0, 1);
	return d.toISOString().slice(0, 10);
}

export function getDefaultToDate(): string {
	return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const QTY_FORMATTER = new Intl.NumberFormat("en-IN", {
	minimumFractionDigits: 0,
	maximumFractionDigits: 3,
});

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/**
 * Formats a quantity value; returns "—" for null/undefined.
 */
export function formatQty(value: number | null | undefined): string {
	if (value == null) return "—";
	return QTY_FORMATTER.format(value);
}

/**
 * Formats a currency amount; returns "—" for null/undefined.
 */
export function formatCurrency(value: number | null | undefined): string {
	if (value == null) return "—";
	return `₹\u00A0${CURRENCY_FORMATTER.format(value)}`;
}

/**
 * Formats a rate value; returns "—" for zero or null/undefined.
 */
export function formatRate(value: number | null | undefined): string {
	if (value == null || value === 0) return "—";
	return `₹\u00A0${CURRENCY_FORMATTER.format(value)}`;
}

/**
 * Formats a Date object as a locale date string; returns "—" for null.
 */
export function formatDate(value: Date | string | null | undefined): string {
	if (value == null) return "—";
	const d = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

/**
 * Returns the optional text value or "—" for empty/null values.
 */
export function formatOptional(value: string | null | undefined): string {
	return value?.trim() || "—";
}
