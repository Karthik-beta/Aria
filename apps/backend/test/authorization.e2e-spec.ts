import { Controller, Get, type INestApplication, Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import {
	AppScope,
	RequirePermissions,
	RequireRoles,
} from "../src/authorization/decorators";
import {
	ActiveUserGuard,
	AppScopeGuard,
	PublicRouteGuard,
	RolePermissionGuard,
} from "../src/authorization/guards";
import { PolicyService } from "../src/authorization/policy.service";

const mockPolicyService = {
	resolveUserPolicy: jest.fn(),
	hasAnyRole: jest.fn(),
	can: jest.fn(),
};

@Controller("secure")
@AppScope("crm")
class SecureController {
	@Get("permission")
	@RequirePermissions("system:user.manage")
	getPermissionProtected() {
		return { ok: true };
	}

	@Get("role")
	@RequireRoles("manager")
	getRoleProtected() {
		return { ok: true };
	}
}

@Module({
	controllers: [SecureController],
	providers: [
		Reflector,
		{ provide: PolicyService, useValue: mockPolicyService },
		PublicRouteGuard,
		ActiveUserGuard,
		AppScopeGuard,
		RolePermissionGuard,
	],
})
class AuthorizationTestModule {}

describe("Authorization guards (e2e)", () => {
	let app: INestApplication;

	beforeEach(async () => {
		jest.clearAllMocks();

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AuthorizationTestModule],
		}).compile();

		app = moduleFixture.createNestApplication();

		app.use((req, _res, next) => {
			req.user = { id: "user-1" };
			next();
		});

		const reflector = app.get(Reflector);
		const policyService = app.get(PolicyService);

		app.useGlobalGuards(
			new PublicRouteGuard(reflector),
			new ActiveUserGuard(policyService),
			new AppScopeGuard(reflector, policyService),
			new RolePermissionGuard(reflector, policyService),
		);

		await app.init();
	});

	afterEach(async () => {
		await app.close();
	});

	it("allows access when user has permission through super admin role", async () => {
		mockPolicyService.resolveUserPolicy.mockResolvedValue({
			userId: "user-1",
			isActive: true,
			roles: [{ roleKey: "super_admin", level: 100, appKey: null }],
			permissions: [{ key: "system:*" }],
			apps: ["crm"],
			supervisedApps: [],
		});
		mockPolicyService.can.mockResolvedValue({ allowed: true });

		const server = app.getHttpServer() as Parameters<typeof request>[0];

		await request(server)
			.get("/secure/permission")
			.expect(200)
			.expect({ ok: true });
	});

	it("denies access when permission check fails", async () => {
		mockPolicyService.resolveUserPolicy.mockResolvedValue({
			userId: "user-1",
			isActive: true,
			roles: [],
			permissions: [],
			apps: ["crm"],
			supervisedApps: [],
		});
		mockPolicyService.can.mockResolvedValue({
			allowed: false,
			reason: "Missing permission: system:user.manage",
		});

		const server = app.getHttpServer() as Parameters<typeof request>[0];

		await request(server).get("/secure/permission").expect(403);
	});

	it("denies access when user is inactive", async () => {
		mockPolicyService.resolveUserPolicy.mockResolvedValue({
			userId: "user-1",
			isActive: false,
			roles: [],
			permissions: [],
			apps: [],
			supervisedApps: [],
		});

		const server = app.getHttpServer() as Parameters<typeof request>[0];

		await request(server).get("/secure/permission").expect(403);
	});

	it("validates role-based access when @RequireRoles is used", async () => {
		mockPolicyService.resolveUserPolicy.mockResolvedValue({
			userId: "user-1",
			isActive: true,
			roles: [],
			permissions: [],
			apps: ["crm"],
			supervisedApps: [],
		});
		mockPolicyService.hasAnyRole.mockResolvedValue(false);

		const server = app.getHttpServer() as Parameters<typeof request>[0];

		await request(server).get("/secure/role").expect(403);
	});
});
