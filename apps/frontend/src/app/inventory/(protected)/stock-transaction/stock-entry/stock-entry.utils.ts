import type { Inventory } from "@aria/types";

export type StockEntryType = Inventory.StockEntryType;
export type StockEntryStatus = Inventory.StockEntryStatus;

export const STOCK_ENTRY_TYPE_OPTIONS: Array<{
	label: string;
	value: StockEntryType;
}> = [
	{ label: "Material Receipt", value: "MATERIAL_RECEIPT" },
	{ label: "Material Issue", value: "MATERIAL_ISSUE" },
	{ label: "Material Transfer", value: "MATERIAL_TRANSFER" },
	{
		label: "Material Transfer for Manufacture",
		value: "MATERIAL_TRANSFER_FOR_MANUFACTURE",
	},
	{ label: "Manufacture", value: "MANUFACTURE" },
	{ label: "Repack", value: "REPACK" },
	{ label: "Send to Subcontractor", value: "SEND_TO_SUBCONTRACTOR" },
];

export const STOCK_ENTRY_STATUS_OPTIONS: Array<{
	label: string;
	value: StockEntryStatus;
}> = [
	{ label: "Draft", value: "DRAFT" },
	{ label: "Submitted", value: "SUBMITTED" },
	{ label: "Cancelled", value: "CANCELLED" },
];

const TYPE_LABELS: Record<StockEntryType, string> = {
	MATERIAL_RECEIPT: "Material Receipt",
	MATERIAL_ISSUE: "Material Issue",
	MATERIAL_TRANSFER: "Material Transfer",
	MATERIAL_TRANSFER_FOR_MANUFACTURE: "Material Transfer for Manufacture",
	MANUFACTURE: "Manufacture",
	REPACK: "Repack",
	SEND_TO_SUBCONTRACTOR: "Send to Subcontractor",
};

const STATUS_LABELS: Record<StockEntryStatus, string> = {
	DRAFT: "Draft",
	SUBMITTED: "Submitted",
	CANCELLED: "Cancelled",
};

const STATUS_BADGE_CLASSES: Record<StockEntryStatus, string> = {
	DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
	SUBMITTED:
		"bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export function formatStockEntryType(type: StockEntryType): string {
	return TYPE_LABELS[type];
}

export function formatStockEntryStatus(status: StockEntryStatus): string {
	return STATUS_LABELS[status];
}

export function getStockEntryStatusBadgeClass(
	status: StockEntryStatus,
): string {
	return STATUS_BADGE_CLASSES[status];
}

export function formatRelativeAge(date: Date): string {
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

export function toDateInputValue(
	date: Date | string | undefined | null,
): string {
	if (!date) return "";
	const parsed = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(parsed.getTime())) return "";
	return parsed.toISOString().split("T")[0] ?? "";
}
