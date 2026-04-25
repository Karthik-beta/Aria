import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppAccessBoundary } from "@/components/auth/app-access-boundary";
import { AuthStateProvider } from "@/components/auth/auth-state-provider";
import KBar from "@/components/kbar";
import AppSidebar from "@/components/layout/app-sidebar";
import Header from "@/components/layout/header";
import Providers from "@/components/layout/providers";
import ThemeProvider from "@/components/layout/ThemeToggle/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AUTH_CONFIG } from "@/config/auth";
import { getActiveThemeValue } from "@/lib/active-theme.server";
import { requireAppAccess } from "@/lib/auth/app-access";
import { requireProtectedAuthState } from "@/lib/auth/server";
import { SIDEBAR_COOKIE_NAME } from "@/lib/cookies";

export const metadata: Metadata = {
	title: "Inventory by Pivotr",
	description: "Inventory management system from Pivotr",
	icons: {
		icon: "/icons/favicon-inventory.svg",
		shortcut: "/icons/favicon-inventory.svg",
		apple: "/icons/favicon-inventory.svg",
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
		callbackUrl: AUTH_CONFIG.appRedirects.inventory,
	});
	await requireAppAccess("inventory");

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
							<AppSidebar />
							<SidebarInset>
								<Header />
								<AppAccessBoundary appKey="inventory">
									{children}
								</AppAccessBoundary>
							</SidebarInset>
						</SidebarProvider>
					</KBar>
				</AuthStateProvider>
			</Providers>
		</ThemeProvider>
	);
}
