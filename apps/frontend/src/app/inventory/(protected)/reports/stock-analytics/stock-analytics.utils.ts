import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Re-exported types for local use in the page
// ---------------------------------------------------------------------------

export type StockAnalyticsRow = Inventory.StockAnalyticsRow;
export type StockAnalyticsPeriod = Inventory.StockAnalyticsPeriod;
export type StockAnalyticsRangeFrequency =
	Inventory.StockAnalyticsRangeFrequency;
export type StockAnalyticsValueQuantity = Inventory.StockAnalyticsValueQuantity;

// ---------------------------------------------------------------------------
// Default date helpers
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

export function formatPeriodValue(
	value: number | null | undefined,
	valueQuantity: StockAnalyticsValueQuantity,
): string {
	if (value == null) return "—";
	if (valueQuantity === "Value") {
		return `₹ ${COMPACT_NUMBER.format(value)}`;
	}
	return COMPACT_NUMBER.format(value);
}

export function formatOptionalText(value: string | null | undefined): string {
	return value?.trim() || "—";
}

// ---------------------------------------------------------------------------
// Chart data builder
// ---------------------------------------------------------------------------

export interface StockAnalyticsChartDataset {
	name: string;
	values: (number | null)[];
}

export interface StockAnalyticsChartData {
	labels: string[];
	datasets: StockAnalyticsChartDataset[];
}

/**
 * Build recharts-compatible line chart data from selected rows and periods.
 *
 * Each entry in the returned array is a period object with label + one key
 * per selected item.
 */
export function buildChartData(
	selectedItemCodes: ReadonlySet<string>,
	rows: StockAnalyticsRow[],
	periods: StockAnalyticsPeriod[],
): Array<Record<string, string | number | null>> {
	const selectedRows = rows.filter((r) => selectedItemCodes.has(r.itemCode));

	return periods.map((period) => {
		const point: Record<string, string | number | null> = {
			label: period.label,
		};
		for (const row of selectedRows) {
			point[row.itemCode] = row.periodValues[period.key] ?? null;
		}
		return point;
	});
}

/**
 * Generate a deterministic CSS color for a series index using the Aria chart
 * palette CSS variables.
 */
export function getSeriesColor(index: number): string {
	const paletteSize = 5;
	const slot = (index % paletteSize) + 1;
	return `hsl(var(--chart-${slot}))`;
}

// ---------------------------------------------------------------------------
// Frequency options
// ---------------------------------------------------------------------------

export const FREQUENCY_OPTIONS: Array<{
	value: StockAnalyticsRangeFrequency;
	label: string;
}> = [
	{ value: "Weekly", label: "Weekly" },
	{ value: "Monthly", label: "Monthly" },
	{ value: "Quarterly", label: "Quarterly" },
	{ value: "Yearly", label: "Yearly" },
];

export const VALUE_QUANTITY_OPTIONS: Array<{
	value: StockAnalyticsValueQuantity;
	label: string;
}> = [
	{ value: "Quantity", label: "Quantity" },
	{ value: "Value", label: "Value" },
];
