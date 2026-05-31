import type { Inventory } from "@aria/types";

export type PurchaseReceiptStatus = Inventory.PurchaseReceiptStatus;

export const PURCHASE_RECEIPT_STATUS_OPTIONS: Array<{
	label: string;
	value: PurchaseReceiptStatus;
}> = [
	{ label: "Draft", value: "DRAFT" },
	{ label: "Partly Billed", value: "PARTLY_BILLED" },
	{ label: "To Bill", value: "TO_BILL" },
	{ label: "Completed", value: "COMPLETED" },
	{ label: "Return Issued", value: "RETURN_ISSUED" },
	{ label: "Cancelled", value: "CANCELLED" },
	{ label: "Closed", value: "CLOSED" },
];

const STATUS_LABELS: Record<PurchaseReceiptStatus, string> = {
	DRAFT: "Draft",
	PARTLY_BILLED: "Partly Billed",
	TO_BILL: "To Bill",
	COMPLETED: "Completed",
	RETURN_ISSUED: "Return Issued",
	CANCELLED: "Cancelled",
	CLOSED: "Closed",
};

const STATUS_BADGE_CLASSES: Record<PurchaseReceiptStatus, string> = {
	DRAFT: "bg-muted text-muted-foreground",
	PARTLY_BILLED:
		"bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
	TO_BILL:
		"bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
	COMPLETED:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
	RETURN_ISSUED:
		"bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
	CANCELLED: "bg-destructive/20 text-destructive",
	CLOSED:
		"bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
};

export function formatPurchaseReceiptStatus(
	status: PurchaseReceiptStatus,
): string {
	return STATUS_LABELS[status];
}

export function getPurchaseReceiptStatusBadgeClass(
	status: PurchaseReceiptStatus,
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

export function formatCurrency(
	value: number,
	currency?: string | null,
): string {
	const formatted = value.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
	return currency ? `${currency} ${formatted}` : formatted;
}

export function computeReturnedPercentage(
	totalAcceptedQuantity: number,
	totalRejectedQuantity: number,
): number {
	const totalAbsoluteQuantity =
		Math.abs(totalAcceptedQuantity) + Math.abs(totalRejectedQuantity);
	if (totalAbsoluteQuantity <= 0) {
		return 0;
	}
	return Math.round(
		(Math.abs(totalRejectedQuantity) / totalAbsoluteQuantity) * 100,
	);
}
