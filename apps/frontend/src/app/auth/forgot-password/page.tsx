import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
	title: "Aria ERP | Forgot password",
	description: "Request a secure reset link for your Aria ERP account.",
};

export default function ForgotPasswordPage() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-muted/10 p-6">
			<ForgotPasswordForm />
		</div>
	);
}
