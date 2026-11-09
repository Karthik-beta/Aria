import type { Asset } from "@aria/types";

export type AssetDepreciationsAndBalancesFilterState = {
	company: string;
	fromDate: string;
	toDate: string;
	groupBy: Asset.AssetDepreciationsAndBalancesGroupBy;
	asset: string;
	assetCategory: string;
};

export const ASSET_DEPRECIATIONS_AND_BALANCES_GROUP_BY_OPTIONS = [
	{
		value:
			"ASSET_CATEGORY" satisfies Asset.AssetDepreciationsAndBalancesGroupBy,
		label: "Asset Category",
	},
	{
		value: "ASSET" satisfies Asset.AssetDepreciationsAndBalancesGroupBy,
		label: "Asset",
	},
] as const;

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

function toDateInputValue(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function parseDateField(value: string, endOfDay = false): Date {
	return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
}

export function getDefaultFromDate(): string {
	const date = new Date();
	date.setMonth(0, 1);
	date.setHours(0, 0, 0, 0);

	return toDateInputValue(date);
}

export function getDefaultToDate(): string {
	return toDateInputValue(new Date());
}

export function buildAssetDepreciationsAndBalancesInput(
	filters: AssetDepreciationsAndBalancesFilterState,
): Asset.ListAssetDepreciationsAndBalancesInput {
	return {
		fromDate: parseDateField(filters.fromDate),
		toDate: parseDateField(filters.toDate, true),
		company: filters.company.trim() || undefined,
		groupBy: filters.groupBy,
		asset: filters.asset.trim() || undefined,
		assetCategory: filters.assetCategory.trim() || undefined,
	};
}

export function getDateRangeError(
	filters: Pick<
		AssetDepreciationsAndBalancesFilterState,
		"fromDate" | "toDate"
	>,
): string | null {
	if (!filters.fromDate || !filters.toDate) {
		return "From date and to date are required.";
	}

	const fromDate = parseDateField(filters.fromDate);
	const toDate = parseDateField(filters.toDate, true);

	if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
		return "Enter a valid date range.";
	}

	if (fromDate.getTime() > toDate.getTime()) {
		return "From date must be on or before to date.";
	}

	return null;
}

export function formatCurrency(value: number | null | undefined): string {
	if (value === null || value === undefined || Number.isNaN(value)) {
		return "-";
	}

	return CURRENCY_FORMATTER.format(value);
}

export function formatDateLabel(value: Date | string): string {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}

	return date.toLocaleDateString("en-IN", {
		year: "numeric",
		month: "short",
		day: "2-digit",
	});
}

export function getOpeningDateLabel(fromDate: string): string {
	const date = parseDateField(fromDate);
	date.setUTCDate(date.getUTCDate() - 1);

	return formatDateLabel(date);
}

export function getClosingDateLabel(toDate: string): string {
	return formatDateLabel(parseDateField(toDate, true));
}

export function renderOptionalText(value: string | null | undefined): string {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : "-";
}

export function getSignedAmountClassName(value: number): string {
	if (value > 0) {
		return "text-emerald-700 dark:text-emerald-300";
	}

	if (value < 0) {
		return "text-rose-700 dark:text-rose-300";
	}

	return "text-muted-foreground";
}
