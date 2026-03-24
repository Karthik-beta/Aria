import type { Inventory } from "@aria/types";

export type DeliveryTripStatus = Inventory.DeliveryTripStatus;

export const DELIVERY_TRIP_STATUS_OPTIONS: Array<{
	label: string;
	value: DeliveryTripStatus;
}> = [
	{ label: "Draft", value: "DRAFT" },
	{ label: "Scheduled", value: "SCHEDULED" },
	{ label: "In Transit", value: "IN_TRANSIT" },
	{ label: "Completed", value: "COMPLETED" },
	{ label: "Cancelled", value: "CANCELLED" },
];

const STATUS_LABELS: Record<DeliveryTripStatus, string> = {
	DRAFT: "Draft",
	SCHEDULED: "Scheduled",
	IN_TRANSIT: "In Transit",
	COMPLETED: "Completed",
	CANCELLED: "Cancelled",
};

const STATUS_BADGE_CLASSES: Record<DeliveryTripStatus, string> = {
	DRAFT: "bg-muted text-muted-foreground",
	SCHEDULED:
		"bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
	IN_TRANSIT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	COMPLETED:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
	CANCELLED: "bg-destructive/20 text-destructive",
};

export function formatDeliveryTripStatus(status: DeliveryTripStatus): string {
	return STATUS_LABELS[status];
}

export function getDeliveryTripStatusBadgeClass(
	status: DeliveryTripStatus,
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

export function toDateTimeLocalInputValue(
	date: Date | string | undefined | null,
): string {
	if (!date) return "";
	const parsed = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(parsed.getTime())) return "";
	// format as "YYYY-MM-DDTHH:mm" for datetime-local input
	return parsed.toISOString().slice(0, 16);
}
