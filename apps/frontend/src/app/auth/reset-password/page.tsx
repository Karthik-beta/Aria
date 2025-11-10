import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Aria ERP | Reset password',
  description: 'Choose a new password to secure your Aria ERP account.',
};

type ResetPasswordPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const tokenParam = searchParams?.token;
  const errorParam = searchParams?.error;

  const normalize = (value: string | string[] | undefined) => {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }
    return null;
  };

  const token = normalize(tokenParam);
  const error = normalize(errorParam);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/10 p-6">
      <ResetPasswordForm token={token} error={error} />
    </div>
  );
}
