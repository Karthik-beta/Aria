import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Source shapes — data fed into the report builder from the service layer.
// ---------------------------------------------------------------------------

export interface VariantSource {
	id: string;
	code: string;
	name: string;
	quantity: number;
	standardSellingRate: number | null;
}

export interface VariantAttributeSource {
	itemId: string;
	attributeName: string;
	attributeValue: string;
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Builds the "Item Variant Details" report result.
 *
 * For a given template item, this function assembles one row per variant with:
 * - Dynamic attribute columns (pivoted from VariantAttributeSource)
 * - Average buying price from purchase receipt items
 * - Average selling price (standardSellingRate)
 * - Current stock (quantity)
 * - Open sales orders count
 *
 * @param variants            Variant inventory items (variant_of = template)
 * @param variantAttributes   Flat list of attribute values per variant
 * @param avgBuyingPriceMap   Map of variant code → average buying price
 * @param openOrdersMap       Map of variant code → open sales order item qty
 * @returns Report result with attribute names and rows
 */
export function buildItemVariantDetailsResult(
	variants: VariantSource[],
	variantAttributes: VariantAttributeSource[],
	avgBuyingPriceMap: ReadonlyMap<string, number>,
	openOrdersMap: ReadonlyMap<string, number>,
): Inventory.ItemVariantDetailsResult {
	if (variants.length === 0) {
		return { attributeNames: [], rows: [] };
	}

	// Collect ordered set of distinct attribute names
	const attributeNameSet = new Set<string>();
	const attrsByItemId = new Map<string, Record<string, string>>();

	for (const va of variantAttributes) {
		attributeNameSet.add(va.attributeName);
		let attrs = attrsByItemId.get(va.itemId);
		if (!attrs) {
			attrs = {};
			attrsByItemId.set(va.itemId, attrs);
		}
		attrs[va.attributeName] = va.attributeValue;
	}

	const attributeNames = [...attributeNameSet].sort();

	const rows: Inventory.ItemVariantDetailsRow[] = variants
		.map((v) => ({
			id: v.id,
			variantCode: v.code,
			variantName: v.name,
			attributes: attrsByItemId.get(v.id) ?? {},
			avgBuyingPriceListRate: avgBuyingPriceMap.get(v.code) ?? 0,
			avgSellingPriceListRate: v.standardSellingRate ?? 0,
			currentStock: v.quantity,
			openOrders: openOrdersMap.get(v.code) ?? 0,
		}))
		.sort((a, b) => a.variantCode.localeCompare(b.variantCode));

	return { attributeNames, rows };
}
