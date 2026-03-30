import {
	buildItemShortageRows,
	type ItemShortageSourceRow,
} from "./item-shortage-report";

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeRow(
	overrides: Partial<ItemShortageSourceRow> = {},
): ItemShortageSourceRow {
	return {
		id: "Company::ITEM-001::Stores - C",
		company: "Company",
		warehouse: "Stores - C",
		itemCode: "ITEM-001",
		itemName: "Widget Alpha",
		description: "Precision Widget",
		actualQty: 5,
		orderedQty: 0,
		plannedQty: 0,
		requestedQty: 0,
		reservedQty: 10,
		reservedQtyForProduction: 0,
		projectedQty: -5,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// buildItemShortageRows — filtering
// ---------------------------------------------------------------------------

describe("buildItemShortageRows – filtering", () => {
	it("excludes rows where projectedQty is exactly zero", () => {
		const rows = buildItemShortageRows([makeRow({ projectedQty: 0 })]);
		expect(rows).toHaveLength(0);
	});

	it("excludes rows where projectedQty is positive", () => {
		const rows = buildItemShortageRows([
			makeRow({ projectedQty: 1 }),
			makeRow({ projectedQty: 100 }),
		]);
		expect(rows).toHaveLength(0);
	});

	it("includes rows where projectedQty is strictly negative", () => {
		const rows = buildItemShortageRows([makeRow({ projectedQty: -1 })]);
		expect(rows).toHaveLength(1);
	});

	it("filters mixed positive/zero/negative rows correctly", () => {
		const rows = buildItemShortageRows([
			makeRow({ id: "k1", itemCode: "ITEM-001", projectedQty: 10 }),
			makeRow({ id: "k2", itemCode: "ITEM-002", projectedQty: 0 }),
			makeRow({ id: "k3", itemCode: "ITEM-003", projectedQty: -3 }),
			makeRow({ id: "k4", itemCode: "ITEM-004", projectedQty: -7 }),
		]);
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.itemCode)).toEqual(
			expect.arrayContaining(["ITEM-003", "ITEM-004"]),
		);
	});

	it("returns an empty array when given an empty input", () => {
		expect(buildItemShortageRows([])).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildItemShortageRows — sorting
// ---------------------------------------------------------------------------

describe("buildItemShortageRows – sorting", () => {
	it("sorts rows by projectedQty ascending (most negative first)", () => {
		const rows = buildItemShortageRows([
			makeRow({ id: "k1", projectedQty: -1 }),
			makeRow({ id: "k2", projectedQty: -10 }),
			makeRow({ id: "k3", projectedQty: -5 }),
		]);
		expect(rows.map((r) => r.projectedQty)).toEqual([-10, -5, -1]);
	});

	it("keeps the single-item result correctly sorted", () => {
		const rows = buildItemShortageRows([makeRow({ projectedQty: -99 })]);
		expect(rows[0].projectedQty).toBe(-99);
	});
});

// ---------------------------------------------------------------------------
// buildItemShortageRows — field mapping
// ---------------------------------------------------------------------------

describe("buildItemShortageRows – field mapping", () => {
	it("maps all expected fields from the source row", () => {
		const source = makeRow({
			id: "MyCompany::WIDGET::Main Warehouse",
			company: "MyCompany",
			warehouse: "Main Warehouse",
			itemCode: "WIDGET-001",
			itemName: "Primary Widget",
			description: "High-grade widget",
			actualQty: 2,
			orderedQty: 1,
			plannedQty: 3,
			requestedQty: 4,
			reservedQty: 8,
			reservedQtyForProduction: 5,
			projectedQty: -3,
		});

		const [row] = buildItemShortageRows([source]);

		expect(row).toMatchObject({
			id: "MyCompany::WIDGET::Main Warehouse",
			company: "MyCompany",
			warehouse: "Main Warehouse",
			itemCode: "WIDGET-001",
			itemName: "Primary Widget",
			description: "High-grade widget",
			actualQty: 2,
			orderedQty: 1,
			plannedQty: 3,
			requestedQty: 4,
			reservedQty: 8,
			reservedQtyForProduction: 5,
			projectedQty: -3,
		});
	});

	it("coerces null itemName and description to null", () => {
		const source = makeRow({
			itemName: undefined,
			description: undefined,
			projectedQty: -2,
		});

		const [row] = buildItemShortageRows([source]);

		expect(row.itemName).toBeNull();
		expect(row.description).toBeNull();
	});
});
