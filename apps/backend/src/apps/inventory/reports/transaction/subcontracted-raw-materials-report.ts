import type { Inventory } from "@aria/types";

export type SubcontractedRawMaterialsSourceRow = {
	id: string;
	subcontractingOrderId: string;
	subcontractOrder: string;
	date: Date;
	supplier: string;
	status: Inventory.SubcontractingOrderStatus;
	percentReceived: number;
	rmItemCode: string;
	rmItemName?: string | null;
	requiredQty: number;
	suppliedQty: number;
	returnedQty: number;
};

export function buildSubcontractedRawMaterialsRows(
	rows: SubcontractedRawMaterialsSourceRow[],
): Inventory.SubcontractedRawMaterialsRow[] {
	return rows
		.map((row) => {
			if (row.status === "DRAFT" || row.status === "CANCELLED") {
				return null;
			}

			if (row.percentReceived >= 100) {
				return null;
			}

			const requiredQty = Math.max(row.requiredQty, 0);
			const suppliedQty = Math.max(row.suppliedQty, 0);
			const returnedQty = Math.max(row.returnedQty, 0);
			const transferredQty = Math.max(suppliedQty - returnedQty, 0);
			const pendingQty = Math.max(requiredQty - transferredQty, 0);

			if (pendingQty <= 0) {
				return null;
			}

			return {
				id: row.id,
				subcontractingOrderId: row.subcontractingOrderId,
				subcontractOrder: row.subcontractOrder,
				date: row.date,
				supplier: row.supplier,
				rmItemCode: row.rmItemCode,
				rmItemName: row.rmItemName ?? null,
				requiredQty,
				transferredQty,
				returnedQty,
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

			return left.rmItemCode.localeCompare(right.rmItemCode);
		});
}

export function summarizeSubcontractedRawMaterialsRows(
	rows: Inventory.SubcontractedRawMaterialsRow[],
): Inventory.SubcontractedRawMaterialsSummary {
	const orderIds = new Set(rows.map((row) => row.subcontractingOrderId));

	return rows.reduce<Inventory.SubcontractedRawMaterialsSummary>(
		(summary, row) => {
			summary.totalRequiredQty += row.requiredQty;
			summary.totalTransferredQty += row.transferredQty;
			summary.totalReturnedQty += row.returnedQty;
			summary.totalPendingQty += row.pendingQty;
			return summary;
		},
		{
			orderCount: orderIds.size,
			rowCount: rows.length,
			totalRequiredQty: 0,
			totalTransferredQty: 0,
			totalReturnedQty: 0,
			totalPendingQty: 0,
		},
	);
}
