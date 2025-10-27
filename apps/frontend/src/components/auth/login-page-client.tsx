'use client';

import { LoginForm } from '@/components/auth/login-form';

/**
 * LoginPageClient - Client-side login page component
 *
 * Renders the login form in a centered layout. This component is used
 * by the /auth/sign-in page and is excluded from AuthGuard protection.
 */
export default function LoginPageClient() {
  return (
    <div className="min-h-screen flex w-full flex-col items-center justify-center">
      <LoginForm />
    </div>
  );
}
