import type { Metadata } from "next";
import { AppAccessBoundary } from "@/components/auth/app-access-boundary";
import Providers from "@/components/layout/providers";
import ThemeProvider from "@/components/layout/ThemeToggle/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
	title: "HRMS by Pivotr",
	description: "HR management system from Pivotr",
	icons: {
		icon: "/icons/favicon-hrms.svg",
		shortcut: "/icons/favicon-hrms.svg",
		apple: "/icons/favicon-hrms.svg",
	},
};

export default async function HRMSLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const activeThemeValue = "default";

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
				<AppAccessBoundary appKey="hrms">{children}</AppAccessBoundary>
			</Providers>
		</ThemeProvider>
	);
}
