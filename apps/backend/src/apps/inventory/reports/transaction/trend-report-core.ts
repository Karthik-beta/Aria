// ---------------------------------------------------------------------------
// Generic Trend Report Core
//
// Shared period-generation and row-aggregation logic used by all inventory
// trend reports (Purchase Receipt Trends, Delivery Note Trends, etc.).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared source / period / row / result shapes
// ---------------------------------------------------------------------------

/** Raw item-level row fed into any trend report. */
export interface TrendsSourceEntry {
	postingDate: Date;
	quantity: number;
	amount: number;
	/** The grouping key derived from the basedOn dimension. */
	dimensionKey: string;
	/** Optional human-readable label for the dimension (e.g. item name). */
	dimensionLabel?: string | null;
}

/** Temporal granularity options shared across all trends reports. */
export type TrendsPeriodFrequency =
	| "Monthly"
	| "Quarterly"
	| "Half-Yearly"
	| "Yearly";

/** One time bucket, produced by {@link buildTrendsPeriods}. */
export interface TrendsPeriod {
	/** Inclusive start of the bucket. */
	from: Date;
	/** Inclusive end of the bucket. */
	to: Date;
	/** Human-readable label, e.g. "Jan 2024", "Jan–Mar 2024". */
	label: string;
	/** Snake-cased column accessor key, e.g. "jan_2024". */
	key: string;
}

/** One aggregated dimension row in a trend report. */
export interface TrendsRow {
	id: string;
	dimensionKey: string;
	dimensionLabel?: string | null;
	/** Aggregated quantity per period key. */
	periodQty: Record<string, number>;
	/** Aggregated amount per period key. */
	periodAmount: Record<string, number>;
	totalQty: number;
	totalAmount: number;
}

/** Full result payload returned to the frontend. */
export interface TrendsResult {
	periods: TrendsPeriod[];
	rows: TrendsRow[];
	totalQty: number;
	totalAmount: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MONTH_ABBR = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

function scrubKey(label: string): string {
	return label
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_]/g, "");
}

/**
 * Add N months to a UTC-anchored date (returns a new Date).
 * Day is reset to 1 to avoid month overflow.
 */
function addMonths(date: Date, months: number): Date {
	const d = new Date(date);
	d.setUTCMonth(d.getUTCMonth() + months, 1);
	return d;
}

