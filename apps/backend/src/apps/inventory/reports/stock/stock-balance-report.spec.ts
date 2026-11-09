import {
	buildStockBalanceRows,
	type StockBalanceSourceRow,
} from "./stock-balance-report";

function createBalanceRow(
	overrides: Partial<StockBalanceSourceRow> = {},
): StockBalanceSourceRow {
	return {
		company: "Nova Gadget House",
		itemCode: "ITEM-001",
		itemName: "iPhone 13",
		itemGroupName: "Phones",
		brandName: "Apple",
		warehouse: "Stores - GH",
		unitOfMeasure: "Nos",
		postingDate: new Date("2026-03-01T00:00:00.000Z"),
		qtyIn: 0,
		qtyOut: 0,
		basicAmount: 0,
		valuationRate: 45000,
		...overrides,
	};
}

describe("buildStockBalanceRows", () => {
	it("calculates opening, inward, outward, and closing balances from movement rows", () => {
		const rows = buildStockBalanceRows(
			[
				createBalanceRow({
					postingDate: new Date("2026-02-20T00:00:00.000Z"),
					qtyIn: 10,
					basicAmount: 450000,
				}),
				createBalanceRow({
					postingDate: new Date("2026-03-05T00:00:00.000Z"),
					qtyIn: 4,
					basicAmount: 180000,
				}),
				createBalanceRow({
					postingDate: new Date("2026-03-07T00:00:00.000Z"),
					qtyOut: 3,
					basicAmount: 135000,
				}),
			],
			{
				dateFrom: new Date("2026-03-01T00:00:00.000Z"),
			},
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			openingQty: 10,
			openingValue: 450000,
			inQty: 4,
			inValue: 180000,
			outQty: 3,
			outValue: 135000,
			balanceQty: 11,
			balanceValue: 495000,
		});
	});

	it("keeps zero-balance rows only when explicitly requested", () => {
		const zeroedRow = createBalanceRow({
			qtyIn: 5,
			qtyOut: 5,
			basicAmount: 500,
		});

		expect(buildStockBalanceRows([zeroedRow])).toHaveLength(0);
		expect(
			buildStockBalanceRows([zeroedRow], { includeZeroStockItems: true }),
		).toHaveLength(1);
	});

	it("aggregates each company, item, and warehouse independently", () => {
		const rows = buildStockBalanceRows([
			createBalanceRow({ qtyIn: 2, basicAmount: 1000 }),
			createBalanceRow({
				company: "Nova Gadget House - 2",
				qtyIn: 3,
				basicAmount: 1500,
			}),
			createBalanceRow({
				warehouse: "Finished Goods - GH",
				qtyIn: 1,
				basicAmount: 500,
			}),
		]);

		expect(rows).toHaveLength(3);
		expect(rows.map((row) => row.balanceQty)).toEqual([1, 2, 3]);
	});
});
