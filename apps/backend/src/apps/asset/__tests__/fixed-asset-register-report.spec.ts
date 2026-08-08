import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import { FixedAssetRegisterReportService } from "../fixed-asset-register-report";

describe("FixedAssetRegisterReportService", () => {
	it("computes Net Book Value formula (netPurchaseAmount - openingDep - depreciatedAmount + revaluationAmount) and groups by ASSET_CATEGORY", async () => {
		const mockAssets = [
			{
				id: "asset-1",
				series: "AST-2026-00001",
				assetName: "CNC Machine 1",
				company: "ACME Corp",
				purchaseDate: new Date("2026-01-10T00:00:00.000Z"),
				availableForUseDate: new Date("2026-01-15T00:00:00.000Z"),
				status: "SUBMITTED",
				netPurchaseAmount: 100000,
				openingAccumulatedDepreciation: 5000,
				assetCategory: { id: "cat-1", name: "Machinery" },
				location: { id: "loc-1", name: "Plant A" },
				valueAdjustments: [
					{
						differenceAmount: 2000,
						adjustmentDate: new Date("2026-02-01T00:00:00.000Z"),
					},
				],
				depreciationSchedules: [
					{
						status: "ACTIVE",
						entries: [
							{
								depreciationAmount: 1000,
								scheduleDate: new Date("2026-01-31T00:00:00.000Z"),
							},
							{
								depreciationAmount: 1000,
								scheduleDate: new Date("2026-02-28T00:00:00.000Z"),
							},
						],
					},
				],
			},
		];

		const prismaMock = {
			asset: {
				findMany: mock(async () => mockAssets),
			},
		} as unknown as PrismaService;

		const service = new FixedAssetRegisterReportService(prismaMock);

		const result = await service.generateReport({
			fromDate: new Date("2026-01-01T00:00:00.000Z"),
			toDate: new Date("2026-03-31T00:00:00.000Z"),
			groupBy: "ASSET_CATEGORY",
		});

		expect(result.rows).toHaveLength(1);
		const row = result.rows[0];
		expect(row.groupingKey).toBe("cat-1");
		expect(row.groupingLabel).toBe("Machinery");
		expect(row.netPurchaseAmount).toBe(100000);
		expect(row.openingAccumulatedDepreciation).toBe(5000);
		expect(row.depreciatedAmount).toBe(2000);
		expect(row.revaluationAmount).toBe(2000);
		// NBV = 100000 - 5000 - 2000 + 2000 = 95000
		expect(row.netBookValue).toBe(95000);

		expect(result.summary.totalAssets).toBe(1);
		expect(result.summary.totalNetBookValue).toBe(95000);

		// Monthly chart points
		expect(result.chartPoints.length).toBeGreaterThanOrEqual(3);
		const janPoint = result.chartPoints.find((p) => p.month === "2026-01");
		expect(janPoint?.assetValue).toBe(100000);
		expect(janPoint?.depreciatedAmount).toBe(1000);
	});

	it("groups assets by LOCATION and computes summary across multiple assets", async () => {
		const mockAssets = [
			{
				id: "asset-1",
				series: "AST-2026-00001",
				assetName: "Laptop 1",
				company: "ACME Corp",
				purchaseDate: new Date("2026-01-05T00:00:00.000Z"),
				availableForUseDate: new Date("2026-01-05T00:00:00.000Z"),
				status: "SUBMITTED",
				netPurchaseAmount: 50000,
				openingAccumulatedDepreciation: 0,
				assetCategory: { id: "cat-2", name: "IT Hardware" },
				location: { id: "loc-2", name: "HQ Office" },
				valueAdjustments: [],
				depreciationSchedules: [
					{
						status: "ACTIVE",
						entries: [
							{
								depreciationAmount: 500,
								scheduleDate: new Date("2026-01-31T00:00:00.000Z"),
							},
						],
					},
				],
			},
			{
				id: "asset-2",
				series: "AST-2026-00002",
				assetName: "Server 1",
				company: "ACME Corp",
				purchaseDate: new Date("2026-02-10T00:00:00.000Z"),
				availableForUseDate: new Date("2026-02-10T00:00:00.000Z"),
				status: "SUBMITTED",
				netPurchaseAmount: 150000,
				openingAccumulatedDepreciation: 10000,
				assetCategory: { id: "cat-2", name: "IT Hardware" },
				location: { id: "loc-2", name: "HQ Office" },
				valueAdjustments: [
					{
						differenceAmount: -5000,
						adjustmentDate: new Date("2026-02-15T00:00:00.000Z"),
					},
				],
				depreciationSchedules: [],
			},
		];

		const prismaMock = {
			asset: {
				findMany: mock(async () => mockAssets),
			},
		} as unknown as PrismaService;

		const service = new FixedAssetRegisterReportService(prismaMock);

		const result = await service.generateReport({
			fromDate: new Date("2026-01-01T00:00:00.000Z"),
			toDate: new Date("2026-02-28T00:00:00.000Z"),
			groupBy: "LOCATION",
		});

		expect(result.rows).toHaveLength(2);
		expect(result.rows[0].groupingLabel).toBe("HQ Office");
		expect(result.rows[1].groupingLabel).toBe("HQ Office");

		// Asset 1 NBV: 50000 - 0 - 500 + 0 = 49500
		expect(result.rows[0].netBookValue).toBe(49500);
		// Asset 2 NBV: 150000 - 10000 - 0 + (-5000) = 135000
		expect(result.rows[1].netBookValue).toBe(135000);

		expect(result.summary.totalAssets).toBe(2);
		expect(result.summary.totalPurchaseAmount).toBe(200000);
		expect(result.summary.totalDepreciatedAmount).toBe(500);
		expect(result.summary.totalRevaluationAmount).toBe(-5000);
		expect(result.summary.totalNetBookValue).toBe(184500);
	});
});
