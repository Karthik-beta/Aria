import { describe, expect, it } from "vitest";
import {
	buildPendingMaterialChartData,
	formatDate,
	formatQty,
	getDefaultFromDate,
	getDefaultToDate,
	type SubcontractedRawMaterialsRow,
} from "./subcontracted-raw-materials-transferred.utils";

function makeRow(
	overrides: Partial<SubcontractedRawMaterialsRow> = {},
): SubcontractedRawMaterialsRow {
	return {
		id: "si-1",
		subcontractingOrderId: "sco-1",
		subcontractOrder: "MAT-SCO-2026-00001",
		date: new Date("2026-03-01T00:00:00.000Z"),
		supplier: "Test Supplier",
		rmItemCode: "RM-001",
		rmItemName: "Raw Material Alpha",
		requiredQty: 10,
		transferredQty: 2,
		returnedQty: 0,
		pendingQty: 8,
		...overrides,
	};
}

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

describe("formatDate", () => {
	it("returns dash for null", () => {
		expect(formatDate(null)).toBe("—");
	});

	it("returns dash for undefined", () => {
		expect(formatDate(undefined)).toBe("—");
	});

	it("returns dash for invalid date string", () => {
		expect(formatDate("not-a-date")).toBe("—");
	});

	it("formats a valid date object", () => {
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

describe("getDefaultFromDate", () => {
	it("returns a YYYY-MM-DD string", () => {
		const result = getDefaultFromDate();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("getDefaultToDate", () => {
	it("returns a YYYY-MM-DD string", () => {
		const result = getDefaultToDate();
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("is not earlier than getDefaultFromDate", () => {
		expect(getDefaultToDate() >= getDefaultFromDate()).toBe(true);
	});
});

describe("buildPendingMaterialChartData", () => {
	it("aggregates pending qty by item code", () => {
		const rows = [
			makeRow({
				id: "r1",
				rmItemCode: "RM-001",
				pendingQty: 5,
				subcontractingOrderId: "sco-1",
			}),
			makeRow({
				id: "r2",
				rmItemCode: "RM-001",
				pendingQty: 3,
				subcontractingOrderId: "sco-2",
			}),
			makeRow({
				id: "r3",
				rmItemCode: "RM-002",
				pendingQty: 10,
				subcontractingOrderId: "sco-1",
			}),
		];

		const data = buildPendingMaterialChartData(rows);

		expect(data).toHaveLength(2);
		expect(data[0].label).toBe("RM-002");
		expect(data[0].pendingQty).toBe(10);
		expect(data[0].orderCount).toBe(1);
		expect(data[1].label).toBe("RM-001");
		expect(data[1].pendingQty).toBe(8);
		expect(data[1].orderCount).toBe(2);
	});

	it("limits chart entries to specified count", () => {
		const rows = Array.from({ length: 12 }, (_, i) =>
			makeRow({
				id: `r-${i}`,
				rmItemCode: `RM-${String(i).padStart(3, "0")}`,
				pendingQty: 100 - i,
			}),
		);

		expect(buildPendingMaterialChartData(rows, 5)).toHaveLength(5);
	});

	it("returns empty array for no rows", () => {
		expect(buildPendingMaterialChartData([])).toEqual([]);
	});

	it("sorts descending by pendingQty", () => {
		const rows = [
			makeRow({ id: "r1", rmItemCode: "RM-A", pendingQty: 3 }),
			makeRow({ id: "r2", rmItemCode: "RM-B", pendingQty: 15 }),
			makeRow({ id: "r3", rmItemCode: "RM-C", pendingQty: 7 }),
		];

		const data = buildPendingMaterialChartData(rows);
		expect(data.map((d) => d.label)).toEqual(["RM-B", "RM-C", "RM-A"]);
	});
});
