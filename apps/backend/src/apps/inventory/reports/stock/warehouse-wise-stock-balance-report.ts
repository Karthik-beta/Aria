import type { Inventory } from "@aria/types";

type WarehouseWiseStockLedgerRow = Pick<
	Inventory.StockLedgerRow,
	| "id"
	| "stockEntryId"
	| "stockEntryItemId"
	| "company"
	| "itemCode"
	| "itemName"
	| "warehouse"
	| "postingDate"
	| "voucherNo"
	| "qtyIn"
	| "qtyOut"
	| "basicRate"
	| "movementType"
	| "createdAt"
	| "updatedAt"
>;

export function buildWarehouseWiseStockBalanceRows(
	rows: WarehouseWiseStockLedgerRow[],
): Inventory.WarehouseWiseStockBalanceRow[] {
	return rows
		.map((row) => ({
			id: row.id,
			stockEntryId: row.stockEntryId,
			stockEntryItemId: row.stockEntryItemId,
			company: row.company,
			itemCode: row.itemCode,
			itemName: row.itemName ?? null,
			warehouse: row.warehouse,
			postingDate: row.postingDate,
			voucherNo: row.voucherNo,
			qtyChange: row.qtyIn - row.qtyOut,
			incomingRate: row.qtyIn > 0 ? row.basicRate : 0,
			movementType: row.movementType,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}))
		.sort((left, right) => {
			const postingDiff =
				right.postingDate.getTime() - left.postingDate.getTime();
			if (postingDiff !== 0) return postingDiff;

			const updatedDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
			if (updatedDiff !== 0) return updatedDiff;

			return left.id.localeCompare(right.id);
		});
}
