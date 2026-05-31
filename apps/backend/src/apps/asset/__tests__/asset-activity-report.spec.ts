import { buildAssetActivityReportResult } from "../asset-activity-report";

describe("buildAssetActivityReportResult", () => {
	it("sorts activity rows newest-first and summarizes distinct assets", () => {
		const result = buildAssetActivityReportResult({
			activities: [
				{
					id: "activity-002",
					assetId: "asset-002",
					assetSeries: "AST-2026-00002",
					assetName: "Forklift B",
					assetCategory: {
						id: "cat-002",
						name: "Vehicles",
					},
					company: "ACME Corp",
					assetStatus: "SOLD",
					activity: "Asset value adjustment AVA-2026-00002 cancelled.",
					createdAt: new Date("2026-04-18T08:30:00.000Z"),
				},
				{
					id: "activity-001",
					assetId: "asset-001",
					assetSeries: "AST-2026-00001",
					assetName: "Hydraulic Pump A",
					assetCategory: {
						id: "cat-001",
						name: "Machinery",
					},
					company: "ACME Corp",
					assetStatus: "PARTIALLY_DEPRECIATED",
					activity: "Asset created with series AST-2026-00001",
					createdAt: new Date("2026-04-12T10:00:00.000Z"),
				},
				{
					id: "activity-003",
					assetId: "asset-001",
					assetSeries: "AST-2026-00001",
					assetName: "Hydraulic Pump A",
					assetCategory: {
						id: "cat-001",
						name: "Machinery",
					},
					company: "ACME Corp",
					assetStatus: "PARTIALLY_DEPRECIATED",
					activity:
						"Asset value adjustment AVA-2026-00003 submitted. Carrying value changed.",
					createdAt: new Date("2026-04-18T08:30:00.000Z"),
				},
			],
		});

		expect(
			result.rows.map((row: (typeof result.rows)[number]) => row.activityId),
		).toEqual(["activity-003", "activity-002", "activity-001"]);
		expect(result.summary).toEqual({
			rowCount: 3,
			distinctAssetCount: 2,
			firstActivityAt: new Date("2026-04-12T10:00:00.000Z"),
			lastActivityAt: new Date("2026-04-18T08:30:00.000Z"),
		});
	});

	it("returns null timestamps when no activities match the report scope", () => {
		const result = buildAssetActivityReportResult({
			activities: [],
		});

		expect(result.rows).toEqual([]);
		expect(result.summary).toEqual({
			rowCount: 0,
			distinctAssetCount: 0,
			firstActivityAt: null,
			lastActivityAt: null,
		});
	});
});
