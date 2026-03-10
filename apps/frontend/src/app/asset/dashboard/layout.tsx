import type { Metadata } from "next";
import KBar from "@/components/kbar";
import AppSidebar from "@/components/layout/app-sidebar";
import Header from "@/components/layout/header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const metadata: Metadata = {
	title: "Asset by Pivotr",
	description: "Asset management system from Pivotr",
};

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const defaultOpen = false;

	return (
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
	);
}
