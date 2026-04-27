import type { Inventory } from "@aria/types";

export type ItemPriceStockCurrency = "INR" | "AED" | "USD" | "EUR";

export const ITEM_PRICE_STOCK_CURRENCY_OPTIONS: Array<{
	label: string;
	value: ItemPriceStockCurrency;
}> = [
	{ label: "INR", value: "INR" },
	{ label: "AED", value: "AED" },
	{ label: "USD", value: "USD" },
	{ label: "EUR", value: "EUR" },
];

const CURRENCY_LOCALE: Record<ItemPriceStockCurrency, string> = {
	INR: "en-IN",
	AED: "en-AE",
	USD: "en-US",
	EUR: "en-IE",
};

export function formatItemPriceStockQuantity(value: number): string {
	return value.toLocaleString(undefined, {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
}

export function formatItemPriceStockCurrency(
	value: number,
	currency: ItemPriceStockCurrency = "INR",
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

export type ItemPriceStockRow = Inventory.ItemPriceStockRow;
