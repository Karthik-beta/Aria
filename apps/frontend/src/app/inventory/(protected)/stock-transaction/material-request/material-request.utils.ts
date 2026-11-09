import type { Inventory } from "@aria/types";

export type MaterialRequestStatus = Inventory.MaterialRequestStatus;
export type MaterialRequestPurpose = Inventory.MaterialRequestPurpose;

export const MATERIAL_REQUEST_STATUS_OPTIONS: Array<{
	label: string;
	value: MaterialRequestStatus;
}> = [
	{ label: "Draft", value: "DRAFT" },
	{ label: "Pending", value: "PENDING" },
	{ label: "Approved", value: "APPROVED" },
	{ label: "Ordered", value: "ORDERED" },
	{ label: "Partially Ordered", value: "PARTIALLY_ORDERED" },
	{ label: "Partially Received", value: "PARTIALLY_RECEIVED" },
	{ label: "Received", value: "RECEIVED" },
	{ label: "Cancelled", value: "CANCELLED" },
];

export const MATERIAL_REQUEST_PURPOSE_OPTIONS: Array<{
	label: string;
	value: MaterialRequestPurpose;
}> = [
	{ label: "Purchase", value: "PURCHASE" },
	{ label: "Manufacture", value: "MANUFACTURE" },
	{ label: "Material Transfer", value: "MATERIAL_TRANSFER" },
	{ label: "Material Issue", value: "MATERIAL_ISSUE" },
	{ label: "Customer Provided", value: "CUSTOMER_PROVIDED" },
];

const STATUS_LABELS: Record<MaterialRequestStatus, string> = {
	DRAFT: "Draft",
	PENDING: "Pending",
	APPROVED: "Approved",
	ORDERED: "Ordered",
	PARTIALLY_ORDERED: "Partially Ordered",
	PARTIALLY_RECEIVED: "Partially Received",
	RECEIVED: "Received",
	CANCELLED: "Cancelled",
};

const STATUS_BADGE_CLASSES: Record<MaterialRequestStatus, string> = {
	DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
	PENDING:
		"bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
	APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	ORDERED: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
	PARTIALLY_ORDERED:
		"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
	PARTIALLY_RECEIVED:
		"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
	RECEIVED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const PURPOSE_LABELS: Record<MaterialRequestPurpose, string> = {
	PURCHASE: "Purchase",
	MANUFACTURE: "Manufacture",
	MATERIAL_TRANSFER: "Material Transfer",
	MATERIAL_ISSUE: "Material Issue",
	CUSTOMER_PROVIDED: "Customer Provided",
};

export function formatMaterialRequestStatus(
	status: MaterialRequestStatus,
): string {
	return STATUS_LABELS[status];
}

export function getMaterialRequestStatusBadgeClass(
	status: MaterialRequestStatus,
): string {
	return STATUS_BADGE_CLASSES[status];
}

export function formatMaterialRequestPurpose(
	purpose: MaterialRequestPurpose,
): string {
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
