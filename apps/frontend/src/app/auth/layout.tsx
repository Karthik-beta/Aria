import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aria ERP | Authentication',
  description: 'Secure authentication for all Aria ERP applications.',
};

/**
 * Shared authentication layout for SSO-style auth across all apps.
 * All apps (Asset, CRM, HRMS, Inventory) use the same authentication routes.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
