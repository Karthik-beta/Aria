import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Source shape — raw batch record returned by the Prisma query.
// ---------------------------------------------------------------------------

export interface BatchItemExpirySourceBatch {
	id: string;
	batchId: string;
	quantity: number;
	expiryDate: Date | null;
	createdAt: Date;
	item: {
		code: string;
		name: string | null;
		defaultUnitOfMeasure: { name: string } | null;
	};
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Transforms raw `Batch` records into `BatchItemExpiryRow` output rows.
 *
 * **Expiry-in-days**
 * Computed server-side relative to `today` (defaults to `new Date()` so the
 * value is always fresh when the report runs):
 * - No expiry date → `expiryInDays` is `null`.
 * - Expiry in the past → `expiryInDays` is `0` (clamped at zero, matching
 *   ERPNext's `max(..., 0)` behaviour).
 * - Expiry in the future → exact whole-day count.
 *
 * Date arithmetic uses UTC to avoid DST-related off-by-one errors.
 *
 * @param batches  Batch records already filtered by the service layer.
 * @param today    Reference date for the expiry calculation (injectable for
 *                 deterministic tests; leave undefined in production).
 */
export function buildBatchItemExpiryRows(
	batches: BatchItemExpirySourceBatch[],
	today: Date = new Date(),
): Inventory.BatchItemExpiryRow[] {
	const todayUtcMs = Date.UTC(
		today.getUTCFullYear(),
		today.getUTCMonth(),
		today.getUTCDate(),
	);

	return batches.map((batch) => {
		let expiresOn: string | null = null;
		let expiryInDays: number | null = null;

		if (batch.expiryDate !== null) {
			expiresOn = batch.expiryDate.toISOString().slice(0, 10);

			const expiryUtcMs = Date.UTC(
				batch.expiryDate.getUTCFullYear(),
				batch.expiryDate.getUTCMonth(),
				batch.expiryDate.getUTCDate(),
			);
			const diffMs = expiryUtcMs - todayUtcMs;
			const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
			expiryInDays = Math.max(diffDays, 0);
		}

		return {
			id: batch.id,
			itemCode: batch.item.code,
			itemName: batch.item.name,
			batchNo: batch.batchId,
			stockUom: batch.item.defaultUnitOfMeasure?.name ?? null,
			quantity: batch.quantity,
			expiresOn,
			expiryInDays,
		};
	});
}
