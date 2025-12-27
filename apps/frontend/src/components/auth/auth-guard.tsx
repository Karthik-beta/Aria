'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

/**
 * AuthGuard - Authentication protection for application routes
 *
 * This component wraps the entire application and enforces authentication
 * on protected routes while allowing access to public auth pages.
 *
 * Public routes (sign-in, sign-up) must be explicitly excluded to prevent
 * infinite redirect loops where AuthGuard tries to redirect to the same auth
 * page the user is already on.
 *
 * Uses `authClient.useSession()` which returns `{ data, error, isPending }`.
 * All three states are handled:
 * - `isPending`: Show loading spinner (only for protected routes)
 * - `error`: Redirect to sign-in
 * - `!session`: Redirect to sign-in (only for protected routes)
 *
 * @param children - Child components to render after authentication check
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending, error } = authClient.useSession();

  // Development mode bypass - skip authentication for testing
  const isDevelopmentBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';

  // Public routes that don't require authentication
  const publicRoutes = [
    '/auth/sign-in',
    '/auth/sign-up',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isChangePasswordRoute = pathname.startsWith('/auth/change-password');

  const mustChangePassword = Boolean(
    session?.user &&
    typeof session.user === 'object' &&
    'mustChangePassword' in session.user &&
    (session.user as Record<string, unknown>).mustChangePassword
  );

  // useEffect MUST be called unconditionally (before any early returns)
  // to satisfy React's Rules of Hooks - hooks cannot be called after conditional returns
  React.useEffect(() => {
    // Skip all authentication logic if development bypass is enabled
    if (isDevelopmentBypass) {
      return;
    }

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
      return;
    }

    if (mustChangePassword && !isChangePasswordRoute) {
      router.push('/auth/change-password');
    }
  }, [
    session,
    isPending,
    error,
    router,
    pathname,
    isPublicRoute,
    mustChangePassword,
    isChangePasswordRoute,
    isDevelopmentBypass,
  ]);

  // If dev bypass is enabled, render children immediately
  if (isDevelopmentBypass) {
    return <>{children}</>;
  }

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

  if (mustChangePassword && !isPublicRoute && !isChangePasswordRoute) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}
