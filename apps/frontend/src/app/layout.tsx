import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AuthGuard } from "@/components/auth/auth-guard";
import { getActiveThemeValue } from "@/lib/active-theme.server";
import { fontVariables } from "@/lib/font";
import { TRPCProvider } from "@/lib/trpc";
import "./globals.css";

const META_THEME_COLORS = {
	light: "#E5E4DF",
	dark: "#09090b",
};

export const metadata: Metadata = {
	title: "Aria ERP Suite",
	description:
		"Multi-zone ERP suite for asset management, CRM, HRMS, and inventory",
	icons: {
		icon: "/icons/favicon-default.svg",
		shortcut: "/icons/favicon-default.svg",
		apple: "/icons/favicon-default.svg",
	},
};

export const viewport: Viewport = {
	themeColor: [
		{
			media: "(prefers-color-scheme: light)",
			color: META_THEME_COLORS.light,
		},
		{
			media: "(prefers-color-scheme: dark)",
			color: META_THEME_COLORS.dark,
		},
	],
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const activeThemeValue = await getActiveThemeValue();
	const isScaled = activeThemeValue.endsWith("-scaled");

	const themeColorSyncScript = `
    try {
      const storedTheme = localStorage.getItem('theme');
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = storedTheme === 'dark' || (storedTheme !== 'light' && systemDark);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', isDark ? '${META_THEME_COLORS.dark}' : '${META_THEME_COLORS.light}');
    } catch {}
  `;

	// Build className as a static string to ensure identical SSR/client output
	// Using array join instead of cn() for deterministic ordering
	const bodyClasses = [
		"bg-background",
		"overflow-hidden",
		"overscroll-none",
		"font-sans",
		"antialiased",
		`theme-${activeThemeValue}`,
		isScaled ? "theme-scaled" : "",
		fontVariables,
	]
		.filter(Boolean)
		.join(" ");

	return (
		// suppressHydrationWarning on <html> only: this is the industry standard
		// for theme handling because browser extensions commonly modify html attributes
		// See: https://nextjs.org/docs/app/building-your-application/styling/css#suppressing-hydration-warnings
		<html lang="en" suppressHydrationWarning>
			<body className={bodyClasses}>
				<Script id="theme-color-sync" strategy="beforeInteractive">
					{themeColorSyncScript}
				</Script>
				<TRPCProvider>
					<AuthGuard>{children}</AuthGuard>
				</TRPCProvider>
			</body>
		</html>
	);
}
