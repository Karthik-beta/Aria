import type { Inventory } from "@aria/types";
import type { Prisma } from "../../generated/prisma/client";

export type StockLedgerReportItem = Prisma.StockEntryItemGetPayload<{
	include: {
		stockEntry: true;
	};
}>;

interface StockLedgerReportOptions {
	warehouse?: string;
}

function createLedgerRowId(
	stockEntryItemId: string,
	warehouse: string,
	movementType: Inventory.StockLedgerRow["movementType"],
): string {
	return `${stockEntryItemId}:${warehouse}:${movementType}`;
}

function createMovementRows(
	item: StockLedgerReportItem,
	options?: StockLedgerReportOptions,
): Omit<Inventory.StockLedgerRow, "balanceQty">[] {
	const sourceWarehouse =
		item.sourceWarehouse ?? item.stockEntry.defaultSourceWarehouse ?? null;
	const targetWarehouse =
		item.targetWarehouse ?? item.stockEntry.defaultTargetWarehouse ?? null;
	const warehouseFilter = options?.warehouse?.trim().toLowerCase();

	const rows: Omit<Inventory.StockLedgerRow, "balanceQty">[] = [];

	if (sourceWarehouse) {
		const matchesWarehouse =
			!warehouseFilter || sourceWarehouse.toLowerCase() === warehouseFilter;
		if (matchesWarehouse) {
			rows.push({
				id: createLedgerRowId(item.id, sourceWarehouse, "OUT"),
				stockEntryId: item.stockEntryId,
				stockEntryItemId: item.id,
				series: item.stockEntry.series,
				voucherNo: item.stockEntry.series,
				postingDate: item.stockEntry.postingDate,
				company: item.stockEntry.company,
				status: item.stockEntry.status,
				stockEntryType: item.stockEntry.stockEntryType,
				project: item.stockEntry.project,
				itemCode: item.itemCode,
				itemName: item.itemName,
				description: item.description,
				warehouse: sourceWarehouse,
				sourceWarehouse,
				targetWarehouse,
				movementType: "OUT",
				qtyIn: 0,
				qtyOut: item.qty,
				basicRate: item.basicRate,
				basicAmount: item.basicAmount,
				unitOfMeasure: item.unitOfMeasure,
				remarks: item.stockEntry.remarks,
				createdAt: item.stockEntry.createdAt,
				updatedAt: item.stockEntry.updatedAt,
			});
		}
	}

	if (targetWarehouse) {
		const matchesWarehouse =
			!warehouseFilter || targetWarehouse.toLowerCase() === warehouseFilter;
		if (matchesWarehouse) {
			rows.push({
				id: createLedgerRowId(item.id, targetWarehouse, "IN"),
				stockEntryId: item.stockEntryId,
				stockEntryItemId: item.id,
				series: item.stockEntry.series,
				voucherNo: item.stockEntry.series,
				postingDate: item.stockEntry.postingDate,
				company: item.stockEntry.company,
				status: item.stockEntry.status,
				stockEntryType: item.stockEntry.stockEntryType,
				project: item.stockEntry.project,
				itemCode: item.itemCode,
				itemName: item.itemName,
				description: item.description,
				warehouse: targetWarehouse,
				sourceWarehouse,
				targetWarehouse,
				movementType: "IN",
				qtyIn: item.qty,
				qtyOut: 0,
				basicRate: item.basicRate,
				basicAmount: item.basicAmount,
				unitOfMeasure: item.unitOfMeasure,
				remarks: item.stockEntry.remarks,
				createdAt: item.stockEntry.createdAt,
				updatedAt: item.stockEntry.updatedAt,
			});
		}
	}

	return rows;
}

function compareLedgerRows(
	left: Omit<Inventory.StockLedgerRow, "balanceQty">,
	right: Omit<Inventory.StockLedgerRow, "balanceQty">,
): number {
	const postingDateDiff =
		left.postingDate.getTime() - right.postingDate.getTime();
	if (postingDateDiff !== 0) return postingDateDiff;

	const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
	if (createdAtDiff !== 0) return createdAtDiff;

	if (left.series !== right.series) {
		return left.series.localeCompare(right.series);
	}

	if (left.stockEntryItemId !== right.stockEntryItemId) {
		return left.stockEntryItemId.localeCompare(right.stockEntryItemId);
	}

	if (left.movementType !== right.movementType) {
		return left.movementType === "OUT" ? -1 : 1;
	}

	return left.warehouse.localeCompare(right.warehouse);
}

export function buildStockLedgerRows(
	items: StockLedgerReportItem[],
	options?: StockLedgerReportOptions,
): Inventory.StockLedgerRow[] {
	const expandedRows = items
		.flatMap((item) => createMovementRows(item, options))
		.sort(compareLedgerRows);

	const balances = new Map<string, number>();

	return expandedRows.map((row) => {
		const balanceKey = `${row.itemCode}::${row.warehouse}`;
		const previousBalance = balances.get(balanceKey) ?? 0;
		const nextBalance = previousBalance + row.qtyIn - row.qtyOut;
		balances.set(balanceKey, nextBalance);

		return {
			...row,
			balanceQty: nextBalance,
		};
	});
}