function buildPeriodLabel(
	from: Date,
	to: Date,
	frequency: TrendsPeriodFrequency,
): string {
	const fromMonth = MONTH_ABBR[from.getUTCMonth()];
	const toMonth = MONTH_ABBR[to.getUTCMonth()];
	const fromYear = from.getUTCFullYear();
	const toYear = to.getUTCFullYear();

	switch (frequency) {
		case "Monthly":
			return `${fromMonth} ${fromYear}`;
		case "Quarterly":
		case "Half-Yearly": {
			if (fromYear === toYear) {
				return `${fromMonth}–${toMonth} ${fromYear}`;
			}
			return `${fromMonth} ${fromYear}–${toMonth} ${toYear}`;
		}
		case "Yearly":
			return `${fromYear}`;
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build month-aligned period buckets that cover [fromDate, toDate].
 * Buckets are anchored to calendar month/quarter/half-year/year boundaries.
 *
 * @param fromDate - Inclusive start date of the report range
 * @param toDate - Inclusive end date of the report range
 * @param frequency - Granularity of each period bucket
 * @returns Ordered array of period descriptors
 */
export function buildTrendsPeriods(
	fromDate: Date,
	toDate: Date,
	frequency: TrendsPeriodFrequency,
): TrendsPeriod[] {
	const incrementMonths: Record<TrendsPeriodFrequency, number> = {
		Monthly: 1,
		Quarterly: 3,
		"Half-Yearly": 6,
		Yearly: 12,
	};
	const stepMonths = incrementMonths[frequency];

	// Snap start to the appropriate boundary
	const bucketStart = new Date(fromDate);
	bucketStart.setUTCDate(1);
	bucketStart.setUTCHours(0, 0, 0, 0);

	if (frequency === "Quarterly") {
		const qStartMonth = Math.floor(bucketStart.getUTCMonth() / 3) * 3;
		bucketStart.setUTCMonth(qStartMonth, 1);
	} else if (frequency === "Half-Yearly") {
		const hStartMonth = Math.floor(bucketStart.getUTCMonth() / 6) * 6;
		bucketStart.setUTCMonth(hStartMonth, 1);
	} else if (frequency === "Yearly") {
		bucketStart.setUTCMonth(0, 1);
	}

	const periods: TrendsPeriod[] = [];
	let current = new Date(bucketStart);

	while (current <= toDate) {
		const periodFrom = new Date(current);
		const nextStart = addMonths(current, stepMonths);
		const periodTo = new Date(nextStart.getTime() - 1);
		const clampedTo = periodTo > toDate ? toDate : periodTo;

		const label = buildPeriodLabel(periodFrom, clampedTo, frequency);
		const key = scrubKey(label);

		periods.push({ from: periodFrom, to: clampedTo, label, key });
		current = nextStart;
	}

	return periods;
}

/**
 * Aggregate source entries into trend rows grouped by dimension.
 *
 * @param entries - Flattened transaction item rows from the database
 * @param periods - Period buckets produced by {@link buildTrendsPeriods}
 * @returns Aggregated result ready for the frontend
 */
export function buildTrendsRows(
	entries: TrendsSourceEntry[],
	periods: TrendsPeriod[],
): TrendsResult {
	if (periods.length === 0 || entries.length === 0) {
		return { periods, rows: [], totalQty: 0, totalAmount: 0 };
	}

	// Map: dimensionKey → periodKey → accumulated value
	const qtyMap = new Map<string, Map<string, number>>();
	const amtMap = new Map<string, Map<string, number>>();
	const labelMap = new Map<string, string | null | undefined>();

	for (const entry of entries) {
		const { dimensionKey, dimensionLabel, postingDate, quantity, amount } =
			entry;

		if (!labelMap.has(dimensionKey)) {
			labelMap.set(dimensionKey, dimensionLabel);
		}

		const period = periods.find(
			(p) => postingDate >= p.from && postingDate <= p.to,
		);
		if (!period) continue;

		const dimQty = qtyMap.get(dimensionKey) ?? new Map<string, number>();
		dimQty.set(period.key, (dimQty.get(period.key) ?? 0) + quantity);
		qtyMap.set(dimensionKey, dimQty);

		const dimAmt = amtMap.get(dimensionKey) ?? new Map<string, number>();
		dimAmt.set(period.key, (dimAmt.get(period.key) ?? 0) + amount);
		amtMap.set(dimensionKey, dimAmt);
	}

	const periodKeys = periods.map((p) => p.key);

	let totalQty = 0;
	let totalAmount = 0;

	const rows: TrendsRow[] = [];

	for (const dimensionKey of qtyMap.keys()) {
		const dimQty = qtyMap.get(dimensionKey) ?? new Map<string, number>();
		const dimAmt = amtMap.get(dimensionKey) ?? new Map<string, number>();

		const periodQty: Record<string, number> = {};
		const periodAmount: Record<string, number> = {};
		let rowTotalQty = 0;
		let rowTotalAmount = 0;

		for (const key of periodKeys) {
			const qty = dimQty.get(key) ?? 0;
			const amt = dimAmt.get(key) ?? 0;
			periodQty[key] = qty;
			periodAmount[key] = amt;
			rowTotalQty += qty;
			rowTotalAmount += amt;
		}

		totalQty += rowTotalQty;
		totalAmount += rowTotalAmount;

		rows.push({
			id: dimensionKey,
			dimensionKey,
			dimensionLabel: labelMap.get(dimensionKey),
			periodQty,
			periodAmount,
			totalQty: rowTotalQty,
			totalAmount: rowTotalAmount,
		});
	}

	// Sort by total amount descending (mirrors ERPNext top-10 bar chart sort)
	rows.sort((a, b) => b.totalAmount - a.totalAmount);

	return { periods, rows, totalQty, totalAmount };
}
