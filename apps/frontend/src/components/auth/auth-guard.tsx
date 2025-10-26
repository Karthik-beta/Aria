'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

/**
 * Authentication guard component
 *
 * @remarks
 * Redirects to login if user is not authenticated in production.
 * Bypasses check in development environment.
 * 
 * According to Better Auth docs, useSession returns { data, error, isPending }
 * We must handle all three states properly to avoid white screens.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending, error } = authClient.useSession();

  useEffect(() => {
    // Log session state for debugging
    console.log('[AuthGuard] Session state:', {
      isPending,
      hasSession: !!session,
      hasError: !!error,
      pathname,
      nodeEnv: process.env.NODE_ENV,
    });

    // If there's an error fetching session, log it
    if (error) {
      console.error('[AuthGuard] Session fetch error:', error);
    }

    // Normalize pathname (remove trailing slash)
    const normalizedPath = pathname.endsWith('/') && pathname !== '/' 
      ? pathname.slice(0, -1) 
      : pathname;

    // Allow access to login page and debug page
    if (normalizedPath === '/login' || normalizedPath === '/debug') {
      return;
    }

    // If session fetch failed (error) or no session after loading completes
    // redirect to login
    if (!isPending && !session) {
      console.log('[AuthGuard] Redirecting to login - no session');
      router.push('/login');
    }
  }, [session, isPending, error, router, pathname]);

  // Normalize pathname (remove trailing slash)
  const normalizedPath = pathname.endsWith('/') && pathname !== '/' 
    ? pathname.slice(0, -1) 
    : pathname;

  // On login/debug page, show children immediately
  if (normalizedPath === '/login' || normalizedPath === '/debug') {
    return <>{children}</>;
  }

  // Show error state if session fetch failed
  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="text-destructive">
          <p className="text-lg font-semibold">Authentication Error</p>
          <p className="text-sm text-muted-foreground">
            {error.message || 'Failed to verify authentication'}
          </p>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
        >
          Go to Login
        </button>
      </div>
    );
  }

  // Show loading state while checking session
  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Show children if authenticated
  if (session) {
    return <>{children}</>;
  }

  // Show nothing while redirecting
  return null;
}

