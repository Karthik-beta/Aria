import type { Inventory } from "@aria/types";

export type PickListStatus = Inventory.PickListStatus;
export type PickListPurpose = Inventory.PickListPurpose;

export const PICK_LIST_STATUS_OPTIONS: Array<{
	label: string;
	value: PickListStatus;
}> = [
	{ label: "Draft", value: "DRAFT" },
	{ label: "Open", value: "OPEN" },
	{ label: "Completed", value: "COMPLETED" },
	{ label: "Cancelled", value: "CANCELLED" },
];

export const PICK_LIST_PURPOSE_OPTIONS: Array<{
	label: string;
	value: PickListPurpose;
}> = [
	{
		label: "Material Transfer for Manufacture",
		value: "MATERIAL_TRANSFER_FOR_MANUFACTURE",
	},
	{ label: "Delivery", value: "DELIVERY" },
	{ label: "Material Transfer", value: "MATERIAL_TRANSFER" },
];

const STATUS_LABELS: Record<PickListStatus, string> = {
	DRAFT: "Draft",
	OPEN: "Open",
	COMPLETED: "Completed",
	CANCELLED: "Cancelled",
};

const STATUS_BADGE_CLASSES: Record<PickListStatus, string> = {
	DRAFT: "bg-muted text-muted-foreground",
	OPEN: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
	COMPLETED:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
	CANCELLED: "bg-destructive/20 text-destructive",
};

const PURPOSE_LABELS: Record<PickListPurpose, string> = {
	MATERIAL_TRANSFER_FOR_MANUFACTURE: "Material Transfer for Manufacture",
	DELIVERY: "Delivery",
	MATERIAL_TRANSFER: "Material Transfer",
};

export function formatPickListStatus(status: PickListStatus): string {
	return STATUS_LABELS[status];
}

export function getPickListStatusBadgeClass(status: PickListStatus): string {
	return STATUS_BADGE_CLASSES[status];
}

export function formatPickListPurpose(purpose: PickListPurpose): string {
	return PURPOSE_LABELS[purpose];
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
