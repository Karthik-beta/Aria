import { cookies } from "next/headers";
import { AuthStateProvider } from "@/components/auth/auth-state-provider";
import { AccessDeniedShell } from "@/components/layout/access-denied-shell";
import Providers from "@/components/layout/providers";
import ThemeProvider from "@/components/layout/ThemeToggle/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AUTH_CONFIG } from "@/config/auth";
import { getActiveThemeValue } from "@/lib/active-theme.server";
import { requireProtectedAuthState } from "@/lib/auth/server";
import { SIDEBAR_COOKIE_NAME } from "@/lib/cookies";

export default async function AccessDeniedLayout({
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
					<AccessDeniedShell defaultOpen={defaultOpen}>
						{children}
					</AccessDeniedShell>
				</AuthStateProvider>
			</Providers>
		</ThemeProvider>
	);
}
