import type { AuthorizationData } from "@aria/types";
import { logger } from "@aria/utils";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { buildSignInUrl, normalizeCallbackUrl } from "@/config/auth";
import type {
	AuthSessionData,
	AuthSessionRecord,
	AuthSessionUser,
	OrganizationData,
} from "@/lib/auth/types";

function getBackendUrl() {
	const baseUrl =
		process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "";

	return baseUrl.replace(/\/$/, "");
}

function isAuthSessionData(value: unknown): value is AuthSessionData {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	const user = candidate.user;
	const session = candidate.session;

	if (typeof user !== "object" || user === null) {
		return false;
	}

	if (typeof session !== "object" || session === null) {
		return false;
	}

	return (
		typeof (user as AuthSessionUser).id === "string" &&
		typeof (user as AuthSessionUser).email === "string" &&
		typeof (session as AuthSessionRecord).id === "string" &&
		typeof (session as AuthSessionRecord).userId === "string"
	);
}

async function fetchBackendSession(): Promise<AuthSessionData | null> {
	const cookieStore = await cookies();
	const cookieHeader = cookieStore.toString();

	if (!cookieHeader) {
		return null;
	}

	const response = await fetch(`${getBackendUrl()}/api/auth/get-session`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			cookie: cookieHeader,
		},
		cache: "no-store",
	});

	if (response.status === 401) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`Session fetch failed with ${response.status}`);
	}

	const payload = (await response.json()) as unknown;
	return isAuthSessionData(payload) ? payload : null;
}

/**
 * Fetch the backend session with retry for transient failures (e.g. connection
 * refused during `bun dev` restart). Null results (no cookie, 401, bad payload)
 * return immediately; only network-level errors trigger retries.
 */
async function fetchBackendSessionWithRetry(
	maxRetries = 3,
	baseDelayMs = 500,
): Promise<AuthSessionData | null> {
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fetchBackendSession();
		} catch (error) {
			lastError = error;
			if (attempt < maxRetries) {
				await new Promise((resolve) =>
					setTimeout(resolve, baseDelayMs * 2 ** attempt),
				);
			}
		}
	}

	logger.error(
		"[Auth] Failed to fetch server session after retries:",
		lastError,
	);
	return null;
}

/**
 * Resolve the current Better Auth session on the server for this request.
 */
export const getServerSession = cache(
	async (): Promise<AuthSessionData | null> => {
		try {
			return await fetchBackendSessionWithRetry();
		} catch (error) {
			logger.error("[Auth] Failed to fetch server session:", error);
			return null;
		}
	},
);

export const getAuthorizationData = cache(
	async (): Promise<AuthorizationData> => {
		const session = await getServerSession();
		const user = session?.user;

		return {
			role: user?.role ?? null,
			isActive: Boolean(user),
		};
	},
);

/**
 * Fetch the active organization for the current request context.
 *
 * Uses getServerSession to obtain the activeOrganizationId from the session,
 * then fetches the full organization from the backend.
 */
export const getActiveOrganization = cache(
	async (): Promise<OrganizationData | null> => {
		const session = await getServerSession();
		const activeOrganizationId = session?.session?.activeOrganizationId;

		if (!activeOrganizationId) {
			return null;
		}

		try {
			const cookieStore = await cookies();
			const cookieHeader = cookieStore.toString();

			const response = await fetch(
				`${getBackendUrl()}/api/auth/organization/get-full-organization?organizationId=${activeOrganizationId}`,
				{
					method: "GET",
					headers: {
						"Content-Type": "application/json",
						cookie: cookieHeader,
					},
					cache: "no-store",
				},
			);

			if (!response.ok) {
				return null;
			}

			const data = (await response.json()) as OrganizationData;
			return data ?? null;
		} catch (error) {
			logger.error("[Auth] Failed to fetch active organization:", error);
			return null;
		}
	},
);

/**
 * Fetch the current user's member role in the active organization.
 */
export const getMemberRole = cache(async (): Promise<string | null> => {
	const session = await getServerSession();
	const activeOrganizationId = session?.session?.activeOrganizationId;

	if (!activeOrganizationId) {
		return null;
	}

	try {
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();

		const response = await fetch(
			`${getBackendUrl()}/api/auth/organization/get-active-member-role`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					cookie: cookieHeader,
				},
				cache: "no-store",
			},
		);

		if (!response.ok) {
			return null;
		}

		const payload = (await response.json()) as { role?: string };
		return payload?.role ?? null;
	} catch (error) {
		logger.error("[Auth] Failed to fetch member role:", error);
		return null;
	}
});

/**
 * Read the current callback URL from request headers or fall back to the supplied value.
 */
export async function getRequestCallbackUrl(
	fallbackUrl?: string,
): Promise<string | undefined> {
	const headerStore = await headers();
	const callbackUrl =
		normalizeCallbackUrl(headerStore.get("x-aria-callback-url")) ??
		normalizeCallbackUrl(fallbackUrl ?? null);

	return callbackUrl ?? undefined;
}

/**
 * Ensure the current request has a valid session, redirecting to sign-in or
 * change-password when required.
 *
 * Returns full auth state including active organization and member role.
 */
export async function requireProtectedAuthState(options?: {
	callbackUrl?: string;
	allowPasswordChangeRoute?: boolean;
}) {
	const callbackUrl = await getRequestCallbackUrl(options?.callbackUrl);
	const session = await getServerSession();

	if (!session) {
		redirect(buildSignInUrl(callbackUrl));
	}

	if (
		session.user.mustChangePassword &&
		options?.allowPasswordChangeRoute !== true
	) {
		redirect("/auth/change-password");
	}

	const authorization = await getAuthorizationData();
	const activeOrganization = await getActiveOrganization();
	const memberRole = await getMemberRole();

	return {
		session,
		role: authorization.role,
		isActive: authorization.isActive,
		activeOrganization,
		memberRole,
	};
}
