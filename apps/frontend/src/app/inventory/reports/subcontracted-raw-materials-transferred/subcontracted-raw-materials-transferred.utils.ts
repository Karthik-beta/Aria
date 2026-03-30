import type { Inventory } from "@aria/types";

export type SubcontractedRawMaterialsRow =
	Inventory.SubcontractedRawMaterialsRow;
export type SubcontractedRawMaterialsResult =
	Inventory.SubcontractedRawMaterialsResult;

export function getDefaultFromDate(): string {
	const d = new Date();
	d.setUTCMonth(d.getUTCMonth() - 1);
	return d.toISOString().slice(0, 10);
}

export function getDefaultToDate(): string {
	return new Date().toISOString().slice(0, 10);
}

export function formatQty(value: number): string {
	const rounded = Number.parseFloat(value.toFixed(3));
	return rounded.toLocaleString(undefined, {
		minimumFractionDigits: 0,
		maximumFractionDigits: 3,
	});
}

export function formatDate(value: Date | string | null | undefined): string {
	if (value == null) {
		return "—";
	}

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "—";
	}

	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "2-digit",
	});
}

export interface PendingMaterialChartEntry {
	label: string;
	pendingQty: number;
	orderCount: number;
}

export function buildPendingMaterialChartData(
	rows: SubcontractedRawMaterialsRow[],
	limit = 8,
): PendingMaterialChartEntry[] {
	const aggregates = new Map<
		string,
		{ pendingQty: number; orderIds: Set<string> }
	>();

	for (const row of rows) {
		const existing = aggregates.get(row.rmItemCode) ?? {
			pendingQty: 0,
			orderIds: new Set<string>(),
		};

		existing.pendingQty += row.pendingQty;
		existing.orderIds.add(row.subcontractingOrderId);
		aggregates.set(row.rmItemCode, existing);
	}

	return [...aggregates.entries()]
		.map(([label, value]) => ({
			label,
			pendingQty: value.pendingQty,
			orderCount: value.orderIds.size,
		}))
		.sort((left, right) => right.pendingQty - left.pendingQty)
		.slice(0, limit);
}
