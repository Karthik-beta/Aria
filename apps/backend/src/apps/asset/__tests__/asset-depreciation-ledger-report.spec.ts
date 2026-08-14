import { buildAssetDepreciationLedgerResult } from "../asset-depreciation-ledger-report";
import { dateOnlyFromPersistedDateTime } from "../depreciation/depreciation.config";

const dateOnly = (value: string) =>
	dateOnlyFromPersistedDateTime(new Date(value));

const assetWithRevisions = {
	id: "asset-001",
	series: "AST-2026-00001",
	assetName: "Hydraulic Pump A",
	company: "ACME Corp",
	purchaseDate: dateOnly("2026-01-01T00:00:00.000Z"),
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
			adjustmentDate: dateOnly("2026-01-15T00:00:00.000Z"),
			costCenter: "Main Plant",
			revaluationEntrySeries: "JE-AVA-2026-00001",
			schedule: {
				id: "sched-001",
				revisionNumber: 1,
				startDate: dateOnly("2026-01-15T00:00:00.000Z"),
				depreciationMethod: "STRAIGHT_LINE" as const,
				openingAccumulatedDepreciation: 0,
				entries: [
					{
						id: "entry-001",
						sequence: 1,
						scheduleDate: dateOnly("2026-01-31T00:00:00.000Z"),
						depreciationAmount: 10000,
						accumulatedDepreciationAmount: 10000,
						bookValueAfterDepreciation: 90000,
					},
					{
						id: "entry-002",
						sequence: 2,
						scheduleDate: dateOnly("2026-02-28T00:00:00.000Z"),
						depreciationAmount: 10000,
						accumulatedDepreciationAmount: 20000,
						bookValueAfterDepreciation: 80000,
					},
					{
						id: "entry-003",
						sequence: 3,
						scheduleDate: dateOnly("2026-03-31T00:00:00.000Z"),
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
			adjustmentDate: dateOnly("2026-03-15T00:00:00.000Z"),
			costCenter: "Main Plant",
			revaluationEntrySeries: "JE-AVA-2026-00002",
			schedule: {
				id: "sched-002",
				revisionNumber: 2,
				startDate: dateOnly("2026-03-15T00:00:00.000Z"),
				depreciationMethod: "STRAIGHT_LINE" as const,
				openingAccumulatedDepreciation: 20000,
				entries: [
					{
						id: "entry-004",
						sequence: 1,
						scheduleDate: dateOnly("2026-03-31T00:00:00.000Z"),
						depreciationAmount: 15000,
						accumulatedDepreciationAmount: 35000,
						bookValueAfterDepreciation: 95000,
					},
					{
						id: "entry-005",
						sequence: 2,
						scheduleDate: dateOnly("2026-04-30T00:00:00.000Z"),
						depreciationAmount: 15000,
						accumulatedDepreciationAmount: 50000,
						bookValueAfterDepreciation: 80000,
					},
					{
						id: "entry-006",
						sequence: 3,
						scheduleDate: dateOnly("2026-05-01T00:00:00.000Z"),
						depreciationAmount: 99999,
						accumulatedDepreciationAmount: 149999,
						bookValueAfterDepreciation: -19999,
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
	purchaseDate: dateOnly("2026-02-01T00:00:00.000Z"),
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
			fromDate: "2026-01-01",
			endExclusive: "2026-05-01",
		});

		expect(result.rows).toHaveLength(4);
		expect(result.rows.map((row) => row.depreciationDate)).toEqual([
			"2026-04-30",
			"2026-03-31",
			"2026-02-28",
			"2026-01-31",
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
			fromDate: "2026-04-01",
			endExclusive: "2026-05-01",
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

	it("uses calendar-date supersession for legacy non-midnight schedule rows", () => {
		const result = buildAssetDepreciationLedgerResult({
			assets: [
				{
					id: "asset-boundary",
					series: "AST-2026-00003",
					assetName: "Boundary Pump",
					company: "ACME Corp",
					purchaseDate: dateOnly("2026-07-01T00:00:00.000Z"),
					netPurchaseAmount: 100,
					status: "PARTIALLY_DEPRECIATED",
					assetCategory: null,
					adjustments: [
						{
							id: "adj-old",
							series: "AVA-2026-00003",
							adjustmentDate: dateOnly("2026-07-01T12:00:00.000Z"),
							costCenter: null,
							revaluationEntrySeries: null,
							schedule: {
								id: "sched-old",
								revisionNumber: 1,
								startDate: dateOnly("2026-07-01T00:00:00.000Z"),
								depreciationMethod: "STRAIGHT_LINE",
								openingAccumulatedDepreciation: 0,
								entries: [
									{
										id: "old-previous",
										sequence: 1,
										scheduleDate: dateOnly("2026-07-23T12:00:00.000Z"),
										depreciationAmount: 5,
										accumulatedDepreciationAmount: 5,
										bookValueAfterDepreciation: 95,
									},
									{
										id: "old-current",
										sequence: 2,
										scheduleDate: dateOnly("2026-07-24T00:00:00.000Z"),
										depreciationAmount: 10,
										accumulatedDepreciationAmount: 15,
										bookValueAfterDepreciation: 85,
									},
									{
										id: "old-next",
										sequence: 3,
										scheduleDate: dateOnly("2026-07-25T00:00:00.000Z"),
										depreciationAmount: 999,
										accumulatedDepreciationAmount: 1014,
										bookValueAfterDepreciation: -914,
									},
								],
							},
						},
						{
							id: "adj-new",
							series: "AVA-2026-00004",
							adjustmentDate: dateOnly("2026-07-24T23:59:59.999Z"),
							costCenter: null,
							revaluationEntrySeries: null,
							schedule: {
								id: "sched-new",
								revisionNumber: 2,
								startDate: dateOnly("2026-07-24T12:00:00.000Z"),
								depreciationMethod: "STRAIGHT_LINE",
								openingAccumulatedDepreciation: 0,
								entries: [
									{
										id: "new-current",
										sequence: 1,
										scheduleDate: dateOnly("2026-07-24T23:59:59.999Z"),
										depreciationAmount: 20,
										accumulatedDepreciationAmount: 20,
										bookValueAfterDepreciation: 80,
									},
									{
										id: "new-next",
										sequence: 2,
										scheduleDate: dateOnly("2026-07-25T12:00:00.000Z"),
										depreciationAmount: 999,
										accumulatedDepreciationAmount: 1019,
										bookValueAfterDepreciation: -919,
									},
								],
							},
						},
					],
				},
			],
			fromDate: "2026-07-24",
			endExclusive: "2026-07-25",
		});

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]).toMatchObject({
			depreciationDate: "2026-07-24",
			scheduleId: "sched-new",
			depreciationAmount: 20,
			valueAfterDepreciation: 80,
		});
		expect(result.summary).toMatchObject({
			rowCount: 1,
			totalDepreciationAmount: 20,
			closingValueTotal: 80,
		});
	});
});
