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
	const mockTx = {
		$queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
		asset: {
			findUnique: jest.fn(),
			update: jest.fn(),
		},
		assetActivity: { create: jest.fn() },
		assetRepair: { findFirst: jest.fn().mockResolvedValue(null) },
		assetDepreciationJournalEntry: {
			count: jest.fn().mockResolvedValue(0),
		},
		assetMaintenance: {
			create: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
		},
		assetMaintenanceTeam: {
			findUnique: jest.fn(),
		},
		assetMaintenanceTask: {
			create: jest.fn(),
			update: jest.fn(),
			findFirst: jest.fn().mockResolvedValue(null),
		},
		assetMaintenanceLog: {
			create: jest.fn(),
			findUnique: jest.fn(),
			update: jest.fn(),
		},
	};

	return {
		asset: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		location: {
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
		assetMaintenance: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		assetMaintenanceTask: {
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
		},
		assetMaintenanceLog: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
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

const mockTask = {
	id: "task-001",
	maintenanceId: "maint-001",
	maintenanceTask: "Lubrication Check",
	maintenanceType: "PREVENTIVE_MAINTENANCE",
	maintenanceStatus: "PLANNED",
	startDate: new Date("2026-01-01"),
	periodicity: "MONTHLY",
	endDate: null,
	certificateRequired: false,
	assignTo: null,
	assignToName: null,
	nextDueDate: new Date("2026-02-01"),
	lastCompletionDate: null,
	description: null,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-01"),
};

const mockMaintenanceRow = {
	id: "maint-001",
	assetId: "asset-001",
	company: "ACME Corp",
	maintenanceTeamId: "team-001",
	maintenanceManager: "manager@example.com",
	maintenanceManagerName: "Manager Name",
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
	asset: {
		assetName: "Hydraulic Pump A",
		itemCode: "HYD-PMP-001",
		assetCategory: { name: "Machinery" },
	},
	maintenanceTeam: { name: "Alpha Team" },
	tasks: [mockTask],
};

const mockLog = {
	id: "log-001",
	maintenanceId: "maint-001",
	taskId: "task-001",
	maintenanceStatus: "PLANNED",
	completionDate: null,
	actionsPerformed: null,
	hasCertificate: false,
	certificateAttachment: null,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-01"),
};

// ---------------------------------------------------------------------------
// Tests for calculateNextDueDate
// ---------------------------------------------------------------------------

describe("AssetService > calculateNextDueDate", () => {
	let service: ReturnType<typeof createTestContext>["service"];

	beforeEach(() => {
		({ service } = createTestContext());
	});

	it("calculates MONTHLY from start date", () => {
		const start = new Date("2026-01-01");
		const result = service.calculateNextDueDate("MONTHLY", start, null, null);
		expect(result?.getFullYear()).toBe(2026);
		expect(result?.getMonth()).toBe(1); // February = 1
	});

	it("calculates YEARLY from start date", () => {
		const start = new Date("2026-01-01");
		const result = service.calculateNextDueDate("YEARLY", start, null, null);
		expect(result?.getFullYear()).toBe(2027);
	});

	it("uses lastCompletionDate when it is more recent than startDate", () => {
		const start = new Date("2026-01-01");
		const last = new Date("2026-03-01");
		const result = service.calculateNextDueDate("MONTHLY", start, null, last);
		// Should add 1 month to lastCompletionDate = April
		expect(result?.getMonth()).toBe(3);
	});

	it("returns null when nextDueDate would be after endDate", () => {
		const start = new Date("2026-01-01");
		const endDate = new Date("2026-01-15");
		const result = service.calculateNextDueDate(
			"MONTHLY",
			start,
			endDate,
			null,
		);
		expect(result).toBeNull();
	});

	it("returns null when base is already at or after endDate", () => {
		const start = new Date("2026-06-01");
		const endDate = new Date("2026-05-01");
		const result = service.calculateNextDueDate("DAILY", start, endDate, null);
		expect(result).toBeNull();
	});

	it("calculates DAILY correctly", () => {
		const start = new Date("2026-01-01");
		const result = service.calculateNextDueDate("DAILY", start, null, null);
		expect(result?.getDate()).toBe(2);
		expect(result?.getMonth()).toBe(0);
	});

	it("calculates QUARTERLY (3 months)", () => {
		const start = new Date("2026-01-01");
		const result = service.calculateNextDueDate("QUARTERLY", start, null, null);
		expect(result?.getMonth()).toBe(3); // April
	});

	it("calculates TWO_YEARLY (2 years)", () => {
		const start = new Date("2026-01-01");
		const result = service.calculateNextDueDate(
			"TWO_YEARLY",
			start,
			null,
			null,
		);
		expect(result?.getFullYear()).toBe(2028);
	});
});

// ---------------------------------------------------------------------------
// Tests for assetMaintenance CRUD
// ---------------------------------------------------------------------------

describe("AssetService > AssetMaintenance", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];
	let mockTx: ReturnType<typeof createTestContext>["mockTx"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma, mockTx } = createTestContext());
	});

	// -------------------------------------------------------------------------
	// findAllAssetMaintenances
	// -------------------------------------------------------------------------

	describe("findAllAssetMaintenances", () => {
		it("returns items and totalCount", async () => {
			mockPrisma.assetMaintenance.findMany.mockResolvedValue([
				mockMaintenanceRow,
			]);
			mockPrisma.assetMaintenance.count.mockResolvedValue(1);

			const result = await service.findAllAssetMaintenances({
				skip: 0,
				take: 20,
			});

			expect(result.totalCount).toBe(1);
			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				id: "maint-001",
				assetName: "Hydraulic Pump A",
				company: "ACME Corp",
				maintenanceTeamName: "Alpha Team",
			});
		});

		it("returns empty list when no records exist", async () => {
			mockPrisma.assetMaintenance.findMany.mockResolvedValue([]);
			mockPrisma.assetMaintenance.count.mockResolvedValue(0);

			const result = await service.findAllAssetMaintenances({});

			expect(result.totalCount).toBe(0);
			expect(result.items).toHaveLength(0);
		});

		it("applies search filter across company, asset name, and team", async () => {
			mockPrisma.assetMaintenance.findMany.mockResolvedValue([]);
			mockPrisma.assetMaintenance.count.mockResolvedValue(0);

			await service.findAllAssetMaintenances({ search: "pump" });

			expect(mockPrisma.assetMaintenance.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						OR: expect.arrayContaining([
							{
								company: {
									contains: "pump",
									mode: "insensitive",
								},
							},
						]),
					}),
				}),
			);
		});

		it("clamps take to LIST_TAKE_MAX (250)", async () => {
			mockPrisma.assetMaintenance.findMany.mockResolvedValue([]);
			mockPrisma.assetMaintenance.count.mockResolvedValue(0);

			await service.findAllAssetMaintenances({ take: 9999 });

			expect(mockPrisma.assetMaintenance.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ take: 250 }),
			);
		});
	});

	// -------------------------------------------------------------------------
	// findAssetMaintenanceById
	// -------------------------------------------------------------------------

	describe("findAssetMaintenanceById", () => {
		it("returns the record when found", async () => {
			mockPrisma.assetMaintenance.findUnique.mockResolvedValue(
				mockMaintenanceRow,
			);

			const result = await service.findAssetMaintenanceById("maint-001");

			expect(result).toMatchObject({
				id: "maint-001",
				assetName: "Hydraulic Pump A",
			});
			expect(result?.tasks).toHaveLength(1);
		});

		it("returns null when record does not exist", async () => {
			mockPrisma.assetMaintenance.findUnique.mockResolvedValue(null);

			const result = await service.findAssetMaintenanceById("missing-id");

			expect(result).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// findAssetMaintenanceLogs
	// -------------------------------------------------------------------------

	describe("findAssetMaintenanceLogs", () => {
		it("returns logs for a maintenance record", async () => {
			mockPrisma.assetMaintenanceLog.findMany.mockResolvedValue([mockLog]);

			const result = await service.findAssetMaintenanceLogs("maint-001");

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: "log-001",
				maintenanceId: "maint-001",
				maintenanceStatus: "PLANNED",
			});
		});
	});

	// -------------------------------------------------------------------------
	// createAssetMaintenance
	// -------------------------------------------------------------------------

	describe("createAssetMaintenance", () => {
		const createInput = {
			assetId: "asset-001",
			company: "ACME Corp",
			maintenanceTeamId: "team-001",
			maintenanceManager: "manager@example.com",
			maintenanceManagerName: "Manager Name",
			tasks: [
				{
					maintenanceTask: "Lubrication Check",
					maintenanceType: "PREVENTIVE_MAINTENANCE" as const,
					maintenanceStatus: "PLANNED" as const,
					startDate: new Date("2026-01-01"),
					periodicity: "MONTHLY" as const,
					endDate: null,
					certificateRequired: false,
					assignTo: null,
					assignToName: null,
					description: null,
				},
			],
		};

		it("throws NotFoundException when asset does not exist", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue(null);

			await expect(service.createAssetMaintenance(createInput)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("throws BadRequestException when asset already has a maintenance record", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-001",
				assetName: "Hydraulic Pump A",
				itemCode: null,
				company: "ACME Corp",
				maintenance: { id: "existing-maint" },
			});

			await expect(service.createAssetMaintenance(createInput)).rejects.toThrow(
				BadRequestException,
			);
		});

		it("throws NotFoundException when maintenance team does not exist", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-001",
				assetName: "Hydraulic Pump A",
				itemCode: null,
				company: "ACME Corp",
				maintenance: null,
			});
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue(null);

			await expect(service.createAssetMaintenance(createInput)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("rejects a maintenance company that differs from the asset", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-001",
				assetName: "Hydraulic Pump A",
				itemCode: null,
				company: "OTHER Corp",
				maintenance: null,
			});

			await expect(service.createAssetMaintenance(createInput)).rejects.toThrow(
				"must match asset company",
			);
		});

		it("rejects a maintenance team from another company", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-001",
				assetName: "Hydraulic Pump A",
				itemCode: null,
				company: "ACME Corp",
				maintenance: null,
			});
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue({
				id: "team-001",
				company: "OTHER Corp",
			});

			await expect(service.createAssetMaintenance(createInput)).rejects.toThrow(
				"does not match asset company",
			);
		});

		it("throws BadRequestException when task startDate >= endDate", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-001",
				assetName: "Hydraulic Pump A",
				itemCode: null,
				company: "ACME Corp",
				maintenance: null,
			});
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue({
				id: "team-001",
				company: "ACME Corp",
			});

			await expect(
				service.createAssetMaintenance({
					...createInput,
					tasks: [
						{
							...createInput.tasks[0],
							startDate: new Date("2026-06-01"),
							endDate: new Date("2026-01-01"),
						},
					],
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("creates a new maintenance record with tasks and logs", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue({
				id: "asset-001",
				assetName: "Hydraulic Pump A",
				itemCode: null,
				company: "ACME Corp",
				maintenance: null,
			});
			mockPrisma.assetMaintenanceTeam.findUnique.mockResolvedValue({
				id: "team-001",
				company: "ACME Corp",
			});
			mockTx.asset.findUnique.mockResolvedValue({
				id: "asset-001",
				assetName: "Hydraulic Pump A",
				company: "ACME Corp",
				maintenance: null,
			});
			mockTx.assetMaintenanceTeam.findUnique.mockResolvedValue({
				id: "team-001",
				company: "ACME Corp",
			});
			mockTx.assetMaintenance.create.mockResolvedValue({
				id: "maint-001",
			});
			mockTx.assetMaintenanceTask.create.mockResolvedValue(mockTask);
			mockTx.assetMaintenanceLog.create.mockResolvedValue(mockLog);
			mockTx.assetMaintenance.findUniqueOrThrow.mockResolvedValue(
				mockMaintenanceRow,
			);

			const result = await service.createAssetMaintenance(
				createInput,
				"actor-001",
			);

			expect(mockTx.assetMaintenance.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						assetId: "asset-001",
						company: "ACME Corp",
					}),
				}),
			);
			expect(mockTx.assetMaintenanceTask.create).toHaveBeenCalledTimes(1);
			expect(mockTx.assetMaintenanceLog.create).toHaveBeenCalledTimes(1);
			expect(mockTx.assetActivity.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					assetId: "asset-001",
					userId: "actor-001",
				}),
			});
			expect(result.assetName).toBe("Hydraulic Pump A");
		});
	});

	// -------------------------------------------------------------------------
	// deleteAssetMaintenance
	// -------------------------------------------------------------------------

	describe("deleteAssetMaintenance", () => {
		it("deletes an existing record and returns success", async () => {
			mockPrisma.assetMaintenance.findUnique.mockResolvedValue({
				id: "maint-001",
				assetId: "asset-001",
			});
			mockTx.assetMaintenance.delete.mockResolvedValue({
				id: "maint-001",
			});

			const result = await service.deleteAssetMaintenance("maint-001");

			expect(result).toEqual({ success: true, id: "maint-001" });
			expect(mockTx.assetMaintenance.delete).toHaveBeenCalledWith({
				where: { id: "maint-001" },
			});
		});

		it("throws NotFoundException when record does not exist", async () => {
			mockPrisma.assetMaintenance.findUnique.mockResolvedValue(null);

			await expect(
				service.deleteAssetMaintenance("missing-id"),
			).rejects.toThrow(NotFoundException);
		});
	});

	// -------------------------------------------------------------------------
	// deleteManyAssetMaintenances
	// -------------------------------------------------------------------------

	describe("deleteManyAssetMaintenances", () => {
		it("deletes multiple records and returns count", async () => {
			mockPrisma.assetMaintenance.findMany.mockResolvedValue([
				{ id: "maint-001", assetId: "asset-001" },
				{ id: "maint-002", assetId: "asset-002" },
			]);
			mockTx.assetMaintenance.deleteMany.mockResolvedValue({ count: 2 });

			const result = await service.deleteManyAssetMaintenances([
				"maint-001",
				"maint-002",
			]);

			expect(result).toEqual({
				success: true,
				count: 2,
				ids: ["maint-001", "maint-002"],
			});
		});

		it("deduplicates ids before deleting", async () => {
			mockPrisma.assetMaintenance.findMany.mockResolvedValue([
				{ id: "maint-001", assetId: "asset-001" },
			]);
			mockTx.assetMaintenance.deleteMany.mockResolvedValue({ count: 1 });

			const result = await service.deleteManyAssetMaintenances([
				"maint-001",
				"maint-001",
			]);

			expect(result.ids).toHaveLength(1);
			expect(mockTx.assetMaintenance.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: ["maint-001"] } },
			});
		});
	});
});

