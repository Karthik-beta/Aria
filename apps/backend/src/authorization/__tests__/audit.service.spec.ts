import type { PrismaService } from "../../shared/prisma.service";
import { AuditService } from "../audit.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockPrisma() {
	return {
		auditLog: {
			create: jest.fn().mockResolvedValue(undefined),
			findMany: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
		},
	} as unknown as jest.Mocked<PrismaService>;
}

function createService(prisma?: jest.Mocked<PrismaService>) {
	const mockPrisma = prisma ?? createMockPrisma();
	return { service: new AuditService(mockPrisma), mockPrisma };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AuditService", () => {
	let service: AuditService;
	let mockPrisma: jest.Mocked<PrismaService>;

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createService();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
	});

	// ── Generic log ──────────────────────────────────────────────────

	describe("log", () => {
		it("creates an audit log entry with all fields", async () => {
			await service.log({
				actorUserId: "user-1",
				action: "test.action",
				subjectType: "test",
				subjectId: "sub-1",
				appKey: "inventory",
				metadata: { key: "value" },
			});

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: {
					actorUserId: "user-1",
					action: "test.action",
					subjectType: "test",
					subjectId: "sub-1",
					appKey: "inventory",
					metadata: { key: "value" },
				},
			});
		});

		it("allows optional fields to be omitted", async () => {
			await service.log({
				action: "anonymous.action",
				subjectType: "system",
			});

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					action: "anonymous.action",
					subjectType: "system",
					actorUserId: undefined,
					subjectId: undefined,
					appKey: undefined,
					metadata: undefined,
				}),
			});
		});
	});

	// ── Convenience methods ──────────────────────────────────────────

	describe("logUserCreated", () => {
		it("writes a user.created audit entry", async () => {
			await service.logUserCreated("actor-1", "new-user-1", {
				email: "test@example.com",
			});

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					actorUserId: "actor-1",
					action: "user.created",
					subjectType: "user",
					subjectId: "new-user-1",
					metadata: { email: "test@example.com" },
				}),
			});
		});
	});

	describe("logUserUpdated", () => {
		it("writes a user.updated audit entry with changes in metadata", async () => {
			await service.logUserUpdated("actor-1", "target-1", {
				name: "New Name",
			});

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					action: "user.updated",
					metadata: { changes: { name: "New Name" } },
				}),
			});
		});
	});

	describe("logUserStatusChanged", () => {
		it("uses user.disabled action when isActive is false", async () => {
			await service.logUserStatusChanged(
				"actor-1",
				"target-1",
				false,
				"Policy violation",
			);

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					action: "user.disabled",
					metadata: { isActive: false, reason: "Policy violation" },
				}),
			});
		});

		it("uses user.enabled action when isActive is true", async () => {
			await service.logUserStatusChanged("actor-1", "target-1", true);

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					action: "user.enabled",
					metadata: { isActive: true, reason: undefined },
				}),
			});
		});
	});

	describe("logUserDeleted", () => {
		it("writes a user.deleted audit entry", async () => {
			await service.logUserDeleted("actor-1", "del-1", "Left org");

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					action: "user.deleted",
					metadata: { reason: "Left org" },
				}),
			});
		});
	});

	describe("logRoleAssigned", () => {
		it("writes a role.assigned entry with role key and app key", async () => {
			await service.logRoleAssigned(
				"actor-1",
				"target-1",
				"admin",
				"inventory",
			);

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					action: "role.assigned",
					subjectType: "user_role",
					subjectId: "target-1",
					appKey: "inventory",
					metadata: { roleKey: "admin", appKey: "inventory" },
				}),
			});
		});
	});

	describe("logRoleRevoked", () => {
		it("writes a role.revoked entry", async () => {
			await service.logRoleRevoked("actor-1", "target-1", "viewer");

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					action: "role.revoked",
					subjectType: "user_role",
				}),
			});
		});
	});

	describe("logSupervisorAssigned", () => {
		it("writes a supervisor.assigned entry", async () => {
			await service.logSupervisorAssigned("actor-1", "sup-1", "hrms");

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					action: "supervisor.assigned",
					subjectType: "app_supervisor",
					subjectId: "sup-1",
					appKey: "hrms",
				}),
			});
		});
	});

	describe("logSupervisorRevoked", () => {
		it("writes a supervisor.revoked entry", async () => {
			await service.logSupervisorRevoked("actor-1", "sup-1", "crm");

			expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					action: "supervisor.revoked",
					subjectType: "app_supervisor",
					subjectId: "sup-1",
					appKey: "crm",
				}),
			});
		});
	});

	// ── queryLogs ────────────────────────────────────────────────────

	describe("queryLogs", () => {
		it("returns logs with default limit / offset", async () => {
			const mockLogs = [
				{
					id: "log-1",
					action: "user.created",
					subjectType: "user",
					createdAt: new Date(),
				},
			];
			(mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
			(mockPrisma.auditLog.count as jest.Mock).mockResolvedValue(1);

			const result = await service.queryLogs({});

			expect(result).toEqual({
				logs: mockLogs,
				total: 1,
				limit: 50,
				offset: 0,
			});

			expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
				where: {},
				orderBy: { createdAt: "desc" },
				take: 50,
				skip: 0,
			});
		});

		it("applies all provided filters", async () => {
			const from = new Date("2024-01-01");
			const to = new Date("2024-12-31");

			(mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
			(mockPrisma.auditLog.count as jest.Mock).mockResolvedValue(0);

			await service.queryLogs({
				actorUserId: "user-1",
				action: "role.assigned",
				subjectType: "user_role",
				subjectId: "sub-1",
				appKey: "inventory",
				fromDate: from,
				toDate: to,
				limit: 10,
				offset: 5,
			});

			expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
				where: {
					actorUserId: "user-1",
					action: "role.assigned",
					subjectType: "user_role",
					subjectId: "sub-1",
					appKey: "inventory",
					createdAt: { gte: from, lte: to },
				},
				orderBy: { createdAt: "desc" },
				take: 10,
				skip: 5,
			});
		});

		it("applies only fromDate when toDate is omitted", async () => {
			const from = new Date("2024-06-01");

			(mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
			(mockPrisma.auditLog.count as jest.Mock).mockResolvedValue(0);

			await service.queryLogs({ fromDate: from });

			expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { createdAt: { gte: from } },
				}),
			);
		});
	});
});
