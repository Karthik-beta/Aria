import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Re-exported types for local use in the page
// ---------------------------------------------------------------------------

export type DeliveryNoteTrendsPeriodFrequency =
	Inventory.DeliveryNoteTrendsPeriodFrequency;
export type DeliveryNoteTrendsBasedOn = Inventory.DeliveryNoteTrendsBasedOn;
export type DeliveryNoteTrendsPeriod = Inventory.DeliveryNoteTrendsPeriod;
export type DeliveryNoteTrendsRow = Inventory.DeliveryNoteTrendsRow;
export type DeliveryNoteTrendsResult = Inventory.DeliveryNoteTrendsResult;

// ---------------------------------------------------------------------------
// Default date helpers — default to the current calendar year
// ---------------------------------------------------------------------------

export function getDefaultFromDate(): string {
	const d = new Date();
	d.setUTCMonth(0, 1);
	return d.toISOString().slice(0, 10);
}

export function getDefaultToDate(): string {
	const d = new Date();
	d.setUTCMonth(11, 31);
	return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const COMPACT_NUMBER = new Intl.NumberFormat("en-IN", {
	maximumFractionDigits: 2,
	minimumFractionDigits: 0,
});

/** Format a qty value for display in the table cells. */
export function formatQty(value: number | null | undefined): string {
	if (value == null) return "—";
	return COMPACT_NUMBER.format(value);
}

/** Format an amount value for display in the table cells. */
export function formatAmount(value: number | null | undefined): string {
	if (value == null) return "—";
	return `₹ ${COMPACT_NUMBER.format(value)}`;
}

/** Format a period cell value by metric (qty or amount). */
export function formatPeriodCellValue(
	value: number,
	metric: "qty" | "amount",
): string {
	if (metric === "amount") return formatAmount(value);
	return formatQty(value);
}

/** Format a dimension key / label for display (returns "—" for empty strings). */
export function formatDimensionText(value: string | null | undefined): string {
	return value?.trim() || "—";
}

// ---------------------------------------------------------------------------
// Chart colors — deterministic from Aria CSS palette variables
// ---------------------------------------------------------------------------

export function getSeriesColor(index: number): string {
	const paletteSize = 5;
	const slot = (index % paletteSize) + 1;
	return `hsl(var(--chart-${slot}))`;
}

// ---------------------------------------------------------------------------
// Bar chart data builder
// ---------------------------------------------------------------------------

export interface TrendsChartEntry {
	label: string;
	amount: number;
}

/**
 * Build the top-10 bar chart data from the result rows, sorted by total
 * amount descending (mirrors ERPNext chart behavior).
 *
 * @param rows - All rows from the report result (already sorted server-side)
 * @param maxItems - Maximum number of bars to show (default 10)
 */
export function buildBarChartData(
	rows: DeliveryNoteTrendsRow[],
	maxItems = 10,
): TrendsChartEntry[] {
	return rows.slice(0, maxItems).map((row) => ({
		label: row.dimensionLabel
			? `${row.dimensionKey} — ${row.dimensionLabel}`
			: row.dimensionKey,
		amount: row.totalAmount,
	}));
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

export const PERIOD_OPTIONS: Array<{
	value: DeliveryNoteTrendsPeriodFrequency;
	label: string;
}> = [
	{ value: "Monthly", label: "Monthly" },
	{ value: "Quarterly", label: "Quarterly" },
	{ value: "Half-Yearly", label: "Half-Yearly" },
	{ value: "Yearly", label: "Yearly" },
];

export const BASED_ON_OPTIONS: Array<{
	value: DeliveryNoteTrendsBasedOn;
	label: string;
}> = [
	{ value: "Item", label: "Item" },
	{ value: "Item Group", label: "Item Group" },
	{ value: "Customer", label: "Customer" },
	{ value: "Project", label: "Project" },
];

// ---------------------------------------------------------------------------
// Metric toggle options
// ---------------------------------------------------------------------------

export type TrendsMetric = "qty" | "amount";

export const METRIC_OPTIONS: Array<{ value: TrendsMetric; label: string }> = [
	{ value: "qty", label: "Quantity" },
	{ value: "amount", label: "Amount" },
];
