import type { Metadata } from "next";
import { AppAccessBoundary } from "@/components/auth/app-access-boundary";
import { AuthStateProvider } from "@/components/auth/auth-state-provider";
import Providers from "@/components/layout/providers";
import ThemeProvider from "@/components/layout/ThemeToggle/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AUTH_CONFIG } from "@/config/auth";
import { getActiveThemeValue } from "@/lib/active-theme.server";
import { requireProtectedAuthState } from "@/lib/auth/server";

export const metadata: Metadata = {
	title: "HRMS by Pivotr",
	description: "HR management system from Pivotr",
	icons: {
		icon: "/icons/favicon-hrms.svg",
		shortcut: "/icons/favicon-hrms.svg",
		apple: "/icons/favicon-hrms.svg",
	},
};

export default async function HRMSLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const activeThemeValue = await getActiveThemeValue();
	const authState = await requireProtectedAuthState({
		callbackUrl: AUTH_CONFIG.appRedirects.hrms,
	});

	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			enableColorScheme
		>
			<Providers activeThemeValue={activeThemeValue}>
				<AuthStateProvider value={authState}>
					<Toaster />
					<AppAccessBoundary appKey="hrms">{children}</AppAccessBoundary>
				</AuthStateProvider>
			</Providers>
		</ThemeProvider>
	);
}
