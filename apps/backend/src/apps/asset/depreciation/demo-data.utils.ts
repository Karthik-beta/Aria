import { dateOnlyUtc, normalizeDateOnly } from "./depreciation.config";

export interface IndianFiscalYearDef {
	year: string;
	yearStartDate: Date;
	yearEndDate: Date;
}

/** ERPNext month-based cadences represented by the Pivotr demo categories. */
export const DEMO_ASSET_DEPRECIATION_CADENCES = {
	smtEquipment: 1,
	testInstruments: 3,
	warehouseAssets: 6,
	itEquipment: 1,
	utilities: 12,
	demoSystems: 3,
} as const;

/** Validates and normalizes the demo loader's date-only accounting cutoff. */
export function normalizeDemoAsOf(value: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new Error(`--as-of must use YYYY-MM-DD: ${value}`);
	}
	try {
		return normalizeDateOnly(value);
	} catch {
		throw new Error(`--as-of is not a valid calendar date: ${value}`);
	}
}

/** Builds Indian April-to-March fiscal years around the supplied as-of date. */
export function buildIndianFiscalYears(asOf: Date): IndianFiscalYearDef[] {
	const asOfYear = asOf.getUTCFullYear();
	const currentStartYear = asOf.getUTCMonth() >= 3 ? asOfYear : asOfYear - 1;
	return [-3, -2, -1, 0, 1].map((offset) => {
		const startYear = currentStartYear + offset;
		return {
			year: `${startYear}-${String(startYear + 1).slice(-2)}`,
			yearStartDate: new Date(Date.UTC(startYear, 3, 1)),
			yearEndDate: new Date(Date.UTC(startYear + 1, 2, 31)),
		};
	});
}

/** Resolves the Indian April-to-March fiscal year containing a date-only value. */
export function getIndianFiscalYear(date: string): {
	startDate: string;
	endDate: string;
} {
	const normalized = normalizeDateOnly(date);
	const parsed = dateOnlyUtc(normalized);
	const year = parsed.getUTCFullYear();
	const startYear = parsed.getUTCMonth() >= 3 ? year : year - 1;
	return {
		startDate: `${startYear}-04-01`,
		endDate: `${startYear + 1}-03-31`,
	};
}

function endOfUtcMonth(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

/** Resolves the first ERPNext-style month-end depreciation date. */
export function resolveDemoDepreciationStartDate(
	availableForUseDate: Date,
): Date {
	return endOfUtcMonth(availableForUseDate);
}
