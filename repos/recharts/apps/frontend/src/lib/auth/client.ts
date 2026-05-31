import { logger } from "@aria/utils";
import {
	adminClient,
	customSessionClient,
	organizationClient,
	usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client for React
 *
 * Configured with username, organization, custom session, and admin plugins.
 * Environment-aware base URL configuration with credentials inclusion.
 */
const baseURL = process.env.NEXT_PUBLIC_API_URL
	? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")
	: "";

export const authClient = createAuthClient({
	baseURL,
	plugins: [
		usernameClient(),
		customSessionClient(),
		adminClient(),
		organizationClient(),
	],
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
export const {
	signIn,
	signOut,
	signUp,
	useSession,
	useListOrganizations,
	useActiveOrganization,
	organization,
} = authClient;
