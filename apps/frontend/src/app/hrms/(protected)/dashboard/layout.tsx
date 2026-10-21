import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Aria HRMS",
	description: "Human resource management system in Aria ERP",
};

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
