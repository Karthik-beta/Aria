/* eslint-disable */
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import type { AssetDashboardSubService } from "../asset-dashboard.service";

const COMPANY_ID = "company-1";
const COMPANY = "ACME Corp";
const COMPANY_RELATION = { id: COMPANY_ID, name: COMPANY };

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function createMockPrisma() {
	const mockTx = {
		assetMaintenanceTeam: {
			update: jest.fn(),
			findUniqueOrThrow: jest.fn(),
		},
		assetMaintenanceTeamMember: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
	};

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
		company: {
			findUnique: jest.fn().mockResolvedValue({
				id: COMPANY_ID,
				disabled: false,
			}),
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
		assetMaintenanceTeam: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		assetMaintenanceTeamMember: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
		$transaction: jest.fn().mockImplementation(async (fn) => fn(mockTx)),
		_mockTx: mockTx,
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
	return { service, mockPrisma, mockTx: mockPrisma._mockTx };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockMember1 = {
	id: "mem-001",
	teamId: "team-001",
	teamMember: "john@example.com",
	fullName: "John Doe",
	maintenanceRole: "Technician",
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-01"),
};

const mockMember2 = {
	id: "mem-002",
	teamId: "team-001",
	teamMember: "jane@example.com",
	fullName: "Jane Smith",
	maintenanceRole: "Engineer",
	createdAt: new Date("2026-01-02"),
	updatedAt: new Date("2026-01-02"),
};

const mockTeamRow = {
	id: "team-001",
	name: "Alpha Team",
	maintenanceManager: "manager@example.com",
	maintenanceManagerName: "Manager Name",
	companyId: COMPANY_ID,
	company: COMPANY_RELATION,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
	members: [mockMember1, mockMember2],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AssetService > MaintenanceTeam", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];
	let mockTx: ReturnType<typeof createTestContext>["mockTx"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma, mockTx } = createTestContext());
	});

	// -------------------------------------------------------------------------
	// findAllMaintenanceTeams
	// -------------------------------------------------------------------------

	describe("findAllMaintenanceTeams", () => {
		it("returns items and totalCount", async () => {
			mockPrisma.assetMaintenanceTeam.findMany.mockResolvedValue([mockTeamRow]);
			mockPrisma.assetMaintenanceTeam.count.mockResolvedValue(1);

			const result = await service.findAllMaintenanceTeams({
				skip: 0,
				take: 20,
			});

			expect(result.totalCount).toBe(1);
			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				id: "team-001",
				name: "Alpha Team",
				company: "ACME Corp",
				maintenanceManager: "manager@example.com",
				maintenanceManagerName: "Manager Name",
			});
			expect(result.items[0].members).toHaveLength(2);
		});

		it("returns empty list when no teams exist", async () => {
			mockPrisma.assetMaintenanceTeam.findMany.mockResolvedValue([]);
			mockPrisma.assetMaintenanceTeam.count.mockResolvedValue(0);

			const result = await service.findAllMaintenanceTeams({});

			expect(result.totalCount).toBe(0);
			expect(result.items).toHaveLength(0);
		});

		it("applies search filter across name, manager, and company", async () => {
			mockPrisma.assetMaintenanceTeam.findMany.mockResolvedValue([]);
			mockPrisma.assetMaintenanceTeam.count.mockResolvedValue(0);

			await service.findAllMaintenanceTeams({ search: "alpha" });

			expect(mockPrisma.assetMaintenanceTeam.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						OR: expect.arrayContaining([
							{ name: { contains: "alpha", mode: "insensitive" } },
						]),
					}),
				}),
			);
		});

		it("applies company filter when provided", async () => {
			mockPrisma.assetMaintenanceTeam.findMany.mockResolvedValue([]);
			mockPrisma.assetMaintenanceTeam.count.mockResolvedValue(0);

			await service.findAllMaintenanceTeams({ company: "ACME" });

			expect(mockPrisma.assetMaintenanceTeam.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						company: {
							is: {
								name: { contains: "ACME", mode: "insensitive" },
							},
						},
					}),
				}),
			);
		});

		it("clamps take to LIST_TAKE_MAX (250)", async () => {
			mockPrisma.assetMaintenanceTeam.findMany.mockResolvedValue([]);
			mockPrisma.assetMaintenanceTeam.count.mockResolvedValue(0);

			await service.findAllMaintenanceTeams({ take: 9999 });

			expect(mockPrisma.assetMaintenanceTeam.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ take: 250 }),
			);
		});
	});

	// -------------------------------------------------------------------------
	// findMaintenanceTeamById
	// -------------------------------------------------------------------------

	describe("findMaintenanceTeamById", () => {
		it("returns the team when found", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue(mockTeamRow);

			const result = await service.findMaintenanceTeamById("team-001");

			expect(result).toMatchObject({
				id: "team-001",
				name: "Alpha Team",
			});
			expect(result?.members).toHaveLength(2);
		});

		it("returns null when team does not exist", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue(null);

			const result = await service.findMaintenanceTeamById("missing-id");

			expect(result).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// createMaintenanceTeam
	// -------------------------------------------------------------------------

	describe("createMaintenanceTeam", () => {
		it("creates a new maintenance team with members", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue(null);
			mockPrisma.assetMaintenanceTeam.create.mockResolvedValue(mockTeamRow);

			const result = await service.createMaintenanceTeam({
				name: "Alpha Team",
				maintenanceManager: "manager@example.com",
				maintenanceManagerName: "Manager Name",
				companyId: COMPANY_ID,
				members: [
					{
						teamMember: "john@example.com",
						fullName: "John Doe",
						maintenanceRole: "Technician",
					},
				],
			});

			expect(result.name).toBe("Alpha Team");
			expect(result.company).toBe("ACME Corp");
			expect(result.members).toHaveLength(2);
			expect(mockPrisma.assetMaintenanceTeam.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						name: "Alpha Team",
						companyId: COMPANY_ID,
						members: expect.objectContaining({ create: expect.any(Array) }),
					}),
				}),
			);
		});

		it("creates a team without optional manager fields", async () => {
			const noManagerRow = {
				...mockTeamRow,
				maintenanceManager: null,
				maintenanceManagerName: null,
			};
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue(null);
			mockPrisma.assetMaintenanceTeam.create.mockResolvedValue(noManagerRow);

			const result = await service.createMaintenanceTeam({
				name: "Alpha Team",
				companyId: COMPANY_ID,
				members: [
					{
						teamMember: "john@example.com",
						fullName: "John Doe",
						maintenanceRole: "Technician",
					},
				],
			});

			expect(result.maintenanceManager).toBeNull();
			expect(result.maintenanceManagerName).toBeNull();
		});

		it("throws BadRequestException on duplicate team name", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue({
				id: "dup-id",
			});

			await expect(
				service.createMaintenanceTeam({
					name: "Alpha Team",
					companyId: COMPANY_ID,
					members: [
						{
							teamMember: "john@example.com",
							fullName: "John Doe",
							maintenanceRole: "Technician",
						},
					],
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("throws BadRequestException with a meaningful message on duplicate", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue({
				id: "dup-id",
			});

			await expect(
				service.createMaintenanceTeam({
					name: "Alpha Team",
					companyId: COMPANY_ID,
					members: [
						{
							teamMember: "john@example.com",
							fullName: "John Doe",
							maintenanceRole: "Technician",
						},
					],
				}),
			).rejects.toThrow("already exists");
		});
	});

	// -------------------------------------------------------------------------
	// updateMaintenanceTeam
	// -------------------------------------------------------------------------

	describe("updateMaintenanceTeam", () => {
		it("throws NotFoundException when team does not exist", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue(null);

			await expect(
				service.updateMaintenanceTeam({
					id: "nonexistent",
					name: "New Name",
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("throws BadRequestException on name conflict with another team", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique
				.mockResolvedValueOnce({ id: "team-001" }) // existence check
				.mockResolvedValueOnce({ id: "other-team" }); // name conflict

			await expect(
				service.updateMaintenanceTeam({
					id: "team-001",
					name: "Taken Name",
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("allows updating when name belongs to the same team (no conflict)", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique
				.mockResolvedValueOnce({ id: "team-001" }) // existence check
				.mockResolvedValueOnce({ id: "team-001" }); // same id = no conflict

			mockTx.assetMaintenanceTeam.update.mockResolvedValue(mockTeamRow);
			mockTx.assetMaintenanceTeamMember.findMany.mockResolvedValue([]);
			mockTx.assetMaintenanceTeamMember.deleteMany.mockResolvedValue({
				count: 0,
			});
			mockTx.assetMaintenanceTeam.findUniqueOrThrow.mockResolvedValue(
				mockTeamRow,
			);

			const result = await service.updateMaintenanceTeam({
				id: "team-001",
				name: "Alpha Team",
			});

			expect(result.name).toBe("Alpha Team");
		});

		it("throws BadRequestException when a member id does not belong to the team", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValueOnce({
				id: "team-001",
			});
			// No name conflict check (no name in input).
			// Transaction executes:
			mockTx.assetMaintenanceTeam.update.mockResolvedValue(mockTeamRow);
			// findMany returns empty → foreign id detected
			mockTx.assetMaintenanceTeamMember.findMany.mockResolvedValue([]);

			await expect(
				service.updateMaintenanceTeam({
					id: "team-001",
					members: [
						{
							id: "foreign-mem",
							teamMember: "x@example.com",
							fullName: "X",
							maintenanceRole: "Tech",
						},
					],
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("updates members by creating new ones when id is omitted", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValueOnce({
				id: "team-001",
			});
			mockTx.assetMaintenanceTeam.update.mockResolvedValue(mockTeamRow);
			mockTx.assetMaintenanceTeamMember.deleteMany.mockResolvedValue({
				count: 0,
			});
			mockTx.assetMaintenanceTeamMember.create.mockResolvedValue(mockMember1);
			mockTx.assetMaintenanceTeam.findUniqueOrThrow.mockResolvedValue({
				...mockTeamRow,
				members: [mockMember1],
			});

			const result = await service.updateMaintenanceTeam({
				id: "team-001",
				members: [
					{
						teamMember: "new@example.com",
						fullName: "New guy",
						maintenanceRole: "Tech",
					},
				],
			});

			expect(mockTx.assetMaintenanceTeamMember.create).toHaveBeenCalled();
			expect(result).toBeDefined();
		});
	});

	// -------------------------------------------------------------------------
	// deleteMaintenanceTeam
	// -------------------------------------------------------------------------

	describe("deleteMaintenanceTeam", () => {
		it("deletes a team by id and returns success", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue({
				id: "team-001",
			});
			mockPrisma.assetMaintenanceTeam.delete.mockResolvedValue({
				id: "team-001",
			});

			const result = await service.deleteMaintenanceTeam("team-001");

			expect(result).toEqual({ success: true, id: "team-001" });
			expect(mockPrisma.assetMaintenanceTeam.delete).toHaveBeenCalledWith({
				where: { id: "team-001" },
			});
		});

		it("throws NotFoundException when team does not exist", async () => {
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue(null);

			await expect(
				service.deleteMaintenanceTeam("nonexistent"),
			).rejects.toThrow(NotFoundException);
		});
	});

	// -------------------------------------------------------------------------
	// deleteManyMaintenanceTeams
	// -------------------------------------------------------------------------

	describe("deleteManyMaintenanceTeams", () => {
		it("bulk-deletes teams and returns count", async () => {
			mockPrisma.assetMaintenanceTeam.deleteMany.mockResolvedValue({
				count: 2,
			});

			const result = await service.deleteManyMaintenanceTeams([
				"team-001",
				"team-002",
			]);

			expect(result.success).toBe(true);
			expect(result.count).toBe(2);
			expect(result.ids).toEqual(["team-001", "team-002"]);
		});

		it("deduplicates ids before deleting", async () => {
			mockPrisma.assetMaintenanceTeam.deleteMany.mockResolvedValue({
				count: 1,
			});

			const result = await service.deleteManyMaintenanceTeams([
				"team-001",
				"team-001",
			]);

			expect(result.ids).toEqual(["team-001"]);
			expect(mockPrisma.assetMaintenanceTeam.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: ["team-001"] } },
			});
		});
	});
});
