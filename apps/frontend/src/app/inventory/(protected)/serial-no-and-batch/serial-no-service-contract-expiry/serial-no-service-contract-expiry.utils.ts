import type { Inventory } from "@aria/types";

export const SERIAL_NO_SERVICE_CONTRACT_EXPIRY_PAGE_SIZE = 20;

export function buildSerialNoServiceContractExpiryListInput(params: {
	search: string;
	itemId: string;
	warehouseId: string;
	company: string;
	status: "all" | Inventory.SerialNoStatus;
	expiryState: "all" | Inventory.SerialNoServiceContractExpiryState;
	includeDisabled: boolean;
	expiryDateFrom: string;
	expiryDateTo: string;
	expiringWithinDays: string;
	pageIndex: number;
	pageSize: number;
	sortBy: Inventory.SerialNoServiceContractExpirySortBy;
	sortDirection: "asc" | "desc";
}): Inventory.ListSerialNoServiceContractExpiryInput {
	const expiringWithinDays = Number.parseInt(params.expiringWithinDays, 10);

	return {
		skip: Math.max(0, params.pageIndex) * params.pageSize,
		take: params.pageSize,
		search: params.search.trim() || undefined,
		itemId: params.itemId || undefined,
		warehouseId: params.warehouseId || undefined,
		company: params.company.trim() || undefined,
		status: params.status === "all" ? undefined : params.status,
		expiryState: params.expiryState === "all" ? undefined : params.expiryState,
		includeDisabled: params.includeDisabled,
		expiryDateFrom: params.expiryDateFrom
			? new Date(`${params.expiryDateFrom}T00:00:00.000Z`)
			: undefined,
		expiryDateTo: params.expiryDateTo
			? new Date(`${params.expiryDateTo}T00:00:00.000Z`)
			: undefined,
		expiringWithinDays:
			Number.isFinite(expiringWithinDays) && expiringWithinDays >= 0
				? expiringWithinDays
				: undefined,
		sortBy: params.sortBy,
		sortDirection: params.sortDirection,
	};
}

export function formatSerialNoServiceContractExpiryState(
	state: Inventory.SerialNoServiceContractExpiryState,
): string {
	switch (state) {
		case "EXPIRED":
			return "Expired";
		case "DUE_SOON":
			return "Due Soon";
		case "ACTIVE":
			return "Active";
		default:
			return state;
	}
}

export function getSerialNoServiceContractExpiryStateBadgeClass(
	state: Inventory.SerialNoServiceContractExpiryState,
): string {
	switch (state) {
		case "EXPIRED":
			return "bg-rose-100 text-rose-700";
		case "DUE_SOON":
			return "bg-amber-100 text-amber-700";
		case "ACTIVE":
			return "bg-emerald-100 text-emerald-700";
		default:
			return "bg-muted text-muted-foreground";
	}
}

export function formatDaysUntilExpiry(daysUntilExpiry: number): string {
	if (daysUntilExpiry < 0) {
		return `${Math.abs(daysUntilExpiry)} d overdue`;
	}

	if (daysUntilExpiry === 0) {
		return "Due today";
	}

	return `${daysUntilExpiry} d left`;
}

export function formatCompactDate(value: Date | null | undefined): string {
	if (!value) {
		return "Not set";
	}

	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	}).format(value);
}
