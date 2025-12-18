import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import ThemeProvider from '@/components/layout/ThemeToggle/theme-provider';
import { AppAccessBoundary } from '@/components/auth/app-access-boundary';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export const metadata: Metadata = {
  title: 'Inventory by Pivotr',
  description: 'Inventory management system from Pivotr',
  icons: {
    icon: '/icons/favicon-inventory.svg',
    shortcut: '/icons/favicon-inventory.svg',
    apple: '/icons/favicon-inventory.svg',
  },
};

export default async function InventoryLayout({ children }: { children: React.ReactNode }) {
  // Persisting the sidebar state in the cookie.
  // Use Promise.all for better performance if we need to read multiple cookies
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar_state')?.value === 'true';
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
        <AppAccessBoundary appKey="inventory">
          <KBar>
            <SidebarProvider defaultOpen={defaultOpen}>
              <AppSidebar />
              <SidebarInset>
                <Header />
                {/* page main content */}
                {children}
                {/* page main content ends */}
              </SidebarInset>
            </SidebarProvider>
          </KBar>
        </AppAccessBoundary>
      </Providers>
    </ThemeProvider>
  );
}
