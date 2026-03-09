import { logger } from "@aria/utils";
import {
	customSessionClient,
	usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client for React
 *
 * Configured with username plugin for username-based authentication.
 * Environment-aware base URL configuration with credentials inclusion.
 */
const baseURL = (
	process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
).replace(/\/$/, "");

export const authClient = createAuthClient({
	baseURL,
	plugins: [usernameClient(), customSessionClient()],
	fetchOptions: {
		credentials: "include", // Include cookies for cross-site requests
		onError(context) {
			// Silent error handling - AuthGuard will manage redirects
			// Only log server errors in development
			if (
				process.env.NODE_ENV === "development" &&
				context.response?.status &&
				context.response.status >= 500
			) {
				logger.error(`[Auth] Server error: ${context.response.status}`);
			}
		},
	},
});

/**
 * Type-safe hooks and utilities from auth client
 */
export const { signIn, signOut, signUp } = authClient;

/**
 * Enhanced useSession hook with development bypass
 *
 * If NEXT_PUBLIC_DEV_AUTH_BYPASS is set to 'true' in development,
 * returns a mock admin session when no real session exists.
 */
export const useSession: typeof authClient.useSession = () => {
	const session = authClient.useSession();

	const isDevelopmentBypass =
		process.env.NODE_ENV === "development" &&
		process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

	if (isDevelopmentBypass && !session.data && !session.isPending) {
		return {
			...session,
			data: {
				user: {
					id: "dev-admin-id",
					email: "admin@aria.local",
					emailVerified: true,
					name: "System Administrator",
					createdAt: new Date(),
					updatedAt: new Date(),
					username: "admin",
					displayUsername: "admin",
					mustChangePassword: false,
				},
				session: {
					id: "dev-session-id",
					createdAt: new Date(),
					updatedAt: new Date(),
					userId: "dev-admin-id",
					token: "dev-session-token",
					expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
				},
			} as (typeof session)["data"],
		};
	}

	return session;
};
