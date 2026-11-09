/**
 * Unit tests for generic trend-report period generation and row aggregation.
 *
 * @module trend-report-core.spec
 */
import {
	buildTrendsPeriods,
	buildTrendsRows,
	type TrendsPeriod,
	type TrendsSourceEntry,
} from "./trend-report-core";

// ─── buildTrendsPeriods ──────────────────────────────────────────────────────

describe("buildTrendsPeriods", () => {
	describe("Monthly", () => {
		it("generates one period per month", () => {
			const from = new Date("2024-01-01T00:00:00Z");
			const to = new Date("2024-03-31T23:59:59Z");
			const periods = buildTrendsPeriods(from, to, "Monthly");
			expect(periods).toHaveLength(3);
			expect(periods[0].label).toBe("Jan 2024");
			expect(periods[1].label).toBe("Feb 2024");
			expect(periods[2].label).toBe("Mar 2024");
		});

		it("snaps from-date to the first of the month", () => {
			const from = new Date("2024-01-15T12:00:00Z");
			const to = new Date("2024-01-31T23:59:59Z");
			const periods = buildTrendsPeriods(from, to, "Monthly");
			expect(periods).toHaveLength(1);
			expect(periods[0].from.getUTCDate()).toBe(1);
		});

		it("returns empty when to < from", () => {
			const from = new Date("2024-06-01T00:00:00Z");
			const to = new Date("2024-01-01T00:00:00Z");
			const periods = buildTrendsPeriods(from, to, "Monthly");
			expect(periods).toHaveLength(0);
		});
	});

	describe("Quarterly", () => {
		it("snaps to calendar quarter boundaries", () => {
			const from = new Date("2024-02-15T00:00:00Z");
			const to = new Date("2024-09-30T23:59:59Z");
			const periods = buildTrendsPeriods(from, to, "Quarterly");
			// Feb → Q1 start (Jan), runs through Q3 (Jul–Sep)
			expect(periods.length).toBeGreaterThanOrEqual(3);
			expect(periods[0].from.getUTCMonth()).toBe(0); // January
		});

		it("generates correct labels", () => {
			const from = new Date("2024-01-01T00:00:00Z");
			const to = new Date("2024-06-30T23:59:59Z");
			const periods = buildTrendsPeriods(from, to, "Quarterly");
			expect(periods[0].label).toContain("Jan");
			expect(periods[0].label).toContain("Mar");
		});
	});

	describe("Half-Yearly", () => {
		it("snaps to 6-month boundaries", () => {
			const from = new Date("2024-04-01T00:00:00Z");
			const to = new Date("2024-12-31T23:59:59Z");
			const periods = buildTrendsPeriods(from, to, "Half-Yearly");
			expect(periods.length).toBeGreaterThanOrEqual(1);
			// April belongs to H1 (Jan–Jun)
			expect(periods[0].from.getUTCMonth()).toBe(0);
		});
	});

	describe("Yearly", () => {
		it("snaps to January 1st", () => {
			const from = new Date("2024-06-15T00:00:00Z");
			const to = new Date("2025-03-31T00:00:00Z");
			const periods = buildTrendsPeriods(from, to, "Yearly");
			expect(periods.length).toBeGreaterThanOrEqual(1);
			expect(periods[0].from.getUTCMonth()).toBe(0);
			expect(periods[0].from.getUTCDate()).toBe(1);
			expect(periods[0].label).toBe("2024");
		});
	});

	it("every period has from <= to", () => {
		const from = new Date("2023-01-01T00:00:00Z");
		const to = new Date("2024-12-31T23:59:59Z");
		for (const freq of [
			"Monthly",
			"Quarterly",
			"Half-Yearly",
			"Yearly",
		] as const) {
			const periods = buildTrendsPeriods(from, to, freq);
			for (const p of periods) {
				expect(p.from.getTime()).toBeLessThanOrEqual(p.to.getTime());
			}
		}
	});

	it("period keys are snake_cased and lowercase", () => {
		const from = new Date("2024-01-01T00:00:00Z");
		const to = new Date("2024-12-31T23:59:59Z");
		const periods = buildTrendsPeriods(from, to, "Monthly");
		for (const p of periods) {
			expect(p.key).toMatch(/^[a-z0-9_]+$/);
		}
	});
});

