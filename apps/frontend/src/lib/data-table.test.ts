import { describe, expect, it } from "vitest";
import type { ExtendedColumnFilter } from "@/types/data-table";
import {
	getDefaultFilterOperator,
	getFilterOperators,
	getValidFilters,
} from "./data-table";

describe("getFilterOperators", () => {
	it("returns text operators for 'text' variant", () => {
		const ops = getFilterOperators("text");
		expect(ops.length).toBeGreaterThan(0);
		expect(ops.some((o) => o.value === "iLike")).toBe(true);
	});

	it("returns numeric operators for 'number' variant", () => {
		const ops = getFilterOperators("number");
		expect(ops.some((o) => o.value === "gt")).toBe(true);
		expect(ops.some((o) => o.value === "lt")).toBe(true);
	});

	it("returns numeric operators for 'range' variant", () => {
		const ops = getFilterOperators("range");
		expect(ops.some((o) => o.value === "gte")).toBe(true);
	});

	it("returns date operators for 'date' variant", () => {
		const ops = getFilterOperators("date");
		expect(ops.some((o) => o.value === "isBetween")).toBe(true);
	});

	it("returns boolean operators for 'boolean' variant", () => {
		const ops = getFilterOperators("boolean");
		expect(ops).toHaveLength(2);
		expect(ops.some((o) => o.value === "eq")).toBe(true);
	});

	it("returns select operators for 'select' variant", () => {
		const ops = getFilterOperators("select");
		expect(ops.some((o) => o.value === "eq")).toBe(true);
		expect(ops.some((o) => o.value === "ne")).toBe(true);
	});

	it("returns multiSelect operators for 'multiSelect' variant", () => {
		const ops = getFilterOperators("multiSelect");
		expect(ops.some((o) => o.value === "inArray")).toBe(true);
	});
});

describe("getDefaultFilterOperator", () => {
	it("returns 'iLike' for text filters", () => {
		expect(getDefaultFilterOperator("text")).toBe("iLike");
	});

	it("returns 'eq' for number filters", () => {
		expect(getDefaultFilterOperator("number")).toBe("eq");
	});

	it("returns 'eq' for boolean filters", () => {
		expect(getDefaultFilterOperator("boolean")).toBe("eq");
	});

	it("returns 'eq' for date filters", () => {
		expect(getDefaultFilterOperator("date")).toBe("eq");
	});
});

describe("getValidFilters", () => {
	type TestData = { name: string; count: number };

	const baseFilter: ExtendedColumnFilter<TestData> = {
		id: "name",
		value: "test",
		variant: "text",
		operator: "iLike",
		filterId: "f1",
	};

	it("keeps filters with non-empty string values", () => {
		const result = getValidFilters([baseFilter]);
		expect(result).toHaveLength(1);
	});

	it("removes filters with empty string values", () => {
		const result = getValidFilters([{ ...baseFilter, value: "" }]);
		expect(result).toHaveLength(0);
	});

	it("removes filters with null values", () => {
		const result = getValidFilters([
			{ ...baseFilter, value: null as unknown as string },
		]);
		expect(result).toHaveLength(0);
	});

	it("removes filters with undefined values", () => {
		const result = getValidFilters([
			{ ...baseFilter, value: undefined as unknown as string },
		]);
		expect(result).toHaveLength(0);
	});

	it("keeps filters with non-empty array values", () => {
		const result = getValidFilters([
			{ ...baseFilter, value: ["a", "b"], operator: "inArray" },
		]);
		expect(result).toHaveLength(1);
	});

	it("removes filters with empty array values", () => {
		const result = getValidFilters([
			{ ...baseFilter, value: [], operator: "inArray" },
		]);
		expect(result).toHaveLength(0);
	});

	it("keeps isEmpty operator regardless of value", () => {
		const result = getValidFilters([
			{ ...baseFilter, value: "", operator: "isEmpty" },
		]);
		expect(result).toHaveLength(1);
	});

	it("keeps isNotEmpty operator regardless of value", () => {
		const result = getValidFilters([
			{ ...baseFilter, value: "", operator: "isNotEmpty" },
		]);
		expect(result).toHaveLength(1);
	});
});
