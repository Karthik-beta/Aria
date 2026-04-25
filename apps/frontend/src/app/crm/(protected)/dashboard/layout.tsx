import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "CRM by Pivotr",
	description: "Customer relationship management system from Pivotr",
};

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
