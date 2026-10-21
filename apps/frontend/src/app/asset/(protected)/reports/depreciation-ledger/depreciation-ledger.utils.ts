import type { Asset } from "@aria/types";
import { formatDateOnly } from "@/lib/date-only";

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

export function buildAssetDepreciationLedgerInput(
	filters: AssetDepreciationLedgerFilterState,
): Asset.ListAssetDepreciationLedgerInput {
	return {
		fromDate: parseDateField(filters.fromDate),
		toDate: parseDateField(filters.toDate, true),
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

export function formatDate(value: Date | string | null | undefined): string {
	return formatDateOnly(value);
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
