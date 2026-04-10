import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildSignInUrl, normalizeCallbackUrl } from "@/config/auth";
import { isDevelopmentAuthBypassEnabled } from "@/lib/auth/development-bypass";

const SESSION_COOKIE_NAMES = [
	"better-auth.session_token",
	"__Secure-better-auth.session_token",
];

function hasSessionCookie(request: NextRequest) {
	return SESSION_COOKIE_NAMES.some((cookieName) =>
		Boolean(request.cookies.get(cookieName)?.value),
	);
}

/**
 * Optimistic auth redirect for protected routes.
 *
 * Per the Next.js App Router auth guidance, Proxy should stay lightweight:
 * perform only a fast cookie-presence check here and let server layouts,
 * pages, and route handlers make the final authentication and authorization
 * decision through requireProtectedAuthState().
 */
export function proxy(request: NextRequest) {
	const callbackUrl = normalizeCallbackUrl(
		`${request.nextUrl.pathname}${request.nextUrl.search}`,
	);
	const requestHeaders = new Headers(request.headers);

	if (callbackUrl) {
		requestHeaders.set("x-aria-callback-url", callbackUrl);
	}

	if (isDevelopmentAuthBypassEnabled()) {
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
