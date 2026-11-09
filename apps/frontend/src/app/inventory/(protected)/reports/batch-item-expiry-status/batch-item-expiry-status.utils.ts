import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Re-exported type for use in the page component
// ---------------------------------------------------------------------------

export type BatchItemExpiryRow = Inventory.BatchItemExpiryRow;

// ---------------------------------------------------------------------------
// Default date helpers — default range is the current calendar year to today
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

/**
 * Formats a quantity value; returns "—" for null/undefined.
 */
export function formatQty(value: number | null | undefined): string {
	if (value == null) return "—";
	return QTY_FORMATTER.format(value);
}

/**
 * Formats a Date object or ISO-8601 string as a locale date string.
 * Returns "—" for null/undefined.
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

// ---------------------------------------------------------------------------
// Expiry-status label helpers
// ---------------------------------------------------------------------------

export type ExpiryStatus = "expired" | "critical" | "warning" | "ok" | "none";

/**
 * Classifies a batch's expiry status for visual cues.
 *
 * - `none`     — no expiry date set
 * - `expired`  — expiryInDays === 0 (already expired)
 * - `critical` — 1–30 days remaining
 * - `warning`  — 31–90 days remaining
 * - `ok`       — more than 90 days remaining
 */
export function getExpiryStatus(expiryInDays: number | null): ExpiryStatus {
	if (expiryInDays === null) return "none";
	if (expiryInDays === 0) return "expired";
	if (expiryInDays <= 30) return "critical";
	if (expiryInDays <= 90) return "warning";
	return "ok";
}