// ─── buildTrendsRows ─────────────────────────────────────────────────────────

describe("buildTrendsRows", () => {
	const periods: TrendsPeriod[] = [
		{
			from: new Date("2024-01-01T00:00:00Z"),
			to: new Date("2024-01-31T23:59:59.999Z"),
			label: "Jan 2024",
			key: "jan_2024",
		},
		{
			from: new Date("2024-02-01T00:00:00Z"),
			to: new Date("2024-02-29T23:59:59.999Z"),
			label: "Feb 2024",
			key: "feb_2024",
		},
	];

	it("returns empty rows when entries array is empty", () => {
		const result = buildTrendsRows([], periods);
		expect(result.rows).toEqual([]);
		expect(result.totalQty).toBe(0);
		expect(result.totalAmount).toBe(0);
	});

	it("returns empty rows when periods array is empty", () => {
		const entries: TrendsSourceEntry[] = [
			{
				postingDate: new Date("2024-01-15T00:00:00Z"),
				quantity: 10,
				amount: 100,
				dimensionKey: "item-1",
			},
		];
		const result = buildTrendsRows(entries, []);
		expect(result.rows).toEqual([]);
		expect(result.totalQty).toBe(0);
	});

	it("aggregates entries into correct periods", () => {
		const entries: TrendsSourceEntry[] = [
			{
				postingDate: new Date("2024-01-10T00:00:00Z"),
				quantity: 5,
				amount: 50,
				dimensionKey: "widget",
				dimensionLabel: "Widget",
			},
			{
				postingDate: new Date("2024-01-20T00:00:00Z"),
				quantity: 3,
				amount: 30,
				dimensionKey: "widget",
				dimensionLabel: "Widget",
			},
			{
				postingDate: new Date("2024-02-15T00:00:00Z"),
				quantity: 10,
				amount: 200,
				dimensionKey: "widget",
				dimensionLabel: "Widget",
			},
		];
		const result = buildTrendsRows(entries, periods);
		expect(result.rows).toHaveLength(1);
		const row = result.rows[0];
		expect(row.dimensionKey).toBe("widget");
		expect(row.dimensionLabel).toBe("Widget");
		expect(row.periodQty.jan_2024).toBe(8);
		expect(row.periodQty.feb_2024).toBe(10);
		expect(row.periodAmount.jan_2024).toBe(80);
		expect(row.periodAmount.feb_2024).toBe(200);
		expect(row.totalQty).toBe(18);
		expect(row.totalAmount).toBe(280);
		expect(result.totalQty).toBe(18);
		expect(result.totalAmount).toBe(280);
	});

	it("groups by dimensionKey", () => {
		const entries: TrendsSourceEntry[] = [
			{
				postingDate: new Date("2024-01-05T00:00:00Z"),
				quantity: 2,
				amount: 20,
				dimensionKey: "A",
			},
			{
				postingDate: new Date("2024-01-06T00:00:00Z"),
				quantity: 3,
				amount: 60,
				dimensionKey: "B",
			},
		];
		const result = buildTrendsRows(entries, periods);
		expect(result.rows).toHaveLength(2);
	});

	it("sorts rows by total amount descending", () => {
		const entries: TrendsSourceEntry[] = [
			{
				postingDate: new Date("2024-01-05T00:00:00Z"),
				quantity: 1,
				amount: 10,
				dimensionKey: "cheap",
			},
			{
				postingDate: new Date("2024-01-06T00:00:00Z"),
				quantity: 1,
				amount: 1000,
				dimensionKey: "expensive",
			},
		];
		const result = buildTrendsRows(entries, periods);
		expect(result.rows[0].dimensionKey).toBe("expensive");
		expect(result.rows[1].dimensionKey).toBe("cheap");
	});

	it("skips entries outside all period ranges", () => {
		const entries: TrendsSourceEntry[] = [
			{
				postingDate: new Date("2023-12-31T00:00:00Z"),
				quantity: 100,
				amount: 9999,
				dimensionKey: "outside",
			},
		];
		const result = buildTrendsRows(entries, periods);
		expect(result.rows).toHaveLength(0);
		expect(result.totalQty).toBe(0);
	});
});
