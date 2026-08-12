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
			findMany: jest.fn(),
		},
		company: {
			findFirst: jest.fn(),
		},
		documentSeriesCounter: {
			findUnique: jest.fn(),
			update: jest.fn(),
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
	companyId: "company-123",
	company: { id: "company-123", name: "Test Corp", organizationId: "org-1" },
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

	describe("createAsset with barcode and actor attribution", () => {
		it("persists barcode and attributes assetActivity to the trusted actor", async () => {
			mockPrisma.company.findFirst.mockResolvedValue({
				id: "company-123",
				name: "Test Corp",
				disabled: false,
			});
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);
			mockPrisma.documentSeriesCounter.findUnique.mockResolvedValue(null);
			mockPrisma.asset.findFirst.mockResolvedValue(null);
			mockPrisma.asset.create.mockResolvedValue(mockAssetRow);
			mockPrisma.asset.findUniqueOrThrow.mockResolvedValue(mockAssetRow);
			const input: Asset.CreateAssetInput = {
				assetName: "Office Laptop",
				companyId: "company-123",
				barcode: "1234567890",
			};

			const result = await service.createAsset(input, "org-1", "user-123");

			expect(mockPrisma.asset.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						barcode: "1234567890",
						companyId: "company-123",
					}),
				}),
			);
			expect(mockPrisma.assetActivity.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					assetId: "asset-123",
					userId: "user-123",
				}),
			});
			expect(result.barcode).toBe("1234567890");
		});

		it("atomically increments documentSeriesCounter when counter exists", async () => {
			mockPrisma.company.findFirst.mockResolvedValue({
				id: "company-123",
				name: "Test Corp",
				disabled: false,
			});
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);
			mockPrisma.documentSeriesCounter.findUnique.mockResolvedValue({
				value: 5,
			});
			mockPrisma.documentSeriesCounter.update.mockResolvedValue({ value: 6 });
			mockPrisma.asset.create.mockResolvedValue({
				...mockAssetRow,
				series: "AST-2026-00006",
			});
			mockPrisma.asset.findUniqueOrThrow.mockResolvedValue({
				...mockAssetRow,
				series: "AST-2026-00006",
			});

			const result = await service.createAsset(
				{
					assetName: "Office Chair",
					companyId: "company-123",
				},
				"org-1",
			);

			expect(mockPrisma.documentSeriesCounter.update).toHaveBeenCalledWith({
				where: { key: "AST-2026-" },
				data: { value: { increment: 1 } },
			});
			expect(result.series).toBe("AST-2026-00006");
		});
	});

	describe("updateAsset with barcode and actor attribution", () => {
		it("updates barcode and attributes activity to the trusted actor", async () => {
			mockPrisma.company.findFirst.mockResolvedValue({
				id: "company-123",
				name: "Test Corp",
			});
			mockPrisma.asset.findUnique.mockResolvedValue(mockAssetRow);
			mockPrisma.asset.update.mockResolvedValue({
				...mockAssetRow,
				barcode: "9876543210",
			});

			const input: Asset.UpdateAssetInput = {
				id: "asset-123",
				barcode: "9876543210",
			};

			const result = await service.updateAsset(input, "org-1", "user-456");

			expect(mockPrisma.asset.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "asset-123" },
					data: expect.objectContaining({
						barcode: "9876543210",
					}),
				}),
			);
			expect(mockPrisma.assetActivity.create).toHaveBeenCalledWith({
				data: {
					assetId: "asset-123",
					activity: "Asset updated",
					userId: "user-456",
				},
			});
			expect(result.barcode).toBe("9876543210");
		});
	});

	describe("findAssetActivityReport", () => {
		it("populates userId and userName in report result", async () => {
			const createdAt = new Date("2026-01-15T10:00:00Z");
			mockPrisma.assetActivity.findMany.mockResolvedValue([
				{
					id: "act-1",
					assetId: "asset-123",
					userId: "user-123",
					user: { id: "user-123", name: "John Doe" },
					activity: "Asset updated",
					createdAt,
					asset: {
						id: "asset-123",
						series: "AST-2026-00001",
						assetName: "Office Laptop",
						company: { name: "Test Corp" },
						status: "DRAFT",
						assetCategory: null,
					},
				},
			]);

			const result = await service.findAssetActivityReport({
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-01-31"),
			});

			expect(result.rows).toHaveLength(1);
			expect(result.rows[0]).toMatchObject({
				activityId: "act-1",
				assetId: "asset-123",
				userId: "user-123",
				userName: "John Doe",
			});
		});
	});
});
