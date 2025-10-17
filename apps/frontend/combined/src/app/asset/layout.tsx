import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Asset Management - Aria ERP',
  description: 'Asset management system from Aria ERP',
};

export default function AssetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
