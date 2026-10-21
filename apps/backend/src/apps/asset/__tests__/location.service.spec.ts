/* eslint-disable */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetLocationService } from "../asset-location.service";

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
	const service = new AssetLocationService(
		mockPrisma as unknown as PrismaService,
	);
	return { service, mockPrisma };
}

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const mockLocationRow = {
	id: "loc-abc-001",
	name: "Head Office",
	parentLocationId: null,
	parentLocation: null,
	isGroup: true,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssetService > Location", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma } = createTestContext());
	});

	// -------------------------------------------------------------------------
	// findAllLocations
	// -------------------------------------------------------------------------

	describe("findAllLocations", () => {
		it("returns items and totalCount", async () => {
			mockPrisma.location.findMany.mockResolvedValue([mockLocationRow]);
			mockPrisma.location.count.mockResolvedValue(1);

			const result = await service.findAllLocations({ skip: 0, take: 20 });

			expect(result.totalCount).toBe(1);
			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				id: mockLocationRow.id,
				name: mockLocationRow.name,
				parentLocationId: null,
				parentLocationName: null,
				isGroup: true,
			});
		});

		it("applies isGroup filter", async () => {
			mockPrisma.location.findMany.mockResolvedValue([]);
			mockPrisma.location.count.mockResolvedValue(0);

			await service.findAllLocations({ isGroup: true });

			expect(mockPrisma.location.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ where: { isGroup: true } }),
			);
		});

		it("applies search filter", async () => {
			mockPrisma.location.findMany.mockResolvedValue([]);
			mockPrisma.location.count.mockResolvedValue(0);

			await service.findAllLocations({ search: "Office" });

			expect(mockPrisma.location.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: {
						name: { contains: "Office", mode: "insensitive" },
					},
				}),
			);
		});

		it("clamps take to LIST_TAKE_MAX (250)", async () => {
			mockPrisma.location.findMany.mockResolvedValue([]);
			mockPrisma.location.count.mockResolvedValue(0);

			await service.findAllLocations({ take: 9999 });

			expect(mockPrisma.location.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ take: 250 }),
			);
		});

		it("maps parentLocationName from relation", async () => {
			const rowWithParent = {
				...mockLocationRow,
				id: "loc-child-001",
				name: "Floor 1",
				parentLocationId: "loc-abc-001",
				parentLocation: { name: "Head Office" },
				isGroup: false,
			};
			mockPrisma.location.findMany.mockResolvedValue([rowWithParent]);
			mockPrisma.location.count.mockResolvedValue(1);

			const result = await service.findAllLocations({});

			expect(result.items[0].parentLocationName).toBe("Head Office");
			expect(result.items[0].parentLocationId).toBe("loc-abc-001");
		});
	});

	// -------------------------------------------------------------------------
	// findLocationById
	// -------------------------------------------------------------------------

	describe("findLocationById", () => {
		it("returns the location when found", async () => {
			mockPrisma.location.findUnique.mockResolvedValue(mockLocationRow);

			const result = await service.findLocationById("loc-abc-001");

			expect(result).toMatchObject({ id: "loc-abc-001", name: "Head Office" });
		});

		it("returns null when location does not exist", async () => {
			mockPrisma.location.findUnique.mockResolvedValue(null);

			const result = await service.findLocationById("missing-id");

			expect(result).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// createLocation
	// -------------------------------------------------------------------------

	describe("createLocation", () => {
		it("creates a new location", async () => {
			mockPrisma.location.findUnique.mockResolvedValue(null); // no existing
			mockPrisma.location.create.mockResolvedValue(mockLocationRow);

			const result = await service.createLocation({
				name: "Head Office",
				parentLocationId: null,
				isGroup: true,
			});

			expect(result.name).toBe("Head Office");
			expect(mockPrisma.location.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						name: "Head Office",
						isGroup: true,
						parentLocationId: null,
					}),
					select: expect.objectContaining({ id: true, name: true }),
				}),
			);
		});

		it("throws BadRequestException on duplicate name", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({ id: "dup-id" });

			await expect(
				service.createLocation({ name: "Head Office", isGroup: false }),
			).rejects.toThrow(BadRequestException);
		});
	});

	// -------------------------------------------------------------------------
	// updateLocation
	// -------------------------------------------------------------------------

	describe("updateLocation", () => {
		it("updates an existing location", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({ id: "loc-abc-001" });
			mockPrisma.location.update.mockResolvedValue({
				...mockLocationRow,
				name: "Head Office Renamed",
			});

			const result = await service.updateLocation({
				id: "loc-abc-001",
				name: "Head Office Renamed",
			});

			expect(result.name).toBe("Head Office Renamed");
		});

		it("throws NotFoundException when location does not exist", async () => {
			mockPrisma.location.findUnique.mockResolvedValue(null);

			await expect(
				service.updateLocation({ id: "nonexistent", name: "X" }),
			).rejects.toThrow(NotFoundException);
		});
	});

	// -------------------------------------------------------------------------
	// deleteLocation
	// -------------------------------------------------------------------------

	describe("deleteLocation", () => {
		it("deletes a location with no assigned assets", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({
				id: "loc-abc-001",
				_count: { assets: 0 },
			});
			mockPrisma.location.delete.mockResolvedValue({ id: "loc-abc-001" });

			const result = await service.deleteLocation("loc-abc-001");

			expect(result).toEqual({ success: true, id: "loc-abc-001" });
			expect(mockPrisma.location.delete).toHaveBeenCalledWith({
				where: { id: "loc-abc-001" },
			});
		});

		it("throws BadRequestException when location has assigned assets", async () => {
			mockPrisma.location.findUnique.mockResolvedValue({
				id: "loc-abc-001",
				_count: { assets: 3 },
			});

			await expect(service.deleteLocation("loc-abc-001")).rejects.toThrow(
				BadRequestException,
			);
		});

		it("throws NotFoundException when location does not exist", async () => {
			mockPrisma.location.findUnique.mockResolvedValue(null);

			await expect(service.deleteLocation("nonexistent")).rejects.toThrow(
				NotFoundException,
			);
		});
	});
});
