import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import ThemeProvider from '@/components/layout/ThemeToggle/theme-provider';
import { AppAccessBoundary } from '@/components/auth/app-access-boundary';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'HRMS by Pivotr',
  description: 'HR management system from Pivotr',
  icons: {
    icon: '/icons/favicon-hrms.svg',
    shortcut: '/icons/favicon-hrms.svg',
    apple: '/icons/favicon-hrms.svg',
  },
};

export default async function HRMSLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const activeThemeValue = cookieStore.get('active_theme')?.value || 'default';

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
        <AppAccessBoundary appKey="hrms">{children}</AppAccessBoundary>
      </Providers>
    </ThemeProvider>
  );
}
