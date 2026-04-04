import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppAccessBoundary } from "@/components/auth/app-access-boundary";
import KBar from "@/components/kbar";
import AppSidebar from "@/components/layout/app-sidebar";
import Header from "@/components/layout/header";
import Providers from "@/components/layout/providers";
import ThemeProvider from "@/components/layout/ThemeToggle/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { getActiveThemeValue } from "@/lib/active-theme.server";
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

	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			enableColorScheme
		>
			<Providers activeThemeValue={activeThemeValue}>
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
			</Providers>
		</ThemeProvider>
	);
}
