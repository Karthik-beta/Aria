import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Source shape — raw stock ledger rows fed into this report
// ---------------------------------------------------------------------------

export interface StockAnalyticsSourceEntry {
	company: string;
	itemCode: string;
	warehouse: string;
	postingDate: Date;
	/** Net qty change for this movement (positive = in, negative = out). */
	qtyChange: number;
	/** Net stock-value change for this movement. */
	valueChange: number;
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

function scrubLabel(label: string): string {
	return label
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_]/g, "");
}

/** Round a date down to the start of its frequency bucket. */
function roundDownToFrequency(
	date: Date,
	frequency: Inventory.StockAnalyticsRangeFrequency,
): Date {
	const d = new Date(date);
	switch (frequency) {
		case "Weekly": {
			// ISO week starts on Monday
			const dow = d.getUTCDay(); // 0=Sun … 6=Sat
			const offsetToMon = dow === 0 ? -6 : 1 - dow;
			d.setUTCDate(d.getUTCDate() + offsetToMon);
			d.setUTCHours(0, 0, 0, 0);
			break;
		}
		case "Monthly":
			d.setUTCDate(1);
			d.setUTCHours(0, 0, 0, 0);
			break;
		case "Quarterly": {
			const qStartMonth = Math.floor(d.getUTCMonth() / 3) * 3;
			d.setUTCMonth(qStartMonth, 1);
			d.setUTCHours(0, 0, 0, 0);
			break;
		}
		case "Yearly":
			d.setUTCMonth(0, 1);
			d.setUTCHours(0, 0, 0, 0);
			break;
	}
	return d;
}

/** Add the increment for a given frequency to a date (returns a new Date). */
function addFrequencyIncrement(
	date: Date,
	frequency: Inventory.StockAnalyticsRangeFrequency,
): Date {
	const d = new Date(date);
	switch (frequency) {
		case "Weekly":
			d.setUTCDate(d.getUTCDate() + 7);
			break;
		case "Monthly":
			d.setUTCMonth(d.getUTCMonth() + 1);
			break;
		case "Quarterly":
			d.setUTCMonth(d.getUTCMonth() + 3);
			break;
		case "Yearly":
			d.setUTCFullYear(d.getUTCFullYear() + 1);
			break;
	}
	return d;
}

