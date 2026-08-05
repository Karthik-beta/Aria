import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthStateProvider } from "@/components/auth/auth-state-provider";
import { OrganizationGate } from "@/components/auth/organization-gate";
import KBar from "@/components/kbar";
import AppSidebar from "@/components/layout/app-sidebar";
import Header from "@/components/layout/header";
import Providers from "@/components/layout/providers";
import ThemeProvider from "@/components/layout/ThemeToggle/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AUTH_CONFIG } from "@/config/auth";
import { getActiveThemeValue } from "@/lib/active-theme.server";
import { requireProtectedAuthState } from "@/lib/auth/server";
import { SIDEBAR_COOKIE_NAME } from "@/lib/cookies";

export const metadata: Metadata = {
	title: "CRM by Pivotr",
	description: "Customer relationship management system from Pivotr",
	icons: {
		icon: "/icons/favicon-crm.svg",
		shortcut: "/icons/favicon-crm.svg",
		apple: "/icons/favicon-crm.svg",
	},
};

export default async function ProtectedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const cookieStore = await cookies();
	const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
	const defaultOpen = sidebarCookie !== "false";
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
					<KBar>
						<SidebarProvider defaultOpen={defaultOpen}>
							<AppSidebar activeAppKey="crm" />
							<SidebarInset>
								<Header />
								<OrganizationGate orgSlug="crm">{children}</OrganizationGate>
							</SidebarInset>
						</SidebarProvider>
					</KBar>
				</AuthStateProvider>
			</Providers>
		</ThemeProvider>
	);
}
