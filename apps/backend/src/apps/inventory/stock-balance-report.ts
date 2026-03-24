import type { Inventory } from "@aria/types";

export type StockBalanceSourceRow = Pick<
	Inventory.StockLedgerRow,
	| "company"
	| "itemCode"
	| "itemName"
	| "warehouse"
	| "unitOfMeasure"
	| "postingDate"
	| "qtyIn"
	| "qtyOut"
	| "basicAmount"
> & {
	itemGroupName?: string | null;
	brandName?: string | null;
	valuationRate?: number | null;
};

interface StockBalanceReportOptions {
	dateFrom?: Date;
	includeZeroStockItems?: boolean;
}

function createBalanceRowId(
	company: string,
	itemCode: string,
	warehouse: string,
) {
	return `${company}::${itemCode}::${warehouse}`;
}

export function buildStockBalanceRows(
	rows: StockBalanceSourceRow[],
	options?: StockBalanceReportOptions,
): Inventory.StockBalanceRow[] {
	const aggregates = new Map<string, Inventory.StockBalanceRow>();

	for (const row of rows) {
		const key = createBalanceRowId(row.company, row.itemCode, row.warehouse);
		const existing = aggregates.get(key) ?? {
			id: key,
			company: row.company,
			itemCode: row.itemCode,
			itemName: row.itemName ?? null,
			itemGroupName: row.itemGroupName ?? null,
			brandName: row.brandName ?? null,
			warehouse: row.warehouse,
			unitOfMeasure: row.unitOfMeasure ?? null,
			openingQty: 0,
			openingValue: 0,
			inQty: 0,
			inValue: 0,
			outQty: 0,
			outValue: 0,
			balanceQty: 0,
			valuationRate: row.valuationRate ?? null,
			balanceValue: null,
			lastPostingDate: row.postingDate,
		};

		existing.itemName ??= row.itemName ?? null;
		existing.itemGroupName ??= row.itemGroupName ?? null;
		existing.brandName ??= row.brandName ?? null;
		existing.unitOfMeasure ??= row.unitOfMeasure ?? null;
		existing.valuationRate ??= row.valuationRate ?? null;
		if (
			existing.lastPostingDate == null ||
			row.postingDate.getTime() > existing.lastPostingDate.getTime()
		) {
			existing.lastPostingDate = row.postingDate;
		}

		const deltaQty = row.qtyIn - row.qtyOut;
		const deltaValue =
			(row.qtyIn > 0 ? row.basicAmount : 0) -
			(row.qtyOut > 0 ? row.basicAmount : 0);
		const isOpeningRow =
			options?.dateFrom != null &&
			row.postingDate.getTime() < options.dateFrom.getTime();

		if (isOpeningRow) {
			existing.openingQty += deltaQty;
			existing.openingValue += deltaValue;
		} else {
			existing.inQty += row.qtyIn;
			existing.inValue += row.qtyIn > 0 ? row.basicAmount : 0;
			existing.outQty += row.qtyOut;
			existing.outValue += row.qtyOut > 0 ? row.basicAmount : 0;
		}

		aggregates.set(key, existing);
	}

	const includeZeroStockItems = options?.includeZeroStockItems === true;

	return [...aggregates.values()]
		.map((row) => {
			const balanceQty = row.openingQty + row.inQty - row.outQty;
			const computedBalanceValue =
				row.valuationRate == null
					? row.openingValue + row.inValue - row.outValue
					: row.valuationRate * balanceQty;

			return {
				...row,
				balanceQty,
				balanceValue: computedBalanceValue,
			};
		})
		.filter((row) => includeZeroStockItems || row.balanceQty !== 0)
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
