import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Middleware for SSO-style authentication across all Aria ERP apps
 *
 * This middleware ensures:
 * 1. Protected routes redirect to centralized /auth/sign-in
 * 2. Callback URLs preserve the original destination
 * 3. All apps share the same authentication session
 */
export default function proxy(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // Skip middleware for auth routes, static files, and API routes
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Protected route patterns for all apps
  const protectedPatterns = [
    '/asset/dashboard',
    '/crm/dashboard',
    '/hrms/dashboard',
    '/inventory/dashboard',
  ];

  const isProtectedRoute = protectedPatterns.some((pattern) => pathname.startsWith(pattern));

  // TODO: Replace with actual authentication check
  // For now, this is a placeholder - integrate with your auth solution
  // (NextAuth, Clerk, Auth0, Supabase, etc.)
  const isAuthenticated = checkAuthentication(req);

  if (isProtectedRoute && !isAuthenticated) {
    // Redirect to centralized sign-in with callback URL
    const signInUrl = new URL('/auth/sign-in', origin);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

/**
 * Check if the user is authenticated
 * TODO: Implement actual authentication check based on your auth provider
 */
function checkAuthentication(req: NextRequest): boolean {
  // TEMPORARILY DISABLED FOR TESTING
  // Authentication is disabled to allow testing of tRPC and WebSocket connections
  return true;

  // Placeholder implementation - uncomment when ready to enable auth
  // Replace with actual auth check:
  // - NextAuth: check for session token
  // - Clerk: check clerk session
  // - Custom: check JWT or session cookie

  // For development/preview, allow access without authentication
  // if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_AUTH_DISABLED === 'true') {
  //   return true;
  // }

  // const sessionCookie = req.cookies.get('session')?.value;
  // return !!sessionCookie;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
