/* eslint-disable */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import type { AssetDashboardSubService } from "../asset-dashboard.service";

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function createMockPrisma() {
	return {
		location: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		asset: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		assetCategory: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		company: {
			findFirst: jest.fn(),
			findMany: jest.fn(),
		},
		assetActivity: {
			create: jest.fn(),
		},
		$transaction: jest.fn(),
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

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockCategoryRow = {
	id: "cat-abc-001",
	name: "Vehicles",
	depreciationMethod: "STRAIGHT_LINE",
	totalNumberOfDepreciations: 60,
	frequencyOfDepreciation: 12,
	nonDepreciableCategory: false,
	enableCwipAccounting: false,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

const mockNonDepreciableRow = {
	id: "cat-land-001",
	name: "Land",
	depreciationMethod: null,
	totalNumberOfDepreciations: null,
	frequencyOfDepreciation: null,
	nonDepreciableCategory: true,
	enableCwipAccounting: true,
	createdAt: new Date("2026-02-01"),
	updatedAt: new Date("2026-02-01"),
};

const categoryAccountA = {
	id: "account-a",
	companyId: "company-a",
	company: { name: "Acme" },
	fixedAssetAccount: "Fixed Asset - A",
	accumulatedDepreciationAccount: "Accumulated Depreciation - A",
	depreciationExpenseAccount: "Depreciation Expense - A",
	capitalWorkInProgressAccount: "CWIP - A",
};

const categoryAccountB = {
	id: "account-b",
	companyId: "company-b",
	company: { name: "Acme" },
	fixedAssetAccount: "Fixed Asset - B",
	accumulatedDepreciationAccount: "Accumulated Depreciation - B",
	depreciationExpenseAccount: "Depreciation Expense - B",
	capitalWorkInProgressAccount: "CWIP - B",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssetService > AssetCategory", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma } = createTestContext());
	});

	// -------------------------------------------------------------------------
	// findAllAssetCategories
	// -------------------------------------------------------------------------

	describe("findAllAssetCategories", () => {
		it("returns items and totalCount", async () => {
			mockPrisma.assetCategory.findMany.mockResolvedValue([mockCategoryRow]);
			mockPrisma.assetCategory.count.mockResolvedValue(1);

			const result = await service.findAllAssetCategories("org-1", {
				skip: 0,
				take: 20,
			});

			expect(result.totalCount).toBe(1);
			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				id: mockCategoryRow.id,
				name: mockCategoryRow.name,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 60,
				frequencyOfDepreciation: 12,
				nonDepreciableCategory: false,
				enableCwipAccounting: false,
			});
		});

		it("scopes nested account reads through Company organization ownership", async () => {
			mockPrisma.assetCategory.findMany.mockResolvedValue([
				{ ...mockCategoryRow, accounts: [categoryAccountA] },
			]);
			mockPrisma.assetCategory.count.mockResolvedValue(1);

			const result = await service.findAllAssetCategories("org-a", {});
			const findManyArgs = mockPrisma.assetCategory.findMany.mock.calls[0][0];

			expect(findManyArgs.include.accounts.where.company.is.AND).toContainEqual(
				{ organizationId: "org-a" },
			);
			expect(result.items[0]?.accounts).toEqual([
				expect.objectContaining({
					companyId: "company-a",
					fixedAssetAccount: "Fixed Asset - A",
				}),
			]);
		});

		it("returns empty list when no categories exist", async () => {
			mockPrisma.assetCategory.findMany.mockResolvedValue([]);
			mockPrisma.assetCategory.count.mockResolvedValue(0);

			const result = await service.findAllAssetCategories("org-1", {});

			expect(result.totalCount).toBe(0);
			expect(result.items).toHaveLength(0);
		});

		it("applies case-insensitive search filter on name", async () => {
			mockPrisma.assetCategory.findMany.mockResolvedValue([]);
			mockPrisma.assetCategory.count.mockResolvedValue(0);

			await service.findAllAssetCategories("org-1", { search: "vehicles" });

			expect(mockPrisma.assetCategory.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						name: {
							contains: "vehicles",
							mode: "insensitive",
						},
					},
				}),
			);
		});

		it("clamps take to LIST_TAKE_MAX (250)", async () => {
			mockPrisma.assetCategory.findMany.mockResolvedValue([]);
			mockPrisma.assetCategory.count.mockResolvedValue(0);

			await service.findAllAssetCategories("org-1", { take: 9999 });

			expect(mockPrisma.assetCategory.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ take: 250 }),
			);
		});

		it("maps null depreciation fields for non-depreciable categories", async () => {
			mockPrisma.assetCategory.findMany.mockResolvedValue([
				mockNonDepreciableRow,
			]);
			mockPrisma.assetCategory.count.mockResolvedValue(1);

			const result = await service.findAllAssetCategories("org-1", {});

			expect(result.items[0]).toMatchObject({
				name: "Land",
				depreciationMethod: null,
				totalNumberOfDepreciations: null,
				frequencyOfDepreciation: null,
				nonDepreciableCategory: true,
				enableCwipAccounting: true,
			});
		});
	});

	// -------------------------------------------------------------------------
	// findAssetCategoryById
	// -------------------------------------------------------------------------

	describe("findAssetCategoryById", () => {
		it("returns the category when found", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(mockCategoryRow);

			const result = await service.findAssetCategoryById(
				"cat-abc-001",
				"org-1",
			);

			expect(result).toMatchObject({
				id: "cat-abc-001",
				name: "Vehicles",
			});
		});

		it("returns null when category does not exist", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);

			const result = await service.findAssetCategoryById("missing-id", "org-1");

			expect(result).toBeNull();
		});

		it("uses the trusted organization for detail account reads", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				...mockCategoryRow,
				accounts: [categoryAccountB],
			});

			const result = await service.findAssetCategoryById(
				"cat-abc-001",
				"org-b",
			);
			const findUniqueArgs =
				mockPrisma.assetCategory.findUnique.mock.calls[0][0];

			expect(
				findUniqueArgs.include.accounts.where.company.is.AND,
			).toContainEqual({ organizationId: "org-b" });
			expect(result?.accounts).toEqual([
				expect.objectContaining({
					companyId: "company-b",
					fixedAssetAccount: "Fixed Asset - B",
				}),
			]);
		});
	});

	// -------------------------------------------------------------------------
	// createAssetCategory
	// -------------------------------------------------------------------------

	describe("createAssetCategory", () => {
		it("creates a new depreciable category", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);
			mockPrisma.assetCategory.create.mockResolvedValue(mockCategoryRow);

			const result = await service.createAssetCategory(
				{
					name: "Vehicles",
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 60,
					frequencyOfDepreciation: 12,
					nonDepreciableCategory: false,
					enableCwipAccounting: false,
				},
				"org-1",
			);

			expect(result.name).toBe("Vehicles");
			expect(result.depreciationMethod).toBe("STRAIGHT_LINE");
			expect(mockPrisma.assetCategory.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						name: "Vehicles",
						depreciationMethod: "STRAIGHT_LINE",
						totalNumberOfDepreciations: 60,
						frequencyOfDepreciation: 12,
						nonDepreciableCategory: false,
						enableCwipAccounting: false,
					}),
				}),
			);
		});

		it("creates a non-depreciable category", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);
			mockPrisma.assetCategory.create.mockResolvedValue(mockNonDepreciableRow);

			const result = await service.createAssetCategory(
				{
					name: "Land",
					nonDepreciableCategory: true,
					enableCwipAccounting: true,
				},
				"org-1",
			);

			expect(result.name).toBe("Land");
			expect(result.nonDepreciableCategory).toBe(true);
		});

		it("throws BadRequestException on duplicate name", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "dup-id",
			});

			await expect(
				service.createAssetCategory(
					{
						name: "Vehicles",
					},
					"org-1",
				),
			).rejects.toThrow(BadRequestException);
		});

		it("throws BadRequestException with a meaningful message on duplicate", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "dup-id",
			});

			await expect(
				service.createAssetCategory({ name: "Vehicles" }, "org-1"),
			).rejects.toThrow('Asset category "Vehicles" already exists');
		});
	});

	// -------------------------------------------------------------------------
	// updateAssetCategory
	// -------------------------------------------------------------------------

	describe("updateAssetCategory", () => {
		it("updates an existing category name", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "cat-abc-001",
			});
			mockPrisma.assetCategory.update.mockResolvedValue({
				...mockCategoryRow,
				name: "Fleet Vehicles",
			});

			const result = await service.updateAssetCategory(
				{
					id: "cat-abc-001",
					name: "Fleet Vehicles",
				},
				"org-1",
			);

			expect(result.name).toBe("Fleet Vehicles");
		});

		it("updates depreciation settings", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "cat-abc-001",
			});
			mockPrisma.assetCategory.update.mockResolvedValue({
				...mockCategoryRow,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				totalNumberOfDepreciations: 36,
			});

			const result = await service.updateAssetCategory(
				{
					id: "cat-abc-001",
					depreciationMethod: "WRITTEN_DOWN_VALUE",
					totalNumberOfDepreciations: 36,
				},
				"org-1",
			);

			expect(result.depreciationMethod).toBe("WRITTEN_DOWN_VALUE");
			expect(result.totalNumberOfDepreciations).toBe(36);
		});

		it("updates enableCwipAccounting flag", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "cat-abc-001",
			});
			mockPrisma.assetCategory.update.mockResolvedValue({
				...mockCategoryRow,
				enableCwipAccounting: true,
			});

			const result = await service.updateAssetCategory(
				{
					id: "cat-abc-001",
					enableCwipAccounting: true,
				},
				"org-1",
			);

			expect(result.enableCwipAccounting).toBe(true);
		});

		it("replaces only the active organization's account rows", async () => {
			mockPrisma.company.findFirst.mockResolvedValue({
				id: "company-a",
				name: "Acme",
				disabled: false,
			});
			mockPrisma.company.findMany.mockResolvedValue([
				{ id: "company-a" },
				{ id: "company-a2" },
			]);
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "cat-abc-001",
			});
			mockPrisma.assetCategory.update.mockResolvedValue({
				...mockCategoryRow,
				accounts: [categoryAccountA],
			});

			await service.updateAssetCategory(
				{
					id: "cat-abc-001",
					accounts: [
						{
							companyId: "company-a",
							fixedAssetAccount: "Fixed Asset - A2",
							accumulatedDepreciationAccount: "Accumulated Depreciation - A2",
							depreciationExpenseAccount: "Depreciation Expense - A2",
							capitalWorkInProgressAccount: "CWIP - A2",
						},
					],
				},
				"org-a",
			);

			const updateArgs = mockPrisma.assetCategory.update.mock.calls[0][0];
			expect(updateArgs.data.accounts.deleteMany.companyId).toEqual({
				in: ["company-a", "company-a2"],
			});
			expect(updateArgs.data.accounts.create).toEqual([
				{
					companyId: "company-a",
					fixedAssetAccount: "Fixed Asset - A2",
					accumulatedDepreciationAccount: "Accumulated Depreciation - A2",
					depreciationExpenseAccount: "Depreciation Expense - A2",
					capitalWorkInProgressAccount: "CWIP - A2",
				},
			]);
		});

		it("rejects a foreign Company account before any category write", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(null);

			await expect(
				service.updateAssetCategory(
					{
						id: "cat-abc-001",
						accounts: [
							{
								companyId: "company-b",
								fixedAssetAccount: "Fixed Asset - B",
							},
						],
					},
					"org-a",
				),
			).rejects.toThrow(NotFoundException);
			expect(mockPrisma.assetCategory.findUnique).not.toHaveBeenCalled();
			expect(mockPrisma.assetCategory.update).not.toHaveBeenCalled();
		});

		it("throws NotFoundException when category does not exist", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);

			await expect(
				service.updateAssetCategory(
					{
						id: "nonexistent",
						name: "X",
					},
					"org-1",
				),
			).rejects.toThrow(NotFoundException);
		});

		it("marks category as non-depreciable and clears depreciation fields", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "cat-abc-001",
			});
			mockPrisma.assetCategory.update.mockResolvedValue({
				...mockCategoryRow,
				depreciationMethod: null,
				totalNumberOfDepreciations: null,
				frequencyOfDepreciation: null,
				nonDepreciableCategory: true,
			});

			const result = await service.updateAssetCategory(
				{
					id: "cat-abc-001",
					nonDepreciableCategory: true,
					depreciationMethod: null,
					totalNumberOfDepreciations: null,
					frequencyOfDepreciation: null,
				},
				"org-1",
			);

			expect(result.nonDepreciableCategory).toBe(true);
			expect(result.depreciationMethod).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// deleteAssetCategory
	// -------------------------------------------------------------------------

	describe("deleteAssetCategory", () => {
		it("deletes a category with no assigned assets", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "cat-abc-001",
				_count: { assets: 0 },
			});
			mockPrisma.assetCategory.delete.mockResolvedValue({
				id: "cat-abc-001",
			});

			const result = await service.deleteAssetCategory("cat-abc-001", "org-1");

			expect(result).toEqual({ success: true, id: "cat-abc-001" });
			expect(mockPrisma.assetCategory.delete).toHaveBeenCalledWith({
				where: { id: "cat-abc-001" },
			});
		});

		it("throws BadRequestException when category has assigned assets", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "cat-abc-001",
				_count: { assets: 5 },
			});

			await expect(
				service.deleteAssetCategory("cat-abc-001", "org-1"),
			).rejects.toThrow(BadRequestException);
		});

		it("throws BadRequestException with a meaningful message on assigned assets", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "cat-abc-001",
				_count: { assets: 2 },
			});

			await expect(
				service.deleteAssetCategory("cat-abc-001", "org-1"),
			).rejects.toThrow(
				"Cannot delete an asset category that is assigned to assets",
			);
		});

		it("throws NotFoundException when category does not exist", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);

			await expect(
				service.deleteAssetCategory("nonexistent", "org-1"),
			).rejects.toThrow(NotFoundException);
		});
	});
});
