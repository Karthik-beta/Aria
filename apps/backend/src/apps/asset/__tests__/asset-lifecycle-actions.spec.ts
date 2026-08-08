import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import type { AssetDashboardSubService } from "../asset-dashboard.service";

function createMockPrisma() {
	const mockTx = {
		$queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]),
		asset: {
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
		},
		assetDisposal: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
			count: jest.fn(),
		},
		assetMovement: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
		},
		assetRepair: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
		},
		assetCapitalization: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
		},
		assetActivity: {
			create: jest.fn(),
		},
		documentSeriesCounter: {
			findUnique: jest.fn(),
			update: jest.fn(),
		},
	};

	return {
		asset: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
		},
		assetDisposal: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
		},
		assetMovement: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
		},
		assetRepair: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
		},
		assetCapitalization: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
		},
		assetActivity: {
			create: jest.fn(),
		},
		documentSeriesCounter: {
			findUnique: jest.fn(),
			update: jest.fn(),
		},
		client: {
			$queryRaw: jest.fn(),
		},
		$transaction: jest.fn().mockImplementation(async (fn) => fn(mockTx)),
		_mockTx: mockTx,
	};
}

function createTestContext() {
	const mockPrisma = createMockPrisma();
	mockPrisma.documentSeriesCounter.findUnique.mockResolvedValue(null);
	mockPrisma._mockTx.documentSeriesCounter.findUnique.mockResolvedValue(null);
	mockPrisma.client.$queryRaw.mockImplementation(async (query: unknown) => {
		const values =
			query &&
			typeof query === "object" &&
			"values" in query &&
			Array.isArray(query.values)
				? query.values
				: [];
		const initialValue =
			typeof values[1] === "number" && Number.isFinite(values[1])
				? values[1]
				: 1;
		return [{ value: initialValue }];
	});

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

describe("Asset Lifecycle Actions (Phase 2)", () => {
	describe("scrapAsset", () => {
		it("should scrap a submitted asset and generate an AssetDisposal record", async () => {
			const { service, mockPrisma } = createTestContext();
			const purchaseDate = new Date("2025-01-01");
			const disposalDate = new Date("2026-01-01");

			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-1",
				series: "AST-2025-00001",
				status: "SUBMITTED",
				company: "Acme Corp",
				purchaseDate,
				valueAfterDepreciation: 5000,
				netPurchaseAmount: 10000,
			});

			mockPrisma._mockTx.assetDisposal.create.mockResolvedValue({
				id: "disp-1",
				series: "DISP-2026-00001",
				assetId: "asset-1",
				company: "Acme Corp",
				disposalDate,
				disposalType: "SCRAP",
				salesAmount: 0,
				gainLossAmount: -5000,
				status: "POSTED",
				notes: "Scrapped due to unrepairable damage",
				createdAt: new Date(),
				updatedAt: new Date(),
				asset: { assetName: "Test Laptop" },
			});

			const result = await service.scrapAsset({
				assetId: "asset-1",
				disposalDate,
				notes: "Scrapped due to unrepairable damage",
			});

			expect(result.series).toBe("DISP-2026-00001");
			expect(result.disposalType).toBe("SCRAP");
			expect(result.gainLossAmount).toBe(-5000);
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: { status: "SCRAPPED", disposalDate },
			});
		});

		it("should throw NotFoundException if asset does not exist", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.asset.findUnique.mockResolvedValue(null);

			await expect(
				service.scrapAsset({
					assetId: "nonexistent",
					disposalDate: new Date(),
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("should throw BadRequestException if asset is in DRAFT status", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-1",
				series: "AST-2025-00001",
				status: "DRAFT",
				purchaseDate: new Date("2025-01-01"),
			});

			await expect(
				service.scrapAsset({
					assetId: "asset-1",
					disposalDate: new Date("2026-01-01"),
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("sellAsset", () => {
		it("should sell a submitted asset and calculate gain/loss correctly", async () => {
			const { service, mockPrisma } = createTestContext();
			const purchaseDate = new Date("2025-01-01");
			const disposalDate = new Date("2026-01-01");

			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-1",
				series: "AST-2025-00001",
				status: "SUBMITTED",
				company: "Acme Corp",
				purchaseDate,
				valueAfterDepreciation: 5000,
			});

			mockPrisma._mockTx.assetDisposal.create.mockResolvedValue({
				id: "disp-2",
				series: "DISP-2026-00002",
				assetId: "asset-1",
				company: "Acme Corp",
				disposalDate,
				disposalType: "SELL",
				salesAmount: 7000,
				gainLossAmount: 2000,
				status: "POSTED",
				notes: "Sold to third party",
				createdAt: new Date(),
				updatedAt: new Date(),
				asset: { assetName: "Test Server" },
			});

			const result = await service.sellAsset({
				assetId: "asset-1",
				disposalDate,
				salesAmount: 7000,
				notes: "Sold to third party",
			});

			expect(result.disposalType).toBe("SELL");
			expect(result.salesAmount).toBe(7000);
			expect(result.gainLossAmount).toBe(2000);
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: { status: "SOLD", disposalDate },
			});
		});
	});

	describe("restoreAsset", () => {
		it("should restore a SCRAPPED asset back to operational status", async () => {
			const { service, mockPrisma } = createTestContext();

			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-1",
				series: "AST-2025-00001",
				assetName: "Printer",
				status: "SCRAPPED",
				company: "Acme Corp",
				netPurchaseAmount: 10000,
				valueAfterDepreciation: 8000,
				isFullyDepreciated: false,
				assetQuantity: 1,
				calculateDepreciation: false,
				assetOwner: "COMPANY",
				maintenanceRequired: false,
				activities: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			mockPrisma._mockTx.asset.update.mockResolvedValue({
				id: "asset-1",
				series: "AST-2025-00001",
				assetName: "Printer",
				status: "PARTIALLY_DEPRECIATED",
				company: "Acme Corp",
				netPurchaseAmount: 10000,
				valueAfterDepreciation: 8000,
				isFullyDepreciated: false,
				assetQuantity: 1,
				calculateDepreciation: false,
				assetOwner: "COMPANY",
				maintenanceRequired: false,
				activities: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const result = await service.restoreAsset({ assetId: "asset-1" });

			expect(result.status).toBe("PARTIALLY_DEPRECIATED");
			expect(mockPrisma._mockTx.assetDisposal.updateMany).toHaveBeenCalledWith({
				where: { assetId: "asset-1", status: "POSTED" },
				data: { status: "CANCELLED" },
			});
		});

		it("should throw BadRequestException if asset is SUBMITTED (not scrapped/sold)", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-1",
				series: "AST-2025-00001",
				status: "SUBMITTED",
			});

			await expect(
				service.restoreAsset({ assetId: "asset-1" }),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("AssetMovement submit & cancel", () => {
		it("should submit a draft movement and update asset location and custodian", async () => {
			const { service, mockPrisma } = createTestContext();

			mockPrisma.assetMovement.findUnique.mockResolvedValue({
				id: "mov-1",
				series: "MOV-2026-00001",
				status: "DRAFT",
				items: [
					{
						assetId: "asset-1",
						sourceLocationId: "loc-1",
						targetLocationId: "loc-2",
						fromEmployee: "Emp A",
						toEmployee: "Emp B",
						targetLocation: { name: "Warehouse B" },
					},
				],
			});

			mockPrisma._mockTx.assetMovement.update.mockResolvedValue({
				id: "mov-1",
				series: "MOV-2026-00001",
				company: "Acme Corp",
				transactionDate: new Date(),
				purpose: "TRANSFER",
				status: "SUBMITTED",
				submittedAt: new Date(),
				items: [
					{
						id: "item-1",
						movementId: "mov-1",
						assetId: "asset-1",
						sourceLocationId: "loc-1",
						targetLocationId: "loc-2",
						fromEmployee: "Emp A",
						toEmployee: "Emp B",
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				],
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const result = await service.submitAssetMovement({ id: "mov-1" });

			expect(result.status).toBe("SUBMITTED");
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: {
					location: { connect: { id: "loc-2" } },
					custodian: "Emp B",
				},
			});
		});

		it("should cancel a submitted movement and revert asset location and custodian", async () => {
			const { service, mockPrisma } = createTestContext();

			mockPrisma.assetMovement.findUnique.mockResolvedValue({
				id: "mov-1",
				series: "MOV-2026-00001",
				status: "SUBMITTED",
				items: [
					{
						assetId: "asset-1",
						sourceLocationId: "loc-1",
						targetLocationId: "loc-2",
						fromEmployee: "Emp A",
						toEmployee: "Emp B",
					},
				],
			});

			mockPrisma._mockTx.assetMovement.update.mockResolvedValue({
				id: "mov-1",
				series: "MOV-2026-00001",
				company: "Acme Corp",
				transactionDate: new Date(),
				purpose: "TRANSFER",
				status: "CANCELLED",
				cancelledAt: new Date(),
				items: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const result = await service.cancelAssetMovement({ id: "mov-1" });

			expect(result.status).toBe("CANCELLED");
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: {
					location: { connect: { id: "loc-1" } },
					custodian: "Emp A",
				},
			});
		});
	});

	describe("AssetRepair submit & cancel", () => {
		it("should submit repair and capitalize cost into asset netPurchaseAmount", async () => {
			const { service, mockPrisma } = createTestContext();

			mockPrisma.assetRepair.findUnique.mockResolvedValue({
				id: "rep-1",
				series: "REP-2026-00001",
				assetId: "asset-1",
				repairStatus: "DRAFT",
				repairCost: 1500,
				capitalizeRepairCost: true,
				increaseInAssetLife: 2,
				consumedItems: [],
				purchaseInvoices: [],
			});

			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue({
				id: "asset-1",
				netPurchaseAmount: 10000,
				valueAfterDepreciation: 8000,
				totalNumberOfDepreciations: 10,
			});

			mockPrisma._mockTx.assetRepair.update.mockResolvedValue({
				id: "rep-1",
				series: "REP-2026-00001",
				assetId: "asset-1",
				company: "Acme Corp",
				failureDate: new Date(),
				repairStatus: "COMPLETED",
				repairCost: 1500,
				capitalizeRepairCost: true,
				increaseInAssetLife: 2,
				consumedItems: [],
				purchaseInvoices: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const result = await service.submitAssetRepair({ id: "rep-1" });

			expect(result.repairStatus).toBe("COMPLETED");
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: {
					netPurchaseAmount: 11500,
					valueAfterDepreciation: 9500,
					totalNumberOfDepreciations: 12,
				},
			});
		});

		it("should cancel repair and revert capitalized cost from asset", async () => {
			const { service, mockPrisma } = createTestContext();

			mockPrisma.assetRepair.findUnique.mockResolvedValue({
				id: "rep-1",
				series: "REP-2026-00001",
				assetId: "asset-1",
				repairStatus: "COMPLETED",
				submittedAt: new Date(),
				repairCost: 1500,
				capitalizeRepairCost: true,
				increaseInAssetLife: 2,
				consumedItems: [],
				purchaseInvoices: [],
			});

			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue({
				id: "asset-1",
				netPurchaseAmount: 11500,
				valueAfterDepreciation: 9500,
				totalNumberOfDepreciations: 12,
			});

			mockPrisma._mockTx.assetRepair.update.mockResolvedValue({
				id: "rep-1",
				series: "REP-2026-00001",
				assetId: "asset-1",
				company: "Acme Corp",
				failureDate: new Date(),
				repairStatus: "CANCELLED",
				cancelledAt: new Date(),
				repairCost: 1500,
				capitalizeRepairCost: true,
				increaseInAssetLife: 2,
				consumedItems: [],
				purchaseInvoices: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const result = await service.cancelAssetRepair({ id: "rep-1" });

			expect(result.repairStatus).toBe("CANCELLED");
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: {
					netPurchaseAmount: 10000,
					valueAfterDepreciation: 8000,
					totalNumberOfDepreciations: 10,
				},
			});
		});
	});

	describe("AssetCapitalization submit & cancel", () => {
		it("should submit capitalization, adding total value to target asset and scrapping consumed assets", async () => {
			const { service, mockPrisma } = createTestContext();

			mockPrisma.assetCapitalization.findUnique.mockResolvedValue({
				id: "cap-1",
				series: "CAP-2026-00001",
				status: "DRAFT",
				targetType: "EXISTING_ASSET",
				targetAssetId: "target-asset",
				totalValue: 5000,
				assetItems: [{ assetId: "consumed-asset-1" }],
			});

			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue({
				id: "target-asset",
				netPurchaseAmount: 20000,
				valueAfterDepreciation: 15000,
			});

			mockPrisma._mockTx.assetCapitalization.update.mockResolvedValue({
				id: "cap-1",
				series: "CAP-2026-00001",
				company: "Acme Corp",
				postingDate: new Date(),
				targetType: "EXISTING_ASSET",
				targetAssetId: "target-asset",
				status: "SUBMITTED",
				totalStockValue: 2000,
				totalAssetValue: 3000,
				totalServiceValue: 0,
				totalValue: 5000,
				stockItems: [],
				assetItems: [],
				serviceItems: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const result = await service.submitAssetCapitalization({ id: "cap-1" });

			expect(result.status).toBe("SUBMITTED");
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "target-asset" },
				data: {
					netPurchaseAmount: 25000,
					valueAfterDepreciation: 20000,
				},
			});
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "consumed-asset-1" },
				data: { status: "SCRAPPED" },
			});
		});

		it("should cancel capitalization, reverting target asset value and restoring consumed assets", async () => {
			const { service, mockPrisma } = createTestContext();

			mockPrisma.assetCapitalization.findUnique.mockResolvedValue({
				id: "cap-1",
				series: "CAP-2026-00001",
				status: "SUBMITTED",
				targetType: "EXISTING_ASSET",
				targetAssetId: "target-asset",
				totalValue: 5000,
				assetItems: [{ assetId: "consumed-asset-1" }],
			});

			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue({
				id: "target-asset",
				netPurchaseAmount: 25000,
				valueAfterDepreciation: 20000,
			});

			mockPrisma._mockTx.assetCapitalization.update.mockResolvedValue({
				id: "cap-1",
				series: "CAP-2026-00001",
				company: "Acme Corp",
				postingDate: new Date(),
				targetType: "EXISTING_ASSET",
				targetAssetId: "target-asset",
				status: "CANCELLED",
				totalStockValue: 2000,
				totalAssetValue: 3000,
				totalServiceValue: 0,
				totalValue: 5000,
				stockItems: [],
				assetItems: [],
				serviceItems: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const result = await service.cancelAssetCapitalization({ id: "cap-1" });

			expect(result.status).toBe("CANCELLED");
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "target-asset" },
				data: {
					netPurchaseAmount: 20000,
					valueAfterDepreciation: 15000,
				},
			});
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "consumed-asset-1" },
				data: { status: "SUBMITTED" },
			});
		});
	});
});
