import { buildAssetDepreciationsAndBalancesResult } from "../asset-depreciations-and-balances-report";

const revaluedMachine = {
	id: "asset-001",
	series: "AST-2026-00001",
	assetName: "Hydraulic Pump A",
	company: "ACME Corp",
	purchaseDate: "2026-01-01",
	disposalDate: null,
	netPurchaseAmount: 100000,
	openingAccumulatedDepreciation: 0,
	status: "PARTIALLY_DEPRECIATED" as const,
	assetCategory: {
		id: "cat-001",
		name: "Machinery",
	},
	adjustments: [
		{
			id: "adj-001",
			adjustmentDate: "2026-01-15",
			differenceAmount: 10000,
			schedule: {
				id: "sched-001",
				revisionNumber: 1,
				startDate: "2026-01-15",
				openingAccumulatedDepreciation: 0,
				entries: [
					{
						id: "entry-001",
						sequence: 1,
						scheduleDate: "2026-01-31",
						depreciationAmount: 10000,
						accumulatedDepreciationAmount: 10000,
						bookValueAfterDepreciation: 100000,
					},
					{
						id: "entry-002",
						sequence: 2,
						scheduleDate: "2026-02-28",
						depreciationAmount: 10000,
						accumulatedDepreciationAmount: 20000,
						bookValueAfterDepreciation: 90000,
					},
				],
			},
		},
		{
			id: "adj-002",
			adjustmentDate: "2026-03-15",
			differenceAmount: -5000,
			schedule: {
				id: "sched-002",
				revisionNumber: 2,
				startDate: "2026-03-15",
				openingAccumulatedDepreciation: 20000,
				entries: [
					{
						id: "entry-003",
						sequence: 1,
						scheduleDate: "2026-03-31",
						depreciationAmount: 15000,
						accumulatedDepreciationAmount: 35000,
						bookValueAfterDepreciation: 80000,
					},
					{
						id: "entry-004",
						sequence: 2,
						scheduleDate: "2026-04-30",
						depreciationAmount: 15000,
						accumulatedDepreciationAmount: 50000,
						bookValueAfterDepreciation: 65000,
					},
					{
						id: "entry-005",
						sequence: 3,
						scheduleDate: "2026-05-01",
						depreciationAmount: 99999,
						accumulatedDepreciationAmount: 149999,
						bookValueAfterDepreciation: -34999,
					},
				],
			},
		},
	],
};

const soldMachine = {
	id: "asset-002",
	series: "AST-2026-00002",
	assetName: "Forklift B",
	company: "ACME Corp",
	purchaseDate: "2025-12-01",
	disposalDate: "2026-04-15",
	netPurchaseAmount: 60000,
	openingAccumulatedDepreciation: 10000,
	status: "SOLD" as const,
	assetCategory: {
		id: "cat-001",
		name: "Machinery",
	},
	adjustments: [],
};

describe("buildAssetDepreciationsAndBalancesResult", () => {
	it("aggregates asset balances by category with revaluation deltas and disposal elimination", () => {
		const result = buildAssetDepreciationsAndBalancesResult({
			assets: [revaluedMachine, soldMachine],
			fromDate: "2026-03-01",
			endExclusive: "2026-05-01",
			groupBy: "ASSET_CATEGORY",
		});

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]).toMatchObject({
			groupingLabel: "Machinery",
			assetCount: 2,
			valueAsOnFromDate: 170000,
			valueOfSoldAsset: 60000,
			valueAdjustmentDuringPeriod: -5000,
			valueAsOnToDate: 105000,
			accumulatedDepreciationAsOnFromDate: 30000,
			depreciationAmountDuringPeriod: 30000,
			depreciationEliminatedDuringPeriod: 10000,
			accumulatedDepreciationAsOnToDate: 50000,
			netAssetValueAsOnFromDate: 140000,
			netAssetValueAsOnToDate: 55000,
		});
		expect(result.summary).toEqual({
			matchedAssetCount: 2,
			rowCount: 1,
			totalValueAsOnFromDate: 170000,
			totalValueAsOnToDate: 105000,
			totalNetAssetValueAsOnFromDate: 140000,
			totalNetAssetValueAsOnToDate: 55000,
			totalDepreciationAmountDuringPeriod: 30000,
			totalValueAdjustmentDuringPeriod: -5000,
		});
	});

	it("returns per-asset rows and includes period purchases with no prior opening balance", () => {
		const newAsset = {
			id: "asset-003",
			series: "AST-2026-00003",
			assetName: "Compressor C",
			company: "ACME Corp",
			purchaseDate: "2026-04-10",
			disposalDate: null,
			netPurchaseAmount: 45000,
			openingAccumulatedDepreciation: 0,
			status: "SUBMITTED" as const,
			assetCategory: {
				id: "cat-002",
				name: "Utilities",
			},
			adjustments: [],
		};

		const result = buildAssetDepreciationsAndBalancesResult({
			assets: [newAsset],
			fromDate: "2026-04-01",
			endExclusive: "2026-05-01",
			groupBy: "ASSET",
		});

		expect(result.rows).toEqual([
			expect.objectContaining({
				groupingLabel: "AST-2026-00003",
				assetName: "Compressor C",
				valueAsOnFromDate: 0,
				valueOfNewPurchase: 45000,
				valueAsOnToDate: 45000,
				accumulatedDepreciationAsOnFromDate: 0,
				depreciationAmountDuringPeriod: 0,
				netAssetValueAsOnToDate: 45000,
			}),
		]);
	});

	it("uses a half-open calendar range when disposal is persisted at a non-midnight instant", () => {
		const result = buildAssetDepreciationsAndBalancesResult({
			assets: [
				{
					id: "asset-boundary",
					series: "AST-2026-00004",
					assetName: "Boundary Asset",
					company: "ACME Corp",
					purchaseDate: "2026-01-01",
					disposalDate: "2026-07-24",
					netPurchaseAmount: 1000,
					openingAccumulatedDepreciation: 0,
					status: "SOLD",
					assetCategory: null,
					adjustments: [
						{
							id: "schedule-boundary",
							adjustmentDate: "2026-01-01",
							differenceAmount: 0,
							schedule: {
								id: "schedule-boundary",
								revisionNumber: 1,
								startDate: "2026-01-01",
								openingAccumulatedDepreciation: 0,
								entries: [
									{
										id: "same-business-day",
										sequence: 1,
										scheduleDate: "2026-07-24",
										depreciationAmount: 20,
										accumulatedDepreciationAmount: 20,
										bookValueAfterDepreciation: 980,
									},
									{
										id: "next-business-day",
										sequence: 2,
										scheduleDate: "2026-07-25",
										depreciationAmount: 40,
										accumulatedDepreciationAmount: 60,
										bookValueAfterDepreciation: 940,
									},
								],
							},
						},
					],
				},
			],
			fromDate: "2026-07-24",
			endExclusive: "2026-07-25",
			groupBy: "ASSET",
		});

		expect(result.summary.totalDepreciationAmountDuringPeriod).toBe(20);
	});
});
