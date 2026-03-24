import type { Inventory } from "@aria/types";

export type WarehouseWiseStockBalanceCurrency = "INR" | "AED" | "USD" | "EUR";

export const WAREHOUSE_WISE_STOCK_BALANCE_CURRENCY_OPTIONS: Array<{
	label: string;
	value: WarehouseWiseStockBalanceCurrency;
}> = [
	{ label: "INR", value: "INR" },
	{ label: "AED", value: "AED" },
	{ label: "USD", value: "USD" },
	{ label: "EUR", value: "EUR" },
];

export type WarehouseWiseStockSortBy =
	| "LAST_UPDATED_ON"
	| "ID"
	| "CREATED_ON"
	| "MOST_USED"
	| "ITEM_CODE"
	| "WAREHOUSE"
	| "POSTING_DATE"
	| "VOUCHER_NO"
	| "QTY_CHANGE"
	| "INCOMING_RATE";

export const WAREHOUSE_WISE_STOCK_SORT_OPTIONS: Array<{
	label: string;
	value: WarehouseWiseStockSortBy;
}> = [
	{ label: "Last Updated On", value: "LAST_UPDATED_ON" },
	{ label: "ID", value: "ID" },
	{ label: "Created On", value: "CREATED_ON" },
	{ label: "Most Used", value: "MOST_USED" },
	{ label: "Item Code", value: "ITEM_CODE" },
	{ label: "Warehouse", value: "WAREHOUSE" },
	{ label: "Posting Date", value: "POSTING_DATE" },
	{ label: "Voucher No", value: "VOUCHER_NO" },
	{ label: "Qty Change", value: "QTY_CHANGE" },
	{ label: "Incoming Rate", value: "INCOMING_RATE" },
];

export type WarehouseWiseGroupByField = "itemCode" | "warehouse" | "company";

export const WAREHOUSE_WISE_GROUP_BY_OPTIONS: Array<{
	label: string;
	value: WarehouseWiseGroupByField;
}> = [
	{ label: "Item Code", value: "itemCode" },
	{ label: "Warehouse", value: "warehouse" },
	{ label: "Company", value: "company" },
];

export type WarehouseWiseGroupMetric = "count" | "qtyChange" | "incomingRate";

export const WAREHOUSE_WISE_GROUP_METRIC_OPTIONS: Array<{
	label: string;
	value: WarehouseWiseGroupMetric;
}> = [
	{ label: "Count", value: "count" },
	{ label: "Qty Change", value: "qtyChange" },
	{ label: "Incoming Rate", value: "incomingRate" },
];

export type WarehouseWiseFilterField =
	| "id"
	| "itemCode"
	| "warehouse"
	| "voucherNo"
	| "company"
	| "postingDate"
	| "qtyChange"
	| "incomingRate";

export const WAREHOUSE_WISE_FILTER_FIELD_OPTIONS: Array<{
	label: string;
	value: WarehouseWiseFilterField;
}> = [
	{ label: "ID", value: "id" },
	{ label: "Item Code", value: "itemCode" },
	{ label: "Warehouse", value: "warehouse" },
	{ label: "Voucher No", value: "voucherNo" },
	{ label: "Company", value: "company" },
	{ label: "Posting Date", value: "postingDate" },
	{ label: "Qty Change", value: "qtyChange" },
	{ label: "Incoming Rate", value: "incomingRate" },
];

export type WarehouseWiseFilterOperator =
	| "contains"
	| "equals"
	| "gt"
	| "gte"
	| "lt"
	| "lte";

export const WAREHOUSE_WISE_FILTER_OPERATOR_OPTIONS: Array<{
	label: string;
	value: WarehouseWiseFilterOperator;
}> = [
	{ label: "Contains", value: "contains" },
	{ label: "Equals", value: "equals" },
	{ label: "Greater Than", value: "gt" },
	{ label: "Greater Than or Equal", value: "gte" },
	{ label: "Less Than", value: "lt" },
	{ label: "Less Than or Equal", value: "lte" },
];

const CURRENCY_LOCALE: Record<WarehouseWiseStockBalanceCurrency, string> = {
	INR: "en-IN",
	AED: "en-AE",
	USD: "en-US",
	EUR: "en-IE",
};

export type WarehouseWiseStockBalanceRow =
	Inventory.WarehouseWiseStockBalanceRow;

export type WarehouseWiseFilterRule = {
	id: string;
	field: WarehouseWiseFilterField;
	operator: WarehouseWiseFilterOperator;
	value: string;
};

export type WarehouseWiseGroupRow = {
	kind: "group";
	id: string;
	groupBy: WarehouseWiseGroupByField;
	groupValue: string;
	count: number;
	totalQtyChange: number;
	averageIncomingRate: number;
};

export type WarehouseWiseDetailRow = WarehouseWiseStockBalanceRow & {
	kind: "detail";
};

export type WarehouseWiseDisplayRow =
	| WarehouseWiseDetailRow
	| WarehouseWiseGroupRow;

