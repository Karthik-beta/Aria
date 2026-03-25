import type { Inventory } from "@aria/types";
import type { SerialNoFormValues } from "./serial-no.schema";

export const SERIAL_NO_PAGE_SIZE = 25;

export function buildSerialNoListInput(params: {
	search: string;
	itemId: string;
	warehouseId: string;
	company: string;
	status: "all" | Inventory.SerialNoStatus;
	includeDisabled: boolean;
	pageIndex: number;
	pageSize: number;
	sortBy: Inventory.SerialNoSortBy;
	sortDirection: "asc" | "desc";
}): Inventory.ListSerialNosInput {
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

function toNullableString(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function toNullableDate(value: string): Date | null {
	if (!value) return null;
	return new Date(`${value}T00:00:00.000Z`);
}

export function toSerialNoMutationInput(values: SerialNoFormValues) {
	return {
		serialNo: values.serialNo.trim().toUpperCase(),
		itemId: values.itemId,
		company: values.company.trim(),
		status: values.status,
		currentWarehouseId: values.currentWarehouseId || null,
		purchaseReceiptId: values.purchaseReceiptId || null,
		deliveryNoteId: values.deliveryNoteId || null,
		stockEntryId: values.stockEntryId || null,
		pickListId: values.pickListId || null,
		workOrder: toNullableString(values.workOrder),
		purchaseDate: toNullableDate(values.purchaseDate),
		warrantyExpiryDate: toNullableDate(values.warrantyExpiryDate),
		serviceContractExpiryDate: toNullableDate(values.serviceContractExpiryDate),
		maintenanceStatus: toNullableString(values.maintenanceStatus),
		notes: toNullableString(values.notes),
		isDisabled: values.isDisabled,
	} satisfies Omit<Inventory.CreateSerialNoInput, "id">;
}

export function formatSerialNoStatus(status: Inventory.SerialNoStatus): string {
	switch (status) {
		case "DRAFT":
			return "Draft";
		case "AVAILABLE":
			return "Available";
		case "DELIVERED":
			return "Delivered";
		case "INSTALLED":
			return "Installed";
		case "RETURNED":
			return "Returned";
		case "SCRAPPED":
			return "Scrapped";
		case "DISPOSED":
			return "Disposed";
		default:
			return status;
	}
}

export function getSerialNoStatusBadgeClass(
	status: Inventory.SerialNoStatus,
): string {
	switch (status) {
		case "AVAILABLE":
			return "bg-emerald-100 text-emerald-700";
		case "DELIVERED":
			return "bg-sky-100 text-sky-700";
		case "INSTALLED":
			return "bg-violet-100 text-violet-700";
		case "RETURNED":
			return "bg-amber-100 text-amber-700";
		case "SCRAPPED":
		case "DISPOSED":
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
