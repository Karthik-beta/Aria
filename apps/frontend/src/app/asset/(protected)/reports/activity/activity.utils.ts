import type { Asset } from "@aria/types";

export type AssetActivityReportFilterState = {
	company: string;
	fromDate: string;
	toDate: string;
	asset: string;
	assetCategory: string;
	activity: string;
};

function toDateInputValue(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function parseDateField(value: string, endOfDay = false): Date {
	return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
}

function titleCaseSegments(value: string): string {
	return value
		.toLowerCase()
		.split(" ")
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

export function getDefaultFromDate(): string {
	const date = new Date();
	date.setMonth(date.getMonth() - 1);

	return toDateInputValue(date);
}

export function getDefaultToDate(): string {
	return toDateInputValue(new Date());
}

export function buildAssetActivityReportInput(
	filters: AssetActivityReportFilterState,
): Asset.ListAssetActivityReportInput {
	return {
		fromDate: parseDateField(filters.fromDate),
		toDate: parseDateField(filters.toDate, true),
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
