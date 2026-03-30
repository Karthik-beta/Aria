import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Source shape — raw item record returned by the Prisma query.
// ---------------------------------------------------------------------------

export interface ItemPricesSourceItem {
	code: string;
	name: string | null;
	description: string | null;
	disabled: boolean;
	itemGroup: { groupName: string } | null;
	brand: { name: string } | null;
	defaultUnitOfMeasure: { name: string } | null;
	valuationRate: number | null;
	standardSellingRate: number | null;
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Transforms raw item records and a last-purchase-rate map into
 * `ItemPricesRow` output rows, sorted alphabetically by item code.
 *
 * @param items                  Items already filtered and fetched by the service layer.
 * @param lastPurchaseRateByCode Map of item code → most-recent base purchase rate.
 */
export function buildItemPricesRows(
	items: ItemPricesSourceItem[],
	lastPurchaseRateByCode: ReadonlyMap<string, number>,
): Inventory.ItemPricesRow[] {
	return items
		.map((item) => ({
			id: item.code,
			itemCode: item.code,
			itemName: item.name,
			itemGroupName: item.itemGroup?.groupName ?? null,
			brandName: item.brand?.name ?? null,
			description: item.description,
			stockUom: item.defaultUnitOfMeasure?.name ?? null,
			lastPurchaseRate: lastPurchaseRateByCode.get(item.code) ?? null,
			valuationRate: item.valuationRate ?? 0,
			standardSellingRate: item.standardSellingRate ?? 0,
		}))
		.sort((a, b) => a.itemCode.localeCompare(b.itemCode));
}
