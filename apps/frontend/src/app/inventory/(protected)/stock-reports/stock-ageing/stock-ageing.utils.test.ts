import { describe, expect, it } from "vitest";
import {
	buildStockAgeingChartData,
	classifyStockAgeingHealth,
	formatCompactDate,
	formatOptionalText,
	formatStockAgeingBucketLabel,
	formatStockAgeingCurrency,
	formatStockAgeingQuantity,
	parseAgeingRangeInput,
	safeParseAgeingRangeInput,
} from "./stock-ageing.utils";

describe("stock-ageing.utils", () => {
	it("formats quantities and currency values", () => {
		expect(formatStockAgeingQuantity(42)).toBe("42.000");
		expect(formatStockAgeingCurrency(1234.5, "USD")).toContain("1,234.50");
	});

	it("formats dates, labels, and optional text safely", () => {
		expect(formatCompactDate(new Date("2026-03-24T00:00:00.000Z"))).toBe(
			"24/03/2026",
		);
		expect(formatOptionalText("   ")).toBe("-");
		expect(
			formatStockAgeingBucketLabel({
				index: 0,
				minAge: 31,
				maxAge: 60,
				quantity: 0,
				value: 0,
			}),
		).toBe("31 - 60");
	});

	it("parses and validates ageing range inputs", () => {
		expect(parseAgeingRangeInput("60, 30, 90, 30")).toEqual([30, 60, 90]);
		expect(safeParseAgeingRangeInput("")).toEqual({
			ranges: [30, 60, 90],
			error: null,
		});
		expect(safeParseAgeingRangeInput("30, invalid")).toEqual({
			ranges: [30, 60, 90],
			error: "Ageing ranges must be comma-separated positive integers",
		});
	});

	it("classifies ageing health and builds chart data", () => {
		expect(classifyStockAgeingHealth(20)).toBe("FRESH");
		expect(classifyStockAgeingHealth(75)).toBe("WATCH");
		expect(classifyStockAgeingHealth(200)).toBe("AGED");
		expect(classifyStockAgeingHealth(500)).toBe("OBSOLETE");

		const chartRows = buildStockAgeingChartData([
			{
				id: "row-1",
				company: "Aria Corp",
				itemCode: "ITEM-001",
				itemName: "Item One",
				description: null,
				itemGroupName: null,
				brandName: null,
				warehouse: null,
				unitOfMeasure: "Nos",
				availableQty: 5,
				averageAge: 40,
				averageRate: 100,
				asOfDate: new Date("2026-03-24T00:00:00.000Z"),
				buckets: [],
			},
			{
				id: "row-2",
				company: "Aria Corp",
				itemCode: "ITEM-002",
				itemName: "Item Two",
				description: null,
				itemGroupName: null,
				brandName: null,
				warehouse: null,
				unitOfMeasure: "Nos",
				availableQty: 3,
				averageAge: 75,
				averageRate: 120,
				asOfDate: new Date("2026-03-24T00:00:00.000Z"),
				buckets: [],
			},
		]);

		expect(chartRows.map((row) => row.label)).toEqual(["ITEM-002", "ITEM-001"]);
	});
});
