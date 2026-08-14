import type { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import type { AssetDashboardSubService } from "../asset-dashboard.service";

function createMockPrisma() {
	return {
		assetActivity: {
			findMany: jest.fn(),
		},
	};
}

function createTestContext() {
	const mockPrisma = createMockPrisma();
	const mockDashboard = {} as unknown as AssetDashboardSubService;
	const mockFiscalYear = {
		getFiscalYearEndDate: jest.fn().mockResolvedValue(null),
	} as unknown as FiscalYearService;
	const service = new AssetService(
		mockPrisma as unknown as PrismaService,
		mockDashboard,
		mockFiscalYear,
	);
	return { service, mockPrisma };
}

describe("AssetService > AssetActivityReport", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma } = createTestContext());
	});

	it("queries activity rows with date and related asset filters", async () => {
		mockPrisma.assetActivity.findMany.mockResolvedValue([
			{
				id: "activity-001",
				assetId: "asset-001",
				activity: "Asset updated",
				createdAt: new Date("2026-04-10T09:00:00.000Z"),
				asset: {
					id: "asset-001",
					series: "AST-2026-00001",
					assetName: "Hydraulic Pump A",
					company: { name: "ACME Corp" },
					status: "PARTIALLY_DEPRECIATED",
					assetCategory: {
						id: "cat-001",
						name: "Machinery",
					},
				},
			},
		]);

		const result = await service.findAssetActivityReport(
			{
				fromDate: "2026-04-01",
				toDate: "2026-04-30",
				company: "ACME",
				asset: "Pump",
				assetCategory: "Mach",
				activity: "updated",
			},
			"org-1",
		);

		expect(mockPrisma.assetActivity.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					activity: { contains: "updated", mode: "insensitive" },
					asset: {
						is: expect.objectContaining({
							AND: expect.arrayContaining([
								{ company: { is: { organizationId: "org-1" } } },
								expect.objectContaining({
									company: {
										is: {
											name: { contains: "ACME", mode: "insensitive" },
										},
									},
									OR: [
										{ series: { contains: "Pump", mode: "insensitive" } },
										{ assetName: { contains: "Pump", mode: "insensitive" } },
									],
									assetCategory: {
										is: {
											name: { contains: "Mach", mode: "insensitive" },
										},
									},
								}),
							]),
						}),
					},
				}),
			}),
		);
		expect(result.rows).toEqual([
			expect.objectContaining({
				activityId: "activity-001",
				assetSeries: "AST-2026-00001",
				assetName: "Hydraulic Pump A",
				company: "ACME Corp",
				activity: "Asset updated",
			}),
		]);
		expect(result.summary).toEqual({
			rowCount: 1,
			distinctAssetCount: 1,
			firstActivityAt: new Date("2026-04-10T09:00:00.000Z"),
			lastActivityAt: new Date("2026-04-10T09:00:00.000Z"),
		});
	});
});
