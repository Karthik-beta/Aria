import type { Metadata } from "next";
import ThemeProvider from "@/components/layout/ThemeToggle/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
	title: "Aria ERP | Authentication",
	description: "Secure authentication for all Aria ERP applications.",
	icons: {
		icon: "/icons/favicon-auth.svg",
		shortcut: "/icons/favicon-auth.svg",
		apple: "/icons/favicon-auth.svg",
	},
};

/**
 * Shared authentication layout for SSO-style auth across all apps.
 * All apps (Asset, CRM, HRMS, Inventory) use the same authentication routes.
 */
export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			enableColorScheme
		>
			{children}
			<Toaster />
		</ThemeProvider>
	);
}
