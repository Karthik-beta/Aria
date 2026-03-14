import type { Metadata } from "next";
import AdminLayoutClient from "./admin-layout-client";

export const metadata: Metadata = {
	title: "Aria ERP | Admin",
	description: "Administration console for Aria ERP",
	icons: {
		icon: "/icons/favicon-admin.svg",
		shortcut: "/icons/favicon-admin.svg",
		apple: "/icons/favicon-admin.svg",
	},
};

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
