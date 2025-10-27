'use client';

import React, { useEffect } from 'react';
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

  React.useEffect(() => {
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
  }, [session, isPending, error, router, pathname]);

  // Show loading state while checking authentication
  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (!session) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}
