import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Source shape — raw batch record from the database query.
// ---------------------------------------------------------------------------

export interface BatchWiseBalanceSourceBatch {
	id: string;
	batchId: string;
	company: string;
	/** Current on-hand quantity for this batch. */
	quantity: number;
	manufacturingDate: Date | null;
	expiryDate: Date | null;
	item: {
		code: string;
		name: string | null;
		description: string | null;
		valuationRate: number | null;
		defaultUnitOfMeasure: { name: string } | null;
	};
	/** Current location; null when the batch has been fully depleted. */
	currentWarehouse: { name: string } | null;
	/** The receipt transaction that introduced this batch into stock. */
	purchaseReceipt: { postingDate: Date } | null;
	/** A stock entry (e.g. Material Receipt) that introduced this batch. */
	stockEntry: { postingDate: Date } | null;
}

// ---------------------------------------------------------------------------
// Aggregation options
// ---------------------------------------------------------------------------

export interface BuildBatchWiseBalanceOptions {
	fromDate: Date;
	toDate: Date;
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Transforms raw `Batch` records into `BatchWiseBalanceRow` output rows.
 *
 * **Opening vs In Qty**
 * Aria does not maintain a per-batch stock ledger, so opening/in quantities
 * are estimated from the batch's receipt date:
 * - Receipt date **before** `fromDate` → the current batch balance is
 *   classified as `openingQty` (carried into the period).
 * - Receipt date **within** [fromDate, toDate] → the current balance is
 *   classified as `inQty` (received during the period).
 * - Receipt date **after** `toDate` → the batch is excluded entirely.
 * - No receipt date (manual batch) → treated as opening.
 *
 * `outQty` is always 0; Aria's batch model does not record per-period issues.
 * `balanceQty` is always `batch.quantity` (current on-hand).
 *
 * Rows where every quantity field is zero are omitted.
 *
 * @param batches  Source batch records (already pre-filtered by the service).
 * @param options  Reporting window boundaries.
 */
export function buildBatchWiseBalanceRows(
	batches: BatchWiseBalanceSourceBatch[],
	options: BuildBatchWiseBalanceOptions,
): Inventory.BatchWiseBalanceRow[] {
	const { fromDate, toDate } = options;

	const rows: Inventory.BatchWiseBalanceRow[] = [];

	for (const batch of batches) {
		const receiptDate: Date | null =
			batch.purchaseReceipt?.postingDate ??
			batch.stockEntry?.postingDate ??
			null;

		// Exclude batches received strictly after the reporting window.
		if (receiptDate !== null && receiptDate > toDate) {
			continue;
		}

		const balanceQty = batch.quantity;
		const valuationRate = batch.item.valuationRate ?? 0;

		let openingQty = 0;
		let inQty = 0;

		if (receiptDate === null || receiptDate < fromDate) {
			// Batch existed at the start of the period → opening balance.
			openingQty = balanceQty;
		} else {
			// Batch was received inside the reporting window → in qty.
			inQty = balanceQty;
		}

		// Skip rows with nothing to show.
		if (openingQty === 0 && inQty === 0 && balanceQty === 0) {
			continue;
		}

		rows.push({
			id: batch.id,
			company: batch.company,
			itemCode: batch.item.code,
			itemName: batch.item.name ?? null,
			description: batch.item.description ?? null,
			warehouse: batch.currentWarehouse?.name ?? null,
			batchNo: batch.batchId,
			openingQty,
			inQty,
			outQty: 0,
			balanceQty,
			valuationRate,
			balanceValue: balanceQty * valuationRate,
			unitOfMeasure: batch.item.defaultUnitOfMeasure?.name ?? null,
			manufacturingDate: batch.manufacturingDate?.toISOString() ?? null,
			expiryDate: batch.expiryDate?.toISOString() ?? null,
		});
	}

	// Sort: item code → warehouse → batch no (mirrors ERPNext output order).
	rows.sort((a, b) => {
		const itemCmp = a.itemCode.localeCompare(b.itemCode);
		if (itemCmp !== 0) return itemCmp;
		const whCmp = (a.warehouse ?? "").localeCompare(b.warehouse ?? "");
		if (whCmp !== 0) return whCmp;
		return a.batchNo.localeCompare(b.batchNo);
	});

	return rows;
}
