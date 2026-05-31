/* eslint-disable */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";

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
		assetActivity: {
			create: jest.fn(),
		},
		$transaction: jest.fn(),
	};
}

function createTestContext() {
	const mockPrisma = createMockPrisma();
	const service = new AssetService(mockPrisma as unknown as PrismaService);
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

			const result = await service.findAllAssetCategories({
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

		it("returns empty list when no categories exist", async () => {
			mockPrisma.assetCategory.findMany.mockResolvedValue([]);
			mockPrisma.assetCategory.count.mockResolvedValue(0);

			const result = await service.findAllAssetCategories({});

			expect(result.totalCount).toBe(0);
			expect(result.items).toHaveLength(0);
		});

		it("applies case-insensitive search filter on name", async () => {
			mockPrisma.assetCategory.findMany.mockResolvedValue([]);
			mockPrisma.assetCategory.count.mockResolvedValue(0);

			await service.findAllAssetCategories({ search: "vehicles" });

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

			await service.findAllAssetCategories({ take: 9999 });

			expect(mockPrisma.assetCategory.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ take: 250 }),
			);
		});

		it("maps null depreciation fields for non-depreciable categories", async () => {
			mockPrisma.assetCategory.findMany.mockResolvedValue([
				mockNonDepreciableRow,
			]);
			mockPrisma.assetCategory.count.mockResolvedValue(1);

			const result = await service.findAllAssetCategories({});

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

			const result = await service.findAssetCategoryById("cat-abc-001");

			expect(result).toMatchObject({
				id: "cat-abc-001",
				name: "Vehicles",
			});
		});

		it("returns null when category does not exist", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);

			const result = await service.findAssetCategoryById("missing-id");

			expect(result).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// createAssetCategory
	// -------------------------------------------------------------------------

	describe("createAssetCategory", () => {
		it("creates a new depreciable category", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);
			mockPrisma.assetCategory.create.mockResolvedValue(mockCategoryRow);

			const result = await service.createAssetCategory({
				name: "Vehicles",
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 60,
				frequencyOfDepreciation: 12,
				nonDepreciableCategory: false,
				enableCwipAccounting: false,
			});

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

			const result = await service.createAssetCategory({
				name: "Land",
				nonDepreciableCategory: true,
				enableCwipAccounting: true,
			});

			expect(result.name).toBe("Land");
			expect(result.nonDepreciableCategory).toBe(true);
		});

		it("throws BadRequestException on duplicate name", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "dup-id",
			});

			await expect(
				service.createAssetCategory({
					name: "Vehicles",
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("throws BadRequestException with a meaningful message on duplicate", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "dup-id",
			});

			await expect(
				service.createAssetCategory({ name: "Vehicles" }),
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

			const result = await service.updateAssetCategory({
				id: "cat-abc-001",
				name: "Fleet Vehicles",
			});

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

			const result = await service.updateAssetCategory({
				id: "cat-abc-001",
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				totalNumberOfDepreciations: 36,
			});

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

			const result = await service.updateAssetCategory({
				id: "cat-abc-001",
				enableCwipAccounting: true,
			});

			expect(result.enableCwipAccounting).toBe(true);
		});

		it("throws NotFoundException when category does not exist", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);

			await expect(
				service.updateAssetCategory({
					id: "nonexistent",
					name: "X",
				}),
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

			const result = await service.updateAssetCategory({
				id: "cat-abc-001",
				nonDepreciableCategory: true,
				depreciationMethod: null,
				totalNumberOfDepreciations: null,
				frequencyOfDepreciation: null,
			});

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

			const result = await service.deleteAssetCategory("cat-abc-001");

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

			await expect(service.deleteAssetCategory("cat-abc-001")).rejects.toThrow(
				BadRequestException,
			);
		});

		it("throws BadRequestException with a meaningful message on assigned assets", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue({
				id: "cat-abc-001",
				_count: { assets: 2 },
			});

			await expect(service.deleteAssetCategory("cat-abc-001")).rejects.toThrow(
				"Cannot delete an asset category that is assigned to assets",
			);
		});

		it("throws NotFoundException when category does not exist", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);

			await expect(service.deleteAssetCategory("nonexistent")).rejects.toThrow(
				NotFoundException,
			);
		});
	});
});
