import type { Inventory } from "@aria/types";
import {
	buildTrendsPeriods,
	buildTrendsRows,
	type TrendsSourceEntry,
} from "./trend-report-core";

// ---------------------------------------------------------------------------
// Source shape — raw delivery note item rows fed into this report
// ---------------------------------------------------------------------------

/**
 * Flattened delivery note item row produced by the service layer and
 * consumed by {@link buildDeliveryNoteTrendsRows}.
 */
export type DeliveryNoteTrendsSourceEntry = TrendsSourceEntry;

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
export function buildDeliveryNoteTrendsPeriods(
	fromDate: Date,
	toDate: Date,
	frequency: Inventory.DeliveryNoteTrendsPeriodFrequency,
): Inventory.DeliveryNoteTrendsPeriod[] {
	return buildTrendsPeriods(
		fromDate,
		toDate,
		frequency,
	) as Inventory.DeliveryNoteTrendsPeriod[];
}

/**
 * Aggregate source entries into trend rows grouped by dimension.
 *
 * @param entries - Flattened delivery note item rows from the database
 * @param periods - Period buckets produced by {@link buildDeliveryNoteTrendsPeriods}
 * @returns Aggregated result ready for the frontend
 */
export function buildDeliveryNoteTrendsRows(
	entries: DeliveryNoteTrendsSourceEntry[],
	periods: Inventory.DeliveryNoteTrendsPeriod[],
): Inventory.DeliveryNoteTrendsResult {
	return buildTrendsRows(
		entries,
		periods,
	) as Inventory.DeliveryNoteTrendsResult;
}
