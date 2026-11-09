import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Input data shapes — mirror the Prisma query select shapes in the service
// ---------------------------------------------------------------------------

/** Shape of the purchase order header row returned by the Prisma query. */
export interface PurchaseOrderAnalysisOrderInput {
	id: string;
	series: string;
	transactionDate: Date;
	supplier: string;
	company: string;
	/** Matches the Prisma PurchaseOrderStatus enum value. */
	status: string;
	conversionRate: number;
	items: PurchaseOrderAnalysisItemInput[];
}

/** Shape of a single purchase order item row returned by the Prisma query. */
export interface PurchaseOrderAnalysisItemInput {
	id: string;
	itemCode: string;
	itemName: string | null;
	requiredDate: Date;
	qty: number;
	receivedQty: number;
	billedQty: number;
	baseRate: number;
	amount: number;
	baseAmount: number;
	billedAmount: number;
	receivedQtyAmount: number;
	warehouse: string | null;
	project: string | null;
}

// ---------------------------------------------------------------------------
// Row builder
// ---------------------------------------------------------------------------

/**
 * Build a single analysis row from an order header and one of its items.
 *
 * @param order - Purchase order data from the database query
 * @param item - Purchase order item data from the database query
 */
export function buildPurchaseOrderAnalysisItemRow(
	order: PurchaseOrderAnalysisOrderInput,
	item: PurchaseOrderAnalysisItemInput,
): Inventory.PurchaseOrderAnalysisRow {
	const status = order.status as Inventory.PurchaseOrderAnalysisStatus;

	const pendingQty = item.qty - item.receivedQty;
	const qtyToBill = item.qty - item.billedQty;
	const pendingAmount = item.baseAmount - item.billedAmount;

	return {
		purchaseOrder: order.series,
		purchaseOrderId: order.id,
		date: order.transactionDate.toISOString(),
		requiredDate: item.requiredDate.toISOString(),
		status,
		supplier: order.supplier,
		project: item.project ?? null,
		itemCode: item.itemCode,
		qty: item.qty,
		receivedQty: item.receivedQty,
		pendingQty,
		billedQty: item.billedQty,
		qtyToBill,
		amount: item.baseAmount,
		billedAmount: item.billedAmount,
		pendingAmount,
		receivedQtyAmount: item.receivedQtyAmount,
		warehouse: item.warehouse ?? null,
		company: order.company,
	};
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

/**
 * Build all analysis rows from a set of purchase orders.
 *
 * @remarks
 * When `groupByPurchaseOrder` is true, all items per PO are collapsed into one
 * row with numeric fields summed, earliest requiredDate kept, and item-level
 * fields (itemCode, project, warehouse) set to null in the grouped view.
 *
 * @param orders - Purchase order data from the Prisma query
 * @param groupByPurchaseOrder - If true, collapse items per PO
 */
export function buildPurchaseOrderAnalysisRows(
	orders: PurchaseOrderAnalysisOrderInput[],
	groupByPurchaseOrder = false,
): Inventory.PurchaseOrderAnalysisRow[] {
	if (groupByPurchaseOrder) {
		const poMap = new Map<string, Inventory.PurchaseOrderAnalysisRow>();

		for (const order of orders) {
			for (const item of order.items) {
				const itemRow = buildPurchaseOrderAnalysisItemRow(order, item);
				const existing = poMap.get(order.id);

				if (!existing) {
					poMap.set(order.id, {
						...itemRow,
						// Item-level fields are null in the grouped view
						itemCode: null,
						project: null,
						warehouse: null,
					});
				} else {
					existing.qty += itemRow.qty;
					existing.receivedQty += itemRow.receivedQty;
					existing.pendingQty += itemRow.pendingQty;
					existing.billedQty += itemRow.billedQty;
					existing.qtyToBill += itemRow.qtyToBill;
					existing.amount += itemRow.amount;
					existing.billedAmount += itemRow.billedAmount;
					existing.pendingAmount += itemRow.pendingAmount;
					existing.receivedQtyAmount += itemRow.receivedQtyAmount;
					// Earliest required date wins (most urgent line drives the PO)
					if (itemRow.requiredDate < existing.requiredDate) {
						existing.requiredDate = itemRow.requiredDate;
					}
				}
			}
		}

		return Array.from(poMap.values());
	}

	return orders.flatMap((order) =>
		order.items.map((item) => buildPurchaseOrderAnalysisItemRow(order, item)),
	);
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

/**
 * Compute the billing summary from the full set of analysis rows.
 *
 * @param rows - All analysis rows (grouped or item-level)
 */
export function computePurchaseOrderAnalysisSummary(
	rows: Inventory.PurchaseOrderAnalysisRow[],
): Inventory.PurchaseOrderAnalysisSummary {
	return rows.reduce(
		(acc, r) => {
			acc.totalPendingAmount += r.pendingAmount;
			acc.totalBilledAmount += r.billedAmount;
			return acc;
		},
		{ totalPendingAmount: 0, totalBilledAmount: 0 },
	);
}