/** ISO week number (1-53) for a UTC date. */
function isoWeekNumber(date: Date): number {
	const tmp = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
	// Thursday in current week decides the year
	tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
	const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
	return Math.ceil(
		((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
	);
}

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

/** Generate a human-readable label for the bucket whose END date is `date`. */
function getPeriodLabel(
	endDate: Date,
	frequency: Inventory.StockAnalyticsRangeFrequency,
): string {
	const year = endDate.getUTCFullYear();
	switch (frequency) {
		case "Weekly":
			return `Week ${isoWeekNumber(endDate)} ${year}`;
		case "Monthly":
			return `${MONTH_ABBR[endDate.getUTCMonth()]} ${year}`;
		case "Quarterly": {
			const quarter = Math.floor(endDate.getUTCMonth() / 3) + 1;
			return `Q${quarter} ${year}`;
		}
		case "Yearly":
			return `${year}`;
	}
}

/**
 * Build all period buckets for the report from `fromDate` to `toDate`.
 *
 * The first bucket starts at the rounded-down frequency boundary that
 * contains `fromDate`. Each bucket end date is capped at `toDate`.
 */
export function getPeriodDateRanges(
	fromDate: Date,
	toDate: Date,
	frequency: Inventory.StockAnalyticsRangeFrequency,
): Inventory.StockAnalyticsPeriod[] {
	const periods: Inventory.StockAnalyticsPeriod[] = [];
	let periodStart = roundDownToFrequency(fromDate, frequency);

	// Guard against runaway loops (max 260 weekly buckets ≈ 5 years)
	const maxBuckets = 260;

	while (periodStart <= toDate && periods.length < maxBuckets) {
		const nextStart = addFrequencyIncrement(periodStart, frequency);
		const rawEnd = new Date(nextStart.getTime() - 86_400_000); // -1 day
		const periodEnd = rawEnd > toDate ? toDate : rawEnd;

		const label = getPeriodLabel(periodEnd, frequency);
		periods.push({
			from: new Date(periodStart),
			to: new Date(periodEnd),
			label,
			key: scrubLabel(label),
		});

		periodStart = nextStart;
	}

	return periods;
}

// ---------------------------------------------------------------------------
// Core report builder
// ---------------------------------------------------------------------------

interface BuildOptions {
	fromDate: Date;
	toDate: Date;
	frequency: Inventory.StockAnalyticsRangeFrequency;
	valueQuantity: Inventory.StockAnalyticsValueQuantity;
	/** Today's date — periods after this date receive null values. */
	today?: Date;
}

interface ItemMeta {
	itemName?: string | null;
	itemGroup?: string | null;
	brand?: string | null;
	unitOfMeasure?: string | null;
}

/**
 * Build Stock Analytics rows from raw stock ledger entries.
 *
 * @remarks
 * Algorithm (mirrors ERPNext Stock Analytics logic):
 * 1. Sort entries chronologically.
 * 2. For each entry, determine its period bucket.
 * 3. Accumulate a running per-item/warehouse balance.
 * 4. Snapshot the running balance into the period column every time an entry
 *    falls within a tracked period.
 * 5. Fill gaps: if an item has no movements in an intermediate period, carry
 *    forward the previous period balance.
 * 6. Future periods (after today) receive null so the UI can display them
 *    distinctly.
 */
export function buildStockAnalyticsRows(
	entries: StockAnalyticsSourceEntry[],
	itemMeta: Map<string, ItemMeta>,
	options: BuildOptions,
): Inventory.StockAnalyticsResult {
	const today = options.today ?? new Date();
	today.setUTCHours(23, 59, 59, 999);

	const periods = getPeriodDateRanges(
		options.fromDate,
		options.toDate,
		options.frequency,
	);

	if (periods.length === 0) {
		return { periods: [], rows: [] };
	}

	const expectedPeriodKeys = periods.map((p) => p.key);

	// running balance per item → warehouse → numeric value
	const runningBalance = new Map<string, Map<string, number>>();

	// period snapshots: itemCode → periodKey → warehouse → value
	const snapshots = new Map<string, Map<string, Map<string, number>>>();

	// Sort entries by posting date ascending (earlier balances first)
	const sorted = [...entries].sort(
		(a, b) => a.postingDate.getTime() - b.postingDate.getTime(),
	);

	function getOrInitItem(itemCode: string) {
		if (!runningBalance.has(itemCode)) {
			runningBalance.set(itemCode, new Map());
		}
		if (!snapshots.has(itemCode)) {
			snapshots.set(itemCode, new Map());
		}
		return {
			balance: runningBalance.get(itemCode) ?? new Map<string, number>(),
			periodMap:
				snapshots.get(itemCode) ?? new Map<string, Map<string, number>>(),
		};
	}

	function findPeriodForDate(
		date: Date,
	): Inventory.StockAnalyticsPeriod | null {
		for (const p of periods) {
			if (date >= p.from && date <= p.to) {
				return p;
			}
		}
		return null;
	}

	for (const entry of sorted) {
		const { balance, periodMap } = getOrInitItem(entry.itemCode);

		const delta =
			options.valueQuantity === "Quantity"
				? entry.qtyChange
				: entry.valueChange;

		// Update running balance for this warehouse
		const prevBal = balance.get(entry.warehouse) ?? 0;
		balance.set(entry.warehouse, prevBal + delta);

		// Identify period — may be before the from_date window (still updates
		// balance, just not tracked in the visible period columns)
		const period = findPeriodForDate(entry.postingDate);
		if (!period) {
			continue;
		}

		// Fill any intermediate periods that were skipped
		fillIntermediatePeriods(periodMap, period.key, expectedPeriodKeys);

		// Snapshot current balance into this period for this warehouse
		const warehouseMap = periodMap.get(period.key) ?? new Map<string, number>();
		// balance.get is safe: we incremented this warehouse's balance directly above
		warehouseMap.set(entry.warehouse, balance.get(entry.warehouse) ?? 0);
		periodMap.set(period.key, warehouseMap);
	}

	// Collect all item codes that appeared in entries
	const allItemCodes = new Set<string>(entries.map((e) => e.itemCode));

	// For each item, determine earliest period it had data in and back-fill
	// from-period gaps, then propagate forward
	const rows: Inventory.StockAnalyticsRow[] = [];

	for (const itemCode of allItemCodes) {
		const periodMap = snapshots.get(itemCode) ?? new Map();
		const balance = runningBalance.get(itemCode) ?? new Map();

		// Fill remaining periods after last movement
		const lastPeriodWithData = findLastPeriodWithData(
			periodMap,
			expectedPeriodKeys,
		);
		if (lastPeriodWithData != null) {
			fillForwardFromPeriod(
				periodMap,
				balance,
				lastPeriodWithData,
				expectedPeriodKeys,
			);
		}

		const periodValues: Record<string, number | null> = {};
		for (let i = 0; i < periods.length; i++) {
			const p = periods[i];
			const isFuture = p.from > today;

			if (isFuture) {
				periodValues[p.key] = null;
				continue;
			}

			const warehouseMap = periodMap.get(p.key);
			if (warehouseMap) {
				let sum = 0;
				for (const v of warehouseMap.values()) {
					sum += v;
				}
				periodValues[p.key] = sum;
			} else {
				// Period is in the past but no movements yet → zero
				periodValues[p.key] = 0;
			}
		}

		const meta = itemMeta.get(itemCode) ?? {};

		rows.push({
			id: itemCode,
			itemCode,
			itemName: meta.itemName ?? null,
			itemGroup: meta.itemGroup ?? null,
			brand: meta.brand ?? null,
			unitOfMeasure: meta.unitOfMeasure ?? null,
			periodValues,
		});
	}

	// Sort rows by item code for stable output
	rows.sort((a, b) => a.itemCode.localeCompare(b.itemCode));

	return { periods, rows };
}

// ---------------------------------------------------------------------------
// Gap-filling helpers
// ---------------------------------------------------------------------------

/**
 * For any expected period that falls strictly before `currentPeriodKey` and
 * has no data yet, copy the previous period's warehouse map so that balances
 * appear continuous.
 */
function fillIntermediatePeriods(
	periodMap: Map<string, Map<string, number>>,
	currentPeriodKey: string,
	allPeriodKeys: string[],
): void {
	let previousData: Map<string, number> | null = null;

	for (const key of allPeriodKeys) {
		if (key === currentPeriodKey) {
			break;
		}

		if (!periodMap.has(key) && previousData != null) {
			periodMap.set(key, new Map(previousData));
		}

		const existing = periodMap.get(key);
		if (existing) {
			previousData = existing;
		}
	}
}

function findLastPeriodWithData(
	periodMap: Map<string, Map<string, number>>,
	allPeriodKeys: string[],
): string | null {
	let last: string | null = null;
	for (const key of allPeriodKeys) {
		if (periodMap.has(key)) {
			last = key;
		}
	}
	return last;
}

/** Propagate the balance forward to fill all remaining periods after the last
 * one with data, so the table shows a continued balance rather than zeros. */
function fillForwardFromPeriod(
	periodMap: Map<string, Map<string, number>>,
	currentBalance: Map<string, number>,
	startPeriodKey: string,
	allPeriodKeys: string[],
): void {
	let filling = false;

	for (const key of allPeriodKeys) {
		if (key === startPeriodKey) {
			filling = true;
			continue;
		}

		if (filling && !periodMap.has(key)) {
			// Carry forward the current balance
			periodMap.set(key, new Map(currentBalance));
		}
	}
}
