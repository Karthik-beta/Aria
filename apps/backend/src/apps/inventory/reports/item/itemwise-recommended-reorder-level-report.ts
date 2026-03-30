import type { Inventory } from "@aria/types";

// ---------------------------------------------------------------------------
// Source shapes — data fed into the report builder from the service layer.
// ---------------------------------------------------------------------------

export interface ReorderLevelItemSource {
	code: string;
	name: string;
	description: string | null;
	safetyStock: number;
	leadTimeDays: number;
	itemGroupName: string | null;
	brandName: string | null;
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Builds the "Itemwise Recommended Reorder Level" report rows.
 *
 * For each stock item the formula is:
 *
 *   totalOutgoing  = consumed + delivered
 *   avgDailyOutgoing = totalOutgoing / numberOfDays
 *   reorderLevel   = (avgDailyOutgoing × leadTimeDays) + safetyStock
 *
 * Mirrors the ERPNext report of the same name, adapted to Aria's data model.
 *
 * @param items           Active stock items with their metadata.
 * @param consumedByItem  Map of itemCode → total consumed qty in the period.
 * @param deliveredByItem Map of itemCode → total delivered qty in the period.
 * @param numberOfDays    Number of days in the analysis date range (inclusive).
 * @param floatPrecision  Decimal places for rounding (default 3).
 */
export function buildItemwiseRecommendedReorderLevelRows(
	items: ReorderLevelItemSource[],
	consumedByItem: ReadonlyMap<string, number>,
	deliveredByItem: ReadonlyMap<string, number>,
	numberOfDays: number,
	floatPrecision = 3,
): Inventory.ItemwiseRecommendedReorderLevelRow[] {
	if (numberOfDays <= 0) return [];

	const factor = 10 ** floatPrecision;
	const round = (v: number) => Math.round(v * factor) / factor;

	return items
		.map((item) => {
			const consumed = consumedByItem.get(item.code) ?? 0;
			const delivered = deliveredByItem.get(item.code) ?? 0;
			const totalOutgoing = round(consumed + delivered);
			const avgDailyOutgoing = round(totalOutgoing / numberOfDays);
			const reorderLevel = round(
				avgDailyOutgoing * item.leadTimeDays + item.safetyStock,
			);

			return {
				id: item.code,
				itemCode: item.code,
				itemName: item.name,
				itemGroup: item.itemGroupName,
				brand: item.brandName,
				description: item.description,
				safetyStock: item.safetyStock,
				leadTimeDays: item.leadTimeDays,
				consumed,
				delivered,
				totalOutgoing,
				avgDailyOutgoing,
				reorderLevel,
			};
		})
		.sort((a, b) => a.itemCode.localeCompare(b.itemCode));
}
