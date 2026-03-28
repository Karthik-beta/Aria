import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Input data shapes — mirror the Prisma query select shapes in the service
// ---------------------------------------------------------------------------

/** Shape of the sales order header row returned by the Prisma query. */
export interface SalesOrderAnalysisOrderInput {
	id: string;
	series: string;
	transactionDate: Date;
	customer: string;
	company: string;
	/** Matches the Prisma SalesOrderStatus enum value. */
	status: string;
	conversionRate: number;
	items: SalesOrderAnalysisItemInput[];
}

/** Shape of a single sales order item row returned by the Prisma query. */
export interface SalesOrderAnalysisItemInput {
	id: string;
	itemCode: string;
	itemName: string | null;
	description: string | null;
	deliveryDate: Date;
	qty: number;
	deliveredQty: number;
	billedQty: number;
	baseRate: number;
	amount: number;
	baseAmount: number;
	billedAmount: number;
	warehouse: string | null;
	lastDeliveryDate: Date | null;
}

// ---------------------------------------------------------------------------
// Pure computation helpers
// ---------------------------------------------------------------------------

/**
 * Compute the delay in days for a sales order item.
 *
 * @remarks
 * Returns 0 when status is COMPLETED or TO_BILL (delivery is complete) or
 * when the delivery date is in the future relative to `today`.
 *
 * @param status - The sales order status string
 * @param deliveryDate - Promised delivery date for the item
 * @param today - Reference date for delay calculation (UTC midnight)
 */
export function computeDelayDays(
	status: string,
	deliveryDate: Date,
	today: Date,
): number {
	if (status === "COMPLETED" || status === "TO_BILL") return 0;

	const d = new Date(deliveryDate);
	d.setUTCHours(0, 0, 0, 0);
	const t = new Date(today);
	t.setUTCHours(0, 0, 0, 0);

	const days = Math.round((t.getTime() - d.getTime()) / 86_400_000);
	return days < 0 ? 0 : days;
}

/**
 * Compute how long it took to deliver an order, in seconds.
 *
 * @remarks
 * Returns 0 when there is no delivery date recorded or when the order is not
 * in a terminal delivery state (TO_BILL or COMPLETED).
 *
 * @param status - The sales order status string
 * @param lastDeliveryDate - Date of the most recent delivery against this item
 * @param transactionDate - Original sales order creation date
 */
export function computeTimeTakenToDeliverSeconds(
	status: string,
	lastDeliveryDate: Date | null,
	transactionDate: Date,
): number {
	if (!lastDeliveryDate) return 0;
	if (status !== "TO_BILL" && status !== "COMPLETED") return 0;

	return Math.round(
		(new Date(lastDeliveryDate).getTime() -
			new Date(transactionDate).getTime()) /
			1000,
	);
}

// ---------------------------------------------------------------------------
// Row builder
// ---------------------------------------------------------------------------

/**
 * Build a single analysis row from an order header and one of its items.
 *
 * @param order - Sales order data from the database query
 * @param item - Sales order item data from the database query
 * @param today - Reference date used for delay computation (UTC midnight)
 */
export function buildSalesOrderAnalysisItemRow(
	order: SalesOrderAnalysisOrderInput,
	item: SalesOrderAnalysisItemInput,
	today: Date,
): Inventory.SalesOrderAnalysisRow {
	const status = order.status as Inventory.SalesOrderAnalysisStatus;

	const pendingQty = item.qty - item.deliveredQty;
	const qtyToBill = item.qty - item.billedQty;
	const pendingAmount = item.baseAmount - item.billedAmount;
	const deliveredQtyAmount = item.deliveredQty * item.baseRate;

	const delayDays = computeDelayDays(order.status, item.deliveryDate, today);
	const timeTakenToDeliverSeconds = computeTimeTakenToDeliverSeconds(
		order.status,
		item.lastDeliveryDate,
		order.transactionDate,
	);

	return {
		salesOrder: order.series,
		salesOrderId: order.id,
		date: order.transactionDate.toISOString(),
		deliveryDate: item.deliveryDate.toISOString(),
		status,
		customer: order.customer,
		itemCode: item.itemCode,
		description: item.description ?? null,
		qty: item.qty,
		deliveredQty: item.deliveredQty,
		pendingQty,
		billedQty: item.billedQty,
		qtyToBill,
		amount: item.baseAmount,
		billedAmount: item.billedAmount,
		pendingAmount,
		deliveredQtyAmount,
		delayDays,
		timeTakenToDeliverSeconds,
		warehouse: item.warehouse ?? null,
		company: order.company,
	};
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

/**
 * Build all analysis rows from a set of sales orders.
 *
 * @remarks
 * When `groupBySalesOrder` is true, all items per SO are collapsed into one
 * row with numeric fields summed, latest deliveryDate kept, and maximum
 * delayDays kept. Item-level fields (itemCode, description, warehouse) are
 * set to null in the grouped view.
 *
 * @param orders - Sales order data from the Prisma query
 * @param today - Reference date for delay computation
 * @param groupBySalesOrder - If true, collapse items per SO
 */
export function buildSalesOrderAnalysisRows(
	orders: SalesOrderAnalysisOrderInput[],
	today: Date,
	groupBySalesOrder = false,
): Inventory.SalesOrderAnalysisRow[] {
	if (groupBySalesOrder) {
		const soMap = new Map<string, Inventory.SalesOrderAnalysisRow>();

		for (const order of orders) {
			for (const item of order.items) {
				const itemRow = buildSalesOrderAnalysisItemRow(order, item, today);
				const existing = soMap.get(order.id);

				if (!existing) {
					soMap.set(order.id, {
						...itemRow,
						// Item-level fields are null in the grouped view
						itemCode: null,
						description: null,
						warehouse: null,
					});
				} else {
					existing.qty += itemRow.qty;
					existing.deliveredQty += itemRow.deliveredQty;
					existing.pendingQty += itemRow.pendingQty;
					existing.billedQty += itemRow.billedQty;
					existing.qtyToBill += itemRow.qtyToBill;
					existing.amount += itemRow.amount;
					existing.billedAmount += itemRow.billedAmount;
					existing.pendingAmount += itemRow.pendingAmount;
					existing.deliveredQtyAmount += itemRow.deliveredQtyAmount;
					// Latest delivery date wins
					if (itemRow.deliveryDate > existing.deliveryDate) {
						existing.deliveryDate = itemRow.deliveryDate;
					}
					// Most-delayed item defines SO delay
					if (itemRow.delayDays > existing.delayDays) {
						existing.delayDays = itemRow.delayDays;
					}
				}
			}
		}

		return Array.from(soMap.values());
	}

	return orders.flatMap((order) =>
		order.items.map((item) =>
			buildSalesOrderAnalysisItemRow(order, item, today),
		),
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
export function computeSalesOrderAnalysisSummary(
	rows: Inventory.SalesOrderAnalysisRow[],
): Inventory.SalesOrderAnalysisSummary {
	return rows.reduce(
		(acc, r) => {
			acc.totalPendingAmount += r.pendingAmount;
			acc.totalBilledAmount += r.billedAmount;
			return acc;
		},
		{ totalPendingAmount: 0, totalBilledAmount: 0 },
	);
}
