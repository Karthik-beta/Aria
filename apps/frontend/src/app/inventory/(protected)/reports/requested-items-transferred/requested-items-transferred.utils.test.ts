import type { Inventory } from "@aria/types";
import { describe, expect, it } from "vitest";
import {
	buildPendingItemChartData,
	formatDate,
	formatPurpose,
	formatQty,
} from "./requested-items-transferred.utils";

type Row = Inventory.RequestedItemsToBeTransferredRow;

function makeRow(overrides: Partial<Row> = {}): Row {
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
		qtyToTransfer: 6,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// formatQty
// ---------------------------------------------------------------------------

describe("formatQty", () => {
	it("formats whole numbers without unnecessary decimals", () => {
		expect(formatQty(100)).toBe("100");
	});

	it("formats decimal numbers with up to 3 decimal places", () => {
		expect(formatQty(12.345)).toBe("12.345");
	});

	it("rounds beyond 3 decimals", () => {
		expect(formatQty(1.23456)).toBe("1.235");
	});

	it("handles zero", () => {
		expect(formatQty(0)).toBe("0");
	});
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
	it("returns — for null", () => {
		expect(formatDate(null)).toBe("—");
	});

	it("returns — for undefined", () => {
		expect(formatDate(undefined)).toBe("—");
	});

	it("returns — for invalid date string", () => {
		expect(formatDate("not-a-date")).toBe("—");
	});

	it("formats a valid Date object", () => {
		const result = formatDate(new Date("2026-03-15T00:00:00.000Z"));
		expect(result).toBeTruthy();
		expect(result).not.toBe("—");
	});

	it("formats a valid date string", () => {
		const result = formatDate("2026-03-15T00:00:00.000Z");
		expect(result).toBeTruthy();
		expect(result).not.toBe("—");
	});
});

// ---------------------------------------------------------------------------
// formatPurpose
// ---------------------------------------------------------------------------

describe("formatPurpose", () => {
	it("formats MATERIAL_TRANSFER", () => {
		expect(formatPurpose("MATERIAL_TRANSFER")).toBe("Material Transfer");
	});

	it("formats MATERIAL_ISSUE", () => {
		expect(formatPurpose("MATERIAL_ISSUE")).toBe("Material Issue");
	});
});

// ---------------------------------------------------------------------------
// buildPendingItemChartData
// ---------------------------------------------------------------------------

describe("buildPendingItemChartData", () => {
	it("aggregates qtyToTransfer by item code", () => {
		const rows = [
			makeRow({
				id: "r1",
				itemCode: "ITEM-001",
				qtyToTransfer: 6,
				materialRequestId: "mr-1",
			}),
			makeRow({
				id: "r2",
				itemCode: "ITEM-001",
				qtyToTransfer: 4,
				materialRequestId: "mr-2",
			}),
			makeRow({
				id: "r3",
				itemCode: "ITEM-002",
				qtyToTransfer: 20,
				materialRequestId: "mr-1",
			}),
		];

		const data = buildPendingItemChartData(rows);

		expect(data).toHaveLength(2);
		expect(data[0].label).toBe("ITEM-002");
		expect(data[0].qtyToTransfer).toBe(20);
		expect(data[0].requestCount).toBe(1);
		expect(data[1].label).toBe("ITEM-001");
		expect(data[1].qtyToTransfer).toBe(10);
		expect(data[1].requestCount).toBe(2);
	});

	it("limits chart entries to specified count", () => {
		const rows = Array.from({ length: 12 }, (_, i) =>
			makeRow({
				id: `r-${i}`,
				itemCode: `ITEM-${String(i).padStart(3, "0")}`,
				qtyToTransfer: 100 - i,
			}),
		);

		expect(buildPendingItemChartData(rows, 5)).toHaveLength(5);
	});

	it("returns empty array for no rows", () => {
		expect(buildPendingItemChartData([])).toEqual([]);
	});

	it("sorts descending by qtyToTransfer", () => {
		const rows = [
			makeRow({ id: "r1", itemCode: "A", qtyToTransfer: 3 }),
			makeRow({ id: "r2", itemCode: "B", qtyToTransfer: 15 }),
			makeRow({ id: "r3", itemCode: "C", qtyToTransfer: 7 }),
		];

		const data = buildPendingItemChartData(rows);
		expect(data.map((d) => d.label)).toEqual(["B", "C", "A"]);
	});
});
