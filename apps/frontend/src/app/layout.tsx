import { fontVariables } from '@/lib/font';
import { TRPCProvider } from '@/lib/trpc';
import { AuthGuard } from '@/components/auth/auth-guard';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import './globals.css';
import './theme.css';

const META_THEME_COLORS = {
  light: '#E5E4DF',
  dark: '#09090b',
};

export const metadata: Metadata = {
  title: 'Aria ERP Suite',
  description: 'Multi-zone ERP suite for asset management, CRM, HRMS, and inventory',
  icons: {
    icon: '/icons/favicon-default.svg',
    shortcut: '/icons/favicon-default.svg',
    apple: '/icons/favicon-default.svg',
  },
};

export const viewport: Viewport = {
  themeColor: META_THEME_COLORS.light,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read theme cookie on server to render the correct theme class
  const cookieStore = await cookies();
  const activeThemeValue = cookieStore.get('active_theme')?.value || 'default';
  const isScaled = activeThemeValue.endsWith('-scaled');

  // Script to update meta theme-color for dark mode (runs before React hydrates)
  const darkModeScript = `
    try {
      if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '${META_THEME_COLORS.dark}');
      }
    } catch (e) {}
  `;

  // Build className as a static string to ensure identical SSR/client output
  // Using array join instead of cn() for deterministic ordering
  const bodyClasses = [
    'bg-background',
    'overflow-hidden',
    'overscroll-none',
    'font-sans',
    'antialiased',
    `theme-${activeThemeValue}`,
    isScaled ? 'theme-scaled' : '',
    fontVariables,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    // suppressHydrationWarning on <html> only: this is the industry standard
    // for theme handling because browser extensions commonly modify html attributes
    // See: https://nextjs.org/docs/app/building-your-application/styling/css#suppressing-hydration-warnings
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body className={bodyClasses}>
        <TRPCProvider>
          <NextTopLoader color="var(--primary)" showSpinner={false} />
          <NuqsAdapter>
            <AuthGuard>{children}</AuthGuard>
          </NuqsAdapter>
        </TRPCProvider>
      </body>
    </html>
  );
}
