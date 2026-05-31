import type { Inventory } from "@aria/types";

export type ItemPriceStockSourceRow = Pick<
	Inventory.StockProjectedQtyRow,
	| "id"
	| "company"
	| "itemCode"
	| "itemName"
	| "itemGroupName"
	| "brandName"
	| "warehouse"
	| "actualQty"
	| "lastActivityDate"
> & {
	buyingRate?: number | null;
	sellingRate?: number | null;
};

interface ItemPriceStockReportOptions {
	includeZeroStockItems?: boolean;
	buyingPriceList?: string;
	sellingPriceList?: string;
}

export function buildItemPriceStockRows(
	rows: ItemPriceStockSourceRow[],
	options?: ItemPriceStockReportOptions,
): Inventory.ItemPriceStockRow[] {
	const includeZeroStockItems = options?.includeZeroStockItems ?? true;
	const buyingPriceList = options?.buyingPriceList ?? "Standard Buying";
	const sellingPriceList = options?.sellingPriceList ?? "Standard Selling";

	return rows
		.map((row) => ({
			id: row.id,
			company: row.company,
			itemCode: row.itemCode,
			itemName: row.itemName ?? null,
			itemGroupName: row.itemGroupName ?? null,
			brandName: row.brandName ?? null,
			warehouse: row.warehouse,
			availableQty: row.actualQty,
			buyingPriceList,
			buyingRate: row.buyingRate ?? 0,
			sellingPriceList,
			sellingRate: row.sellingRate ?? 0,
			lastActivityDate: row.lastActivityDate ?? null,
		}))
		.filter((row) => includeZeroStockItems || row.availableQty !== 0)
		.sort((left, right) => {
			if (left.company !== right.company) {
				return left.company.localeCompare(right.company);
			}

			if (left.itemCode !== right.itemCode) {
				return left.itemCode.localeCompare(right.itemCode);
			}

			return left.warehouse.localeCompare(right.warehouse);
		});
}
