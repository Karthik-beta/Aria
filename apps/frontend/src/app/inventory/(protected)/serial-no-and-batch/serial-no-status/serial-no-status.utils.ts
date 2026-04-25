import type { Inventory } from "@aria/types";

export const SERIAL_NO_STATUS_QUERY_LIMIT = 250;

export type SerialNoStatusGroupByField =
	| "status"
	| "itemCode"
	| "warehouse"
	| "company";

export const SERIAL_NO_STATUS_GROUP_BY_OPTIONS: Array<{
	label: string;
	value: SerialNoStatusGroupByField;
}> = [
	{ label: "Status", value: "status" },
	{ label: "Item Code", value: "itemCode" },
	{ label: "Warehouse", value: "warehouse" },
	{ label: "Company", value: "company" },
];

export type SerialNoStatusGroupMetric =
	| "count"
	| "disabledCount"
	| "averageDaysInCurrentStatus";

export const SERIAL_NO_STATUS_GROUP_METRIC_OPTIONS: Array<{
	label: string;
	value: SerialNoStatusGroupMetric;
}> = [
	{ label: "Count", value: "count" },
	{ label: "Disabled Count", value: "disabledCount" },
	{
		label: "Avg Days In Status",
		value: "averageDaysInCurrentStatus",
	},
];

export type SerialNoStatusDetailRow = Inventory.SerialNoStatusRow & {
	kind: "detail";
};

export type SerialNoStatusGroupRow = {
	kind: "group";
	id: string;
	groupBy: SerialNoStatusGroupByField;
	groupValue: string;
	count: number;
	disabledCount: number;
	averageDaysInCurrentStatus: number;
};

export type SerialNoStatusDisplayRow =
	| SerialNoStatusDetailRow
	| SerialNoStatusGroupRow;

export function buildSerialNoStatusListInput(params: {
	search: string;
	itemId: string;
	warehouseId: string;
	company: string;
	status: "all" | Inventory.SerialNoStatus;
	includeDisabled: boolean;
	sortBy: Inventory.SerialNoStatusSortBy;
	sortDirection: "asc" | "desc";
}): Inventory.ListSerialNoStatusInput {
	return {
		skip: 0,
		take: SERIAL_NO_STATUS_QUERY_LIMIT,
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

export function formatDaysInCurrentStatus(days: number): string {
	if (days <= 0) {
		return "Today";
	}

	return `${days} d`;
}

function resolveGroupValue(
	row: Inventory.SerialNoStatusRow,
	groupBy: SerialNoStatusGroupByField,
): string {
	switch (groupBy) {
		case "status":
			return row.status;
		case "itemCode":
			return row.itemCode;
		case "warehouse":
			return row.currentWarehouseName ?? "Unassigned";
		case "company":
			return row.company;
		default:
			return row.status;
	}
}

export function toSerialNoStatusDetailRows(
	rows: Inventory.SerialNoStatusRow[],
): SerialNoStatusDetailRow[] {
	return rows.map((row) => ({
		...row,
		kind: "detail",
	}));
}

export function groupSerialNoStatusRows(
	rows: Inventory.SerialNoStatusRow[],
	groupBy: SerialNoStatusGroupByField,
): SerialNoStatusGroupRow[] {
	const groups = new Map<
		string,
		{
			groupValue: string;
			count: number;
			disabledCount: number;
			totalDaysInCurrentStatus: number;
		}
	>();

	for (const row of rows) {
		const groupValue = resolveGroupValue(row, groupBy);
		const key = `${groupBy}:${groupValue}`;
		const existing = groups.get(key);

		if (existing) {
			existing.count += 1;
			existing.disabledCount += row.isDisabled ? 1 : 0;
			existing.totalDaysInCurrentStatus += row.daysInCurrentStatus;
			continue;
		}

		groups.set(key, {
			groupValue,
			count: 1,
			disabledCount: row.isDisabled ? 1 : 0,
			totalDaysInCurrentStatus: row.daysInCurrentStatus,
		});
	}

	return [...groups.entries()]
		.map(([id, group]) => ({
			kind: "group" as const,
			id,
			groupBy,
			groupValue: group.groupValue,
			count: group.count,
			disabledCount: group.disabledCount,
			averageDaysInCurrentStatus:
				group.count === 0 ? 0 : group.totalDaysInCurrentStatus / group.count,
		}))
		.sort((left, right) => left.groupValue.localeCompare(right.groupValue));
}
