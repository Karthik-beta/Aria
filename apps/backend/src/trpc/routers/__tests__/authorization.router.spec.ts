import { logger } from "@aria/utils";
import { auth } from "../../../auth/auth.config";
import type { PrismaService } from "../../../shared/prisma.service";
import type {
	TrpcContextType,
	TrpcRequestLike,
	TrpcResponseLike,
} from "../../trpc.context";
import { authorizationRouter } from "../authorization.router";

type AuthorizationPrismaMock = {
	userRole: { findMany: jest.Mock };
	rolePermission: { findMany: jest.Mock };
	teamMember: { findMany: jest.Mock };
	appSupervisor: { findMany: jest.Mock };
};

const prismaMock: AuthorizationPrismaMock = {
	userRole: { findMany: jest.fn() },
	rolePermission: { findMany: jest.fn() },
	teamMember: { findMany: jest.fn() },
	appSupervisor: { findMany: jest.fn() },
};
const getSessionMock = jest.fn();
const originalNodeEnv = process.env.NODE_ENV;
const originalDisableAuth = process.env.DISABLE_AUTH;

const createSessionPayload = () => ({
	user: {
		id: "user-1",
		email: "user@example.com",
		emailVerified: true,
		name: "Test User",
		createdAt: new Date(),
		updatedAt: new Date(),
		mustChangePassword: false,
		passwordChangedAt: null,
	},
	session: {
		id: "session-1",
		userId: "user-1",
		expiresAt: new Date(Date.now() + 1000 * 60 * 60),
		createdAt: new Date(),
		updatedAt: new Date(),
		token: "session-token",
	},
});

const createCaller = () => {
	const ctx: TrpcContextType = {
		req: { headers: {} } as TrpcRequestLike,
		res: {} as TrpcResponseLike,
		prisma: prismaMock as unknown as PrismaService,
	};

	return authorizationRouter.createCaller(ctx);
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

describe("authorizationRouter", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.NODE_ENV = "test";
		delete process.env.DISABLE_AUTH;
		jest.spyOn(logger, "error").mockImplementation(() => {});
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

	it("returns aggregated authorization data for active session", async () => {
		getSessionMock.mockResolvedValue(createSessionPayload());

		prismaMock.userRole.findMany.mockResolvedValue([
			{
				userId: "user-1",
				appKey: "crm",
				role: {
					id: "role-1",
					key: "admin",
					rolePermissions: [],
				},
			},
		]);

		prismaMock.rolePermission.findMany.mockResolvedValue([
			{
				roleId: "role-1",
				permission: { key: "system:user.manage" },
			},
		]);

		prismaMock.teamMember.findMany.mockResolvedValue([
			{ team: { appKey: "crm" } },
		]);

		prismaMock.appSupervisor.findMany.mockResolvedValue([
			{ app: { appKey: "inventory" } },
		]);

		const caller = createCaller();
		const result = await caller.getUserAuthorization();

		expect(result.roles).toEqual(["admin"]);
		expect(result.permissions).toEqual(["system:user.manage"]);
		expect(result.apps).toEqual({ crm: { roles: ["admin"] } });
		expect(result.supervisedApps).toEqual(["inventory"]);
		expect(result.isActive).toBe(true);
	});

	it("throws UNAUTHORIZED when no session available", async () => {
		getSessionMock.mockResolvedValue(null);

		const caller = createCaller();

		await expect(caller.getUserAuthorization()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("returns safe fallback when prisma throws", async () => {
		getSessionMock.mockResolvedValue(createSessionPayload());

		prismaMock.userRole.findMany.mockRejectedValue(new Error("db unavailable"));

		const caller = createCaller();
		const result = await caller.getUserAuthorization();

		expect(result).toEqual({
			roles: [],
			permissions: [],
			apps: {},
			supervisedApps: [],
			isActive: false,
		});

		expect(logger.error).toHaveBeenCalledWith(
			"[Authorization] Error fetching user authorization:",
			expect.any(Error),
		);
	});
});