export function formatWarehouseWiseStockQuantity(value: number): string {
	return value.toLocaleString(undefined, {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
}

export function formatWarehouseWiseStockCurrency(
	value: number,
	currency: WarehouseWiseStockBalanceCurrency = "INR",
): string {
	return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

export function formatCompactDate(date: Date | null | undefined): string {
	if (!date) return "-";
	return new Intl.DateTimeFormat("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
}

export function formatOptionalText(value?: string | null): string {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : "-";
}

function normalizeText(value: string): string {
	return value.trim().toLowerCase();
}

function toComparableNumber(
	row: WarehouseWiseStockBalanceRow,
	field: WarehouseWiseFilterField,
): number | null {
	if (field === "qtyChange") return row.qtyChange;
	if (field === "incomingRate") return row.incomingRate;
	if (field === "postingDate") return row.postingDate.getTime();
	return null;
}

function toComparableText(
	row: WarehouseWiseStockBalanceRow,
	field: WarehouseWiseFilterField,
): string {
	switch (field) {
		case "id":
			return row.id;
		case "itemCode":
			return row.itemCode;
		case "warehouse":
			return row.warehouse;
		case "voucherNo":
			return row.voucherNo;
		case "company":
			return row.company;
		case "postingDate":
			return row.postingDate.toISOString();
		case "qtyChange":
			return String(row.qtyChange);
		case "incomingRate":
			return String(row.incomingRate);
		default:
			return "";
	}
}

function matchesRule(
	row: WarehouseWiseStockBalanceRow,
	rule: WarehouseWiseFilterRule,
): boolean {
	const value = rule.value.trim();
	if (value.length === 0) return true;

	if (["gt", "gte", "lt", "lte"].includes(rule.operator)) {
		const comparable = toComparableNumber(row, rule.field);
		const numericTarget = Number(value);
		if (comparable == null || Number.isNaN(numericTarget)) return false;
		if (rule.operator === "gt") return comparable > numericTarget;
		if (rule.operator === "gte") return comparable >= numericTarget;
		if (rule.operator === "lt") return comparable < numericTarget;
		return comparable <= numericTarget;
	}

	const rowText = normalizeText(toComparableText(row, rule.field));
	const filterText = normalizeText(value);

	if (rule.operator === "equals") return rowText === filterText;
	return rowText.includes(filterText);
}

export function applyWarehouseWiseFilterRules(
	rows: WarehouseWiseStockBalanceRow[],
	rules: WarehouseWiseFilterRule[],
): WarehouseWiseStockBalanceRow[] {
	if (rules.length === 0) return rows;
	return rows.filter((row) => rules.every((rule) => matchesRule(row, rule)));
}

export function sortWarehouseWiseRows(
	rows: WarehouseWiseStockBalanceRow[],
	sortBy: WarehouseWiseStockSortBy,
): WarehouseWiseStockBalanceRow[] {
	if (rows.length <= 1) return rows;

	const usageByItem = rows.reduce<Record<string, number>>((acc, row) => {
		acc[row.itemCode] = (acc[row.itemCode] ?? 0) + 1;
		return acc;
	}, {});

	const sorted = [...rows];
	sorted.sort((left, right) => {
		switch (sortBy) {
			case "LAST_UPDATED_ON":
				return right.updatedAt.getTime() - left.updatedAt.getTime();
			case "ID":
				return left.id.localeCompare(right.id);
			case "CREATED_ON":
				return right.createdAt.getTime() - left.createdAt.getTime();
			case "MOST_USED": {
				const usageDiff =
					(usageByItem[right.itemCode] ?? 0) -
					(usageByItem[left.itemCode] ?? 0);
				if (usageDiff !== 0) return usageDiff;
				return left.itemCode.localeCompare(right.itemCode);
			}
			case "ITEM_CODE":
				return left.itemCode.localeCompare(right.itemCode);
			case "WAREHOUSE":
				return left.warehouse.localeCompare(right.warehouse);
			case "POSTING_DATE":
				return right.postingDate.getTime() - left.postingDate.getTime();
			case "VOUCHER_NO":
				return left.voucherNo.localeCompare(right.voucherNo);
			case "QTY_CHANGE":
				return right.qtyChange - left.qtyChange;
			case "INCOMING_RATE":
				return right.incomingRate - left.incomingRate;
			default:
				return 0;
		}
	});

	return sorted;
}

export function groupWarehouseWiseRows(
	rows: WarehouseWiseStockBalanceRow[],
	groupBy: WarehouseWiseGroupByField,
): WarehouseWiseGroupRow[] {
	const grouped = new Map<
		string,
		{
			count: number;
			totalQtyChange: number;
			totalIncomingRate: number;
		}
	>();

	for (const row of rows) {
		const key = row[groupBy];
		const current = grouped.get(key) ?? {
			count: 0,
			totalQtyChange: 0,
			totalIncomingRate: 0,
		};

		current.count += 1;
		current.totalQtyChange += row.qtyChange;
		current.totalIncomingRate += row.incomingRate;
		grouped.set(key, current);
	}

	return [...grouped.entries()]
		.map(([groupValue, value]) => ({
			kind: "group" as const,
			id: `${groupBy}:${groupValue}`,
			groupBy,
			groupValue,
			count: value.count,
			totalQtyChange: value.totalQtyChange,
			averageIncomingRate:
				value.count === 0 ? 0 : value.totalIncomingRate / value.count,
		}))
		.sort((left, right) => {
			if (left.groupValue !== right.groupValue) {
				return left.groupValue.localeCompare(right.groupValue);
			}
			return right.count - left.count;
		});
}

export function toWarehouseWiseDetailRows(
	rows: WarehouseWiseStockBalanceRow[],
): WarehouseWiseDetailRow[] {
	return rows.map((row) => ({ ...row, kind: "detail" }));
}
