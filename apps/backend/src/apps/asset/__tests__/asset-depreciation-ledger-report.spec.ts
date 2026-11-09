import { buildAssetDepreciationLedgerResult } from "../asset-depreciation-ledger-report";

const assetWithRevisions = {
	id: "asset-001",
	series: "AST-2026-00001",
	assetName: "Hydraulic Pump A",
	company: "ACME Corp",
	purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
	netPurchaseAmount: 100000,
	status: "PARTIALLY_DEPRECIATED" as const,
	assetCategory: {
		id: "cat-001",
		name: "Machinery",
	},
	adjustments: [
		{
			id: "adj-001",
			series: "AVA-2026-00001",
			adjustmentDate: new Date("2026-01-15T00:00:00.000Z"),
			costCenter: "Main Plant",
			revaluationEntrySeries: "JE-AVA-2026-00001",
			schedule: {
				id: "sched-001",
				revisionNumber: 1,
				startDate: new Date("2026-01-15T00:00:00.000Z"),
				depreciationMethod: "STRAIGHT_LINE" as const,
				openingAccumulatedDepreciation: 0,
				entries: [
					{
						id: "entry-001",
						sequence: 1,
						scheduleDate: new Date("2026-01-31T00:00:00.000Z"),
						depreciationAmount: 10000,
						accumulatedDepreciationAmount: 10000,
						bookValueAfterDepreciation: 90000,
					},
					{
						id: "entry-002",
						sequence: 2,
						scheduleDate: new Date("2026-02-28T00:00:00.000Z"),
						depreciationAmount: 10000,
						accumulatedDepreciationAmount: 20000,
						bookValueAfterDepreciation: 80000,
					},
					{
						id: "entry-003",
						sequence: 3,
						scheduleDate: new Date("2026-03-31T00:00:00.000Z"),
						depreciationAmount: 10000,
						accumulatedDepreciationAmount: 30000,
						bookValueAfterDepreciation: 70000,
					},
				],
			},
		},
		{
			id: "adj-002",
			series: "AVA-2026-00002",
			adjustmentDate: new Date("2026-03-15T00:00:00.000Z"),
			costCenter: "Main Plant",
			revaluationEntrySeries: "JE-AVA-2026-00002",
			schedule: {
				id: "sched-002",
				revisionNumber: 2,
				startDate: new Date("2026-03-15T00:00:00.000Z"),
				depreciationMethod: "STRAIGHT_LINE" as const,
				openingAccumulatedDepreciation: 20000,
				entries: [
					{
						id: "entry-004",
						sequence: 1,
						scheduleDate: new Date("2026-03-31T00:00:00.000Z"),
						depreciationAmount: 15000,
						accumulatedDepreciationAmount: 35000,
						bookValueAfterDepreciation: 95000,
					},
					{
						id: "entry-005",
						sequence: 2,
						scheduleDate: new Date("2026-04-30T00:00:00.000Z"),
						depreciationAmount: 15000,
						accumulatedDepreciationAmount: 50000,
						bookValueAfterDepreciation: 80000,
					},
				],
			},
		},
	],
};

const assetWithoutSchedules = {
	id: "asset-002",
	series: "AST-2026-00002",
	assetName: "Forklift B",
	company: "ACME Corp",
	purchaseDate: new Date("2026-02-01T00:00:00.000Z"),
	netPurchaseAmount: 60000,
	status: "SUBMITTED" as const,
	assetCategory: {
		id: "cat-002",
		name: "Vehicles",
	},
	adjustments: [],
};

describe("buildAssetDepreciationLedgerResult", () => {
	it("builds ledger rows across revisions and excludes superseded schedule entries", () => {
		const result = buildAssetDepreciationLedgerResult({
			assets: [assetWithRevisions, assetWithoutSchedules],
			fromDate: new Date("2026-01-01T00:00:00.000Z"),
			toDate: new Date("2026-04-30T23:59:59.999Z"),
		});

		expect(result.rows).toHaveLength(4);
		expect(
			result.rows.map((row) => row.depreciationDate.toISOString()),
		).toEqual([
			"2026-04-30T00:00:00.000Z",
			"2026-03-31T00:00:00.000Z",
			"2026-02-28T00:00:00.000Z",
			"2026-01-31T00:00:00.000Z",
		]);
		expect(
			result.rows.filter((row) => row.scheduleRevisionNumber === 1),
		).toHaveLength(2);
		expect(result.summary).toEqual({
			matchedAssetCount: 2,
			assetsWithLedgerCount: 1,
			assetsWithoutLedgerCount: 1,
			rowCount: 4,
			totalDepreciationAmount: 50000,
			closingValueTotal: 80000,
		});
	});

	it("uses the previous schedule entry to compute opening accumulated depreciation inside the filtered range", () => {
		const result = buildAssetDepreciationLedgerResult({
			assets: [assetWithRevisions],
			fromDate: new Date("2026-04-01T00:00:00.000Z"),
			toDate: new Date("2026-04-30T23:59:59.999Z"),
		});

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]).toMatchObject({
			adjustmentSeries: "AVA-2026-00002",
			openingAccumulatedDepreciation: 35000,
			depreciationAmount: 15000,
			accumulatedDepreciationAmount: 50000,
			valueAfterDepreciation: 80000,
		});
	});
});
