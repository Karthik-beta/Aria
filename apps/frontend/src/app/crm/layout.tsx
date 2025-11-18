import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import ThemeProvider from '@/components/layout/ThemeToggle/theme-provider';
import { AppAccessBoundary } from '@/components/auth/app-access-boundary';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'CRM by Pivotr',
  description: 'Customer relationship management system from Pivotr',
};

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const activeThemeValue = cookieStore.get('active_theme')?.value;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <Providers activeThemeValue={activeThemeValue as string}>
        <Toaster />
        <AppAccessBoundary appKey="crm">{children}</AppAccessBoundary>
      </Providers>
    </ThemeProvider>
  );
}
