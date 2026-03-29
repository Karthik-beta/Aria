import type { Inventory } from "@aria/types";

export type RequestedItemsToBeTransferredSourceRow = {
	id: string;
	materialRequestId: string;
	materialRequest: string;
	date: Date;
	purpose: Inventory.MaterialRequestPurpose;
	status: Inventory.MaterialRequestStatus;
	itemCode: string;
	itemName?: string | null;
	description?: string | null;
	company: string;
	targetWarehouse?: string | null;
	requiredBy?: Date | null;
	unitOfMeasure?: string | null;
	qty: number;
	transferredQty?: number | null;
};

function isTransferReportPurpose(
	purpose: Inventory.MaterialRequestPurpose,
): purpose is Inventory.RequestedItemsToBeTransferredPurpose {
	return purpose === "MATERIAL_TRANSFER" || purpose === "MATERIAL_ISSUE";
}

export function buildRequestedItemsToBeTransferredRows(
	rows: RequestedItemsToBeTransferredSourceRow[],
): Inventory.RequestedItemsToBeTransferredRow[] {
	return rows
		.map((row) => {
			if (!isTransferReportPurpose(row.purpose)) {
				return null;
			}

			if (row.status === "DRAFT" || row.status === "CANCELLED") {
				return null;
			}

			const qty = Math.max(row.qty, 0);
			const transferredQty = Math.max(row.transferredQty ?? 0, 0);
			const qtyToTransfer = Math.max(qty - transferredQty, 0);

			if (qtyToTransfer <= 0) {
				return null;
			}

			return {
				id: row.id,
				materialRequestId: row.materialRequestId,
				materialRequest: row.materialRequest,
				date: row.date,
				purpose: row.purpose,
				status: row.status,
				itemCode: row.itemCode,
				itemName: row.itemName ?? null,
				description: row.description ?? null,
				company: row.company,
				targetWarehouse: row.targetWarehouse ?? null,
				requiredBy: row.requiredBy ?? null,
				unitOfMeasure: row.unitOfMeasure ?? null,
				qty,
				transferredQty,
				qtyToTransfer,
			};
		})
		.filter((row): row is NonNullable<typeof row> => row != null)
		.sort((left, right) => {
			const dateDifference = left.date.getTime() - right.date.getTime();
			if (dateDifference !== 0) {
				return dateDifference;
			}

			const requestDifference = left.materialRequest.localeCompare(
				right.materialRequest,
			);
			if (requestDifference !== 0) {
				return requestDifference;
			}

			return left.itemCode.localeCompare(right.itemCode);
		});
}

export function summarizeRequestedItemsToBeTransferredRows(
	rows: Inventory.RequestedItemsToBeTransferredRow[],
): Inventory.RequestedItemsToBeTransferredSummary {
	const requestIds = new Set(rows.map((row) => row.materialRequestId));

	return rows.reduce<Inventory.RequestedItemsToBeTransferredSummary>(
		(summary, row) => {
			summary.totalQty += row.qty;
			summary.totalTransferredQty += row.transferredQty;
			summary.totalQtyToTransfer += row.qtyToTransfer;
			if (row.purpose === "MATERIAL_TRANSFER") {
				summary.transferRowCount += 1;
			} else {
				summary.issueRowCount += 1;
			}
			return summary;
		},
		{
			requestCount: requestIds.size,
			rowCount: rows.length,
			totalQty: 0,
			totalTransferredQty: 0,
			totalQtyToTransfer: 0,
			transferRowCount: 0,
			issueRowCount: 0,
		},
	);
}
