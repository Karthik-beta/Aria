import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppAccessBoundary } from "@/components/auth/app-access-boundary";
import { AuthorizationProvider } from "@/components/auth/authorization-provider";
import KBar from "@/components/kbar";
import AppSidebar from "@/components/layout/app-sidebar";
import Header from "@/components/layout/header";
import Providers from "@/components/layout/providers";
import ThemeProvider from "@/components/layout/ThemeToggle/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { getActiveThemeValue } from "@/lib/active-theme.server";
import { getAuthorizationData } from "@/lib/auth/server";
import { SIDEBAR_COOKIE_NAME } from "@/lib/cookies";

export const metadata: Metadata = {
	title: "Asset by Pivotr",
	description: "Asset management system from Pivotr",
	icons: {
		icon: "/icons/favicon-asset.svg",
		shortcut: "/icons/favicon-asset.svg",
		apple: "/icons/favicon-asset.svg",
	},
};

export default async function AssetLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const cookieStore = await cookies();
	const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
	const defaultOpen = sidebarCookie === "true";
	const activeThemeValue = await getActiveThemeValue();
	const authorization = await getAuthorizationData();

	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			enableColorScheme
		>
			<Providers activeThemeValue={activeThemeValue}>
				<AuthorizationProvider value={authorization}>
					<Toaster />
					<AppAccessBoundary appKey="asset">
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
				</AuthorizationProvider>
			</Providers>
		</ThemeProvider>
	);
}
