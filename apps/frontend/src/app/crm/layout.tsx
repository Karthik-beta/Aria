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
	title: "CRM by Pivotr",
	description: "Customer relationship management system from Pivotr",
	icons: {
		icon: "/icons/favicon-crm.svg",
		shortcut: "/icons/favicon-crm.svg",
		apple: "/icons/favicon-crm.svg",
	},
};

export default async function CrmLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const activeThemeValue = await getActiveThemeValue();
	const authState = await requireProtectedAuthState({
		callbackUrl: AUTH_CONFIG.appRedirects.crm,
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
					<AppAccessBoundary appKey="crm">{children}</AppAccessBoundary>
				</AuthStateProvider>
			</Providers>
		</ThemeProvider>
	);
}
