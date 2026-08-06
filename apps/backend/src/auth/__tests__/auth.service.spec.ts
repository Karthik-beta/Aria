import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const mockHandlerFn = mock((_req: Request) =>
	Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
);

mock.module("../auth.config", () => ({
	auth: {
		handler: (_req: Request) => mockHandlerFn(_req),
	},
	Auth: {} as never,
}));

const mockPrismaUserFindFirst = mock((_args?: unknown) =>
	Promise.resolve<unknown>(null),
);
const mockPrismaUserFindUnique = mock((_args?: unknown) =>
	Promise.resolve<unknown>(null),
);
const mockPrismaUserUpdate = mock((_args?: unknown) => Promise.resolve({}));
const mockPrismaConnect = mock(() => Promise.resolve());
const mockPrismaDisconnect = mock(() => Promise.resolve());

const mockPrismaObj = {
	$connect: mockPrismaConnect,
	$disconnect: mockPrismaDisconnect,
	user: {
		findFirst: mockPrismaUserFindFirst,
		findUnique: mockPrismaUserFindUnique,
		update: mockPrismaUserUpdate,
	},
};

mock.module("../shared/prisma-client.js", () => ({
	prismaClient: mockPrismaObj,
}));

import { AuthService } from "../auth.service.js";

/**
 * Unit tests for AuthService.
 *
 * Exercises both the pure error-reporting helpers and the public
 * createDefaultUser method with controlled mocks for the database and
 * better-auth handler.
 */
