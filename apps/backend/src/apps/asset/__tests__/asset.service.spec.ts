/* eslint-disable */

import type { Asset } from "@aria/types";
import type { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import type { AssetDashboardSubService } from "../asset-dashboard.service";

function createMockPrisma() {
	return {
		asset: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			findUniqueOrThrow: jest.fn(),
		},
		assetCategory: {
			findUnique: jest.fn(),
		},
		assetActivity: {
			create: jest.fn(),
		},
		documentSeriesCounter: {
			findUnique: jest.fn(),
		},
		client: {
			$queryRaw: jest.fn(),
		},
	};
}

function createTestContext() {
	const mockPrisma = createMockPrisma();
	mockPrisma.client.$queryRaw.mockResolvedValue([{ value: 1 }]);
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

const mockAssetRow = {
	id: "asset-123",
	series: "AST-2026-00001",
	assetName: "Office Laptop",
	itemCode: "LAP-001",
	barcode: "1234567890",
	assetCategoryId: "cat-123",
	company: "Test Corp",
	locationId: "loc-123",
	custodian: "Jane Doe",
	department: "Engineering",
	purchaseDate: new Date("2026-01-01"),
	availableForUseDate: new Date("2026-01-02"),
	disposalDate: null,
	netPurchaseAmount: 50000,
	assetQuantity: 1,
	calculateDepreciation: false,
	openingAccumulatedDepreciation: 0,
	openingNumberOfBookedDepreciations: 0,
	isFullyDepreciated: false,
	valueAfterDepreciation: 50000,
	maintenanceRequired: false,
	assetOwner: "COMPANY",
	assetOwnerCompany: null,
	supplier: null,
	customer: null,
	policyNumber: null,
	insurer: null,
	insuredValue: null,
	insuranceStartDate: null,
	insuranceEndDate: null,
	depreciationMethod: null,
	totalNumberOfDepreciations: null,
	frequencyOfDepreciation: null,
	expectedValueAfterUsefulLife: null,
	depreciationStartDate: null,
	purchaseReceipt: null,
	purchaseInvoice: null,
	status: "DRAFT",
	activities: [],
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-01"),
};

describe("AssetService > Barcode support", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma } = createTestContext());
	});

	describe("findAssetByBarcode", () => {
		it("returns mapped asset if found", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue(mockAssetRow);

			const result = await service.findAssetByBarcode("1234567890");

			expect(mockPrisma.asset.findUnique).toHaveBeenCalledWith({
				where: { barcode: "1234567890" },
				include: expect.any(Object),
			});
			expect(result).not.toBeNull();
			expect(result?.barcode).toBe("1234567890");
		});

		it("returns null if not found", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue(null);

			const result = await service.findAssetByBarcode("unknown");

			expect(result).toBeNull();
		});
	});

	describe("createAsset with barcode", () => {
		it("persists barcode when provided", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);
			mockPrisma.documentSeriesCounter.findUnique.mockResolvedValue(null);
			mockPrisma.asset.findFirst.mockResolvedValue(null);
			mockPrisma.asset.create.mockResolvedValue(mockAssetRow);
			mockPrisma.asset.findUniqueOrThrow.mockResolvedValue(mockAssetRow);
			const input: Asset.CreateAssetInput = {
				assetName: "Office Laptop",
				company: "Test Corp",
				barcode: "1234567890",
			};

			const result = await service.createAsset(input);

			expect(mockPrisma.asset.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						barcode: "1234567890",
					}),
				}),
			);
			expect(result.barcode).toBe("1234567890");
		});
	});

	describe("updateAsset with barcode", () => {
		it("updates barcode when provided", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue(mockAssetRow);
			mockPrisma.asset.update.mockResolvedValue({
				...mockAssetRow,
				barcode: "9876543210",
			});

			const input: Asset.UpdateAssetInput = {
				id: "asset-123",
				barcode: "9876543210",
			};

			const result = await service.updateAsset(input);

			expect(mockPrisma.asset.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "asset-123" },
					data: expect.objectContaining({
						barcode: "9876543210",
					}),
				}),
			);
			expect(result.barcode).toBe("9876543210");
		});
	});
});
