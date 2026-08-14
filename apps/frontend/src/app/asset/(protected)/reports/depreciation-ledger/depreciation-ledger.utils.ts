import type { Asset } from "@aria/types";
import {
	addMonthsDateOnly,
	dateOnlyFromPersistedDateTime,
	normalizeDateOnly,
} from "@aria/types";
import { formatAssetDate, todayDateInputValue } from "@/lib/asset-date-only";

export type AssetDepreciationLedgerFilterState = {
	company: string;
	fromDate: string;
	toDate: string;
	asset: string;
	assetCategory: string;
	costCenter: string;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

const DEPRECIATION_METHOD_LABELS: Record<Asset.DepreciationMethod, string> = {
	STRAIGHT_LINE: "Straight Line",
	DOUBLE_DECLINING_BALANCE: "Double Declining Balance",
	WRITTEN_DOWN_VALUE: "Written Down Value",
	MANUAL: "Manual",
};

function titleCaseSegments(value: string): string {
	return value
		.toLowerCase()
		.split(" ")
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

export function getDefaultFromDate(): string {
	return dateOnlyFromPersistedDateTime(
		addMonthsDateOnly(todayDateInputValue(), -1),
	);
}

export function getDefaultToDate(): string {
	return todayDateInputValue();
}

export function buildAssetDepreciationLedgerInput(
	filters: AssetDepreciationLedgerFilterState,
): Asset.ListAssetDepreciationLedgerInput {
	return {
		fromDate: normalizeDateOnly(filters.fromDate),
		toDate: normalizeDateOnly(filters.toDate),
		company: filters.company.trim() || undefined,
		asset: filters.asset.trim() || undefined,
		assetCategory: filters.assetCategory.trim() || undefined,
		costCenter: filters.costCenter.trim() || undefined,
	};
}

export function getDateRangeError(
	filters: Pick<AssetDepreciationLedgerFilterState, "fromDate" | "toDate">,
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

export function formatDate(value: Date | string | null | undefined): string {
	if (!value) {
		return "-";
	}

	try {
		return formatAssetDate(value);
	} catch {
		return "-";
	}
}

export function formatDepreciationMethod(
	method: Asset.DepreciationMethod | null | undefined,
): string {
	if (!method) {
		return "-";
	}

	return DEPRECIATION_METHOD_LABELS[method] ?? method;
}

export function formatAssetStatus(status: Asset.AssetStatus): string {
	return titleCaseSegments(status.replaceAll("_", " "));
}

export function getAssetStatusClassName(status: Asset.AssetStatus): string {
	switch (status) {
		case "PARTIALLY_DEPRECIATED":
			return "bg-blue-100 text-blue-700";
		case "FULLY_DEPRECIATED":
			return "bg-slate-200 text-slate-700";
		case "IN_MAINTENANCE":
			return "bg-amber-100 text-amber-700";
		case "OUT_OF_ORDER":
			return "bg-rose-100 text-rose-700";
		case "SUBMITTED":
			return "bg-emerald-100 text-emerald-700";
		default:
			return "bg-muted text-muted-foreground";
	}
}

export function formatRevisionLabel(revisionNumber: number): string {
	return `R${revisionNumber}`;
}

export function renderOptionalText(value: string | null | undefined): string {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : "-";
}
