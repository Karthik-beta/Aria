import {
	type ExecutionContext,
	ForbiddenException,
	UnauthorizedException,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import {
	APP_SCOPE_KEY,
	PUBLIC_ROUTE_KEY,
	REQUIRE_PERMISSIONS_KEY,
	REQUIRE_ROLES_KEY,
} from "../decorators";
import {
	ActiveUserGuard,
	AppScopeGuard,
	OwnershipGuard,
	PublicRouteGuard,
	RolePermissionGuard,
} from "../guards";
import type { PolicyService } from "../policy.service";
import type { ScopeService } from "../scope.service";

const createExecutionContext = (
	requestOverrides: Record<string, unknown> = {},
): ExecutionContext => {
	const request = {
		user: { id: "user-1" },
		params: {},
		body: {},
		query: {},
		...requestOverrides,
	};

	return {
		switchToHttp: () => ({
			getRequest: () => request,
		}),
		getHandler: jest.fn(),
		getClass: jest.fn(),
	} as unknown as ExecutionContext;
};

const createReflector = (
	implementation: (key: string) => unknown = () => undefined,
): Reflector =>
	({
		getAllAndOverride: jest.fn((key: string) => implementation(key)),
	}) as unknown as Reflector;

const createPolicyServiceMock = (): jest.Mocked<PolicyService> =>
	({
		resolveUserPolicy: jest.fn(),
		can: jest.fn(),
		hasAnyRole: jest.fn(),
		hasRole: jest.fn(),
		getUserMaxRoleLevel: jest.fn(),
		invalidateUserCache: jest.fn(),
		clearCache: jest.fn(),
	}) as unknown as jest.Mocked<PolicyService>;

const createScopeServiceMock = (): jest.Mocked<ScopeService> =>
	({
		isInManagementHierarchy: jest.fn(),
	}) as unknown as jest.Mocked<ScopeService>;

const originalNodeEnv = process.env.NODE_ENV;

function restoreEnvVar(key: "NODE_ENV", value: string | undefined) {
	if (value === undefined) {
		delete process.env[key];
		return;
	}

	process.env[key] = value;
}

describe("Authorization Guards", () => {
	beforeEach(() => {
		process.env.NODE_ENV = "test";
	});

	afterAll(() => {
		restoreEnvVar("NODE_ENV", originalNodeEnv);
	});

	describe("PublicRouteGuard", () => {
		it("allows when route marked public", () => {
			const reflector = createReflector((key) =>
				key === PUBLIC_ROUTE_KEY ? true : undefined,
			);
			const guard = new PublicRouteGuard(reflector);
			const context = createExecutionContext();

			expect(guard.canActivate(context)).toBe(true);
		});

		it("allows when route is not public so other guards can run", () => {
			const reflector = createReflector(() => false);
			const guard = new PublicRouteGuard(reflector);
			const context = createExecutionContext();

			expect(guard.canActivate(context)).toBe(true);
		});
	});

	describe("ActiveUserGuard", () => {
		let policyService: jest.Mocked<PolicyService>;

		beforeEach(() => {
			policyService = createPolicyServiceMock();
		});

		it("attaches policy for active users", async () => {
			policyService.resolveUserPolicy.mockResolvedValue({
				userId: "user-1",
				isActive: true,
				roles: [],
				permissions: [],
				apps: [],
				supervisedApps: [],
			});

			const guard = new ActiveUserGuard(policyService);
			const context = createExecutionContext();

			await expect(guard.canActivate(context)).resolves.toBe(true);

			const request = context.switchToHttp().getRequest();
			expect(request.userPolicy).toEqual(
				expect.objectContaining({ userId: "user-1", isActive: true }),
			);
		});

		it("throws when no authenticated user present", async () => {
			const guard = new ActiveUserGuard(policyService);
			const context = createExecutionContext({ user: undefined });

			await expect(guard.canActivate(context)).rejects.toThrow(
				UnauthorizedException,
			);
		});

		it("throws when user is inactive", async () => {
			policyService.resolveUserPolicy.mockResolvedValue({
				userId: "user-1",
				isActive: false,
				roles: [],
				permissions: [],
				apps: [],
				supervisedApps: [],
			});

			const guard = new ActiveUserGuard(policyService);
			const context = createExecutionContext();

			await expect(guard.canActivate(context)).rejects.toThrow(
				ForbiddenException,
			);
		});
	});

	describe("AppScopeGuard", () => {
		let policyService: jest.Mocked<PolicyService>;

		beforeEach(() => {
			policyService = createPolicyServiceMock();
		});

		it("skips when no app scope metadata", async () => {
			const reflector = createReflector(() => undefined);
			const guard = new AppScopeGuard(reflector, policyService);
			const context = createExecutionContext();

			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(policyService.resolveUserPolicy.mock.calls).toHaveLength(0);
		});

		it("allows super admin across app scopes", async () => {
			policyService.resolveUserPolicy.mockResolvedValue({
				userId: "user-1",
				isActive: true,
				roles: [{ roleKey: "super_admin", appKey: null, level: 100 }],
				permissions: [],
				apps: [],
				supervisedApps: [],
			});

			const reflector = createReflector((key) =>
				key === APP_SCOPE_KEY ? "crm" : undefined,
			);
			const guard = new AppScopeGuard(reflector, policyService);
			const context = createExecutionContext();

			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(policyService.resolveUserPolicy.mock.calls[0]).toEqual([
				"user-1",
				"crm",
			]);
		});

		it("throws when user lacks app access", async () => {
			policyService.resolveUserPolicy.mockResolvedValue({
				userId: "user-1",
				isActive: true,
				roles: [],
				permissions: [],
				apps: [],
				supervisedApps: [],
			});

			const reflector = createReflector((key) =>
				key === APP_SCOPE_KEY ? "crm" : undefined,
			);
			const guard = new AppScopeGuard(reflector, policyService);
			const context = createExecutionContext();

			await expect(guard.canActivate(context)).rejects.toThrow(
				ForbiddenException,
			);
		});
	});

	describe("RolePermissionGuard", () => {
		let policyService: jest.Mocked<PolicyService>;
		let requiredRoles: string[] | undefined;
		let requiredPermissions: string[] | undefined;

		beforeEach(() => {
			policyService = createPolicyServiceMock();
			requiredRoles = undefined;
			requiredPermissions = undefined;
		});

		const buildReflector = () =>
			createReflector((key) => {
				if (key === REQUIRE_ROLES_KEY) {
					return requiredRoles;
				}
				if (key === REQUIRE_PERMISSIONS_KEY) {
					return requiredPermissions;
				}
				return undefined;
			});

		it("passes when neither roles nor permissions required", async () => {
			const guard = new RolePermissionGuard(buildReflector(), policyService);
			const context = createExecutionContext();

			await expect(guard.canActivate(context)).resolves.toBe(true);
		});

		it("validates required roles", async () => {
			requiredRoles = ["manager"];
			policyService.hasAnyRole.mockResolvedValue(true);

			const guard = new RolePermissionGuard(buildReflector(), policyService);
			const context = createExecutionContext({ appContext: { appKey: "crm" } });

			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(policyService.hasAnyRole.mock.calls[0]).toEqual([
				"user-1",
				["manager"],
				"crm",
			]);
		});

		it("throws when role requirement fails", async () => {
			requiredRoles = ["admin"];
			policyService.hasAnyRole.mockResolvedValue(false);

			const guard = new RolePermissionGuard(buildReflector(), policyService);
			const context = createExecutionContext();

			await expect(guard.canActivate(context)).rejects.toThrow(
				ForbiddenException,
			);
		});

		it("validates required permissions", async () => {
			requiredPermissions = ["system:user.manage"];
			policyService.can.mockResolvedValue({ allowed: true });

			const guard = new RolePermissionGuard(buildReflector(), policyService);
			const context = createExecutionContext({ appContext: { appKey: "crm" } });

			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(policyService.can.mock.calls[0]).toEqual([
				"user-1",
				"system:user.manage",
				{
					userId: "user-1",
					appKey: "crm",
				},
			]);
		});

		it("throws when permission check fails", async () => {
			requiredPermissions = ["system:user.manage"];
			policyService.can.mockResolvedValue({
				allowed: false,
				reason: "Missing permission",
			});

			const guard = new RolePermissionGuard(buildReflector(), policyService);
			const context = createExecutionContext();

			await expect(guard.canActivate(context)).rejects.toThrow(
				ForbiddenException,
			);
		});

		it("passes request scope context to policy checks", async () => {
			requiredPermissions = ["entity:crm:lead.update"];
			policyService.can.mockResolvedValue({ allowed: true });

			const guard = new RolePermissionGuard(buildReflector(), policyService);
			const context = createExecutionContext({
				params: { ownerId: "owner-1", teamId: "team-1" },
				body: { resourceTeamId: "team-2" },
				appContext: { appKey: "crm" },
			});

			await expect(guard.canActivate(context)).resolves.toBe(true);
			const [, , contextArg] = policyService.can.mock.calls[0];
			expect(contextArg).toEqual(
				expect.objectContaining({
					userId: "user-1",
					appKey: "crm",
					resourceOwnerId: "owner-1",
					teamId: "team-1",
					resourceTeamId: "team-2",
				}),
			);
		});
	});

	describe("OwnershipGuard", () => {
		let policyService: jest.Mocked<PolicyService>;
		let scopeService: jest.Mocked<ScopeService>;

		beforeEach(() => {
			policyService = createPolicyServiceMock();
			scopeService = createScopeServiceMock();
		});

		it("allows when request owner matches user", async () => {
			policyService.resolveUserPolicy.mockResolvedValue({
				userId: "user-1",
				isActive: true,
				roles: [],
				permissions: [],
				apps: [],
				supervisedApps: [],
			});

			const guard = new OwnershipGuard(policyService, scopeService);
			const context = createExecutionContext({ params: { ownerId: "user-1" } });

			await expect(guard.canActivate(context)).resolves.toBe(true);
		});

		it("allows super admins to bypass ownership", async () => {
			policyService.resolveUserPolicy.mockResolvedValue({
				userId: "user-1",
				isActive: true,
				roles: [{ roleKey: "super_admin", appKey: null, level: 100 }],
				permissions: [],
				apps: [],
				supervisedApps: [],
			});

			const guard = new OwnershipGuard(policyService, scopeService);
			const context = createExecutionContext({ params: { ownerId: "user-2" } });

			await expect(guard.canActivate(context)).resolves.toBe(true);
		});

		it("throws when user not owner and not super admin", async () => {
			policyService.resolveUserPolicy.mockResolvedValue({
				userId: "user-1",
				isActive: true,
				roles: [],
				permissions: [],
				apps: [],
				supervisedApps: [],
			});
			scopeService.isInManagementHierarchy.mockResolvedValue(false);

			const guard = new OwnershipGuard(policyService, scopeService);
			const context = createExecutionContext({ params: { ownerId: "user-2" } });

			await expect(guard.canActivate(context)).rejects.toThrow(
				ForbiddenException,
			);
		});

		it("throws when no owner is provided", async () => {
			policyService.resolveUserPolicy.mockResolvedValue({
				userId: "user-1",
				isActive: true,
				roles: [],
				permissions: [],
				apps: [],
				supervisedApps: [],
			});

			const guard = new OwnershipGuard(policyService, scopeService);
			const context = createExecutionContext({ params: {} });

			await expect(guard.canActivate(context)).rejects.toThrow(
				ForbiddenException,
			);
		});

		it("allows when user manages resource owner", async () => {
			policyService.resolveUserPolicy.mockResolvedValue({
				userId: "user-1",
				isActive: true,
				roles: [],
				permissions: [],
				apps: [],
				supervisedApps: [],
			});
			scopeService.isInManagementHierarchy.mockResolvedValue(true);

			const guard = new OwnershipGuard(policyService, scopeService);
			const context = createExecutionContext({ params: { ownerId: "user-2" } });

			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(scopeService.isInManagementHierarchy.mock.calls[0]).toEqual([
				"user-1",
				"user-2",
			]);
		});

		it("throws when no authenticated user", async () => {
			const guard = new OwnershipGuard(policyService, scopeService);
			const context = createExecutionContext({ user: undefined });

			await expect(guard.canActivate(context)).rejects.toThrow(
				UnauthorizedException,
			);
		});
	});
});
