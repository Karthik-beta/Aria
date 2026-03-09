import type { Metadata } from "next";
import { cookies } from "next/headers";
import KBar from "@/components/kbar";
import AppSidebar from "@/components/layout/app-sidebar";
import Header from "@/components/layout/header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const metadata: Metadata = {
	title: "HRMS by Pivotr",
	description: "Human resource management system from Pivotr",
};

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// Persisting the sidebar state in the cookie.
	// Use Promise.all for better performance if we need to read multiple cookies
	const cookieStore = await cookies();
	const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

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
