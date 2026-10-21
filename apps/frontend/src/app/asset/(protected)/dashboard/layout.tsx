import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Aria Asset",
	description: "Asset management system in Aria ERP",
};

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
