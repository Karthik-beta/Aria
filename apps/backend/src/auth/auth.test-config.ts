import { randomBytes } from "node:crypto";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";
import { testUtils } from "better-auth/plugins";
import { customSession } from "better-auth/plugins/custom-session";
import { username } from "better-auth/plugins/username";
import { prismaClient } from "../shared/prisma-client.js";

/**
 * Test-only auth configuration with testUtils plugin.
 *
 * Per better-auth official docs: keeping testUtils in a separate test-only
 * auth instance preserves type inference for ctx.test without adding the
 * plugin to the production auth config.
 */
export const authTest = betterAuth({
	database: prismaAdapter(prismaClient, {
		provider: "postgresql",
		usePlural: false,
	}),

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		minPasswordLength: 8,
		maxPasswordLength: 128,
	},

	plugins: [
		username({
			minUsernameLength: 3,
			maxUsernameLength: 20,
		}),
		customSession(async ({ user, session }) => {
			try {
				const passwordState = await prismaClient.user.findUnique({
					where: { id: user.id },
					select: {
						mustChangePassword: true,
						passwordChangedAt: true,
					},
				});

				return {
					user: {
						...user,
						mustChangePassword: passwordState?.mustChangePassword ?? false,
						passwordChangedAt: passwordState?.passwordChangedAt ?? null,
					},
					session,
				};
			} catch {
				return {
					user: {
						...user,
						mustChangePassword: false,
						passwordChangedAt: null,
					},
					session,
				};
			}
		}),
		testUtils(),
	],

	secret: process.env.BETTER_AUTH_SECRET || randomBytes(32).toString("hex"),

	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",

	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
	},
});

export type AuthTest = typeof authTest;
