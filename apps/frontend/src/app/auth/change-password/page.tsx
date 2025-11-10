import type { Metadata } from 'next';

import { ChangePasswordForm } from '@/components/auth/change-password-form';

export const metadata: Metadata = {
  title: 'Aria ERP | Change password',
  description: 'Update or replace your Aria ERP password.',
};

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/10 p-6">
      <ChangePasswordForm />
    </div>
  );
}
