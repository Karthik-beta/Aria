import type { ReactNode } from "react";
import KBar from "@/components/kbar";
import AppSidebar from "@/components/layout/app-sidebar";
import Header from "@/components/layout/header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface AccessDeniedShellProps {
	children: ReactNode;
	defaultOpen?: boolean;
}

export async function AccessDeniedShell({
	children,
	defaultOpen = false,
}: AccessDeniedShellProps) {
	return (
		<KBar>
			<SidebarProvider defaultOpen={defaultOpen}>
				<AppSidebar />
				<SidebarInset>
					<Header />
					{children}
				</SidebarInset>
			</SidebarProvider>
		</KBar>
	);
}
