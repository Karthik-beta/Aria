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
 * Resolve the current Better Auth session on the server for this request.
 */
export const getServerSession = cache(
	async (): Promise<AuthSessionData | null> => {
		try {
			return await fetchBackendSession();
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

	return {
		session,
		role: authorization.role,
		isActive: authorization.isActive,
	};
}
