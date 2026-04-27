import type { Inventory } from "@aria/types";

export type RequestedItemsToBeTransferredRow =
	Inventory.RequestedItemsToBeTransferredRow;
export type RequestedItemsToBeTransferredResult =
	Inventory.RequestedItemsToBeTransferredResult;

const QTY_FORMATTER = new Intl.NumberFormat("en-IN", {
	minimumFractionDigits: 0,
	maximumFractionDigits: 3,
});

export function formatQty(value: number): string {
	return QTY_FORMATTER.format(value);
}

export function formatDate(value: Date | string | null | undefined): string {
	if (value == null) {
		return "—";
	}

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "—";
	}

	return date.toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

export function formatPurpose(
	purpose: Inventory.RequestedItemsToBeTransferredPurpose,
): string {
	return purpose === "MATERIAL_TRANSFER"
		? "Material Transfer"
		: "Material Issue";
}

export interface RequestedItemsPendingChartEntry {
	label: string;
	qtyToTransfer: number;
	requestCount: number;
}

export function buildPendingItemChartData(
	rows: RequestedItemsToBeTransferredRow[],
	limit = 8,
): RequestedItemsPendingChartEntry[] {
	const aggregates = new Map<
		string,
		{ qtyToTransfer: number; requestIds: Set<string> }
	>();

	for (const row of rows) {
		const existing = aggregates.get(row.itemCode) ?? {
			qtyToTransfer: 0,
			requestIds: new Set<string>(),
		};

		existing.qtyToTransfer += row.qtyToTransfer;
		existing.requestIds.add(row.materialRequestId);
		aggregates.set(row.itemCode, existing);
	}

	return [...aggregates.entries()]
		.map(([label, value]) => ({
			label,
			qtyToTransfer: value.qtyToTransfer,
			requestCount: value.requestIds.size,
		}))
		.sort((left, right) => right.qtyToTransfer - left.qtyToTransfer)
		.slice(0, limit);
}
