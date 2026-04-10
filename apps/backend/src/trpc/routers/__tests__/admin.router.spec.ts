import { auth } from "../../../auth/auth.config";
import type { AuditService } from "../../../authorization/audit.service";
import type { PolicyService } from "../../../authorization/policy.service";
import type {
	PermissionService,
	RoleService,
} from "../../../authorization/role-permission.service";
import type { ScopeService } from "../../../authorization/scope.service";
import type { PrismaService } from "../../../shared/prisma.service";
import type {
	TrpcContextType,
	TrpcRequestLike,
	TrpcResponseLike,
} from "../../trpc.context";
import { createAdminRouter } from "../admin.router";

// ── Mocks ──────────────────────────────────────────────────────────────────

const prismaMock = {
	user: {
		findMany: jest.fn(),
		findUnique: jest.fn(),
		count: jest.fn(),
		update: jest.fn(),
	},
	role: {
		findMany: jest.fn(),
	},
	permission: {
		findMany: jest.fn(),
	},
	auditLog: {
		findMany: jest.fn(),
		count: jest.fn(),
	},
	app: {
		findMany: jest.fn(),
	},
	userRole: {
		deleteMany: jest.fn(),
	},
};

const policyServiceMock = {
	can: jest.fn(),
	invalidateUserCache: jest.fn(),
};

const roleServiceMock = {
	listRoles: jest.fn(),
	getRoleByKey: jest.fn(),
	getRoleWithPermissions: jest.fn(),
	createRole: jest.fn(),
	updateRole: jest.fn(),
	deleteRole: jest.fn(),
	addPermission: jest.fn(),
	removePermission: jest.fn(),
};

const permissionServiceMock = {
	listPermissions: jest.fn(),
	parsePermissionKey: jest.fn(),
	getPermissionByKey: jest.fn(),
	createPermission: jest.fn(),
	updatePermission: jest.fn(),
	deletePermission: jest.fn(),
};

const auditServiceMock = {
	log: jest.fn(),
	queryLogs: jest.fn(),
	logSupervisorRevoked: jest.fn(),
	logUserStatusChanged: jest.fn(),
	logUserDeleted: jest.fn(),
};

const scopeServiceMock = {
	getScopes: jest.fn(),
};

const getSessionMock = jest.fn();

const originalNodeEnv = process.env.NODE_ENV;
const originalDisableAuth = process.env.DISABLE_AUTH;

const createSessionPayload = () => ({
	user: {
		id: "admin-user-1",
		email: "admin@test.com",
		emailVerified: true,
		name: "Admin",
		createdAt: new Date(),
		updatedAt: new Date(),
		mustChangePassword: false,
		passwordChangedAt: null,
	},
	session: {
		id: "session-1",
		userId: "admin-user-1",
		expiresAt: new Date(Date.now() + 1000 * 60 * 60),
		createdAt: new Date(),
		updatedAt: new Date(),
		token: "session-token",
	},
});

const createCaller = () => {
	const adminRouter = createAdminRouter({
		auditService: auditServiceMock as unknown as AuditService,
		policyService: policyServiceMock as unknown as PolicyService,
		permissionService: permissionServiceMock as unknown as PermissionService,
		roleService: roleServiceMock as unknown as RoleService,
		scopeService: scopeServiceMock as unknown as ScopeService,
	});

	const ctx: TrpcContextType = {
		req: { headers: {} } as TrpcRequestLike,
		res: {} as TrpcResponseLike,
		prisma: prismaMock as unknown as PrismaService,
	};

	return adminRouter.createCaller(ctx);
};

