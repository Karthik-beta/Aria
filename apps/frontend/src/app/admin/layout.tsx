import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AuthStateProvider } from "@/components/auth/auth-state-provider";
import { RoleGate } from "@/components/auth/protected-content";
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
	title: "Aria ERP | Admin",
	description: "Administration console for Aria ERP",
	icons: {
		icon: "/icons/favicon-admin.svg",
		shortcut: "/icons/favicon-admin.svg",
		apple: "/icons/favicon-admin.svg",
	},
};

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const cookieStore = await cookies();
	const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
	const defaultOpen = sidebarCookie !== "false";
	const activeThemeValue = await getActiveThemeValue();
	const authState = await requireProtectedAuthState({
		callbackUrl: AUTH_CONFIG.appRedirects.admin,
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
						<RoleGate
							role={["admin", "super_admin"]}
							fallback={<AdminAccessDenied />}
						>
							<SidebarProvider defaultOpen={defaultOpen}>
								<AppSidebar />
								<SidebarInset>
									<Header />
									{children}
								</SidebarInset>
							</SidebarProvider>
						</RoleGate>
					</KBar>
				</AuthStateProvider>
			</Providers>
		</ThemeProvider>
	);
}

function AdminAccessDenied() {
	return (
		<div className="flex min-h-[calc(100dvh-4rem)] flex-1 items-center justify-center p-6">
			<div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
				<h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
				<p className="mt-3 text-sm text-muted-foreground">
					You do not have permission to access the admin console.
				</p>
				<a
					href="/"
					className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Return to Home
				</a>
			</div>
		</div>
	);
}
