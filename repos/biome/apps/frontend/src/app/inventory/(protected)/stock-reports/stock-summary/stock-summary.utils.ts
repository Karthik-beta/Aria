import type { Inventory } from "@aria/types";

export type StockSummaryMetric = Inventory.StockSummaryMetric;
export type StockSummaryHealth = Inventory.StockSummaryHealth;
export type StockSummaryRow = Inventory.StockSummaryRow;

export const STOCK_SUMMARY_METRIC_OPTIONS: Array<{
	label: string;
	value: StockSummaryMetric;
}> = [
	{ label: "Projected qty", value: "PROJECTED_QTY" },
	{ label: "Reserved for sale", value: "RESERVED_QTY" },
	{
		label: "Reserved for manufacturing",
		value: "RESERVED_QTY_FOR_PRODUCTION",
	},
	{
		label: "Reserved for subcontracting",
		value: "RESERVED_QTY_FOR_SUBCONTRACTING",
	},
	{ label: "Actual qty in stock", value: "ACTUAL_QTY" },
	{ label: "Shortage qty", value: "SHORTAGE_QTY" },
];

const STOCK_SUMMARY_HEALTH_LABELS: Record<StockSummaryHealth, string> = {
	CRITICAL: "Critical",
	LOW: "Low stock",
	HEALTHY: "Healthy",
	SURPLUS: "Surplus",
};

const STOCK_SUMMARY_HEALTH_BADGE_CLASSES: Record<StockSummaryHealth, string> = {
	CRITICAL: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
	LOW: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
	HEALTHY:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
	SURPLUS: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200",
};

export function formatStockSummaryQuantity(value: number): string {
	return value.toLocaleString(undefined, {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
}

export function formatCompactDate(date: Date | null | undefined): string {
	if (!date) return "-";
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
}

export function formatRelativeAge(date: Date | null | undefined): string {
	if (!date) return "-";
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}

export function formatOptionalText(value?: string | null): string {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : "-";
}

export function formatStockSummaryMetric(metric: StockSummaryMetric): string {
	return (
		STOCK_SUMMARY_METRIC_OPTIONS.find((option) => option.value === metric)
			?.label ?? metric
	);
}

export function formatStockSummaryHealth(health: StockSummaryHealth): string {
	return STOCK_SUMMARY_HEALTH_LABELS[health];
}

export function getStockSummaryHealthClasses(
	health: StockSummaryHealth,
): string {
	return STOCK_SUMMARY_HEALTH_BADGE_CLASSES[health];
}

export function getStockSummaryBarWidth(
	value: number,
	maxValue: number,
): string {
	if (maxValue <= 0) {
		return "0%";
	}

	return `${Math.max(0, Math.min((Math.abs(value) / maxValue) * 100, 100))}%`;
}
