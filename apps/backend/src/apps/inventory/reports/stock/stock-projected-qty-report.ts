import type { Inventory } from "@aria/types";

export type StockProjectedQtySourceRow = Pick<
	Inventory.StockProjectedQtyRow,
	| "company"
	| "itemCode"
	| "itemName"
	| "description"
	| "itemGroupName"
	| "brandName"
	| "warehouse"
	| "unitOfMeasure"
	| "actualQty"
	| "plannedQty"
	| "requestedQty"
	| "orderedQty"
	| "reservedQty"
	| "reservedQtyForProduction"
	| "reservedQtyForSubcontracting"
	| "reservedQtyForProductionPlan"
	| "reorderLevel"
	| "reorderQty"
	| "lastActivityDate"
>;

interface StockProjectedQtyReportOptions {
	includeZeroStockItems?: boolean;
}

function createProjectedQtyRowId(
	company: string,
	itemCode: string,
	warehouse: string,
) {
	return `${company}::${itemCode}::${warehouse}`;
}

export function buildStockProjectedQtyRows(
	rows: StockProjectedQtySourceRow[],
	options?: StockProjectedQtyReportOptions,
): Inventory.StockProjectedQtyRow[] {
	const aggregates = new Map<string, Inventory.StockProjectedQtyRow>();

	for (const row of rows) {
		const key = createProjectedQtyRowId(
			row.company,
			row.itemCode,
			row.warehouse,
		);
		const existing = aggregates.get(key) ?? {
			id: key,
			company: row.company,
			itemCode: row.itemCode,
			itemName: row.itemName ?? null,
			description: row.description ?? null,
			itemGroupName: row.itemGroupName ?? null,
			brandName: row.brandName ?? null,
			warehouse: row.warehouse,
			unitOfMeasure: row.unitOfMeasure ?? null,
			actualQty: 0,
			plannedQty: 0,
			requestedQty: 0,
			orderedQty: 0,
			reservedQty: 0,
			reservedQtyForProduction: 0,
			reservedQtyForSubcontracting: 0,
			reservedQtyForProductionPlan: 0,
			projectedQty: 0,
			reorderLevel: 0,
			reorderQty: 0,
			shortageQty: 0,
			lastActivityDate: row.lastActivityDate ?? null,
		};

		existing.itemName ??= row.itemName ?? null;
		existing.description ??= row.description ?? null;
		existing.itemGroupName ??= row.itemGroupName ?? null;
		existing.brandName ??= row.brandName ?? null;
		existing.unitOfMeasure ??= row.unitOfMeasure ?? null;

		existing.actualQty += row.actualQty ?? 0;
		existing.plannedQty += row.plannedQty ?? 0;
		existing.requestedQty += row.requestedQty ?? 0;
		existing.orderedQty += row.orderedQty ?? 0;
		existing.reservedQty += row.reservedQty ?? 0;
		existing.reservedQtyForProduction += row.reservedQtyForProduction ?? 0;
		existing.reservedQtyForSubcontracting +=
			row.reservedQtyForSubcontracting ?? 0;
		existing.reservedQtyForProductionPlan +=
			row.reservedQtyForProductionPlan ?? 0;
		existing.reorderLevel = Math.max(
			existing.reorderLevel,
			row.reorderLevel ?? 0,
		);
		existing.reorderQty = Math.max(existing.reorderQty, row.reorderQty ?? 0);

		if (
			row.lastActivityDate &&
			(existing.lastActivityDate == null ||
				row.lastActivityDate.getTime() > existing.lastActivityDate.getTime())
		) {
			existing.lastActivityDate = row.lastActivityDate;
		}

		aggregates.set(key, existing);
	}

	const includeZeroStockItems = options?.includeZeroStockItems === true;

	return [...aggregates.values()]
		.map((row) => {
			const projectedQty =
				row.actualQty +
				row.plannedQty +
				row.requestedQty +
				row.orderedQty -
				row.reservedQty -
				row.reservedQtyForProduction -
				row.reservedQtyForSubcontracting -
				row.reservedQtyForProductionPlan;

			const shortageQty = Math.max(row.reorderLevel - projectedQty, 0);

			return {
				...row,
				projectedQty,
				shortageQty,
			};
		})
		.filter((row) => {
			if (includeZeroStockItems) {
				return true;
			}

			return (
				row.actualQty !== 0 ||
				row.plannedQty !== 0 ||
				row.requestedQty !== 0 ||
				row.orderedQty !== 0 ||
				row.reservedQty !== 0 ||
				row.reservedQtyForProduction !== 0 ||
				row.reservedQtyForSubcontracting !== 0 ||
				row.reservedQtyForProductionPlan !== 0 ||
				row.shortageQty !== 0
			);
		})
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
