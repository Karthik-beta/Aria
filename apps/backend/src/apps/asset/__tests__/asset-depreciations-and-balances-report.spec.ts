import { buildAssetDepreciationsAndBalancesResult } from "../asset-depreciations-and-balances-report";

const revaluedMachine = {
	id: "asset-001",
	series: "AST-2026-00001",
	assetName: "Hydraulic Pump A",
	company: "ACME Corp",
	purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
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
			adjustmentDate: new Date("2026-01-15T00:00:00.000Z"),
			differenceAmount: 10000,
			schedule: {
				id: "sched-001",
				revisionNumber: 1,
				startDate: new Date("2026-01-15T00:00:00.000Z"),
				openingAccumulatedDepreciation: 0,
				entries: [
					{
						id: "entry-001",
						sequence: 1,
						scheduleDate: new Date("2026-01-31T00:00:00.000Z"),
						depreciationAmount: 10000,
						accumulatedDepreciationAmount: 10000,
						bookValueAfterDepreciation: 100000,
					},
					{
						id: "entry-002",
						sequence: 2,
						scheduleDate: new Date("2026-02-28T00:00:00.000Z"),
						depreciationAmount: 10000,
						accumulatedDepreciationAmount: 20000,
						bookValueAfterDepreciation: 90000,
					},
				],
			},
		},
		{
			id: "adj-002",
			adjustmentDate: new Date("2026-03-15T00:00:00.000Z"),
			differenceAmount: -5000,
			schedule: {
				id: "sched-002",
				revisionNumber: 2,
				startDate: new Date("2026-03-15T00:00:00.000Z"),
				openingAccumulatedDepreciation: 20000,
				entries: [
					{
						id: "entry-003",
						sequence: 1,
						scheduleDate: new Date("2026-03-31T00:00:00.000Z"),
						depreciationAmount: 15000,
						accumulatedDepreciationAmount: 35000,
						bookValueAfterDepreciation: 80000,
					},
					{
						id: "entry-004",
						sequence: 2,
						scheduleDate: new Date("2026-04-30T00:00:00.000Z"),
						depreciationAmount: 15000,
						accumulatedDepreciationAmount: 50000,
						bookValueAfterDepreciation: 65000,
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
	purchaseDate: new Date("2025-12-01T00:00:00.000Z"),
	disposalDate: new Date("2026-04-15T00:00:00.000Z"),
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
			fromDate: new Date("2026-03-01T00:00:00.000Z"),
			toDate: new Date("2026-04-30T23:59:59.999Z"),
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
			purchaseDate: new Date("2026-04-10T00:00:00.000Z"),
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
			fromDate: new Date("2026-04-01T00:00:00.000Z"),
			toDate: new Date("2026-04-30T23:59:59.999Z"),
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
});
