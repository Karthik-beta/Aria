import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthRedirectUrl } from "@/config/auth";
import SignUpViewPage from "@/features/auth/components/sign-up-view";
import { getServerSession } from "@/lib/auth/server";

export const metadata: Metadata = {
	title: "Aria ERP | Sign Up",
	description:
		"Create an account to access all Aria ERP applications - Asset, CRM, HRMS, and Inventory.",
};

export default async function Page() {
	const session = await getServerSession();

	if (session) {
		if (session.user.mustChangePassword) {
			redirect("/auth/change-password");
		}

		redirect(getAuthRedirectUrl(null));
	}

	return <SignUpViewPage />;
}
