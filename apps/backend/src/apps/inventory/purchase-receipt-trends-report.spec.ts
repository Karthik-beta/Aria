import {
	buildPurchaseReceiptTrendsPeriods,
	buildPurchaseReceiptTrendsRows,
	type PurchaseReceiptTrendsSourceEntry,
} from "./purchase-receipt-trends-report";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
	overrides: Partial<PurchaseReceiptTrendsSourceEntry> = {},
): PurchaseReceiptTrendsSourceEntry {
	return {
		postingDate: new Date("2024-01-15T00:00:00.000Z"),
		quantity: 10,
		amount: 1000,
		dimensionKey: "ITEM-001",
		dimensionLabel: "Test Item",
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// buildPurchaseReceiptTrendsPeriods
// ---------------------------------------------------------------------------

describe("buildPurchaseReceiptTrendsPeriods", () => {
	it("generates monthly periods covering a 3-month range", () => {
		const periods = buildPurchaseReceiptTrendsPeriods(
			new Date("2024-01-01T00:00:00.000Z"),
			new Date("2024-03-31T00:00:00.000Z"),
			"Monthly",
		);

		expect(periods).toHaveLength(3);
		expect(periods[0].label).toBe("Jan 2024");
		expect(periods[1].label).toBe("Feb 2024");
		expect(periods[2].label).toBe("Mar 2024");
	});

	it("generates quarterly periods for a full year", () => {
		const periods = buildPurchaseReceiptTrendsPeriods(
			new Date("2024-01-01T00:00:00.000Z"),
			new Date("2024-12-31T00:00:00.000Z"),
			"Quarterly",
		);

		expect(periods).toHaveLength(4);
		expect(periods[0].label).toBe("Jan–Mar 2024");
		expect(periods[1].label).toBe("Apr–Jun 2024");
		expect(periods[2].label).toBe("Jul–Sep 2024");
		expect(periods[3].label).toBe("Oct–Dec 2024");
	});

	it("generates half-yearly periods for a full year", () => {
		const periods = buildPurchaseReceiptTrendsPeriods(
			new Date("2024-01-01T00:00:00.000Z"),
			new Date("2024-12-31T00:00:00.000Z"),
			"Half-Yearly",
		);

		expect(periods).toHaveLength(2);
		expect(periods[0].label).toBe("Jan–Jun 2024");
		expect(periods[1].label).toBe("Jul–Dec 2024");
	});

	it("generates a yearly period", () => {
		const periods = buildPurchaseReceiptTrendsPeriods(
			new Date("2024-01-01T00:00:00.000Z"),
			new Date("2024-12-31T00:00:00.000Z"),
			"Yearly",
		);

		expect(periods).toHaveLength(1);
		expect(periods[0].label).toBe("2024");
	});

	it("produces unique snake_cased keys for each period", () => {
		const periods = buildPurchaseReceiptTrendsPeriods(
			new Date("2024-01-01T00:00:00.000Z"),
			new Date("2024-03-31T00:00:00.000Z"),
			"Monthly",
		);

		const keys = periods.map((p) => p.key);
		const unique = new Set(keys);
		expect(unique.size).toBe(keys.length);
	});

	it("handles ranges starting mid-month (snaps to month start)", () => {
		const periods = buildPurchaseReceiptTrendsPeriods(
			new Date("2024-01-15T00:00:00.000Z"),
			new Date("2024-02-29T00:00:00.000Z"),
			"Monthly",
		);

		// Should include Jan since start snaps to Jan 1
		expect(periods.length).toBeGreaterThanOrEqual(1);
		expect(periods[0].label).toBe("Jan 2024");
	});

	it("handles cross-year quarterly periods", () => {
		const periods = buildPurchaseReceiptTrendsPeriods(
			new Date("2023-10-01T00:00:00.000Z"),
			new Date("2024-03-31T00:00:00.000Z"),
			"Quarterly",
		);

		expect(periods.length).toBe(2);
		expect(periods[0].label).toBe("Oct–Dec 2023");
		expect(periods[1].label).toBe("Jan–Mar 2024");
	});

	it("returns an empty array when toDate < fromDate", () => {
		const periods = buildPurchaseReceiptTrendsPeriods(
			new Date("2024-06-01T00:00:00.000Z"),
			new Date("2024-01-01T00:00:00.000Z"),
			"Monthly",
		);

		expect(periods).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// buildPurchaseReceiptTrendsRows
// ---------------------------------------------------------------------------

describe("buildPurchaseReceiptTrendsRows", () => {
	const janToMar = buildPurchaseReceiptTrendsPeriods(
		new Date("2024-01-01T00:00:00.000Z"),
		new Date("2024-03-31T00:00:00.000Z"),
		"Monthly",
	);

	it("returns empty result when there are no entries", () => {
		const result = buildPurchaseReceiptTrendsRows([], janToMar);

		expect(result.rows).toHaveLength(0);
		expect(result.totalQty).toBe(0);
		expect(result.totalAmount).toBe(0);
		expect(result.periods).toHaveLength(3);
	});

	it("returns empty result when there are no periods", () => {
		const result = buildPurchaseReceiptTrendsRows([makeEntry()], []);

		expect(result.rows).toHaveLength(0);
		expect(result.totalQty).toBe(0);
		expect(result.totalAmount).toBe(0);
	});

	it("creates one row per unique dimensionKey", () => {
		const entries = [
			makeEntry({ dimensionKey: "ITEM-001", quantity: 5, amount: 500 }),
			makeEntry({ dimensionKey: "ITEM-002", quantity: 3, amount: 300 }),
		];

		const result = buildPurchaseReceiptTrendsRows(entries, janToMar);

		expect(result.rows).toHaveLength(2);
	});

	it("aggregates qty and amount into the correct period", () => {
		const entries = [
			makeEntry({
				postingDate: new Date("2024-01-10T00:00:00.000Z"),
				quantity: 10,
				amount: 1000,
			}),
			makeEntry({
				postingDate: new Date("2024-02-15T00:00:00.000Z"),
				quantity: 20,
				amount: 2000,
			}),
		];

		const result = buildPurchaseReceiptTrendsRows(entries, janToMar);

		expect(result.rows).toHaveLength(1);

		const row = result.rows[0];
		const janKey = janToMar[0].key;
		const febKey = janToMar[1].key;
		const marKey = janToMar[2].key;

		expect(row.periodQty[janKey]).toBe(10);
		expect(row.periodQty[febKey]).toBe(20);
		expect(row.periodQty[marKey]).toBe(0);
		expect(row.periodAmount[janKey]).toBe(1000);
		expect(row.periodAmount[febKey]).toBe(2000);
		expect(row.totalQty).toBe(30);
		expect(row.totalAmount).toBe(3000);
	});

	it("computes grand totals correctly", () => {
		const entries = [
			makeEntry({ dimensionKey: "ITEM-001", quantity: 10, amount: 1000 }),
			makeEntry({ dimensionKey: "ITEM-002", quantity: 5, amount: 500 }),
		];

		const result = buildPurchaseReceiptTrendsRows(entries, janToMar);

		expect(result.totalQty).toBe(15);
		expect(result.totalAmount).toBe(1500);
	});

	it("sorts rows by totalAmount descending (top-N chart order)", () => {
		const entries = [
			makeEntry({
				dimensionKey: "SMALL",
				quantity: 1,
				amount: 100,
				dimensionLabel: "Small",
			}),
			makeEntry({
				dimensionKey: "LARGE",
				quantity: 50,
				amount: 5000,
				dimensionLabel: "Large",
			}),
			makeEntry({
				dimensionKey: "MEDIUM",
				quantity: 10,
				amount: 1000,
				dimensionLabel: "Medium",
			}),
		];

		const result = buildPurchaseReceiptTrendsRows(entries, janToMar);

		expect(result.rows[0].dimensionKey).toBe("LARGE");
		expect(result.rows[1].dimensionKey).toBe("MEDIUM");
		expect(result.rows[2].dimensionKey).toBe("SMALL");
	});

	it("accumulates multiple entries for the same dimension and period", () => {
		const entries = [
			makeEntry({
				postingDate: new Date("2024-01-05T00:00:00.000Z"),
				quantity: 5,
				amount: 500,
			}),
			makeEntry({
				postingDate: new Date("2024-01-20T00:00:00.000Z"),
				quantity: 7,
				amount: 700,
			}),
		];

		const result = buildPurchaseReceiptTrendsRows(entries, janToMar);

		expect(result.rows).toHaveLength(1);
		const janKey = janToMar[0].key;
		expect(result.rows[0].periodQty[janKey]).toBe(12);
		expect(result.rows[0].periodAmount[janKey]).toBe(1200);
	});

	it("ignores entries outside the period range", () => {
		const entries = [
			makeEntry({
				postingDate: new Date("2023-12-31T00:00:00.000Z"), // before range
				quantity: 100,
				amount: 9999,
			}),
			makeEntry({
				postingDate: new Date("2024-01-15T00:00:00.000Z"), // in range
				quantity: 5,
				amount: 200,
			}),
		];

		const result = buildPurchaseReceiptTrendsRows(entries, janToMar);

		expect(result.totalQty).toBe(5);
		expect(result.totalAmount).toBe(200);
	});

	it("stores the dimensionLabel from the first entry seen", () => {
		const entries = [
			makeEntry({ dimensionKey: "ITEM-001", dimensionLabel: "First Label" }),
			makeEntry({ dimensionKey: "ITEM-001", dimensionLabel: "Second Label" }),
		];

		const result = buildPurchaseReceiptTrendsRows(entries, janToMar);

		expect(result.rows[0].dimensionLabel).toBe("First Label");
	});

	it("handles null dimensionLabel gracefully", () => {
		const entries = [
			makeEntry({ dimensionKey: "SUPPLIER-001", dimensionLabel: null }),
		];

		const result = buildPurchaseReceiptTrendsRows(entries, janToMar);

		expect(result.rows[0].dimensionLabel).toBeNull();
	});

	it("groups supplier-based entries by dimensionKey", () => {
		const entries = [
			makeEntry({
				dimensionKey: "SUPPLIER-A",
				quantity: 20,
				amount: 2000,
				dimensionLabel: null,
			}),
			makeEntry({
				dimensionKey: "SUPPLIER-B",
				quantity: 10,
				amount: 1000,
				dimensionLabel: null,
			}),
			makeEntry({
				dimensionKey: "SUPPLIER-A",
				quantity: 5,
				amount: 500,
				dimensionLabel: null,
			}),
		];

		const result = buildPurchaseReceiptTrendsRows(entries, janToMar);

		expect(result.rows).toHaveLength(2);
		const supplierA = result.rows.find((r) => r.dimensionKey === "SUPPLIER-A");
		expect(supplierA?.totalQty).toBe(25);
		expect(supplierA?.totalAmount).toBe(2500);
	});
});
