import type { Asset } from "@aria/types";
import { formatAssetDate } from "@/lib/asset-date-only";
import type { AssetValueAdjustmentFormValues } from "./value-adjustment.schema";

export const ASSET_VALUE_ADJUSTMENT_PAGE_SIZE = 20;

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
	style: "currency",
	currency: "INR",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

const STATUS_LABELS: Record<Asset.AssetValueAdjustmentStatus, string> = {
	DRAFT: "Draft",
	SUBMITTED: "Submitted",
	CANCELLED: "Cancelled",
};

const DIRECTION_LABELS: Record<Asset.AssetValueAdjustmentDirection, string> = {
	INCREASE: "Increase",
	DECREASE: "Decrease",
};

export function formatAdjustmentStatus(
	status: Asset.AssetValueAdjustmentStatus,
): string {
	return STATUS_LABELS[status] ?? status;
}

export function formatAdjustmentDirection(
	direction: Asset.AssetValueAdjustmentDirection,
): string {
	return DIRECTION_LABELS[direction] ?? direction;
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

export function getRelativeAge(date: Date): string {
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

export function buildAssetValueAdjustmentListInput(params: {
	search: string;
	pageIndex: number;
	pageSize: number;
}): NonNullable<Asset.ListAssetValueAdjustmentsInput> {
	return {
		skip: params.pageIndex * params.pageSize,
		take: params.pageSize,
		search: params.search.trim() || undefined,
	};
}

export function toCreateAssetValueAdjustmentInput(
	values: AssetValueAdjustmentFormValues,
): Asset.CreateAssetValueAdjustmentInput {
	return {
		assetId: values.assetId.trim(),
		financeBookId: values.financeBookId?.trim() || null,
		adjustmentDate: values.adjustmentDate,
		newAssetValue: Number(values.newAssetValue),
		differenceAccount: values.differenceAccount.trim(),
		costCenter: values.costCenter?.trim() || null,
		notes: values.notes?.trim() || null,
	};
}

export function toUpdateAssetValueAdjustmentInput(
	id: string,
	values: AssetValueAdjustmentFormValues,
): Asset.UpdateAssetValueAdjustmentInput {
	return {
		id,
		assetId: values.assetId.trim(),
		financeBookId: values.financeBookId?.trim() || null,
		adjustmentDate: values.adjustmentDate,
		newAssetValue: Number(values.newAssetValue),
		differenceAccount: values.differenceAccount.trim(),
		costCenter: values.costCenter?.trim() || null,
		notes: values.notes?.trim() || null,
	};
}

export function getAdjustmentStatusClassName(
	status: Asset.AssetValueAdjustmentStatus,
): string {
	switch (status) {
		case "SUBMITTED":
			return "bg-emerald-100 text-emerald-700";
		case "CANCELLED":
			return "bg-slate-200 text-slate-700";
		default:
			return "bg-amber-100 text-amber-700";
	}
}

export function getDirectionClassName(
	direction: Asset.AssetValueAdjustmentDirection,
): string {
	return direction === "INCREASE"
		? "bg-blue-100 text-blue-700"
		: "bg-rose-100 text-rose-700";
}
