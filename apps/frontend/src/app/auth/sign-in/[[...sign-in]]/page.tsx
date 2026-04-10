import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginPageClient from "@/components/auth/login-page-client";
import { getAuthRedirectUrl, normalizeCallbackUrl } from "@/config/auth";
import { isDevelopmentAuthBypassEnabled } from "@/lib/auth/development-bypass";
import { getServerSession } from "@/lib/auth/server";

export const metadata: Metadata = {
	title: "Aria ERP | Sign In",
	description:
		"Sign in to access all Aria ERP applications - Asset, CRM, HRMS, and Inventory.",
};

type SignInPageProps = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleSearchParam(
	value: string | string[] | undefined,
): string | null {
	if (typeof value === "string") {
		return value;
	}

	if (Array.isArray(value)) {
		return value[0] ?? null;
	}

	return null;
}

export default async function Page({ searchParams }: SignInPageProps) {
	const resolvedSearchParams = await searchParams;
	const callbackUrl = normalizeCallbackUrl(
		getSingleSearchParam(resolvedSearchParams.callbackUrl),
	);
	const isDevelopmentBypass = isDevelopmentAuthBypassEnabled();
	const session = await getServerSession();

	if (!isDevelopmentBypass && session) {
		if (session.user.mustChangePassword) {
			redirect("/auth/change-password");
		}

		redirect(getAuthRedirectUrl(callbackUrl));
	}

	return <LoginPageClient callbackUrl={callbackUrl} />;
}
