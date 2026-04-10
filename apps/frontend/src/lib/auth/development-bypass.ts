import type { AuthorizationData } from "./authorization";
import type { AuthSessionData } from "./types";

export const INVALID_DEVELOPMENT_AUTH_BYPASS_MESSAGE =
	"NEXT_PUBLIC_DEV_AUTH_BYPASS can only be enabled in development.";

type DevelopmentAuthBypassState = {
	enabled: boolean;
	error?: string;
};

function isDevelopmentAuthBypassRequested(): boolean {
	return process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
}

export function getDevelopmentAuthBypassState(): DevelopmentAuthBypassState {
	if (!isDevelopmentAuthBypassRequested()) {
		return { enabled: false };
	}

	if (process.env.NODE_ENV !== "development") {
		return {
			enabled: false,
			error: INVALID_DEVELOPMENT_AUTH_BYPASS_MESSAGE,
		};
	}

	return { enabled: true };
}

export function assertValidDevelopmentAuthBypassConfiguration(): void {
	const bypassState = getDevelopmentAuthBypassState();

	if (bypassState.error) {
		throw new Error(bypassState.error);
	}
}

export function isDevelopmentAuthBypassEnabled(): boolean {
	return getDevelopmentAuthBypassState().enabled;
}

export function buildDevelopmentSession(): AuthSessionData {
	const now = new Date();

	return {
		user: {
			id: "dev-admin-id",
			email: "admin@aria.local",
			emailVerified: true,
			name: "System Administrator",
			createdAt: now,
			updatedAt: now,
			username: "admin",
			displayUsername: "admin",
			mustChangePassword: false,
			passwordChangedAt: now,
		},
		session: {
			id: "dev-session-id",
			userId: "dev-admin-id",
			createdAt: now,
			updatedAt: now,
			token: "dev-session-token",
			expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7),
		},
	};
}

export function buildDevelopmentAuthorization(): AuthorizationData {
	return {
		roles: ["super_admin"],
		permissions: ["system:*"],
		apps: {
			inventory: { roles: ["admin"] },
			asset: { roles: ["admin"] },
			crm: { roles: ["admin"] },
			hrms: { roles: ["admin"] },
		},
		supervisedApps: ["inventory", "asset", "crm", "hrms"],
		isActive: true,
	};
}
