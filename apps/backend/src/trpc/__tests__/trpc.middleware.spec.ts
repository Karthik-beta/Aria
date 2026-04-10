import { auth } from "../../auth/auth.config";
import { INVALID_DEVELOPMENT_AUTH_BYPASS_MESSAGE } from "../../auth/development-bypass";
import type { PrismaService } from "../../shared/prisma.service";
import { protectedProcedure, router } from "../trpc";
import type {
	TrpcContextType,
	TrpcRequestLike,
	TrpcResponseLike,
} from "../trpc.context";

const getSessionMock = jest.fn();

const protectedTestRouter = router({
	currentUser: protectedProcedure.query(({ ctx }) => ({
		userId: ctx.user.id,
		email: ctx.user.email,
		sessionUserId: ctx.session.userId,
	})),
});

const createCaller = () => {
	const ctx: TrpcContextType = {
		req: { headers: {} } as TrpcRequestLike,
		res: {} as TrpcResponseLike,
		prisma: {} as PrismaService,
	};

	return protectedTestRouter.createCaller(ctx);
};

const originalNodeEnv = process.env.NODE_ENV;
const originalDisableAuth = process.env.DISABLE_AUTH;
const originalDefaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL;
const originalDefaultAdminName = process.env.DEFAULT_ADMIN_NAME;
const originalDefaultAdminUsername = process.env.DEFAULT_ADMIN_USERNAME;
const originalGetSessionDescriptor = Object.getOwnPropertyDescriptor(
	auth.api,
	"getSession",
);

function restoreEnvVar(key: string, value: string | undefined) {
	if (value === undefined) {
		delete process.env[key];
		return;
	}

	process.env[key] = value;
}

describe("protectedProcedure authentication middleware", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		Object.defineProperty(auth.api, "getSession", {
			value: getSessionMock,
			configurable: true,
		});
		getSessionMock.mockReset();

		process.env.NODE_ENV = "test";
		delete process.env.DISABLE_AUTH;
		delete process.env.DEFAULT_ADMIN_EMAIL;
		delete process.env.DEFAULT_ADMIN_NAME;
		delete process.env.DEFAULT_ADMIN_USERNAME;
	});

	afterEach(() => {
		if (originalGetSessionDescriptor) {
			Object.defineProperty(
				auth.api,
				"getSession",
				originalGetSessionDescriptor,
			);
			return;
		}

		Reflect.deleteProperty(auth.api, "getSession");
	});

	afterAll(() => {
		restoreEnvVar("NODE_ENV", originalNodeEnv);
		restoreEnvVar("DISABLE_AUTH", originalDisableAuth);
		restoreEnvVar("DEFAULT_ADMIN_EMAIL", originalDefaultAdminEmail);
		restoreEnvVar("DEFAULT_ADMIN_NAME", originalDefaultAdminName);
		restoreEnvVar("DEFAULT_ADMIN_USERNAME", originalDefaultAdminUsername);
	});

	it("throws when DISABLE_AUTH is enabled in production", async () => {
		process.env.NODE_ENV = "production";
		process.env.DISABLE_AUTH = "true";

		const caller = createCaller();

		await expect(caller.currentUser()).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
			message: INVALID_DEVELOPMENT_AUTH_BYPASS_MESSAGE,
		});
		expect(getSessionMock).not.toHaveBeenCalled();
	});

	it("injects development auth context when DISABLE_AUTH is enabled", async () => {
		process.env.NODE_ENV = "development";
		process.env.DISABLE_AUTH = "true";
		process.env.DEFAULT_ADMIN_EMAIL = "dev-admin@example.com";
		process.env.DEFAULT_ADMIN_NAME = "Dev Admin";
		process.env.DEFAULT_ADMIN_USERNAME = "dev-admin";

		const caller = createCaller();
		const result = await caller.currentUser();

		expect(result).toEqual({
			userId: "dev-admin-id",
			email: "dev-admin@example.com",
			sessionUserId: "dev-admin-id",
		});
		expect(getSessionMock).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated requests on the normal path", async () => {
		getSessionMock.mockResolvedValue(null);

		const caller = createCaller();

		await expect(caller.currentUser()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: "Not authenticated",
		});
		expect(getSessionMock).toHaveBeenCalledTimes(1);
	});
});
