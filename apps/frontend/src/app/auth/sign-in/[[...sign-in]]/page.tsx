import { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: 'Aria ERP | Sign In',
  description: 'Sign in to access all Aria ERP applications - Asset, CRM, HRMS, and Inventory.',
};

export default function Page() {
  return <SignInViewPage />;
}
