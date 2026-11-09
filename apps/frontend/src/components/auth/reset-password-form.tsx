"use client";

import { logger } from "@aria/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Icons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { getToastMessage } from "@/lib/errors";

interface ResetPasswordFormProps {
	token: string | null;
	error: string | null;
}

export function ResetPasswordForm({ token, error }: ResetPasswordFormProps) {
	const router = useRouter();
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	if (error || !token) {
		return (
			<Card className="w-full max-w-md border border-destructive/40 bg-destructive/5 backdrop-blur-sm">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-destructive">
						<Icons.warning className="h-5 w-5" />
						Unable to reset password
					</CardTitle>
					<CardDescription className="text-destructive/80">
						{error === "INVALID_TOKEN"
							? "This reset link is invalid or has expired."
							: "We could not validate this password reset link."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert variant="destructive">
						<AlertTitle>Request a new reset link</AlertTitle>
						<AlertDescription>
							For security we only allow each link to be used once. Please
							request another link and try again.
						</AlertDescription>
					</Alert>
					<Button
						type="button"
						variant="secondary"
						onClick={() => router.push("/auth/forgot-password")}
					>
						Back to reset request
					</Button>
				</CardContent>
			</Card>
		);
	}

	const handleSubmit = async (formData: FormData) => {
		const newPwd = formData.get("newPassword") as string;
		const confirmPwd = formData.get("confirmPassword") as string;

		if (!token) {
			toast.error("Reset token missing. Request a new link.");
			return;
		}

		if (!newPwd || !confirmPwd) {
			toast.error("Enter and confirm your new password.");
			return;
		}

		if (newPwd !== confirmPwd) {
			toast.error("Passwords do not match.");
			return;
		}

		setIsSubmitting(true);

		try {
			const { error: resetError } = await authClient.resetPassword({
				token,
				newPassword: newPwd,
			});

			if (resetError) {
				toast.error(getToastMessage(resetError, "update"));
				return;
			}

			toast.success(
				"Password updated. You can now sign in with your new credentials.",
			);
			router.push("/auth/sign-in");
		} catch (cause) {
			logger.error("[ResetPassword] resetPassword failed", cause);
			toast.error("An unexpected error occurred.");
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
							Choose a new password
						</CardTitle>
						<CardDescription>
							Strong passwords protect access to Aria. Use at least 12
							characters with letters, numbers, and symbols.
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<form className="space-y-4" action={handleSubmit}>
					<div className="space-y-2">
						<Label htmlFor="new-password">New password</Label>
						<div className="relative">
							<Input
								id="new-password"
								name="newPassword"
								type={showPassword ? "text" : "password"}
								autoComplete="new-password"
								defaultValue=""
								disabled={isSubmitting}
								minLength={8}
								required
							/>
							<button
								type="button"
								className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground transition-colors"
								onClick={() => setShowPassword((previous) => !previous)}
								disabled={isSubmitting}
							>
								{showPassword ? (
									<Icons.eyeOff className="h-4 w-4" />
								) : (
									<Icons.eye className="h-4 w-4" />
								)}
								<span className="sr-only">Toggle password visibility</span>
							</button>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="confirm-password">Confirm new password</Label>
						<Input
							id="confirm-password"
							name="confirmPassword"
							type="password"
							autoComplete="new-password"
							defaultValue=""
							disabled={isSubmitting}
							minLength={8}
							required
						/>
					</div>
					<Button className="w-full" type="submit" disabled={isSubmitting}>
						{isSubmitting && (
							<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
						)}
						Update password
					</Button>
					<Button
						type="button"
						variant="link"
						className="w-full"
						onClick={() => router.push("/auth/sign-in")}
						disabled={isSubmitting}
					>
						Return to sign in
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
