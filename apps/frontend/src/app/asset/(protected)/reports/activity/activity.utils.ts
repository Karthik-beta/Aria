import type { Asset } from "@aria/types";
import {
	addMonthsDateOnly,
	dateOnlyFromPersistedDateTime,
	normalizeDateOnly,
} from "@aria/types";
import { todayDateInputValue } from "@/lib/asset-date-only";

export type AssetActivityReportFilterState = {
	company: string;
	fromDate: string;
	toDate: string;
	asset: string;
	assetCategory: string;
	activity: string;
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

export function buildAssetActivityReportInput(
	filters: AssetActivityReportFilterState,
): Asset.ListAssetActivityReportInput {
	return {
		fromDate: normalizeDateOnly(filters.fromDate),
		toDate: normalizeDateOnly(filters.toDate),
		company: filters.company.trim() || undefined,
		asset: filters.asset.trim() || undefined,
		assetCategory: filters.assetCategory.trim() || undefined,
		activity: filters.activity.trim() || undefined,
	};
}

export function getDateRangeError(
	filters: Pick<AssetActivityReportFilterState, "fromDate" | "toDate">,
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

export function formatDateTime(
	value: Date | string | null | undefined,
): string {
	if (!value) {
		return "-";
	}

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}

	return date.toLocaleString("en-IN", {
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});
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
		case "SOLD":
			return "bg-indigo-100 text-indigo-700";
		case "SCRAPPED":
			return "bg-orange-100 text-orange-700";
		default:
			return "bg-muted text-muted-foreground";
	}
}

export function renderOptionalText(value: string | null | undefined): string {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : "-";
}
