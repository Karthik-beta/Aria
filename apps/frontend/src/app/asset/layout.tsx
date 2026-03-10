import type { Metadata } from "next";
import { AppAccessBoundary } from "@/components/auth/app-access-boundary";
import Providers from "@/components/layout/providers";
import ThemeProvider from "@/components/layout/ThemeToggle/theme-provider";
import { Toaster } from "@/components/ui/sonner";

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
				<AppAccessBoundary appKey="asset">{children}</AppAccessBoundary>
			</Providers>
		</ThemeProvider>
	);
}
