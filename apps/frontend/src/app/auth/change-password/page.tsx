import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { requireProtectedAuthState } from "@/lib/auth/server";

export const metadata: Metadata = {
	title: "Aria ERP | Change password",
	description: "Update or replace your Aria ERP password.",
};

export default async function ChangePasswordPage() {
	const { session } = await requireProtectedAuthState({
		callbackUrl: "/auth/change-password",
		allowPasswordChangeRoute: true,
	});

	return (
		<div className="flex min-h-screen items-center justify-center bg-muted/10 p-6">
			<ChangePasswordForm
				mustChangePassword={session.user.mustChangePassword === true}
			/>
		</div>
	);
}
