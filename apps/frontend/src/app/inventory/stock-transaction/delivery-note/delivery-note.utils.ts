import type { Inventory } from "@aria/types";

export type DeliveryNoteStatus = Inventory.DeliveryNoteStatus;

export const DELIVERY_NOTE_STATUS_OPTIONS: Array<{
	label: string;
	value: DeliveryNoteStatus;
}> = [
	{ label: "Draft", value: "DRAFT" },
	{ label: "To Bill", value: "TO_BILL" },
	{ label: "Completed", value: "COMPLETED" },
	{ label: "Return Issued", value: "RETURN_ISSUED" },
	{ label: "Cancelled", value: "CANCELLED" },
	{ label: "Closed", value: "CLOSED" },
];

const STATUS_LABELS: Record<DeliveryNoteStatus, string> = {
	DRAFT: "Draft",
	TO_BILL: "To Bill",
	COMPLETED: "Completed",
	RETURN_ISSUED: "Return Issued",
	CANCELLED: "Cancelled",
	CLOSED: "Closed",
};

const STATUS_BADGE_CLASSES: Record<DeliveryNoteStatus, string> = {
	DRAFT: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
	TO_BILL: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
	COMPLETED:
		"bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
	RETURN_ISSUED:
		"bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
	CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
	CLOSED:
		"bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export function formatDeliveryNoteStatus(status: DeliveryNoteStatus): string {
	return STATUS_LABELS[status];
}

export function getDeliveryNoteStatusBadgeClass(
	status: DeliveryNoteStatus,
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
