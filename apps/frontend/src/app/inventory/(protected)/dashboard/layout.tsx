import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Aria Inventory",
	description: "Inventory management system in Aria ERP",
};

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
