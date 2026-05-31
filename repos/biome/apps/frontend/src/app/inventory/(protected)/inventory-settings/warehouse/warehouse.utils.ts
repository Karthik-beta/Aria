import type { Inventory } from "@aria/types";
import type { WarehouseFormValues } from "./warehouse.schema";

export const WAREHOUSE_PAGE_SIZE = 20;

export function getWarehouseStatusLabel(disabled: boolean): string {
	return disabled ? "Disabled" : "Enabled";
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

function sanitizeOptionalText(value?: string | null): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

export function buildWarehouseListInput(params: {
	search: string;
	company: string;
	status: "all" | "enabled" | "disabled";
	group: "all" | "group" | "leaf";
	pageIndex: number;
	pageSize: number;
}): Inventory.ListWarehousesInput {
	return {
		skip: params.pageIndex * params.pageSize,
		take: params.pageSize,
		search: params.search.trim() || undefined,
		company: params.company.trim() || undefined,
		disabled:
			params.status === "all" ? undefined : params.status === "disabled",
		isGroupWarehouse:
			params.group === "all" ? undefined : params.group === "group",
	};
}

export function toWarehouseMutationInput(values: WarehouseFormValues) {
	return {
		name: values.name.trim(),
		disabled: values.disabled,
		isGroupWarehouse: values.isGroupWarehouse,
		parentWarehouseId: values.parentWarehouseId || null,
		company: values.company.trim(),
		isRejectedWarehouse: values.isRejectedWarehouse,
		phoneNo: sanitizeOptionalText(values.phoneNo),
		mobileNo: sanitizeOptionalText(values.mobileNo),
		addressLine1: sanitizeOptionalText(values.addressLine1),
		addressLine2: sanitizeOptionalText(values.addressLine2),
		city: sanitizeOptionalText(values.city),
		state: sanitizeOptionalText(values.state),
		pin: sanitizeOptionalText(values.pin),
		warehouseType: sanitizeOptionalText(values.warehouseType),
		defaultInTransitWarehouseId: values.defaultInTransitWarehouseId || null,
	};
}
