import type { Asset } from "@aria/types";
import { addDateOnly, normalizeDateOnly } from "@aria/types";
import { formatAssetDate, todayDateInputValue } from "@/lib/asset-date-only";

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

export function getDefaultFromDate(): string {
	return `${todayDateInputValue().slice(0, 4)}-01-01`;
}

export function getDefaultToDate(): string {
	return todayDateInputValue();
}

export function buildAssetDepreciationsAndBalancesInput(
	filters: AssetDepreciationsAndBalancesFilterState,
): Asset.ListAssetDepreciationsAndBalancesInput {
	return {
		fromDate: normalizeDateOnly(filters.fromDate),
		toDate: normalizeDateOnly(filters.toDate),
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

	try {
		const fromDate = normalizeDateOnly(filters.fromDate);
		const toDate = normalizeDateOnly(filters.toDate);
		if (fromDate > toDate) {
			return "From date must be on or before to date.";
		}
	} catch {
		return "Enter a valid date range.";
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
	try {
		return formatAssetDate(value);
	} catch {
		return "-";
	}
}

export function getOpeningDateLabel(fromDate: string): string {
	return formatDateLabel(addDateOnly(fromDate, -1));
}

export function getClosingDateLabel(toDate: string): string {
	return formatDateLabel(toDate);
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
