import type { Inventory } from "@aria/types";

export type StockAgeingRow = Inventory.StockAgeingRow;
export type StockAgeingBucket = Inventory.StockAgeingBucket;
export type StockAgeingCurrency = "INR" | "AED" | "USD" | "EUR";
export type StockAgeingHealth = "FRESH" | "WATCH" | "AGED" | "OBSOLETE";

export const DEFAULT_STOCK_AGEING_RANGE_INPUT = "30, 60, 90";

const DEFAULT_STOCK_AGEING_BREAKS = [30, 60, 90];

const CURRENCY_LOCALE: Record<StockAgeingCurrency, string> = {
	INR: "en-IN",
	AED: "en-AE",
	USD: "en-US",
	EUR: "en-IE",
};

const STOCK_AGEING_HEALTH_LABELS: Record<StockAgeingHealth, string> = {
	FRESH: "Fresh",
	WATCH: "Watch",
	AGED: "Aged",
	OBSOLETE: "Obsolete",
};

const STOCK_AGEING_HEALTH_CLASSES: Record<StockAgeingHealth, string> = {
	FRESH:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
	WATCH: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200",
	AGED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
	OBSOLETE: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
};

/**
 * Parses a comma-separated ageing range input into sorted unique bucket breaks.
 */
export function parseAgeingRangeInput(rawInput: string): number[] {
	const segments = rawInput
		.split(",")
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0);

	if (segments.length === 0) {
		throw new Error("Enter at least one ageing range");
	}

	const values = segments.map((segment) => Number.parseInt(segment, 10));
	if (
		values.some((value) => !Number.isFinite(value) || value < 0) ||
		values.length === 0
	) {
		throw new Error("Ageing ranges must be comma-separated positive integers");
	}

	return [...new Set(values)].sort((left, right) => left - right);
}

export function safeParseAgeingRangeInput(rawInput?: string | null): {
	ranges: number[];
	error: string | null;
} {
	const normalizedInput = rawInput?.trim();

	if (!normalizedInput) {
		return {
			ranges: [...DEFAULT_STOCK_AGEING_BREAKS],
			error: null,
		};
	}

	try {
		return {
			ranges: parseAgeingRangeInput(normalizedInput),
			error: null,
		};
	} catch (error) {
		return {
			ranges: [...DEFAULT_STOCK_AGEING_BREAKS],
			error:
				error instanceof Error ? error.message : "Ageing ranges are invalid",
		};
	}
}

export function formatStockAgeingQuantity(value: number): string {
	return value.toLocaleString(undefined, {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
}

export function formatStockAgeingCurrency(
	value: number,
	currency: StockAgeingCurrency = "INR",
): string {
	return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

export function formatCompactDate(date: Date | null | undefined): string {
	if (!date) return "-";
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
}

export function formatOptionalText(value?: string | null): string {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : "-";
}

export function classifyStockAgeingHealth(
	averageAge: number,
): StockAgeingHealth {
	if (averageAge >= 365) {
		return "OBSOLETE";
	}

	if (averageAge >= 180) {
		return "AGED";
	}

	if (averageAge >= 60) {
		return "WATCH";
	}

	return "FRESH";
}

export function formatStockAgeingHealth(health: StockAgeingHealth): string {
	return STOCK_AGEING_HEALTH_LABELS[health];
}

export function getStockAgeingHealthClasses(health: StockAgeingHealth): string {
	return STOCK_AGEING_HEALTH_CLASSES[health];
}

export function formatStockAgeingBucketLabel(
	bucket: StockAgeingBucket,
): string {
	return bucket.maxAge == null
		? `${bucket.minAge}+`
		: `${bucket.minAge} - ${bucket.maxAge}`;
}

export function getBucketQuantity(
	row: StockAgeingRow,
	bucketIndex: number,
): number {
	return row.buckets[bucketIndex]?.quantity ?? 0;
}

export function getBucketValue(
	row: StockAgeingRow,
	bucketIndex: number,
): number {
	return row.buckets[bucketIndex]?.value ?? 0;
}

export function buildStockAgeingChartData(rows: StockAgeingRow[]) {
	return [...rows]
		.sort((left, right) => right.averageAge - left.averageAge)
		.slice(0, 10)
		.map((row) => ({
			id: row.id,
			label: row.itemCode,
			averageAge: row.averageAge,
			availableQty: row.availableQty,
			warehouse: row.warehouse,
		}));
}
