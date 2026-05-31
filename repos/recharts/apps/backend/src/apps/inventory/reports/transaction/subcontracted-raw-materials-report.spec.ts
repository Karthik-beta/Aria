import type { Inventory } from "@aria/types";
import {
	buildSubcontractedRawMaterialsRows,
	type SubcontractedRawMaterialsSourceRow,
	summarizeSubcontractedRawMaterialsRows,
} from "./subcontracted-raw-materials-report";

function makeSourceRow(
	overrides: Partial<SubcontractedRawMaterialsSourceRow> = {},
): SubcontractedRawMaterialsSourceRow {
	return {
		id: "si-1",
		subcontractingOrderId: "sco-1",
		subcontractOrder: "MAT-SCO-2026-00001",
		date: new Date("2026-03-01T00:00:00.000Z"),
		supplier: "Test Supplier",
		status: "OPEN",
		percentReceived: 0,
		rmItemCode: "RM-001",
		rmItemName: "Raw Material Alpha",
		requiredQty: 10,
		suppliedQty: 2,
		returnedQty: 0,
		...overrides,
	};
}

describe("buildSubcontractedRawMaterialsRows", () => {
	it("keeps only rows with pending quantity", () => {
		const rows = buildSubcontractedRawMaterialsRows([
			makeSourceRow({ id: "pending", requiredQty: 10, suppliedQty: 2 }),
			makeSourceRow({
				id: "complete",
				requiredQty: 10,
				suppliedQty: 10,
				returnedQty: 0,
			}),
		]);

		expect(rows.map((row) => row.id)).toEqual(["pending"]);
	});

	it("excludes draft and cancelled orders", () => {
		const rows = buildSubcontractedRawMaterialsRows([
			makeSourceRow({ id: "draft", status: "DRAFT" }),
			makeSourceRow({ id: "cancelled", status: "CANCELLED" }),
			makeSourceRow({ id: "open", status: "OPEN" }),
		]);

		expect(rows.map((row) => row.id)).toEqual(["open"]);
	});

	it("excludes orders with 100% received", () => {
		const rows = buildSubcontractedRawMaterialsRows([
			makeSourceRow({ id: "fully-received", percentReceived: 100 }),
			makeSourceRow({ id: "partial", percentReceived: 50 }),
		]);

		expect(rows.map((row) => row.id)).toEqual(["partial"]);
	});

	it("computes transferredQty as suppliedQty minus returnedQty", () => {
		const [row] = buildSubcontractedRawMaterialsRows([
			makeSourceRow({
				requiredQty: 20,
				suppliedQty: 12,
				returnedQty: 3,
			}),
		]);

		expect(row.requiredQty).toBe(20);
		expect(row.transferredQty).toBe(9);
		expect(row.returnedQty).toBe(3);
		expect(row.pendingQty).toBe(11);
	});

	it("computes pendingQty as requiredQty minus transferredQty", () => {
		const [row] = buildSubcontractedRawMaterialsRows([
			makeSourceRow({
				requiredQty: 15,
				suppliedQty: 5,
				returnedQty: 0,
			}),
		]);

		expect(row.pendingQty).toBe(10);
	});

	it("clamps negative quantities to zero", () => {
		const [row] = buildSubcontractedRawMaterialsRows([
			makeSourceRow({
				requiredQty: 10,
				suppliedQty: -2,
				returnedQty: -1,
			}),
		]);

		expect(row.transferredQty).toBe(0);
		expect(row.returnedQty).toBe(0);
		expect(row.pendingQty).toBe(10);
	});

	it("sorts by date, then order series, then item code", () => {
		const rows = buildSubcontractedRawMaterialsRows([
			makeSourceRow({
				id: "third",
				date: new Date("2026-03-02T00:00:00.000Z"),
			}),
			makeSourceRow({
				id: "second",
				subcontractOrder: "MAT-SCO-2026-00002",
			}),
			makeSourceRow({ id: "first", rmItemCode: "RM-000" }),
		]);

		expect(rows.map((row) => row.id)).toEqual(["first", "second", "third"]);
	});

	it("returns empty array when all rows are fully supplied", () => {
		const rows = buildSubcontractedRawMaterialsRows([
			makeSourceRow({ requiredQty: 10, suppliedQty: 10, returnedQty: 0 }),
			makeSourceRow({ requiredQty: 5, suppliedQty: 8, returnedQty: 0 }),
		]);

		expect(rows).toEqual([]);
	});
});

describe("summarizeSubcontractedRawMaterialsRows", () => {
	it("aggregates totals and counts", () => {
		const rows: Inventory.SubcontractedRawMaterialsRow[] = [
			buildSubcontractedRawMaterialsRows([
				makeSourceRow({
					id: "row-1",
					subcontractingOrderId: "sco-1",
					requiredQty: 10,
					suppliedQty: 2,
					returnedQty: 0,
				}),
			])[0],
			buildSubcontractedRawMaterialsRows([
				makeSourceRow({
					id: "row-2",
					subcontractingOrderId: "sco-2",
					requiredQty: 20,
					suppliedQty: 8,
					returnedQty: 3,
				}),
			])[0],
		];

		expect(summarizeSubcontractedRawMaterialsRows(rows)).toEqual({
			orderCount: 2,
			rowCount: 2,
			totalRequiredQty: 30,
			totalTransferredQty: 7,
			totalReturnedQty: 3,
			totalPendingQty: 23,
		});
	});

	it("counts unique orders", () => {
		const rows: Inventory.SubcontractedRawMaterialsRow[] = [
			buildSubcontractedRawMaterialsRows([
				makeSourceRow({
					id: "row-1",
					subcontractingOrderId: "sco-1",
					rmItemCode: "RM-001",
				}),
			])[0],
			buildSubcontractedRawMaterialsRows([
				makeSourceRow({
					id: "row-2",
					subcontractingOrderId: "sco-1",
					rmItemCode: "RM-002",
				}),
			])[0],
		];

		const summary = summarizeSubcontractedRawMaterialsRows(rows);
		expect(summary.orderCount).toBe(1);
		expect(summary.rowCount).toBe(2);
	});

	it("returns zeroes for empty array", () => {
		expect(summarizeSubcontractedRawMaterialsRows([])).toEqual({
			orderCount: 0,
			rowCount: 0,
			totalRequiredQty: 0,
			totalTransferredQty: 0,
			totalReturnedQty: 0,
			totalPendingQty: 0,
		});
	});
});
