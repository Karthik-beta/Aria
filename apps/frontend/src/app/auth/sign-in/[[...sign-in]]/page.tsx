import type { Metadata } from "next";
import LoginPageClient from "@/components/auth/login-page-client";

export const metadata: Metadata = {
	title: "Aria ERP | Sign In",
	description:
		"Sign in to access all Aria ERP applications - Asset, CRM, HRMS, and Inventory.",
};

export default function Page() {
	return <LoginPageClient />;
}
