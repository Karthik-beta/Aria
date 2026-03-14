import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Inventory by Pivotr",
	description: "Inventory management system from Pivotr",
};

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
