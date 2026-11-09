import type { Inventory } from "@aria/types";
import type { BatchFormValues } from "./batch.schema";

export const BATCH_PAGE_SIZE = 25;

export function buildBatchListInput(params: {
	search: string;
	itemId: string;
	warehouseId: string;
	company: string;
	status: "all" | Inventory.BatchStatus;
	includeDisabled: boolean;
	pageIndex: number;
	pageSize: number;
	sortBy: Inventory.BatchSortBy;
	sortDirection: "asc" | "desc";
}): Inventory.ListBatchesInput {
	return {
		skip: Math.max(0, params.pageIndex) * params.pageSize,
		take: params.pageSize,
		search: params.search.trim() || undefined,
		itemId: params.itemId || undefined,
		warehouseId: params.warehouseId || undefined,
		company: params.company.trim() || undefined,
		status: params.status === "all" ? undefined : params.status,
		includeDisabled: params.includeDisabled,
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	};
}

export function toDateInputValue(value?: Date | string | null): string {
	if (!value) return "";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}

function toNullableString(value: string | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function toNullableDate(value: string | undefined): Date | null {
	if (!value) return null;
	return new Date(`${value}T00:00:00.000Z`);
}

export function toBatchMutationInput(values: BatchFormValues) {
	return {
		batchId: values.batchId.trim().toUpperCase(),
		itemId: values.itemId,
		company: values.company.trim(),
		currentWarehouseId: values.currentWarehouseId || null,
		purchaseReceiptId: values.purchaseReceiptId || null,
		deliveryNoteId: values.deliveryNoteId || null,
		stockEntryId: values.stockEntryId || null,
		useBatchWiseValuation: values.useBatchWiseValuation,
		manufacturingDate: toNullableDate(values.manufacturingDate),
		expiryDate: toNullableDate(values.expiryDate),
		description: toNullableString(values.description),
		quantity: values.quantity,
		isDisabled: values.isDisabled,
	} satisfies Omit<Inventory.CreateBatchInput, "id">;
}

export function formatBatchStatus(status: Inventory.BatchStatus): string {
	switch (status) {
		case "ACTIVE":
			return "Active";
		case "EMPTY":
			return "Empty";
		case "EXPIRED":
			return "Expired";
		case "DISABLED":
			return "Disabled";
		default:
			return status;
	}
}

export function getBatchStatusBadgeClass(
	status: Inventory.BatchStatus,
): string {
	switch (status) {
		case "ACTIVE":
			return "bg-emerald-100 text-emerald-700";
		case "EMPTY":
			return "bg-slate-100 text-slate-700";
		case "EXPIRED":
			return "bg-amber-100 text-amber-700";
		case "DISABLED":
			return "bg-rose-100 text-rose-700";
		default:
			return "bg-muted text-muted-foreground";
	}
}

export function formatRelativeAge(date: Date): string {
	const now = Date.now();
	const diffMs = Math.max(0, now - date.getTime());
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffYears >= 1) return `${diffYears} y`;
	if (diffMonths >= 1) return `${diffMonths} m`;
	if (diffDays >= 1) return `${diffDays} d`;
	return "Today";
}

export function formatBatchDate(value?: Date | string | null): string {
	if (!value) return "No expiry";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "No expiry";
	return date.toLocaleDateString();
}
