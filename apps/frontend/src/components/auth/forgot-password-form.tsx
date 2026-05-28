"use client";

import { logger } from "@aria/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function ForgotPasswordForm() {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasSentEmail, setHasSentEmail] = useState(false);

	const handleSubmit = async (formData: FormData) => {
		const email = formData.get("email") as string;
		if (!email) {
			toast.error(
				"Please enter the email address associated with your account.",
			);
			return;
		}

		setIsSubmitting(true);

		try {
			const redirectTo =
				typeof window !== "undefined"
					? `${window.location.origin}/auth/reset-password`
					: undefined;
			const { error } = await authClient.requestPasswordReset({
				email,
				...(redirectTo ? { redirectTo } : {}),
			});

			if (error) {
				toast.error(
					error.message || "Password reset failed. Try again in a moment.",
				);
				return;
			}

			toast.success(
				"If that email exists in Aria, you will receive reset instructions shortly.",
			);
			setHasSentEmail(true);
		} catch (cause) {
			logger.error("[ForgotPassword] requestPasswordReset failed", cause);
			toast.error("Something went wrong while requesting the reset link.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card className="w-full max-w-md border border-muted/40 shadow-sm backdrop-blur-sm bg-card/95">
			<CardHeader className="space-y-3">
				<div className="flex items-start gap-3">
					<div className="rounded-md bg-primary/10 p-2 ring-1 ring-primary/20">
						<Icons.lock className="h-5 w-5 text-primary" />
					</div>
					<div className="space-y-1">
						<CardTitle className="text-2xl font-bold tracking-tight">
							Reset your password
						</CardTitle>
						<CardDescription>
							We will send a secure link to your email so you can choose a new
							password.
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<form className="space-y-4" action={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="email">Work email address</Label>
						<Input
							id="email"
							name="email"
							type="email"
							inputMode="email"
							autoComplete="email"
							placeholder="you@company.com"
							defaultValue=""
							disabled={isSubmitting}
							required
						/>
					</div>
					<Button className="w-full" type="submit" disabled={isSubmitting}>
						{isSubmitting && (
							<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
						)}
						Send reset link
					</Button>
				</form>
				<div className="space-y-2 rounded-md border border-muted/40 bg-muted/20 p-3 text-xs text-muted-foreground">
					<p>
						The link expires after 60 minutes. If you do not receive an email,
						check your spam folder or contact the security team.
					</p>
					{hasSentEmail ? (
						<Button
							type="button"
							variant="link"
							className="px-0 text-xs"
							onClick={() => router.push("/auth/sign-in")}
						>
							Return to sign in
						</Button>
					) : (
						<Button
							type="button"
							variant="link"
							className="px-0 text-xs"
							onClick={() => router.push("/auth/sign-in")}
							disabled={isSubmitting}
						>
							Back to sign in
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
