import type { Inventory } from "@aria/types";
import {
	buildSubcontractedItemReceivedRows,
	type SubcontractedItemReceivedSourceRow,
	summarizeSubcontractedItemReceivedRows,
} from "./subcontracted-item-received-report";

function makeSourceRow(
	overrides: Partial<SubcontractedItemReceivedSourceRow> = {},
): SubcontractedItemReceivedSourceRow {
	return {
		id: "item-1",
		subcontractingOrderId: "sco-1",
		subcontractOrder: "MAT-SCO-2026-00001",
		date: new Date("2026-03-01T00:00:00.000Z"),
		supplier: "Test Supplier",
		status: "OPEN",
		percentReceived: 0,
		fgItemCode: "FG-001",
		itemName: "Finished Good Alpha",
		qty: 100,
		receivedQty: 20,
		...overrides,
	};
}

describe("buildSubcontractedItemReceivedRows", () => {
	it("keeps only rows with pending quantity", () => {
		const rows = buildSubcontractedItemReceivedRows([
			makeSourceRow({ id: "pending", qty: 100, receivedQty: 20 }),
			makeSourceRow({ id: "complete", qty: 100, receivedQty: 100 }),
		]);

		expect(rows.map((row) => row.id)).toEqual(["pending"]);
	});

	it("excludes draft and cancelled orders", () => {
		const rows = buildSubcontractedItemReceivedRows([
			makeSourceRow({ id: "draft", status: "DRAFT" }),
			makeSourceRow({ id: "cancelled", status: "CANCELLED" }),
			makeSourceRow({ id: "open", status: "OPEN" }),
		]);

		expect(rows.map((row) => row.id)).toEqual(["open"]);
	});

	it("excludes orders with 100% received", () => {
		const rows = buildSubcontractedItemReceivedRows([
			makeSourceRow({ id: "fully-received", percentReceived: 100 }),
			makeSourceRow({ id: "partial", percentReceived: 50 }),
		]);

		expect(rows.map((row) => row.id)).toEqual(["partial"]);
	});

	it("computes pendingQty as qty minus receivedQty", () => {
		const [row] = buildSubcontractedItemReceivedRows([
			makeSourceRow({ qty: 100, receivedQty: 30 }),
		]);

		expect(row.requiredQty).toBe(100);
		expect(row.receivedQty).toBe(30);
		expect(row.pendingQty).toBe(70);
	});

	it("clamps negative quantities to zero", () => {
		const [row] = buildSubcontractedItemReceivedRows([
			makeSourceRow({ qty: 50, receivedQty: -5 }),
		]);

		expect(row.receivedQty).toBe(0);
		expect(row.pendingQty).toBe(50);
	});

	it("excludes rows where receivedQty exceeds qty", () => {
		const rows = buildSubcontractedItemReceivedRows([
			makeSourceRow({ qty: 10, receivedQty: 15 }),
		]);

		expect(rows).toEqual([]);
	});

	it("sorts by date, then order series, then item code", () => {
		const rows = buildSubcontractedItemReceivedRows([
			makeSourceRow({
				id: "third",
				date: new Date("2026-03-02T00:00:00.000Z"),
			}),
			makeSourceRow({
				id: "second",
				subcontractOrder: "MAT-SCO-2026-00002",
			}),
			makeSourceRow({ id: "first", fgItemCode: "FG-000" }),
		]);

		expect(rows.map((row) => row.id)).toEqual(["first", "second", "third"]);
	});

	it("returns empty array when all items are fully received", () => {
		const rows = buildSubcontractedItemReceivedRows([
			makeSourceRow({ qty: 100, receivedQty: 100 }),
			makeSourceRow({ qty: 50, receivedQty: 50 }),
		]);

		expect(rows).toEqual([]);
	});

	it("handles partially received orders correctly", () => {
		const rows = buildSubcontractedItemReceivedRows([
			makeSourceRow({
				id: "partial",
				status: "PARTIALLY_RECEIVED",
				percentReceived: 40,
				qty: 100,
				receivedQty: 40,
			}),
		]);

		expect(rows).toHaveLength(1);
		expect(rows[0].pendingQty).toBe(60);
	});

	it("preserves item name including null", () => {
		const [withName] = buildSubcontractedItemReceivedRows([
			makeSourceRow({ id: "named", itemName: "Widget A" }),
		]);
		const [withNull] = buildSubcontractedItemReceivedRows([
			makeSourceRow({ id: "unnamed", itemName: null }),
		]);

		expect(withName.itemName).toBe("Widget A");
		expect(withNull.itemName).toBeNull();
	});
});

describe("summarizeSubcontractedItemReceivedRows", () => {
	it("aggregates totals and counts", () => {
		const rows: Inventory.SubcontractedItemToBeReceivedRow[] = [
			buildSubcontractedItemReceivedRows([
				makeSourceRow({
					id: "row-1",
					subcontractingOrderId: "sco-1",
					qty: 100,
					receivedQty: 20,
				}),
			])[0],
			buildSubcontractedItemReceivedRows([
				makeSourceRow({
					id: "row-2",
					subcontractingOrderId: "sco-2",
					qty: 50,
					receivedQty: 10,
				}),
			])[0],
		];

		expect(summarizeSubcontractedItemReceivedRows(rows)).toEqual({
			orderCount: 2,
			rowCount: 2,
			totalRequiredQty: 150,
			totalReceivedQty: 30,
			totalPendingQty: 120,
		});
	});

	it("counts unique orders", () => {
		const rows: Inventory.SubcontractedItemToBeReceivedRow[] = [
			buildSubcontractedItemReceivedRows([
				makeSourceRow({
					id: "row-1",
					subcontractingOrderId: "sco-1",
					fgItemCode: "FG-001",
				}),
			])[0],
			buildSubcontractedItemReceivedRows([
				makeSourceRow({
					id: "row-2",
					subcontractingOrderId: "sco-1",
					fgItemCode: "FG-002",
				}),
			])[0],
		];

		const summary = summarizeSubcontractedItemReceivedRows(rows);
		expect(summary.orderCount).toBe(1);
		expect(summary.rowCount).toBe(2);
	});

	it("returns zeroes for empty array", () => {
		expect(summarizeSubcontractedItemReceivedRows([])).toEqual({
			orderCount: 0,
			rowCount: 0,
			totalRequiredQty: 0,
			totalReceivedQty: 0,
			totalPendingQty: 0,
		});
	});
});
