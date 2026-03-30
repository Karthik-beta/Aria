import type { Inventory } from "@aria/types";

export type SubcontractedItemReceivedSourceRow = {
	id: string;
	subcontractingOrderId: string;
	subcontractOrder: string;
	date: Date;
	supplier: string;
	status: Inventory.SubcontractingOrderStatus;
	percentReceived: number;
	fgItemCode: string;
	itemName: string | null;
	qty: number;
	receivedQty: number;
};

export function buildSubcontractedItemReceivedRows(
	rows: SubcontractedItemReceivedSourceRow[],
): Inventory.SubcontractedItemToBeReceivedRow[] {
	return rows
		.map((row) => {
			if (row.status === "DRAFT" || row.status === "CANCELLED") {
				return null;
			}

			if (row.percentReceived >= 100) {
				return null;
			}

			const requiredQty = Math.max(row.qty, 0);
			const receivedQty = Math.max(row.receivedQty, 0);
			const pendingQty = Math.max(requiredQty - receivedQty, 0);

			if (pendingQty <= 0) {
				return null;
			}

			return {
				id: row.id,
				subcontractingOrderId: row.subcontractingOrderId,
				subcontractOrder: row.subcontractOrder,
				date: row.date,
				supplier: row.supplier,
				fgItemCode: row.fgItemCode,
				itemName: row.itemName,
				requiredQty,
				receivedQty,
				pendingQty,
			};
		})
		.filter((row): row is NonNullable<typeof row> => row != null)
		.sort((left, right) => {
			const dateDifference = left.date.getTime() - right.date.getTime();
			if (dateDifference !== 0) {
				return dateDifference;
			}

			const orderDifference = left.subcontractOrder.localeCompare(
				right.subcontractOrder,
			);
			if (orderDifference !== 0) {
				return orderDifference;
			}

			return left.fgItemCode.localeCompare(right.fgItemCode);
		});
}

export function summarizeSubcontractedItemReceivedRows(
	rows: Inventory.SubcontractedItemToBeReceivedRow[],
): Inventory.SubcontractedItemToBeReceivedSummary {
	const orderIds = new Set(rows.map((row) => row.subcontractingOrderId));

	return rows.reduce<Inventory.SubcontractedItemToBeReceivedSummary>(
		(summary, row) => {
			summary.totalRequiredQty += row.requiredQty;
			summary.totalReceivedQty += row.receivedQty;
			summary.totalPendingQty += row.pendingQty;
			return summary;
		},
		{
			orderCount: orderIds.size,
			rowCount: rows.length,
			totalRequiredQty: 0,
			totalReceivedQty: 0,
			totalPendingQty: 0,
		},
	);
}
