import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HRMS - Aria ERP',
  description: 'Human resource management system from Aria ERP',
};

export default function HrmsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
