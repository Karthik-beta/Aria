import type { Inventory } from "@aria/types";

export type StockSummarySourceRow = Pick<
	Inventory.StockSummaryRow,
	| "id"
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
	| "projectedQty"
	| "reorderLevel"
	| "reorderQty"
	| "shortageQty"
	| "lastActivityDate"
>;

interface StockSummaryReportOptions {
	metric?: Inventory.StockSummaryMetric;
	sortDirection?: Inventory.StockSummarySortDirection;
}

function resolvePrimaryMetricValue(
	row: StockSummarySourceRow,
	metric: Inventory.StockSummaryMetric,
) {
	switch (metric) {
		case "ACTUAL_QTY":
			return row.actualQty;
		case "RESERVED_QTY":
			return row.reservedQty;
		case "RESERVED_QTY_FOR_PRODUCTION":
			return row.reservedQtyForProduction;
		case "RESERVED_QTY_FOR_SUBCONTRACTING":
			return row.reservedQtyForSubcontracting;
		case "SHORTAGE_QTY":
			return row.shortageQty;
		case "PROJECTED_QTY":
			return row.projectedQty;
	}
}

function resolveStockHealth(
	row: StockSummarySourceRow,
): Inventory.StockSummaryHealth {
	if (row.projectedQty <= 0) {
		return "CRITICAL";
	}

	if (row.shortageQty > 0) {
		return "LOW";
	}

	if (
		row.reorderLevel > 0 &&
		row.projectedQty >= row.reorderLevel + Math.max(row.reorderQty, 1)
	) {
		return "SURPLUS";
	}

	return "HEALTHY";
}

function resolveRecommendedAction(
	row: StockSummarySourceRow,
): Inventory.StockSummaryAction {
	return row.projectedQty > 0 ? "MOVE_AND_ADD" : "ADD";
}

export function buildStockSummaryRows(
	rows: StockSummarySourceRow[],
	options?: StockSummaryReportOptions,
): Inventory.StockSummaryRow[] {
	const metric = options?.metric ?? "PROJECTED_QTY";
	const sortDirection = options?.sortDirection ?? "desc";

	return rows
		.map((row) => ({
			...row,
			primaryMetric: metric,
			primaryMetricValue: resolvePrimaryMetricValue(row, metric),
			stockHealth: resolveStockHealth(row),
			recommendedAction: resolveRecommendedAction(row),
		}))
		.sort((left, right) => {
			const metricDelta =
				sortDirection === "asc"
					? left.primaryMetricValue - right.primaryMetricValue
					: right.primaryMetricValue - left.primaryMetricValue;

			if (metricDelta !== 0) {
				return metricDelta;
			}

			if (left.shortageQty !== right.shortageQty) {
				return right.shortageQty - left.shortageQty;
			}

			if (left.company !== right.company) {
				return left.company.localeCompare(right.company);
			}

			if (left.warehouse !== right.warehouse) {
				return left.warehouse.localeCompare(right.warehouse);
			}

			return left.itemCode.localeCompare(right.itemCode);
		});
}
