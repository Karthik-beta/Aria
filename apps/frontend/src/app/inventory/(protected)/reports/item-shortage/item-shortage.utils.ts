import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Re-export row type for use in page component
// ---------------------------------------------------------------------------

export type ItemShortageRow = Inventory.ItemShortageRow;

// ---------------------------------------------------------------------------
// Quantity formatting
// ---------------------------------------------------------------------------

/**
 * Formats a floating-point quantity with up to 3 decimal places, removing
 * trailing zeros, e.g. 12.500 → "12.5", 10.000 → "10".
 */
export function formatQty(value: number): string {
	const rounded = parseFloat(value.toFixed(3));
	return rounded.toLocaleString(undefined, {
		minimumFractionDigits: 0,
		maximumFractionDigits: 3,
	});
}

// ---------------------------------------------------------------------------
// Chart helpers
// ---------------------------------------------------------------------------

export interface ShortageChartEntry {
	/** Item code, used as the bar label. */
	label: string;
	/** Projected quantity (negative value). */
	projectedQty: number;
	/** Absolute shortfall, used as the bar value so bars are positive. */
	shortfall: number;
}

/**
 * Builds bar chart entries from shortage rows, limited to the top-N most
 * critical items (i.e. those with the most negative projected_qty).
 *
 * The chart shows `shortfall` (absolute value) so bars point upward, while
 * tooltip/label can display the actual negative number.
 *
 * @param rows - Already sorted ascending by projectedQty (most negative first).
 * @param limit - Maximum number of bars to show (default 10, matching ERPNext).
 */
export function buildBarChartData(
	rows: ItemShortageRow[],
	limit = 10,
): ShortageChartEntry[] {
	return rows.slice(0, limit).map((row) => ({
		label: row.itemCode,
		projectedQty: row.projectedQty,
		shortfall: Math.abs(row.projectedQty),
	}));
}
