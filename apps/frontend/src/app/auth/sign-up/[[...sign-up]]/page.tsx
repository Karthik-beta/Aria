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
	const isDevelopmentBypass =
		process.env.NODE_ENV === "development" &&
		process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
	const session = await getServerSession();

	if (!isDevelopmentBypass && session) {
		if (session.user.mustChangePassword) {
			redirect("/auth/change-password");
		}

		redirect(getAuthRedirectUrl(null));
	}

	let stars = 3000; // Default value

	try {
		const response = await fetch(
			"https://api.github.com/repos/kiranism/next-shadcn-dashboard-starter",
			{
				next: { revalidate: 86400 },
			},
		);

		if (response.ok) {
			const data = await response.json();
			stars = data.stargazers_count || stars; // Update stars if API response is valid
		}
	} catch {
		// Error fetching GitHub stars, using default value
	}
	return <SignUpViewPage stars={stars} />;
}