describe("AuthService", () => {
	let service: AuthService;

	const originalEnv = { ...process.env };

	beforeEach(() => {
		service = Object.create(AuthService.prototype) as AuthService;
		// biome-ignore lint/suspicious/noExplicitAny: accessing private helpers
		(service as any).prisma = mockPrismaObj;
		// biome-ignore lint/suspicious/noExplicitAny: accessing private helpers
		(service as any).logger = {
			log: () => {
				/* suppressed */
			},
			warn: () => {
				/* suppressed */
			},
			error: () => {
				/* suppressed */
			},
		};
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		mockPrismaConnect.mockClear();
		mockPrismaUserFindFirst.mockClear();
		mockPrismaUserFindUnique.mockClear();
		mockPrismaUserUpdate.mockClear();
		mockHandlerFn.mockClear();
	});

	// ── getSafeErrorMessage ───────────────────────────────────────────────────

	describe("getSafeErrorMessage", () => {
		const call = (error: unknown) =>
			// biome-ignore lint/suspicious/noExplicitAny: accessing private helper
			(service as any).getSafeErrorMessage(error);

		it("returns the message from an Error instance", () => {
			expect(call(new Error("boom"))).toBe("boom");
		});

		it("returns the string directly when given a non-empty string", () => {
			expect(call("something went wrong")).toBe("something went wrong");
		});

		it("falls back for an Error with an empty message", () => {
			expect(call(new Error(""))).toBe("Unexpected error");
		});

		it("falls back for a whitespace-only Error message", () => {
			expect(call(new Error("   "))).toBe("Unexpected error");
		});

		it("falls back for a whitespace-only string", () => {
			expect(call("   ")).toBe("Unexpected error");
		});

		it("falls back for null", () => {
			expect(call(null)).toBe("Unexpected error");
		});

		it("falls back for undefined", () => {
			expect(call(undefined)).toBe("Unexpected error");
		});

		it("falls back for a number", () => {
			expect(call(42)).toBe("Unexpected error");
		});

		it("falls back for an empty object", () => {
			expect(call({})).toBe("Unexpected error");
		});
	});

	// ── getErrorDetails ───────────────────────────────────────────────────────

	describe("getErrorDetails", () => {
		const call = (error: unknown) =>
			// biome-ignore lint/suspicious/noExplicitAny: accessing private helper
			(service as any).getErrorDetails(error);

		it("returns stack from an Error", () => {
			const err = new Error("oops");
			expect(call(err)).toBe(err.stack);
		});

		it("returns the string itself for a non-empty string", () => {
			expect(call("detail text")).toBe("detail text");
		});

		it("returns undefined for a whitespace-only string", () => {
			expect(call("  ")).toBeUndefined();
		});

		it("JSON-serializes a plain object with content", () => {
			expect(call({ code: 42 })).toBe('{"code":42}');
		});

		it("returns undefined for an empty object", () => {
			expect(call({})).toBeUndefined();
		});

		it("returns undefined for null", () => {
			expect(call(null)).toBeUndefined();
		});

		it("returns undefined for undefined", () => {
			expect(call(undefined)).toBeUndefined();
		});

		it("returns undefined for a number", () => {
			expect(call(42)).toBeUndefined();
		});

		it("returns undefined when JSON.stringify throws (circular ref)", () => {
			const circular: Record<string, unknown> = {};
			circular.self = circular;
			expect(call(circular)).toBeUndefined();
		});
	});

	// ── createDefaultUser ─────────────────────────────────────────────────────

	describe("createDefaultUser", () => {
		const setEnv = (env: Record<string, string>) => {
			Object.entries(env).forEach(([k, v]) => {
				process.env[k] = v;
			});
		};

		const clearEnv = (...keys: string[]) => {
			keys.forEach((k) => {
				delete process.env[k];
			});
		};

		beforeEach(() => {
			clearEnv(
				"DEFAULT_ADMIN_USERNAME",
				"DEFAULT_ADMIN_PASSWORD",
				"DEFAULT_ADMIN_EMAIL",
				"DEFAULT_ADMIN_NAME",
			);
			mockPrismaConnect.mockImplementation(() => Promise.resolve());
			mockPrismaUserFindFirst.mockImplementation(() => Promise.resolve(null));
			mockPrismaUserFindUnique.mockImplementation(() => Promise.resolve(null));
			mockPrismaUserUpdate.mockImplementation(() => Promise.resolve({}));
			mockHandlerFn.mockImplementation(() =>
				Promise.resolve(new Response(JSON.stringify({}), { status: 200 })),
			);
		});

		it("skips creation when DEFAULT_ADMIN_USERNAME is missing", async () => {
			clearEnv("DEFAULT_ADMIN_USERNAME");
			setEnv({
				DEFAULT_ADMIN_PASSWORD: "pass12345",
				DEFAULT_ADMIN_EMAIL: "admin@test.com",
			});

			await service.createDefaultUser();

			expect(mockPrismaConnect).not.toHaveBeenCalled();
			expect(mockHandlerFn).not.toHaveBeenCalled();
		});

		it("skips creation when DEFAULT_ADMIN_PASSWORD is missing", async () => {
			setEnv({
				DEFAULT_ADMIN_USERNAME: "admin",
				DEFAULT_ADMIN_EMAIL: "admin@test.com",
			});
			clearEnv("DEFAULT_ADMIN_PASSWORD");

			await service.createDefaultUser();

			expect(mockPrismaConnect).not.toHaveBeenCalled();
			expect(mockHandlerFn).not.toHaveBeenCalled();
		});

		it("skips creation when DEFAULT_ADMIN_EMAIL is missing", async () => {
			setEnv({
				DEFAULT_ADMIN_USERNAME: "admin",
				DEFAULT_ADMIN_PASSWORD: "pass12345",
			});
			clearEnv("DEFAULT_ADMIN_EMAIL");

			await service.createDefaultUser();

			expect(mockPrismaConnect).not.toHaveBeenCalled();
			expect(mockHandlerFn).not.toHaveBeenCalled();
		});

		it("skips sign-up when user already exists", async () => {
			setEnv({
				DEFAULT_ADMIN_USERNAME: "admin",
				DEFAULT_ADMIN_PASSWORD: "pass12345",
				DEFAULT_ADMIN_EMAIL: "admin@test.com",
			});
			mockPrismaUserFindFirst.mockResolvedValue({
				id: "existing-id",
				username: "admin",
				email: "admin@test.com",
			});

			await service.createDefaultUser();

			expect(mockPrismaConnect).toHaveBeenCalled();
			expect(mockHandlerFn).not.toHaveBeenCalled();
		});

		it("creates user via auth.handler when no existing user found", async () => {
			setEnv({
				DEFAULT_ADMIN_USERNAME: "admin",
				DEFAULT_ADMIN_PASSWORD: "pass12345",
				DEFAULT_ADMIN_EMAIL: "admin@test.com",
			});
			mockPrismaUserFindFirst.mockResolvedValue(null);
			mockPrismaUserFindUnique.mockResolvedValue({
				id: "created-id",
				email: "admin@test.com",
			});

			await service.createDefaultUser();

			expect(mockHandlerFn).toHaveBeenCalledTimes(1);
			const callArg = mockHandlerFn.mock.calls[0]?.[0] as Request | undefined;
			expect(callArg).toBeDefined();
			expect(callArg?.method).toBe("POST");
		});

		it("sets super_admin role after successful creation", async () => {
			setEnv({
				DEFAULT_ADMIN_USERNAME: "admin",
				DEFAULT_ADMIN_PASSWORD: "pass12345",
				DEFAULT_ADMIN_EMAIL: "admin@test.com",
			});
			mockPrismaUserFindFirst.mockResolvedValue(null);
			mockPrismaUserFindUnique.mockResolvedValue({
				id: "created-id",
				email: "admin@test.com",
			});

			await service.createDefaultUser();

			expect(mockPrismaUserUpdate).toHaveBeenCalled();
			const updateCall = (
				mockPrismaUserUpdate.mock.calls as unknown as [
					Record<string, unknown>[],
				]
			)[0]?.[0];
			expect(updateCall).toBeDefined();
			if (updateCall) {
				expect(updateCall.where).toEqual({ id: "created-id" });
				expect(updateCall.data).toMatchObject({ role: "super_admin" });
			}
		});

		it("does not crash when auth.handler returns non-ok", async () => {
			setEnv({
				DEFAULT_ADMIN_USERNAME: "admin",
				DEFAULT_ADMIN_PASSWORD: "pass12345",
				DEFAULT_ADMIN_EMAIL: "admin@test.com",
			});
			mockPrismaUserFindFirst.mockResolvedValue(null);
			mockHandlerFn.mockImplementation(() =>
				Promise.resolve(
					new Response(JSON.stringify({ message: "Conflict" }), {
						status: 409,
					}),
				),
			);

			await service.createDefaultUser();

			expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
		});

		it("does not throw when prisma connection fails", async () => {
			setEnv({
				DEFAULT_ADMIN_USERNAME: "admin",
				DEFAULT_ADMIN_PASSWORD: "pass12345",
				DEFAULT_ADMIN_EMAIL: "admin@test.com",
			});
			mockPrismaConnect.mockRejectedValue(new Error("Connection refused"));

			await expect(service.createDefaultUser()).resolves.toBeUndefined();
		});

		it("updates password metadata for existing user", async () => {
			setEnv({
				DEFAULT_ADMIN_USERNAME: "admin",
				DEFAULT_ADMIN_PASSWORD: "pass12345",
				DEFAULT_ADMIN_EMAIL: "admin@test.com",
			});
			mockPrismaUserFindFirst.mockResolvedValue({
				id: "existing-id",
				email: "admin@test.com",
				username: "admin",
			});

			await service.createDefaultUser();

			expect(mockPrismaUserUpdate).toHaveBeenCalled();
			const updateCall = (
				mockPrismaUserUpdate.mock.calls as unknown as [
					Record<string, unknown>[],
				]
			)[0]?.[0];
			expect(updateCall).toBeDefined();
			if (updateCall) {
				expect(updateCall.where).toEqual({ email: "admin@test.com" });
				expect(updateCall.data).toMatchObject({
					mustChangePassword: false,
				});
			}
		});

		it("uses DEFAULT_ADMIN_NAME in sign-up request body", async () => {
			setEnv({
				DEFAULT_ADMIN_USERNAME: "admin",
				DEFAULT_ADMIN_PASSWORD: "pass12345",
				DEFAULT_ADMIN_EMAIL: "admin@test.com",
				DEFAULT_ADMIN_NAME: "Custom Admin",
			});
			mockPrismaUserFindFirst.mockResolvedValue(null);
			mockPrismaUserFindUnique.mockResolvedValue({
				id: "created-id",
				email: "admin@test.com",
			});

			await service.createDefaultUser();

			expect(mockHandlerFn).toHaveBeenCalled();
			const callArg = mockHandlerFn.mock.calls[0]?.[0] as Request | undefined;
			expect(callArg).toBeDefined();
			if (callArg) {
				const body = await callArg.json();
				expect(body.name).toBe("Custom Admin");
			}
		});
	});
});
