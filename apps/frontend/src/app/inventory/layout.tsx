import type { Metadata } from "next";
import { AppAccessBoundary } from "@/components/auth/app-access-boundary";
import KBar from "@/components/kbar";
import AppSidebar from "@/components/layout/app-sidebar";
import Header from "@/components/layout/header";
import Providers from "@/components/layout/providers";
import ThemeProvider from "@/components/layout/ThemeToggle/theme-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { getActiveThemeValue } from "@/lib/active-theme.server";

export const metadata: Metadata = {
	title: "Inventory by Pivotr",
	description: "Inventory management system from Pivotr",
	icons: {
		icon: "/icons/favicon-inventory.svg",
		shortcut: "/icons/favicon-inventory.svg",
		apple: "/icons/favicon-inventory.svg",
	},
};

export default async function InventoryLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const defaultOpen = false;
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
