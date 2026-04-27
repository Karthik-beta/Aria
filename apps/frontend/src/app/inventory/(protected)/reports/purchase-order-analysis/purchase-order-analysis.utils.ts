import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Re-exported types for local use in the page
// ---------------------------------------------------------------------------

export type PurchaseOrderAnalysisStatus = Inventory.PurchaseOrderAnalysisStatus;
export type PurchaseOrderAnalysisRow = Inventory.PurchaseOrderAnalysisRow;
export type PurchaseOrderAnalysisSummary =
	Inventory.PurchaseOrderAnalysisSummary;
export type PurchaseOrderAnalysisResult = Inventory.PurchaseOrderAnalysisResult;

// ---------------------------------------------------------------------------
// Status options
// ---------------------------------------------------------------------------

export const STATUS_OPTIONS: {
	value: PurchaseOrderAnalysisStatus;
	label: string;
}[] = [
	{ value: "TO_PAY", label: "To Pay" },
	{ value: "TO_BILL", label: "To Bill" },
	{ value: "TO_RECEIVE", label: "To Receive" },
	{ value: "TO_RECEIVE_AND_BILL", label: "To Receive and Bill" },
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

/** Return a CSS class to visually highlight a received quantity value. */
export function getReceivedClass(qty: number): string {
	return qty > 0 ? "text-green-600 font-medium" : "";
}

/** Return a CSS class to visually highlight a billed amount value. */
export function getBilledClass(amount: number): string {
	return amount > 0 ? "text-green-600 font-medium" : "";
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
	summary: PurchaseOrderAnalysisSummary,
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
