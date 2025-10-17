import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CRM - Aria ERP',
  description: 'Customer relationship management system from Aria ERP',
};

export default function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
