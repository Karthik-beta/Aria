import type { Inventory } from "@aria/types";
import {
	buildRequestedItemsToBeTransferredRows,
	type RequestedItemsToBeTransferredSourceRow,
	summarizeRequestedItemsToBeTransferredRows,
} from "./requested-items-to-be-transferred-report";

function makeSourceRow(
	overrides: Partial<RequestedItemsToBeTransferredSourceRow> = {},
): RequestedItemsToBeTransferredSourceRow {
	return {
		id: "mri-1",
		materialRequestId: "mr-1",
		materialRequest: "MAT-MRQ-2026-00001",
		date: new Date("2026-03-01T00:00:00.000Z"),
		purpose: "MATERIAL_TRANSFER",
		status: "APPROVED",
		itemCode: "ITEM-001",
		itemName: "Widget Alpha",
		description: "Primary widget",
		company: "Aria Corp",
		targetWarehouse: "Stores - AC",
		requiredBy: new Date("2026-03-05T00:00:00.000Z"),
		unitOfMeasure: "Nos",
		qty: 10,
		transferredQty: 4,
		...overrides,
	};
}

describe("buildRequestedItemsToBeTransferredRows", () => {
	it("keeps only transfer and issue requests with pending quantity", () => {
		const rows = buildRequestedItemsToBeTransferredRows([
			makeSourceRow({ id: "keep-1", purpose: "MATERIAL_TRANSFER" }),
			makeSourceRow({ id: "keep-2", purpose: "MATERIAL_ISSUE" }),
			makeSourceRow({ id: "drop-1", purpose: "PURCHASE" }),
			makeSourceRow({ id: "drop-2", transferredQty: 10 }),
		]);

		expect(rows.map((row) => row.id)).toEqual(["keep-1", "keep-2"]);
	});

	it("excludes draft and cancelled requests", () => {
		const rows = buildRequestedItemsToBeTransferredRows([
			makeSourceRow({ id: "draft", status: "DRAFT" }),
			makeSourceRow({ id: "cancelled", status: "CANCELLED" }),
			makeSourceRow({ id: "approved", status: "APPROVED" }),
		]);

		expect(rows.map((row) => row.id)).toEqual(["approved"]);
	});

	it("computes qty to transfer from requested minus transferred quantity", () => {
		const [row] = buildRequestedItemsToBeTransferredRows([
			makeSourceRow({ qty: 12.5, transferredQty: 3.25 }),
		]);

		expect(row.qty).toBe(12.5);
		expect(row.transferredQty).toBe(3.25);
		expect(row.qtyToTransfer).toBe(9.25);
	});

	it("sorts by date, then request series, then item code", () => {
		const rows = buildRequestedItemsToBeTransferredRows([
			makeSourceRow({
				id: "third",
				date: new Date("2026-03-02T00:00:00.000Z"),
			}),
			makeSourceRow({ id: "second", materialRequest: "MAT-MRQ-2026-00002" }),
			makeSourceRow({ id: "first", itemCode: "ITEM-000" }),
		]);

		expect(rows.map((row) => row.id)).toEqual(["first", "second", "third"]);
	});
});

describe("summarizeRequestedItemsToBeTransferredRows", () => {
	it("aggregates totals and row splits", () => {
		const rows: Inventory.RequestedItemsToBeTransferredRow[] = [
			buildRequestedItemsToBeTransferredRows([
				makeSourceRow({
					id: "row-1",
					materialRequestId: "mr-1",
					qty: 10,
					transferredQty: 4,
				}),
			])[0],
			buildRequestedItemsToBeTransferredRows([
				makeSourceRow({
					id: "row-2",
					materialRequestId: "mr-2",
					purpose: "MATERIAL_ISSUE",
					qty: 5,
					transferredQty: 1,
				}),
			])[0],
		];

		expect(summarizeRequestedItemsToBeTransferredRows(rows)).toEqual({
			requestCount: 2,
			rowCount: 2,
			totalQty: 15,
			totalTransferredQty: 5,
			totalQtyToTransfer: 10,
			transferRowCount: 1,
			issueRowCount: 1,
		});
	});
});
