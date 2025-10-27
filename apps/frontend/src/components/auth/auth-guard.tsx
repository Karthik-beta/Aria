'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

/**
 * AuthGuard - Authentication protection for application routes
 *
 * @remarks
 * This component wraps the entire application and enforces authentication
 * on protected routes while allowing access to public auth pages.
 *
 * **Critical**: Public routes (sign-in, sign-up) must be explicitly excluded
 * to prevent infinite redirect loops where AuthGuard tries to redirect to
 * the same auth page the user is already on.
 *
 * **Better Auth Integration**: Uses `authClient.useSession()` which returns
 * `{ data, error, isPending }`. All three states must be handled:
 * - `isPending`: Show loading spinner (only for protected routes)
 * - `error`: Redirect to sign-in
 * - `!session`: Redirect to sign-in (only for protected routes)
 *
 * @see https://www.better-auth.com/docs/concepts/session
 * @see AUTH_GUARD_INFINITE_LOOP_FIX.md for detailed explanation
 *
 * @param children - Child components to render after authentication check
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending, error } = authClient.useSession();

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/sign-in', '/auth/sign-up'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  React.useEffect(() => {
    // Skip authentication for public routes (sign-in, sign-up pages)
    if (isPublicRoute) {
      return;
    }

    // Wait for session to be fetched
    if (isPending) {
      return;
    }

    // Handle authentication errors
    if (error) {
      router.push('/auth/sign-in');
      return;
    }

    // Redirect unauthenticated users to sign-in
    if (!session) {
      router.push('/auth/sign-in');
    }
  }, [session, isPending, error, router, pathname, isPublicRoute]);

  // Show loading state while checking authentication (only for protected routes)
  if (!isPublicRoute && isPending) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting (only for protected routes)
  if (!isPublicRoute && !session) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}