// ---------------------------------------------------------------------------
// Fixtures for log list/cancel tests
// ---------------------------------------------------------------------------

const mockLogWithContext = {
	id: "log-001",
	maintenanceId: "maint-001",
	taskId: "task-001",
	maintenanceStatus: "PLANNED",
	completionDate: null,
	actionsPerformed: null,
	hasCertificate: false,
	certificateAttachment: null,
	modifiedBy: null,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-01"),
	maintenance: {
		id: "maint-001",
		assetId: "asset-001",
		company: "ACME Corp",
		asset: { id: "asset-001", assetName: "Hydraulic Pump A" },
	},
	task: {
		id: "task-001",
		maintenanceTask: "Lubrication Check",
		maintenanceType: "PREVENTIVE_MAINTENANCE",
		periodicity: "MONTHLY",
		assignToName: "John Doe",
		nextDueDate: new Date("2026-02-01"),
	},
};

// ---------------------------------------------------------------------------
// Tests for findAllAssetMaintenanceLogs
// ---------------------------------------------------------------------------

describe("AssetService > findAllAssetMaintenanceLogs", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma } = createTestContext());
	});

	it("returns items and totalCount", async () => {
		mockPrisma.assetMaintenanceLog.findMany.mockResolvedValue([
			mockLogWithContext,
		]);
		mockPrisma.assetMaintenanceLog.count.mockResolvedValue(1);

		const result = await service.findAllAssetMaintenanceLogs({});

		expect(result.totalCount).toBe(1);
		expect(result.items).toHaveLength(1);
		expect(result.items[0]).toMatchObject({
			id: "log-001",
			assetName: "Hydraulic Pump A",
			maintenanceTask: "Lubrication Check",
			maintenanceStatus: "PLANNED",
		});
	});

	it("returns empty list when no records exist", async () => {
		mockPrisma.assetMaintenanceLog.findMany.mockResolvedValue([]);
		mockPrisma.assetMaintenanceLog.count.mockResolvedValue(0);

		const result = await service.findAllAssetMaintenanceLogs({});

		expect(result.totalCount).toBe(0);
		expect(result.items).toHaveLength(0);
	});

	it("applies search filter", async () => {
		mockPrisma.assetMaintenanceLog.findMany.mockResolvedValue([]);
		mockPrisma.assetMaintenanceLog.count.mockResolvedValue(0);

		await service.findAllAssetMaintenanceLogs({ search: "pump" });

		expect(mockPrisma.assetMaintenanceLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					OR: expect.arrayContaining([
						expect.objectContaining({
							maintenance: expect.objectContaining({
								asset: expect.objectContaining({
									assetName: expect.objectContaining({
										contains: "pump",
									}),
								}),
							}),
						}),
					]),
				}),
			}),
		);
	});

	it("applies status filter", async () => {
		mockPrisma.assetMaintenanceLog.findMany.mockResolvedValue([]);
		mockPrisma.assetMaintenanceLog.count.mockResolvedValue(0);

		await service.findAllAssetMaintenanceLogs({ status: "PLANNED" });

		expect(mockPrisma.assetMaintenanceLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					maintenanceStatus: "PLANNED",
				}),
			}),
		);
	});

	it("clamps take to LIST_TAKE_MAX (250)", async () => {
		mockPrisma.assetMaintenanceLog.findMany.mockResolvedValue([]);
		mockPrisma.assetMaintenanceLog.count.mockResolvedValue(0);

		await service.findAllAssetMaintenanceLogs({ take: 9999 });

		expect(mockPrisma.assetMaintenanceLog.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ take: 250 }),
		);
	});
});

