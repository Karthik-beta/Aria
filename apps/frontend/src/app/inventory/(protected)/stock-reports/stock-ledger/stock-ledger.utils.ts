import type { Inventory } from "@aria/types";

export type StockLedgerStatus = Inventory.StockEntryStatus;
export type StockLedgerType = Inventory.StockEntryType;
export type StockLedgerMovementType = Inventory.StockLedgerRow["movementType"];
export type StockLedgerCurrency = "INR" | "AED" | "USD" | "EUR";

export const STOCK_LEDGER_CURRENCY_OPTIONS: Array<{
	label: string;
	value: StockLedgerCurrency;
}> = [
	{ label: "INR", value: "INR" },
	{ label: "AED", value: "AED" },
	{ label: "USD", value: "USD" },
	{ label: "EUR", value: "EUR" },
];

export const STOCK_LEDGER_STATUS_OPTIONS: Array<{
	label: string;
	value: StockLedgerStatus;
}> = [
	{ label: "Draft", value: "DRAFT" },
	{ label: "Submitted", value: "SUBMITTED" },
	{ label: "Cancelled", value: "CANCELLED" },
];

export const STOCK_LEDGER_TYPE_OPTIONS: Array<{
	label: string;
	value: StockLedgerType;
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

const STATUS_LABELS: Record<StockLedgerStatus, string> = {
	DRAFT: "Draft",
	SUBMITTED: "Submitted",
	CANCELLED: "Cancelled",
};

const STATUS_BADGE_CLASSES: Record<StockLedgerStatus, string> = {
	DRAFT: "bg-muted text-muted-foreground",
	SUBMITTED:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
	CANCELLED: "bg-destructive/20 text-destructive",
};

const TYPE_LABELS: Record<StockLedgerType, string> = {
	MATERIAL_RECEIPT: "Material Receipt",
	MATERIAL_ISSUE: "Material Issue",
	MATERIAL_TRANSFER: "Material Transfer",
	MATERIAL_TRANSFER_FOR_MANUFACTURE: "Material Transfer for Manufacture",
	MANUFACTURE: "Manufacture",
	REPACK: "Repack",
	SEND_TO_SUBCONTRACTOR: "Send to Subcontractor",
};

const MOVEMENT_LABELS: Record<StockLedgerMovementType, string> = {
	IN: "Inward",
	OUT: "Outward",
};

const MOVEMENT_BADGE_CLASSES: Record<StockLedgerMovementType, string> = {
	IN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
	OUT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export function formatStockLedgerStatus(status: StockLedgerStatus): string {
	return STATUS_LABELS[status];
}

export function getStockLedgerStatusBadgeClass(
	status: StockLedgerStatus,
): string {
	return STATUS_BADGE_CLASSES[status];
}

export function formatStockLedgerType(type: StockLedgerType): string {
	return TYPE_LABELS[type];
}

export function formatStockLedgerMovement(
	movement: StockLedgerMovementType,
): string {
	return MOVEMENT_LABELS[movement];
}

export function getStockLedgerMovementBadgeClass(
	movement: StockLedgerMovementType,
): string {
	return MOVEMENT_BADGE_CLASSES[movement];
}

export function formatCompactDate(date: Date): string {
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
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

export function formatLedgerQuantity(value: number): string {
	return value.toLocaleString(undefined, {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
}

const CURRENCY_LOCALE: Record<StockLedgerCurrency, string> = {
	INR: "en-IN",
	AED: "en-AE",
	USD: "en-US",
	EUR: "en-IE",
};

export function formatLedgerCurrency(
	value: number,
	currency: StockLedgerCurrency = "INR",
): string {
	return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

export function toDateInputValue(
	date: Date | string | undefined | null,
): string {
	if (!date) return "";
	const parsed = date instanceof Date ? date : new Date(date);
	if (Number.isNaN(parsed.getTime())) return "";
	return parsed.toISOString().split("T")[0] ?? "";
}
