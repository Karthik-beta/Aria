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

type PolicySnapshot = {
	userId: string;
	isActive: boolean;
	roles: Array<{
		roleKey: string;
		level: number;
		appKey: string | null;
	}>;
	permissions: Array<{
		key: string;
	}>;
	apps: string[];
	supervisedApps: string[];
};

type PolicyServiceMock = {
	resolveUserPolicy: (
		userId: string,
		appKey?: string,
	) => Promise<PolicySnapshot>;
	hasAnyRole: (
		userId: string,
		roles: string[],
		appKey?: string,
	) => Promise<boolean>;
	can: (
		userId: string,
		permission: string,
		context: Record<string, unknown>,
	) => Promise<{ allowed: boolean; reason?: string }>;
};

const defaultPolicy = (): PolicySnapshot => ({
	userId: "user-1",
	isActive: true,
	roles: [],
	permissions: [],
	apps: ["crm"],
	supervisedApps: [],
});

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

	@Get("app-scope")
	getAppScopeProtected() {
		return { ok: true };
	}
}

@Module({
	controllers: [SecureController],
	providers: [
		Reflector,
		{ provide: PolicyService, useValue: {} },
		PublicRouteGuard,
		ActiveUserGuard,
		AppScopeGuard,
		RolePermissionGuard,
	],
})
class AuthorizationTestModule {}

async function createApp(policyServiceMock: PolicyServiceMock) {
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [AuthorizationTestModule],
	})
		.overrideProvider(PolicyService)
		.useValue(policyServiceMock)
		.compile();

	const app = moduleFixture.createNestApplication();
	app.use((req, _res, next) => {
		(req as { user?: { id: string } }).user = { id: "user-1" };
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

	return { app, moduleFixture };
}

async function closeApp(app: INestApplication, moduleFixture: TestingModule) {
	await app.close();
	await moduleFixture.close();
}

describe("Authorization guards (e2e)", () => {
	it("allows access when a super admin reaches an app-scoped, permission-protected route", async () => {
		const policyServiceMock: PolicyServiceMock = {
			resolveUserPolicy: async () => ({
				userId: "user-1",
				isActive: true,
				roles: [{ roleKey: "super_admin", level: 100, appKey: null }],
				permissions: [{ key: "system:*" }],
				apps: ["crm"],
				supervisedApps: [],
			}),
			hasAnyRole: async () => true,
			can: async () => ({ allowed: true }),
		};
		const { app, moduleFixture } = await createApp(policyServiceMock);

		try {
			const response = await request(app.getHttpServer())
				.get("/secure/permission")
				.expect(200);

			expect(response.body).toEqual({ ok: true });
		} finally {
			await closeApp(app, moduleFixture);
		}
	});

	it("denies access when the permission check fails", async () => {
		const policyServiceMock: PolicyServiceMock = {
			resolveUserPolicy: async () => defaultPolicy(),
			hasAnyRole: async () => false,
			can: async () => ({
				allowed: false,
				reason: "Missing permission: system:user.manage",
			}),
		};
		const { app, moduleFixture } = await createApp(policyServiceMock);

		try {
			await request(app.getHttpServer()).get("/secure/permission").expect(403);
		} finally {
			await closeApp(app, moduleFixture);
		}
	});

	it("denies access when the requested app is out of scope", async () => {
		const policyServiceMock: PolicyServiceMock = {
			resolveUserPolicy: async () => ({
				userId: "user-1",
				isActive: true,
				roles: [],
				permissions: [],
				apps: [],
				supervisedApps: [],
			}),
			hasAnyRole: async () => false,
			can: async () => ({ allowed: true }),
		};
		const { app, moduleFixture } = await createApp(policyServiceMock);

		try {
			await request(app.getHttpServer()).get("/secure/app-scope").expect(403);
		} finally {
			await closeApp(app, moduleFixture);
		}
	});

	it("denies access when the user account is inactive", async () => {
		const policyServiceMock: PolicyServiceMock = {
			resolveUserPolicy: async () => ({
				userId: "user-1",
				isActive: false,
				roles: [],
				permissions: [],
				apps: ["crm"],
				supervisedApps: [],
			}),
			hasAnyRole: async () => false,
			can: async () => ({ allowed: true }),
		};
		const { app, moduleFixture } = await createApp(policyServiceMock);

		try {
			await request(app.getHttpServer()).get("/secure/app-scope").expect(403);
		} finally {
			await closeApp(app, moduleFixture);
		}
	});

	it("denies access when the required role is missing", async () => {
		const policyServiceMock: PolicyServiceMock = {
			resolveUserPolicy: async () => defaultPolicy(),
			hasAnyRole: async () => false,
			can: async () => ({ allowed: true }),
		};
		const { app, moduleFixture } = await createApp(policyServiceMock);

		try {
			await request(app.getHttpServer()).get("/secure/role").expect(403);
		} finally {
			await closeApp(app, moduleFixture);
		}
	});
});
