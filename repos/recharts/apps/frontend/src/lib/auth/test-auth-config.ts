/**
 * Test-only auth config with memory adapter for admin plugin integration tests.
 *
 * Uses the memory adapter (per official better-auth docs) and testUtils plugin
 * to exercise all 16 admin plugin operations without a real database.
 *
 * @see https://better-auth.com/docs/plugins/admin
 * @see https://better-auth.com/docs/plugins/test-utils
 */

import { memoryAdapter } from "better-auth/adapters/memory";
import { betterAuth } from "better-auth/minimal";
import { admin, testUtils } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";

const ac = createAccessControl({
	user: [
		"create",
		"list",
		"set-role",
		"ban",
		"impersonate",
		"delete",
		"set-password",
		"update",
	],
	session: ["list", "revoke"],
} as const);

export const authTest = betterAuth({
	database: memoryAdapter({}),

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		minPasswordLength: 8,
		maxPasswordLength: 128,
	},

	plugins: [
		admin({
			ac,
			roles: {
				admin: ac.newRole({
					user: [
						"create",
						"list",
						"set-role",
						"ban",
						"impersonate",
						"delete",
						"set-password",
						"update",
					],
					session: ["list", "revoke"],
				}),
				user: ac.newRole({
					user: [],
					session: [],
				}),
				super_admin: ac.newRole({
					user: [
						"create",
						"list",
						"set-role",
						"ban",
						"impersonate",
						"delete",
						"set-password",
						"update",
					],
					session: ["list", "revoke"],
				}),
			},
			adminRoles: ["admin", "super_admin"],
			defaultRole: "user",
		}),
		testUtils(),
	],

	secret: "integration-test-secret-32chars",
	baseURL: "http://localhost:3000",
});

export type AuthTest = typeof authTest;
