import {
	buildStockAnalyticsRows,
	getPeriodDateRanges,
	type StockAnalyticsSourceEntry,
} from "./stock-analytics-report";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
	overrides: Partial<StockAnalyticsSourceEntry> = {},
): StockAnalyticsSourceEntry {
	return {
		company: "Test Corp",
		itemCode: "ITEM-001",
		warehouse: "Stores - TC",
		postingDate: new Date("2024-01-15T00:00:00.000Z"),
		qtyChange: 0,
		valueChange: 0,
		...overrides,
	};
}

const BASE_OPTIONS = {
	fromDate: new Date("2024-01-01T00:00:00.000Z"),
	toDate: new Date("2024-03-31T00:00:00.000Z"),
	frequency: "Monthly" as const,
	valueQuantity: "Quantity" as const,
	today: new Date("2024-03-31T00:00:00.000Z"),
};

// ---------------------------------------------------------------------------
// getPeriodDateRanges
// ---------------------------------------------------------------------------

describe("getPeriodDateRanges", () => {
	it("generates monthly periods from Jan to Mar", () => {
		const periods = getPeriodDateRanges(
			new Date("2024-01-01T00:00:00.000Z"),
			new Date("2024-03-31T00:00:00.000Z"),
			"Monthly",
		);

		expect(periods).toHaveLength(3);
		expect(periods[0].label).toBe("Jan 2024");
		expect(periods[1].label).toBe("Feb 2024");
		expect(periods[2].label).toBe("Mar 2024");
	});

	it("generates quarterly periods", () => {
		const periods = getPeriodDateRanges(
			new Date("2024-01-01T00:00:00.000Z"),
			new Date("2024-12-31T00:00:00.000Z"),
			"Quarterly",
		);

		expect(periods).toHaveLength(4);
		expect(periods[0].label).toBe("Q1 2024");
		expect(periods[1].label).toBe("Q2 2024");
		expect(periods[2].label).toBe("Q3 2024");
		expect(periods[3].label).toBe("Q4 2024");
	});

	it("generates yearly periods for a multi-year range", () => {
		const periods = getPeriodDateRanges(
			new Date("2022-01-01T00:00:00.000Z"),
			new Date("2024-12-31T00:00:00.000Z"),
			"Yearly",
		);

		expect(periods).toHaveLength(3);
		expect(periods.map((p) => p.label)).toEqual(["2022", "2023", "2024"]);
	});

	it("generates weekly periods and caps correctly at toDate", () => {
		// 2024-01-01 is a Monday (ISO week 1)
		const periods = getPeriodDateRanges(
			new Date("2024-01-01T00:00:00.000Z"),
			new Date("2024-01-21T00:00:00.000Z"),
			"Weekly",
		);

		expect(periods).toHaveLength(3);
		// Last period end should not exceed toDate
		expect(periods[2].to.getTime()).toBeLessThanOrEqual(
			new Date("2024-01-21T00:00:00.000Z").getTime(),
		);
	});

	it("produces unique, snake_case period keys", () => {
		const periods = getPeriodDateRanges(
			new Date("2024-01-01T00:00:00.000Z"),
			new Date("2024-03-31T00:00:00.000Z"),
			"Monthly",
		);

		const keys = periods.map((p) => p.key);
		const uniqueKeys = new Set(keys);
		expect(uniqueKeys.size).toBe(keys.length);
		for (const key of keys) {
			expect(key).toMatch(/^[a-z0-9_]+$/);
		}
	});

	it("caps output at 260 buckets (max guard)", () => {
		// Weekly over 10 years would normally produce ~520 buckets
		const periods = getPeriodDateRanges(
			new Date("2020-01-01T00:00:00.000Z"),
			new Date("2030-01-01T00:00:00.000Z"),
			"Weekly",
		);

		expect(periods.length).toBeLessThanOrEqual(260);
	});

	it("returns empty array when fromDate is after toDate", () => {
		const periods = getPeriodDateRanges(
			new Date("2024-06-01T00:00:00.000Z"),
			new Date("2024-01-01T00:00:00.000Z"),
			"Monthly",
		);

		expect(periods).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// buildStockAnalyticsRows
// ---------------------------------------------------------------------------

describe("buildStockAnalyticsRows", () => {
	it("accumulates a running quantity balance across periods", () => {
		const entries: StockAnalyticsSourceEntry[] = [
			makeEntry({
				postingDate: new Date("2024-01-10T00:00:00.000Z"),
				qtyChange: 10,
			}),
			makeEntry({
				postingDate: new Date("2024-02-05T00:00:00.000Z"),
				qtyChange: 5,
			}),
			makeEntry({
				postingDate: new Date("2024-03-12T00:00:00.000Z"),
				qtyChange: -3,
			}),
		];

		const result = buildStockAnalyticsRows(entries, new Map(), BASE_OPTIONS);

		expect(result.rows).toHaveLength(1);
		const row = result.rows[0];

		expect(row.periodValues.jan_2024).toBe(10);
		expect(row.periodValues.feb_2024).toBe(15);
		expect(row.periodValues.mar_2024).toBe(12);
	});

	it("uses value change when valueQuantity is Value", () => {
		const entries: StockAnalyticsSourceEntry[] = [
			makeEntry({
				postingDate: new Date("2024-01-10T00:00:00.000Z"),
				qtyChange: 5,
				valueChange: 25000,
			}),
		];

		const result = buildStockAnalyticsRows(entries, new Map(), {
			...BASE_OPTIONS,
			valueQuantity: "Value",
		});

		expect(result.rows[0].periodValues.jan_2024).toBe(25000);
	});

	it("carries forward balance into periods with no movements", () => {
		const entries: StockAnalyticsSourceEntry[] = [
			makeEntry({
				postingDate: new Date("2024-01-10T00:00:00.000Z"),
				qtyChange: 10,
			}),
			// No movement in Feb or Mar
		];

		const result = buildStockAnalyticsRows(entries, new Map(), BASE_OPTIONS);
		const row = result.rows[0];

		expect(row.periodValues.jan_2024).toBe(10);
		expect(row.periodValues.feb_2024).toBe(10);
		expect(row.periodValues.mar_2024).toBe(10);
	});

	it("assigns null to future periods", () => {
		const entries: StockAnalyticsSourceEntry[] = [
			makeEntry({
				postingDate: new Date("2024-01-10T00:00:00.000Z"),
				qtyChange: 10,
			}),
		];

		const result = buildStockAnalyticsRows(entries, new Map(), {
			...BASE_OPTIONS,
			// today is Feb 15, so Mar is a future period
			today: new Date("2024-02-15T00:00:00.000Z"),
		});
		const row = result.rows[0];

		expect(row.periodValues.jan_2024).toBe(10);
		expect(row.periodValues.feb_2024).toBe(10);
		expect(row.periodValues.mar_2024).toBeNull();
	});

	it("sums balances across multiple warehouses for the same item", () => {
		const entries: StockAnalyticsSourceEntry[] = [
			makeEntry({
				postingDate: new Date("2024-01-10T00:00:00.000Z"),
				warehouse: "Stores - TC",
				qtyChange: 10,
			}),
			makeEntry({
				postingDate: new Date("2024-01-12T00:00:00.000Z"),
				warehouse: "Finished Goods - TC",
				qtyChange: 5,
			}),
		];

		const result = buildStockAnalyticsRows(entries, new Map(), BASE_OPTIONS);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].periodValues.jan_2024).toBe(15);
	});

	it("handles multiple items independently and sorts by item code", () => {
		const entries: StockAnalyticsSourceEntry[] = [
			makeEntry({
				itemCode: "ITEM-002",
				postingDate: new Date("2024-01-10T00:00:00.000Z"),
				qtyChange: 3,
			}),
			makeEntry({
				itemCode: "ITEM-001",
				postingDate: new Date("2024-01-15T00:00:00.000Z"),
				qtyChange: 7,
			}),
		];

		const result = buildStockAnalyticsRows(entries, new Map(), BASE_OPTIONS);

		expect(result.rows).toHaveLength(2);
		expect(result.rows[0].itemCode).toBe("ITEM-001");
		expect(result.rows[1].itemCode).toBe("ITEM-002");
	});

	it("attaches item metadata from the provided map", () => {
		const entries: StockAnalyticsSourceEntry[] = [makeEntry({ qtyChange: 1 })];
		const meta = new Map([
			[
				"ITEM-001",
				{
					itemName: "Test Widget",
					itemGroup: "Electronics",
					brand: "Acme",
					unitOfMeasure: "Nos",
				},
			],
		]);

		const result = buildStockAnalyticsRows(entries, meta, BASE_OPTIONS);

		expect(result.rows[0]).toMatchObject({
			itemName: "Test Widget",
			itemGroup: "Electronics",
			brand: "Acme",
			unitOfMeasure: "Nos",
		});
	});

	it("returns empty rows and periods when entries is empty", () => {
		const result = buildStockAnalyticsRows([], new Map(), BASE_OPTIONS);

		expect(result.rows).toHaveLength(0);
		// periods are still generated even with no entries
		expect(result.periods).toHaveLength(3);
	});

	it("assigns zero balance to past periods with no movements", () => {
		const entries: StockAnalyticsSourceEntry[] = [
			makeEntry({
				postingDate: new Date("2024-03-10T00:00:00.000Z"),
				qtyChange: 5,
			}),
		];

		const result = buildStockAnalyticsRows(entries, new Map(), BASE_OPTIONS);
		const row = result.rows[0];

		// Jan and Feb are past but item had no movements → 0 (not null)
		expect(row.periodValues.jan_2024).toBe(0);
		expect(row.periodValues.feb_2024).toBe(0);
		expect(row.periodValues.mar_2024).toBe(5);
	});

	it("returns empty result when period list is empty (fromDate > toDate)", () => {
		const result = buildStockAnalyticsRows(
			[makeEntry({ qtyChange: 10 })],
			new Map(),
			{
				fromDate: new Date("2024-06-01T00:00:00.000Z"),
				toDate: new Date("2024-01-01T00:00:00.000Z"),
				frequency: "Monthly",
				valueQuantity: "Quantity",
			},
		);

		expect(result.rows).toHaveLength(0);
		expect(result.periods).toHaveLength(0);
	});
});
