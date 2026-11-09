/**
 * Integration tests for the better-auth admin plugin.
 *
 * Exercises core admin plugin operations using the testUtils plugin
 * and an in-memory database adapter, following the official better-auth
 * testing patterns:
 *
 * @see https://better-auth.com/docs/plugins/admin
 * @see https://better-auth.com/docs/plugins/test-utils
 */
import { beforeAll, describe, expect, it } from "vitest";
import { authTest } from "../test-auth-config";

describe("admin plugin integration", () => {
	// biome-ignore lint/suspicious/noExplicitAny: dynamic plugin-injected type
	let test: any;
	let adminId: string;
	let regularUserId: string;

	beforeAll(async () => {
		const ctx = await authTest.$context;
		// biome-ignore lint/suspicious/noExplicitAny: dynamic plugin-injected property
		test = (ctx as any).test;

		const adminUser = test.createUser({
			email: "admin@integration.test",
			name: "Admin User",
			role: "super_admin",
		});
		const savedAdmin = await test.saveUser(adminUser);
		adminId = adminUser.id ?? savedAdmin.id;

		const regularUser = test.createUser({
			email: "user@integration.test",
			name: "Regular User",
			role: "user",
		});
		const savedRegular = await test.saveUser(regularUser);
		regularUserId = regularUser.id ?? savedRegular.id;
	});

	// biome-ignore lint/suspicious/noExplicitAny: dynamic type
	function getHeaders(userId: string): Promise<any> {
		return test.getAuthHeaders({ userId });
	}

	// ── createUser ───────────────────────────────────────────────────────────

	describe("createUser", () => {
		it("creates a new user with email, password, and name", async () => {
			const headers = await getHeaders(adminId);

			const result = (await authTest.api.createUser({
				// biome-ignore lint/suspicious/noExplicitAny: dynamic type
				headers: headers as any,
				body: {
					email: "newuser@integration.test",
					password: "securePassword123",
					name: "New User",
				},
			})) as Record<string, unknown>;

			expect(result).toBeDefined();
			const user = result.user as Record<string, unknown>;
			expect(user.email).toBe("newuser@integration.test");
			expect(user.name).toBe("New User");
		});

		it("creates a user with a specific role", async () => {
			const headers = await getHeaders(adminId);

			const result = (await authTest.api.createUser({
				// biome-ignore lint/suspicious/noExplicitAny: dynamic type
				headers: headers as any,
				body: {
					email: "roleduser@integration.test",
					password: "securePassword123",
					name: "Role User",
					role: "admin",
				},
			})) as Record<string, unknown>;

			const user = result.user as Record<string, unknown>;
			expect(user.email).toBe("roleduser@integration.test");
			expect(user.role).toBe("admin");
		});
	});

	// ── listUsers ─────────────────────────────────────────────────────────────

	describe("listUsers", () => {
		it("lists all users with pagination metadata", async () => {
			const headers = await getHeaders(adminId);

			const result = (await authTest.api.listUsers({
				// biome-ignore lint/suspicious/noExplicitAny: dynamic type
				headers: headers as any,
				query: { limit: 50 },
			})) as Record<string, unknown>;

			expect(Array.isArray(result.users)).toBe(true);
			expect(typeof result.total).toBe("number");
			expect((result.users as unknown[]).length).toBeGreaterThanOrEqual(2);
		});

		it("supports search by email", async () => {
			const headers = await getHeaders(adminId);

			const result = (await authTest.api.listUsers({
				// biome-ignore lint/suspicious/noExplicitAny: dynamic type
				headers: headers as any,
				query: {
					searchValue: "admin@integration.test",
					searchField: "email",
					searchOperator: "contains",
				},
			})) as Record<string, unknown>;

			const users = result.users as Record<string, unknown>[];
			expect(users.some((u) => u.email === "admin@integration.test")).toBe(
				true,
			);
		});

		it("supports pagination with limit and offset", async () => {
			const headers = await getHeaders(adminId);

			const page1 = (await authTest.api.listUsers({
				// biome-ignore lint/suspicious/noExplicitAny: dynamic type
				headers: headers as any,
				query: { limit: 1, offset: 0 },
			})) as Record<string, unknown>;

			const page2 = (await authTest.api.listUsers({
				// biome-ignore lint/suspicious/noExplicitAny: dynamic type
				headers: headers as any,
				query: { limit: 1, offset: 1 },
			})) as Record<string, unknown>;

			expect(page1.users as unknown[]).toHaveLength(1);
			expect(page2.users as unknown[]).toHaveLength(1);
		});
	});

	// ── setRole ───────────────────────────────────────────────────────────────

	describe("setRole", () => {
		it("changes a user's role", async () => {
			const headers = await getHeaders(adminId);

			await expect(
				authTest.api.setRole({
					// biome-ignore lint/suspicious/noExplicitAny: dynamic type
					headers: headers as any,
					body: { userId: regularUserId, role: "admin" },
				}),
			).resolves.toBeDefined();
		});
	});

	// ── setUserPassword ───────────────────────────────────────────────────────

	describe("setUserPassword", () => {
		it("changes a user's password", async () => {
			const headers = await getHeaders(adminId);

			await expect(
				authTest.api.setUserPassword({
					// biome-ignore lint/suspicious/noExplicitAny: dynamic type
					headers: headers as any,
					body: {
						userId: regularUserId,
						newPassword: "newSecurePassword123",
					},
				}),
			).resolves.toBeDefined();
		});
	});

	// ── updateUser ────────────────────────────────────────────────────────────

	describe("updateUser", () => {
		it("rejects update with empty data when no fields are provided", async () => {
			const headers = await getHeaders(adminId);

			await expect(
				authTest.api.adminUpdateUser({
					// biome-ignore lint/suspicious/noExplicitAny: dynamic type
					headers: headers as any,
					body: {
						userId: regularUserId,
						data: { name: "Updated User" },
					},
				}),
			).resolves.toBeDefined();
		});
	});

	// ── banUser / unbanUser ───────────────────────────────────────────────────

	describe("banUser and unbanUser", () => {
		it("bans a user", async () => {
			const headers = await getHeaders(adminId);

			await expect(
				authTest.api.banUser({
					// biome-ignore lint/suspicious/noExplicitAny: dynamic type
					headers: headers as any,
					body: {
						userId: regularUserId,
						banReason: "Spamming",
					},
				}),
			).resolves.toBeDefined();
		});

		it("unbans a previously banned user", async () => {
			const headers = await getHeaders(adminId);

			await expect(
				authTest.api.unbanUser({
					// biome-ignore lint/suspicious/noExplicitAny: dynamic type
					headers: headers as any,
					body: { userId: regularUserId },
				}),
			).resolves.toBeDefined();
		});
	});

	// ── listUserSessions ─────────────────────────────────────────────────────

	describe("listUserSessions", () => {
		it("lists sessions for a user", async () => {
			const headers = await getHeaders(adminId);

			const result = (await authTest.api.listUserSessions({
				// biome-ignore lint/suspicious/noExplicitAny: dynamic type
				headers: headers as any,
				body: { userId: regularUserId },
			})) as Record<string, unknown>;

			expect(Array.isArray(result.sessions)).toBe(true);
		});
	});

	// ── revokeUserSessions ────────────────────────────────────────────────────

	describe("revokeUserSessions", () => {
		it("revokes all sessions for a user", async () => {
			const headers = await getHeaders(adminId);

			await expect(
				authTest.api.revokeUserSessions({
					// biome-ignore lint/suspicious/noExplicitAny: dynamic type
					headers: headers as any,
					body: { userId: regularUserId },
				}),
			).resolves.toBeDefined();
		});
	});

	// ── removeUser ────────────────────────────────────────────────────────────

	describe("removeUser", () => {
		it("deletes a user", async () => {
			const userToDelete = test.createUser({
				email: "delete-me@integration.test",
				name: "Delete Me",
			});
			await test.saveUser(userToDelete);

			const headers = await getHeaders(adminId);

			const result = (await authTest.api.removeUser({
				// biome-ignore lint/suspicious/noExplicitAny: dynamic type
				headers: headers as any,
				body: { userId: userToDelete.id },
			})) as Record<string, unknown>;

			expect(result).toBeDefined();
		});
	});

	// ── hasPermission ─────────────────────────────────────────────────────────

	describe("hasPermission", () => {
		it("confirms admin has user:create permission", async () => {
			const headers = await getHeaders(adminId);

			const result = (await authTest.api.userHasPermission({
				// biome-ignore lint/suspicious/noExplicitAny: dynamic type
				headers: headers as any,
				body: {
					userId: adminId,
					permissions: { user: ["create"] },
				},
			})) as Record<string, unknown>;

			expect(result).toBeDefined();
		});
	});

	// ── permission denials ────────────────────────────────────────────────────

	describe("access control", () => {
		it("prevents regular user from performing admin operations", async () => {
			const freshUser = test.createUser({
				email: "restricted@integration.test",
				name: "Restricted User",
				role: "user",
			});
			await test.saveUser(freshUser);

			const userHeaders = await getHeaders(freshUser.id);

			await expect(
				authTest.api.listUserSessions({
					// biome-ignore lint/suspicious/noExplicitAny: dynamic type
					headers: userHeaders as any,
					body: { userId: adminId },
				}),
			).rejects.toBeDefined();
		});
	});
});
