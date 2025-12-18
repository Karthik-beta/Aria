import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import ThemeProvider from '@/components/layout/ThemeToggle/theme-provider';
import { AppAccessBoundary } from '@/components/auth/app-access-boundary';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: 'Asset by Pivotr',
  description: 'Asset management system from Pivotr',
  icons: {
    icon: '/icons/favicon-asset.svg',
    shortcut: '/icons/favicon-asset.svg',
    apple: '/icons/favicon-asset.svg',
  },
};

export default async function AssetLayout({ children }: { children: React.ReactNode }) {
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
        <AppAccessBoundary appKey="asset">{children}</AppAccessBoundary>
      </Providers>
    </ThemeProvider>
  );
}