function restoreEnvVar(
	key: "NODE_ENV" | "DISABLE_AUTH",
	value: string | undefined,
) {
	if (value === undefined) {
		delete process.env[key];
		return;
	}

	process.env[key] = value;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("admin.router", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.NODE_ENV = "test";
		delete process.env.DISABLE_AUTH;
		Object.defineProperty(auth.api, "getSession", {
			value: getSessionMock,
			configurable: true,
		});
		getSessionMock.mockReset();
	});

	afterAll(() => {
		restoreEnvVar("NODE_ENV", originalNodeEnv);
		restoreEnvVar("DISABLE_AUTH", originalDisableAuth);
	});

	// Helper to set up an authenticated admin session
	function setupAdminSession() {
		getSessionMock.mockResolvedValue(createSessionPayload());
		policyServiceMock.can.mockResolvedValue({ allowed: true });
	}

	// ── listUsers ──────────────────────────────────────────────────────────

	describe("listUsers", () => {
		it("returns paginated user list for authorized user", async () => {
			setupAdminSession();

			const mockUsers = [
				{
					id: "u1",
					email: "user1@test.com",
					name: "User 1",
					isActive: true,
					userRoles: [],
					supervisedApps: [],
				},
			];
			prismaMock.user.findMany.mockResolvedValue(mockUsers);
			prismaMock.user.count.mockResolvedValue(1);

			const caller = createCaller();
			const result = await caller.listUsers({ page: 1, limit: 20 });

			expect(result.users).toEqual(mockUsers);
			expect(result.pagination).toEqual({
				page: 1,
				limit: 20,
				total: 1,
				totalPages: 1,
			});
		});

		it("throws UNAUTHORIZED when no session", async () => {
			getSessionMock.mockResolvedValue(null);

			const caller = createCaller();
			await expect(
				caller.listUsers({ page: 1, limit: 20 }),
			).rejects.toMatchObject({
				code: "UNAUTHORIZED",
			});
		});

		it("throws FORBIDDEN when user lacks permission", async () => {
			getSessionMock.mockResolvedValue(createSessionPayload());
			policyServiceMock.can.mockResolvedValue({
				allowed: false,
				reason: "Insufficient permissions",
			});

			const caller = createCaller();
			await expect(
				caller.listUsers({ page: 1, limit: 20 }),
			).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
		});
	});

	// ── listRoles ──────────────────────────────────────────────────────────

	describe("listRoles", () => {
		it("returns all roles with permissions", async () => {
			setupAdminSession();

			const mockRoles = [
				{
					id: "r1",
					key: "admin",
					name: "Admin",
					description: null,
					level: 100,
					isSystem: true,
					rolePermissions: [
						{
							permission: {
								id: "p1",
								key: "system:user.read",
								name: "Read Users",
							},
						},
					],
				},
			];
			prismaMock.role.findMany.mockResolvedValue(mockRoles);

			const caller = createCaller();
			const result = await caller.listRoles();

			expect(result).toEqual(mockRoles);
			expect(prismaMock.role.findMany).toHaveBeenCalled();
		});
	});

	// ── listPermissions ────────────────────────────────────────────────────

	describe("listPermissions", () => {
		it("returns all permissions with parsed scope", async () => {
			setupAdminSession();

			const mockPermissions = [
				{
					id: "p1",
					key: "system:user.read",
					name: "Read Users",
					description: null,
				},
			];
			permissionServiceMock.listPermissions.mockResolvedValue(mockPermissions);
			permissionServiceMock.parsePermissionKey.mockReturnValue({
				scope: "system",
				resource: "user",
				action: "read",
			});

			const caller = createCaller();
			const result = await caller.listPermissions();

			expect(result).toEqual([
				{
					id: "p1",
					key: "system:user.read",
					name: "Read Users",
					description: null,
					scope: "system",
				},
			]);
			expect(permissionServiceMock.parsePermissionKey).toHaveBeenCalledWith(
				"system:user.read",
			);
		});
	});

	// ── createRole ─────────────────────────────────────────────────────────

	describe("createRole", () => {
		it("creates a role via roleService", async () => {
			setupAdminSession();

			roleServiceMock.createRole.mockResolvedValue({
				id: "new-role",
				key: "editor",
				name: "Editor",
				description: "Can edit content",
				level: 50,
				isSystem: false,
			});

			const caller = createCaller();
			const result = await caller.createRole({
				key: "editor",
				name: "Editor",
				description: "Can edit content",
				level: 50,
				isSystem: false,
			});

			expect(result.key).toBe("editor");
			expect(roleServiceMock.createRole).toHaveBeenCalledWith(
				expect.objectContaining({ key: "editor", name: "Editor" }),
			);
		});
	});

	// ── deleteRole ─────────────────────────────────────────────────────────

	describe("deleteRole", () => {
		it("deletes a role", async () => {
			setupAdminSession();
			roleServiceMock.deleteRole.mockResolvedValue(undefined);

			const caller = createCaller();
			const result = await caller.deleteRole({ roleKey: "editor" });

			expect(result).toEqual({ success: true });
			expect(roleServiceMock.deleteRole).toHaveBeenCalledWith("editor");
		});

		it("throws FORBIDDEN without permission", async () => {
			getSessionMock.mockResolvedValue(createSessionPayload());
			policyServiceMock.can.mockResolvedValue({
				allowed: false,
				reason: "Not allowed",
			});

			const caller = createCaller();
			await expect(
				caller.deleteRole({ roleKey: "editor" }),
			).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
		});
	});

	// ── getAuditLogs ───────────────────────────────────────────────────────

	describe("getAuditLogs", () => {
		it("returns audit logs", async () => {
			setupAdminSession();

			const mockLogs = [
				{
					id: "log-1",
					action: "user.create",
					actorUserId: "admin-user-1",
					subjectId: "u1",
					metadata: {},
					createdAt: new Date(),
				},
			];
			const mockResult = { logs: mockLogs, total: 1 };
			auditServiceMock.queryLogs.mockResolvedValue(mockResult);

			const caller = createCaller();
			const result = await caller.getAuditLogs({ limit: 50 });

			expect(result).toEqual(mockResult);
			expect(auditServiceMock.queryLogs).toHaveBeenCalledWith(
				expect.objectContaining({ limit: 50 }),
			);
		});
	});

	// ── assignPermissionToRole ─────────────────────────────────────────────

	describe("assignPermissionToRole", () => {
		it("assigns a permission to a role", async () => {
			setupAdminSession();
			roleServiceMock.addPermission.mockResolvedValue(undefined);

			const caller = createCaller();
			const result = await caller.assignPermissionToRole({
				roleKey: "editor",
				permissionKey: "system:user.read",
			});

			expect(result).toEqual({ success: true });
			expect(roleServiceMock.addPermission).toHaveBeenCalledWith(
				"editor",
				"system:user.read",
			);
		});
	});

	// ── removePermissionFromRole ───────────────────────────────────────────

	describe("removePermissionFromRole", () => {
		it("removes a permission from a role", async () => {
			setupAdminSession();
			roleServiceMock.removePermission.mockResolvedValue(undefined);

			const caller = createCaller();
			const result = await caller.removePermissionFromRole({
				roleKey: "editor",
				permissionKey: "system:user.read",
			});

			expect(result).toEqual({ success: true });
			expect(roleServiceMock.removePermission).toHaveBeenCalledWith(
				"editor",
				"system:user.read",
			);
		});
	});

	// ── Self-service protection ────────────────────────────────────────────

	describe("disableUser", () => {
		it("prevents self-disable", async () => {
			setupAdminSession();

			const caller = createCaller();
			await expect(
				caller.disableUser({ userId: "admin-user-1" }),
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: "Cannot disable your own account",
			});
		});

		it("disables another user successfully", async () => {
			setupAdminSession();
			prismaMock.user.update.mockResolvedValue({
				id: "other-user",
				isActive: false,
			});

			const caller = createCaller();
			const result = await caller.disableUser({ userId: "other-user" });

			expect(result.isActive).toBe(false);
			expect(auditServiceMock.logUserStatusChanged).toHaveBeenCalledWith(
				"admin-user-1",
				"other-user",
				false,
			);
		});
	});

	describe("deleteUser", () => {
		it("prevents self-deletion", async () => {
			setupAdminSession();

			const caller = createCaller();
			await expect(
				caller.deleteUser({ userId: "admin-user-1" }),
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: "Cannot delete your own account",
			});
		});
	});

	describe("revokeRole", () => {
		it("prevents revoking own admin role", async () => {
			setupAdminSession();

			const caller = createCaller();
			await expect(
				caller.revokeRole({ userId: "admin-user-1", roleKey: "admin" }),
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: "Cannot revoke your own admin role",
			});
		});

		it("prevents revoking own super_admin role", async () => {
			setupAdminSession();

			const caller = createCaller();
			await expect(
				caller.revokeRole({
					userId: "admin-user-1",
					roleKey: "super_admin",
				}),
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: "Cannot revoke your own admin role",
			});
		});
	});

	// ── Audit logging on mutations ─────────────────────────────────────────

	describe("createRole audit logging", () => {
		it("logs role creation", async () => {
			setupAdminSession();
			roleServiceMock.createRole.mockResolvedValue({
				id: "new-role",
				key: "editor",
				name: "Editor",
				level: 50,
			});

			const caller = createCaller();
			await caller.createRole({
				key: "editor",
				name: "Editor",
				level: 50,
				isSystem: false,
			});

			expect(auditServiceMock.log).toHaveBeenCalledWith(
				expect.objectContaining({
					actorUserId: "admin-user-1",
					action: "role.created",
					subjectType: "role",
					subjectId: "editor",
				}),
			);
		});
	});

	describe("deleteRole audit logging", () => {
		it("logs role deletion", async () => {
			setupAdminSession();
			roleServiceMock.deleteRole.mockResolvedValue(undefined);

			const caller = createCaller();
			await caller.deleteRole({ roleKey: "editor" });

			expect(auditServiceMock.log).toHaveBeenCalledWith(
				expect.objectContaining({
					actorUserId: "admin-user-1",
					action: "role.deleted",
					subjectType: "role",
					subjectId: "editor",
				}),
			);
		});
	});

	describe("assignPermissionToRole audit logging", () => {
		it("logs permission assignment", async () => {
			setupAdminSession();
			roleServiceMock.addPermission.mockResolvedValue(undefined);

			const caller = createCaller();
			await caller.assignPermissionToRole({
				roleKey: "editor",
				permissionKey: "system:user.read",
			});

			expect(auditServiceMock.log).toHaveBeenCalledWith(
				expect.objectContaining({
					actorUserId: "admin-user-1",
					action: "permission.assigned_to_role",
					subjectType: "role_permission",
					subjectId: "editor",
				}),
			);
		});
	});
});
