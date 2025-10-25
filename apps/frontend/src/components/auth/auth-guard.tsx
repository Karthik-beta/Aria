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
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    // Only enforce auth in production
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    // Allow access to login page
    if (pathname === '/login') {
      return;
    }

    // Redirect to login if not authenticated
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router, pathname]);

  // In development or on login page, show children immediately
  if (process.env.NODE_ENV !== 'production' || pathname === '/login') {
    return <>{children}</>;
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
