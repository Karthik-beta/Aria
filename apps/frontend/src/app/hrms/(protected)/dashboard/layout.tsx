import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "HRMS by Pivotr",
	description: "Human resource management system from Pivotr",
};

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
