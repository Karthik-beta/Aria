import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Re-exported types for local use in the page
// ---------------------------------------------------------------------------

export type SalesOrderAnalysisStatus = Inventory.SalesOrderAnalysisStatus;
export type SalesOrderAnalysisRow = Inventory.SalesOrderAnalysisRow;
export type SalesOrderAnalysisSummary = Inventory.SalesOrderAnalysisSummary;
export type SalesOrderAnalysisResult = Inventory.SalesOrderAnalysisResult;

// ---------------------------------------------------------------------------
// Status options
// ---------------------------------------------------------------------------

export const STATUS_OPTIONS: {
	value: SalesOrderAnalysisStatus;
	label: string;
}[] = [
	{ value: "TO_DELIVER_AND_BILL", label: "To Deliver and Bill" },
	{ value: "TO_DELIVER", label: "To Deliver" },
	{ value: "TO_BILL", label: "To Bill" },
	{ value: "COMPLETED", label: "Completed" },
	{ value: "CLOSED", label: "Closed" },
];

// ---------------------------------------------------------------------------
// Default date helpers — default to a 1-month window ending today
// ---------------------------------------------------------------------------

export function getDefaultFromDate(): string {
	const d = new Date();
	d.setUTCMonth(d.getUTCMonth() - 1);
	return d.toISOString().slice(0, 10);
}

export function getDefaultToDate(): string {
	return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const COMPACT_NUMBER = new Intl.NumberFormat("en-IN", {
	maximumFractionDigits: 2,
	minimumFractionDigits: 0,
});

/** Format a quantity value for display in table cells. */
export function formatQty(value: number | null | undefined): string {
	if (value == null) return "—";
	return COMPACT_NUMBER.format(value);
}

/** Format a monetary amount value prefixed with the rupee symbol. */
export function formatAmount(value: number | null | undefined): string {
	if (value == null) return "—";
	return `₹ ${COMPACT_NUMBER.format(value)}`;
}

/**
 * Format a duration given in seconds into a human-readable string.
 *
 * @example
 * formatDurationSeconds(90061) // "1d 1h 1m"
 * formatDurationSeconds(0)     // "—"
 */
export function formatDurationSeconds(seconds: number): string {
	if (seconds <= 0) return "—";

	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	const parts: string[] = [];
	if (days > 0) parts.push(`${days.toString()}d`);
	if (hours > 0) parts.push(`${hours.toString()}h`);
	if (minutes > 0 || parts.length === 0) parts.push(`${minutes.toString()}m`);

	return parts.join(" ");
}

/** Return a CSS class to visually highlight a delay value. */
export function getDelayClass(days: number): string {
	return days > 0 ? "text-destructive font-medium" : "";
}

/** Return a CSS class to visually highlight a delivered quantity value. */
export function getDeliveredClass(qty: number): string {
	return qty > 0 ? "text-green-600 font-medium" : "";
}

// ---------------------------------------------------------------------------
// Donut chart data builder
// ---------------------------------------------------------------------------

export interface DonutChartEntry {
	name: string;
	value: number;
}

/**
 * Build the two-segment donut chart data from the report summary.
 *
 * @remarks
 * Mirrors the ERPNext "Amount to Bill vs Billed Amount" donut chart.
 *
 * @param summary - Aggregated billing summary from the analysis result
 */
export function buildDonutChartData(
	summary: SalesOrderAnalysisSummary,
): DonutChartEntry[] {
	return [
		{ name: "Amount to Bill", value: summary.totalPendingAmount },
		{ name: "Billed Amount", value: summary.totalBilledAmount },
	];
}

// ---------------------------------------------------------------------------
// Chart colors
// ---------------------------------------------------------------------------

/** Return a deterministic chart color from the Aria CSS palette. */
export function getChartColor(index: number): string {
	const paletteSize = 5;
	const slot = (index % paletteSize) + 1;
	return `hsl(var(--chart-${slot}))`;
}
