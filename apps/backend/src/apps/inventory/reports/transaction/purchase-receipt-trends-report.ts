import type { Inventory } from "@aria/types";
import {
	buildTrendsPeriods,
	buildTrendsRows,
	type TrendsSourceEntry,
} from "./trend-report-core";

// ---------------------------------------------------------------------------
// Source shape — raw purchase receipt item rows fed into this report
// ---------------------------------------------------------------------------

/**
 * Flattened purchase receipt item row produced by the service layer and
 * consumed by {@link buildPurchaseReceiptTrendsRows}.
 */
export type PurchaseReceiptTrendsSourceEntry = TrendsSourceEntry;

// ---------------------------------------------------------------------------
// Public API — thin typed wrappers over the shared trend-report-core
// ---------------------------------------------------------------------------

/**
 * Build month-aligned period buckets that cover [fromDate, toDate].
 * Buckets are anchored to calendar month/quarter/half-year/year boundaries.
 *
 * @param fromDate - Inclusive start date for the report range
 * @param toDate - Inclusive end date for the report range
 * @param frequency - Granularity of each period bucket
 * @returns Ordered array of period descriptors
 */
export function buildPurchaseReceiptTrendsPeriods(
	fromDate: Date,
	toDate: Date,
	frequency: Inventory.PurchaseReceiptTrendsPeriodFrequency,
): Inventory.PurchaseReceiptTrendsPeriod[] {
	return buildTrendsPeriods(
		fromDate,
		toDate,
		frequency,
	) as Inventory.PurchaseReceiptTrendsPeriod[];
}

/**
 * Aggregate source entries into trend rows grouped by dimension.
 *
 * @param entries - Flattened purchase receipt item rows from the database
 * @param periods - Period buckets produced by {@link buildPurchaseReceiptTrendsPeriods}
 * @returns Aggregated result ready for the frontend
 */
export function buildPurchaseReceiptTrendsRows(
	entries: PurchaseReceiptTrendsSourceEntry[],
	periods: Inventory.PurchaseReceiptTrendsPeriod[],
): Inventory.PurchaseReceiptTrendsResult {
	return buildTrendsRows(
		entries,
		periods,
	) as Inventory.PurchaseReceiptTrendsResult;
}
