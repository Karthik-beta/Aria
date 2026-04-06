import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildSignInUrl, normalizeCallbackUrl } from "@/config/auth";

const SESSION_COOKIE_NAMES = [
	"better-auth.session_token",
	"__Secure-better-auth.session_token",
];

function isDevelopmentBypassEnabled() {
	return (
		process.env.NODE_ENV === "development" &&
		process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true"
	);
}

function hasSessionCookie(request: NextRequest) {
	return SESSION_COOKIE_NAMES.some((cookieName) =>
		Boolean(request.cookies.get(cookieName)?.value),
	);
}

/**
 * Optimistic auth redirect for protected routes.
 *
 * Per Next.js and Better Auth guidance, this performs only a fast cookie check
 * and forwards the requested path so page/layout-level server checks can make
 * the final authorization decision.
 */
export function proxy(request: NextRequest) {
	const callbackUrl = normalizeCallbackUrl(
		`${request.nextUrl.pathname}${request.nextUrl.search}`,
	);
	const requestHeaders = new Headers(request.headers);

	if (callbackUrl) {
		requestHeaders.set("x-aria-callback-url", callbackUrl);
	}

	if (isDevelopmentBypassEnabled()) {
		return NextResponse.next({
			request: {
				headers: requestHeaders,
			},
		});
	}

	if (!hasSessionCookie(request)) {
		return NextResponse.redirect(
			new URL(buildSignInUrl(callbackUrl ?? undefined), request.url),
		);
	}

	return NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});
}

export const config = {
	matcher: [
		"/",
		"/admin/:path*",
		"/asset/:path*",
		"/crm/:path*",
		"/hrms/:path*",
		"/inventory/:path*",
	],
};
