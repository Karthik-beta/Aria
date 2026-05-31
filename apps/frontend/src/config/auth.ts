/**
 * Centralized Authentication Configuration for SSO-style Auth
 *
 * This configuration enables Single Sign-On functionality across all Aria ERP apps:
 * - Admin Console
 * - Asset Management
 * - CRM
 * - HRMS
 * - Inventory
 *
 * All apps share the same authentication routes and session.
 */

export const AUTH_CONFIG = {
	// Centralized auth routes (shared across all apps)
	routes: {
		signIn: "/auth/sign-in",
		signUp: "/auth/sign-up",
	},

	// App-specific default redirect paths after successful authentication
	appRedirects: {
		admin: "/admin/dashboard/overview",
		asset: "/asset/dashboard/overview",
		crm: "/crm/dashboard/overview",
		hrms: "/hrms/dashboard/overview",
		inventory: "/inventory/dashboard/overview",
	},

	// Default redirect if no app is specified
	defaultRedirect: "/inventory/dashboard/overview",

	// Public routes that don't require authentication
	publicRoutes: [
		"/auth/sign-in",
		"/auth/sign-up",
		"/auth/forgot-password",
		"/auth/reset-password",
	],

	// Protected route patterns
	protectedPatterns: ["/", "/admin", "/asset", "/crm", "/hrms", "/inventory"],
} as const;

const CALLBACK_URL_BASE = "http://aria.local";

/**
 * Normalize a callback URL so only in-app relative redirects are allowed.
 */
export function normalizeCallbackUrl(
	callbackUrl: string | null,
): string | null {
	if (!callbackUrl) {
		return null;
	}

	const trimmedCallbackUrl = callbackUrl.trim();

	if (
		trimmedCallbackUrl.length === 0 ||
		!trimmedCallbackUrl.startsWith("/") ||
		trimmedCallbackUrl.startsWith("//") ||
		trimmedCallbackUrl.includes("\\")
	) {
		return null;
	}

	try {
		const normalizedUrl = new URL(trimmedCallbackUrl, CALLBACK_URL_BASE);

		if (normalizedUrl.origin !== CALLBACK_URL_BASE) {
			return null;
		}

		return `${normalizedUrl.pathname}${normalizedUrl.search}${normalizedUrl.hash}`;
	} catch {
		return null;
	}
}

/**
 * Detect which app the user is trying to access from the callback URL
 */
export function detectAppFromCallbackUrl(
	callbackUrl: string | null,
): keyof typeof AUTH_CONFIG.appRedirects | null {
	if (!callbackUrl) return null;

	if (callbackUrl.includes("/admin")) return "admin";
	if (callbackUrl.includes("/asset")) return "asset";
	if (callbackUrl.includes("/crm")) return "crm";
	if (callbackUrl.includes("/hrms")) return "hrms";
	if (callbackUrl.includes("/inventory")) return "inventory";

	return null;
}

/**
 * Get the appropriate redirect URL based on the callback URL or app context
 */
export function getAuthRedirectUrl(callbackUrl: string | null): string {
	const normalizedCallbackUrl = normalizeCallbackUrl(callbackUrl);

	// If callback URL is provided, use it
	if (normalizedCallbackUrl) {
		return normalizedCallbackUrl;
	}

	// Detect app from callback and return appropriate default
	const app = detectAppFromCallbackUrl(normalizedCallbackUrl);
	if (app) {
		return AUTH_CONFIG.appRedirects[app];
	}

	// Fallback to default redirect
	return AUTH_CONFIG.defaultRedirect;
}

/**
 * Build sign-in URL with callback
 */
export function buildSignInUrl(callbackUrl?: string): string {
	const url = AUTH_CONFIG.routes.signIn;
	const normalizedCallbackUrl = normalizeCallbackUrl(callbackUrl ?? null);
	if (normalizedCallbackUrl) {
		return `${url}?callbackUrl=${encodeURIComponent(normalizedCallbackUrl)}`;
	}
	return url;
}

/**
 * Build sign-up URL with callback
 */
export function buildSignUpUrl(callbackUrl?: string): string {
	const url = AUTH_CONFIG.routes.signUp;
	const normalizedCallbackUrl = normalizeCallbackUrl(callbackUrl ?? null);
	if (normalizedCallbackUrl) {
		return `${url}?callbackUrl=${encodeURIComponent(normalizedCallbackUrl)}`;
	}
	return url;
}
