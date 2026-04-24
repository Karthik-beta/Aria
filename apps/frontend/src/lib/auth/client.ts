import { logger } from "@aria/utils";
import {
	customSessionClient,
	usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import {
	buildDevelopmentSession,
	isDevelopmentAuthBypassEnabled,
} from "./development-bypass";

/**
 * Better Auth client for React
 *
 * Configured with username plugin for username-based authentication.
 * Environment-aware base URL configuration with credentials inclusion.
 */
const baseURL = process.env.NEXT_PUBLIC_API_URL
	? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
	: "";

export const authClient = createAuthClient({
	baseURL,
	plugins: [usernameClient(), customSessionClient()],
	fetchOptions: {
		credentials: "include", // Include cookies for cross-site requests
		onError(context) {
			// Silent error handling - protected layouts handle redirects on the server
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

	if (isDevelopmentAuthBypassEnabled() && !session.data && !session.isPending) {
		return {
			...session,
			data: buildDevelopmentSession() as (typeof session)["data"],
		};
	}

	return session;
};
