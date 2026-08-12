/* eslint-disable */
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../../../shared/prisma.service";
import { CompanyService } from "../company.service";

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function createMockPrisma() {
	return {
		company: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		fiscalYearCompany: {
			count: jest.fn(),
		},
	};
}

function createTestContext() {
	const mockPrisma = createMockPrisma();
	const service = new CompanyService(mockPrisma as unknown as PrismaService);
	return { service, mockPrisma };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const organizationId = "org-1";

const mockCompanyRow = {
	id: "clxyz001",
	organizationId,
	name: "Acme Corp",
	abbreviation: "AC",
	country: "United States",
	currency: "USD",
	taxId: "123-456-789",
	domain: "Manufacturing",
	isGroup: false,
	parentCompanyId: null,
	parentCompany: null,
	disabled: false,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

const mockGroupCompanyRow = {
	id: "clxyz002",
	organizationId,
	name: "Acme Holdings",
	abbreviation: "AH",
	country: "United States",
	currency: "USD",
	taxId: null,
	domain: null,
	isGroup: true,
	parentCompanyId: null,
	parentCompany: null,
	disabled: false,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CompanyService", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma } = createTestContext());
	});

	// -------------------------------------------------------------------------
	// findAllCompanies
	// -------------------------------------------------------------------------

	describe("findAllCompanies", () => {
		it("returns items and totalCount", async () => {
			mockPrisma.company.findMany.mockResolvedValue([mockCompanyRow]);
			mockPrisma.company.count.mockResolvedValue(1);

			const result = await service.findAllCompanies(organizationId, {
				skip: 0,
				take: 20,
			});

			expect(mockPrisma.company.findMany.mock.calls[0][0].where).toEqual({
				organizationId,
			});
			expect(result.totalCount).toBe(1);
			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				id: mockCompanyRow.id,
				name: mockCompanyRow.name,
				abbreviation: mockCompanyRow.abbreviation,
				country: mockCompanyRow.country,
				isGroup: false,
			});
		});

		it("applies search filter", async () => {
			mockPrisma.company.findMany.mockResolvedValue([]);
			mockPrisma.company.count.mockResolvedValue(0);

			await service.findAllCompanies(organizationId, { search: "Acme" });

			const whereArg = mockPrisma.company.findMany.mock.calls[0][0].where;
			expect(whereArg.OR).toBeDefined();
			expect(whereArg.OR).toHaveLength(4);
		});

		it("applies isGroup filter", async () => {
			mockPrisma.company.findMany.mockResolvedValue([]);
			mockPrisma.company.count.mockResolvedValue(0);

			await service.findAllCompanies(organizationId, { isGroup: true });

			const whereArg = mockPrisma.company.findMany.mock.calls[0][0].where;
			expect(whereArg.isGroup).toBe(true);
		});

		it("uses default pagination when not provided", async () => {
			mockPrisma.company.findMany.mockResolvedValue([]);
			mockPrisma.company.count.mockResolvedValue(0);

			await service.findAllCompanies(organizationId);

			const callArgs = mockPrisma.company.findMany.mock.calls[0][0];
			expect(callArgs.skip).toBe(0);
			expect(callArgs.take).toBe(250);
		});
	});

	// -------------------------------------------------------------------------
	// findCompanyById
	// -------------------------------------------------------------------------

	describe("findCompanyById", () => {
		it("returns company when found", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(mockCompanyRow);

			const result = await service.findCompanyById(organizationId, "clxyz001");

			expect(result).not.toBeNull();
			expect(result?.id).toBe("clxyz001");
			expect(result?.name).toBe("Acme Corp");
		});

		it("returns null when not found", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(null);

			const result = await service.findCompanyById(
				organizationId,
				"nonexistent",
			);

			expect(result).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// createCompany
	// -------------------------------------------------------------------------

	describe("createCompany", () => {
		it("creates a company with valid input", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(null); // name and abbr checks
			mockPrisma.company.create.mockResolvedValue(mockCompanyRow);

			const result = await service.createCompany(organizationId, {
				name: "Acme Corp",
				abbreviation: "AC",
				country: "United States",
				currency: "USD",
			});

			expect(result.name).toBe("Acme Corp");
			expect(mockPrisma.company.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ organizationId }),
				}),
			);
			expect(mockPrisma.company.create).toHaveBeenCalledTimes(1);
		});

		it("throws ConflictException for duplicate name", async () => {
			mockPrisma.company.findFirst.mockResolvedValue({ id: "existing" });

			await expect(
				service.createCompany(organizationId, { name: "Acme Corp" }),
			).rejects.toThrow(ConflictException);
		});

		it("throws ConflictException for duplicate abbreviation", async () => {
			mockPrisma.company.findFirst.mockResolvedValueOnce(null); // name check
			mockPrisma.company.findFirst.mockResolvedValue({ id: "existing" }); // abbr check

			await expect(
				service.createCompany(organizationId, {
					name: "New Corp",
					abbreviation: "AC",
				}),
			).rejects.toThrow(ConflictException);
		});

		it("validates parent company is a group", async () => {
			mockPrisma.company.findFirst
				.mockResolvedValueOnce(null) // name check
				.mockResolvedValueOnce({
					id: "parent-001",
					name: "Non-Group",
					isGroup: false,
				});

			await expect(
				service.createCompany(organizationId, {
					name: "New Corp",
					parentCompanyId: "parent-001",
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	// -------------------------------------------------------------------------
	// updateCompany
	// -------------------------------------------------------------------------

	describe("updateCompany", () => {
		it("updates a company with valid input", async () => {
			mockPrisma.company.findFirst
				.mockResolvedValueOnce(mockCompanyRow) // existence check
				.mockResolvedValueOnce(null); // name duplicate check
			mockPrisma.company.update.mockResolvedValue({
				...mockCompanyRow,
				name: "Updated Corp",
			});

			const result = await service.updateCompany(organizationId, {
				id: "clxyz001",
				name: "Updated Corp",
			});

			expect(result.name).toBe("Updated Corp");
			expect(mockPrisma.company.update).toHaveBeenCalledTimes(1);
		});

		it("throws NotFoundException for nonexistent id", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(null);

			await expect(
				service.updateCompany(organizationId, {
					id: "nonexistent",
					name: "Test",
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("throws ConflictException for duplicate name", async () => {
			mockPrisma.company.findFirst.mockResolvedValueOnce(mockCompanyRow);
			mockPrisma.company.findFirst.mockResolvedValueOnce({
				id: "other",
			});

			await expect(
				service.updateCompany(organizationId, {
					id: "clxyz001",
					name: "Existing Corp",
				}),
			).rejects.toThrow(ConflictException);
		});

		it("throws BadRequestException for self-referencing parent", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(mockCompanyRow);

			await expect(
				service.updateCompany(organizationId, {
					id: "clxyz001",
					parentCompanyId: "clxyz001",
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	// -------------------------------------------------------------------------
	// deleteCompany
	// -------------------------------------------------------------------------

	describe("deleteCompany", () => {
		it("deletes when no children and no fiscal year refs", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(mockCompanyRow);
			mockPrisma.company.count.mockResolvedValue(0); // no children
			mockPrisma.fiscalYearCompany.count.mockResolvedValue(0); // no FY refs
			mockPrisma.company.delete.mockResolvedValue(mockCompanyRow);

			const result = await service.deleteCompany(organizationId, "clxyz001");

			expect(result.success).toBe(true);
			expect(result.id).toBe("clxyz001");
			expect(mockPrisma.company.delete).toHaveBeenCalledTimes(1);
		});

		it("throws NotFoundException for nonexistent id", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(null);

			await expect(
				service.deleteCompany(organizationId, "nonexistent"),
			).rejects.toThrow(NotFoundException);
		});

		it("throws BadRequestException when children exist", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(mockGroupCompanyRow);
			mockPrisma.company.count.mockResolvedValue(2);

			await expect(
				service.deleteCompany(organizationId, "clxyz002"),
			).rejects.toThrow(BadRequestException);
		});

		it("throws BadRequestException when fiscal year refs exist", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(mockCompanyRow);
			mockPrisma.company.count.mockResolvedValue(0);
			mockPrisma.fiscalYearCompany.count.mockResolvedValue(3);

			await expect(
				service.deleteCompany(organizationId, "clxyz001"),
			).rejects.toThrow(BadRequestException);
		});
	});

	// -------------------------------------------------------------------------
	// deleteManyCompanies
	// -------------------------------------------------------------------------

	describe("deleteManyCompanies", () => {
		it("deletes multiple companies", async () => {
			mockPrisma.company.findFirst.mockResolvedValue(mockCompanyRow);
			mockPrisma.company.count.mockResolvedValue(0);
			mockPrisma.fiscalYearCompany.count.mockResolvedValue(0);
			mockPrisma.company.delete.mockResolvedValue(mockCompanyRow);

			const result = await service.deleteManyCompanies(organizationId, [
				"clxyz001",
				"clxyz002",
			]);

			expect(result.count).toBe(2);
		});

		it("skips companies that fail to delete", async () => {
			// First call succeeds
			mockPrisma.company.findFirst
				.mockResolvedValueOnce(mockCompanyRow)
				.mockResolvedValueOnce(mockGroupCompanyRow);
			mockPrisma.company.count
				.mockResolvedValueOnce(0) // no children for first
				.mockResolvedValueOnce(2); // has children for second
			mockPrisma.fiscalYearCompany.count.mockResolvedValue(0);
			mockPrisma.company.delete.mockResolvedValue(mockCompanyRow);

			const result = await service.deleteManyCompanies(organizationId, [
				"clxyz001",
				"clxyz002",
			]);

			expect(result.count).toBe(1);
		});
	});
});
