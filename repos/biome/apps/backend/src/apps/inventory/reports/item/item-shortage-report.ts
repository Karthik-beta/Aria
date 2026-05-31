import type { Inventory } from "@aria/types";

/** Input row from the projected-qty computation pipeline. */
export type ItemShortageSourceRow = Pick<
	Inventory.StockProjectedQtyRow,
	| "id"
	| "company"
	| "warehouse"
	| "itemCode"
	| "itemName"
	| "description"
	| "actualQty"
	| "orderedQty"
	| "plannedQty"
	| "requestedQty"
	| "reservedQty"
	| "reservedQtyForProduction"
	| "projectedQty"
>;

/**
 * Filters projected-qty rows to those with negative projected quantity,
 * maps them to the ItemShortageRow shape, and sorts ascending by
 * projectedQty so the most critical shortage appears first.
 *
 * When the caller collects rows from multiple warehouses, duplicates are
 * deduplicated by `id` before filtering — pass `deduplicateById: true`
 * to enable this path.
 *
 * @param rows     Source rows from the projected-qty pipeline.
 */
export function buildItemShortageRows(
	rows: ItemShortageSourceRow[],
): Inventory.ItemShortageRow[] {
	return rows
		.filter((row) => row.projectedQty < 0)
		.map((row) => ({
			id: row.id,
			company: row.company,
			warehouse: row.warehouse,
			itemCode: row.itemCode,
			itemName: row.itemName ?? null,
			description: row.description ?? null,
			actualQty: row.actualQty,
			orderedQty: row.orderedQty,
			plannedQty: row.plannedQty,
			requestedQty: row.requestedQty,
			reservedQty: row.reservedQty,
			reservedQtyForProduction: row.reservedQtyForProduction,
			projectedQty: row.projectedQty,
		}))
		.sort((a, b) => a.projectedQty - b.projectedQty);
}