// ---------------------------------------------------------------------------
// Tests for cancelAssetMaintenanceLog
// ---------------------------------------------------------------------------

describe("AssetService > cancelAssetMaintenanceLog", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];
	let mockTx: ReturnType<typeof createTestContext>["mockTx"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma, mockTx } = createTestContext());
	});

	it("throws NotFoundException when log does not exist", async () => {
		mockPrisma.assetMaintenanceLog.findUnique.mockResolvedValue(null);

		await expect(
			service.cancelAssetMaintenanceLog({ logId: "missing-log" }),
		).rejects.toThrow(NotFoundException);
	});

	it("throws BadRequestException for COMPLETED log", async () => {
		mockPrisma.assetMaintenanceLog.findUnique.mockResolvedValue({
			id: "log-001",
			maintenanceId: "maint-001",
			taskId: "task-001",
			maintenanceStatus: "COMPLETED",
			maintenance: { assetId: "asset-001" },
		});

		await expect(
			service.cancelAssetMaintenanceLog({ logId: "log-001" }),
		).rejects.toThrow(BadRequestException);
	});

	it("throws BadRequestException for already CANCELLED log", async () => {
		mockPrisma.assetMaintenanceLog.findUnique.mockResolvedValue({
			id: "log-001",
			maintenanceId: "maint-001",
			taskId: "task-001",
			maintenanceStatus: "CANCELLED",
			maintenance: { assetId: "asset-001" },
		});

		await expect(
			service.cancelAssetMaintenanceLog({ logId: "log-001" }),
		).rejects.toThrow(BadRequestException);
	});

	it("successfully cancels a PLANNED log", async () => {
		mockPrisma.assetMaintenanceLog.findUnique.mockResolvedValue({
			id: "log-001",
			maintenanceId: "maint-001",
			taskId: "task-001",
			maintenanceStatus: "PLANNED",
			maintenance: { assetId: "asset-001" },
		});

		const cancelledLog = {
			...mockLog,
			maintenanceStatus: "CANCELLED",
		};
		mockTx.assetMaintenanceLog.findUnique.mockResolvedValue({
			maintenanceStatus: "PLANNED",
		});
		mockTx.assetMaintenanceLog.update.mockResolvedValue(cancelledLog);
		mockTx.assetMaintenanceTask.update.mockResolvedValue({});

		const result = await service.cancelAssetMaintenanceLog({
			logId: "log-001",
		});

		expect(mockTx.assetMaintenanceLog.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "log-001" },
				data: { maintenanceStatus: "CANCELLED" },
			}),
		);
		expect(mockTx.assetMaintenanceTask.update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "task-001" },
				data: { maintenanceStatus: "CANCELLED" },
			}),
		);
		expect(result.maintenanceStatus).toBe("CANCELLED");
	});

	it("successfully cancels an OVERDUE log", async () => {
		mockPrisma.assetMaintenanceLog.findUnique.mockResolvedValue({
			id: "log-002",
			maintenanceId: "maint-001",
			taskId: "task-001",
			maintenanceStatus: "OVERDUE",
			maintenance: { assetId: "asset-001" },
		});

		const cancelledLog = {
			...mockLog,
			id: "log-002",
			maintenanceStatus: "CANCELLED",
		};
		mockTx.assetMaintenanceLog.findUnique.mockResolvedValue({
			maintenanceStatus: "OVERDUE",
		});
		mockTx.assetMaintenanceLog.update.mockResolvedValue(cancelledLog);
		mockTx.assetMaintenanceTask.update.mockResolvedValue({});

		const result = await service.cancelAssetMaintenanceLog({
			logId: "log-002",
		});

		expect(result.maintenanceStatus).toBe("CANCELLED");
	});

	it("rejects a cancellation that loses the asset lock to another transition", async () => {
		mockPrisma.assetMaintenanceLog.findUnique.mockResolvedValue({
			id: "log-001",
			maintenanceId: "maint-001",
			taskId: "task-001",
			maintenanceStatus: "PLANNED",
			maintenance: null,
		});
		mockTx.assetMaintenanceLog.findUnique.mockResolvedValue({
			maintenanceStatus: "CANCELLED",
		});

		await expect(
			service.cancelAssetMaintenanceLog({ logId: "log-001" }),
		).rejects.toThrow("already cancelled");
		expect(mockTx.assetMaintenanceLog.update).not.toHaveBeenCalled();
	});

	it("rejects duplicate completion after the first request commits", async () => {
		mockPrisma.assetMaintenanceLog.findUnique.mockResolvedValue({
			id: "log-001",
			maintenanceId: "maint-001",
			taskId: "task-001",
			maintenanceStatus: "PLANNED",
			maintenance: null,
		});
		mockTx.assetMaintenanceLog.findUnique.mockResolvedValue({
			maintenanceId: "maint-001",
			taskId: "task-001",
			maintenanceStatus: "COMPLETED",
		});

		await expect(
			service.completeAssetMaintenanceLog({
				logId: "log-001",
				completionDate: new Date("2026-02-01"),
				hasCertificate: false,
			}),
		).rejects.toThrow("already completed");
		expect(mockTx.assetMaintenanceLog.update).not.toHaveBeenCalled();
	});
});
