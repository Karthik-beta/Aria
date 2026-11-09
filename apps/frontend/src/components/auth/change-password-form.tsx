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
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth/client";
import { getToastMessage } from "@/lib/errors";
import { trpc } from "@/lib/trpc";

export function ChangePasswordForm({
	mustChangePassword,
}: {
	mustChangePassword: boolean;
}) {
	const router = useRouter();
	const markPasswordUpdated = trpc.account.markPasswordUpdated.useMutation();

	const [showCurrentPassword, setShowCurrentPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (formData: FormData) => {
		const currentPwd = formData.get("currentPassword") as string;
		const newPwd = formData.get("newPassword") as string;
		const confirmPwd = formData.get("confirmPassword") as string;

		if (!currentPwd || !newPwd || !confirmPwd) {
			toast.error("Please complete all password fields.");
			return;
		}

		if (newPwd.length < 8) {
			toast.error("New password must be at least 8 characters long.");
			return;
		}

		if (newPwd !== confirmPwd) {
			toast.error("New passwords do not match.");
			return;
		}

		if (currentPwd === newPwd) {
			toast.error("Choose a new password that differs from the current one.");
			return;
		}

		setIsSubmitting(true);

		try {
			const { data, error } = await authClient.changePassword({
				currentPassword: currentPwd,
				newPassword: newPwd,
				revokeOtherSessions,
			});

			if (error) {
				toast.error(getToastMessage(error, "update"));
				return;
			}

			await markPasswordUpdated.mutateAsync();
			authClient.$store.notify("$sessionSignal");
			router.refresh();

			toast.success("Password updated successfully.");

			if (revokeOtherSessions && data?.token) {
				toast.info(
					"Other sessions were revoked. Please sign in again if prompted.",
				);
			}

			if (mustChangePassword) {
				router.push("/");
			}
		} catch (cause) {
			logger.error("[ChangePassword] changePassword failed", cause);
			toast.error("An unexpected error occurred while changing your password.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Card className="w-full max-w-2xl border border-muted/40 bg-card/95 shadow-sm backdrop-blur-sm">
			<CardHeader className="space-y-3">
				<div className="flex items-start gap-3">
					<div className="rounded-md bg-primary/10 p-2 ring-1 ring-primary/20">
						<Icons.lock className="h-5 w-5 text-primary" />
					</div>
					<div className="space-y-1">
						<CardTitle className="text-2xl font-bold tracking-tight">
							Update password
						</CardTitle>
						<CardDescription>
							{mustChangePassword
								? "You are using a temporary password. Choose a permanent password to continue."
								: "Regular password updates help keep your workspace secure."}
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{mustChangePassword && (
					<Alert>
						<AlertTitle>Action required</AlertTitle>
						<AlertDescription>
							This account is flagged for a mandatory password change. Access to
							protected apps remains limited until you finish this update.
						</AlertDescription>
					</Alert>
				)}
				<form className="space-y-6" action={handleSubmit}>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="current-password">Current password</Label>
							<div className="relative">
								<Input
									id="current-password"
									name="currentPassword"
									type={showCurrentPassword ? "text" : "password"}
									autoComplete="current-password"
									defaultValue=""
									disabled={isSubmitting}
									required
								/>
								<button
									type="button"
									className="absolute inset-y-0 right-2 flex items-center text-muted-foreground transition-colors hover:text-foreground"
									onClick={() =>
										setShowCurrentPassword((previous) => !previous)
									}
									disabled={isSubmitting}
								>
									{showCurrentPassword ? (
										<Icons.eyeOff className="h-4 w-4" />
									) : (
										<Icons.eye className="h-4 w-4" />
									)}
									<span className="sr-only">
										Toggle current password visibility
									</span>
								</button>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="new-password">New password</Label>
							<div className="relative">
								<Input
									id="new-password"
									name="newPassword"
									type={showNewPassword ? "text" : "password"}
									autoComplete="new-password"
									defaultValue=""
									disabled={isSubmitting}
									minLength={8}
									required
								/>
								<button
									type="button"
									className="absolute inset-y-0 right-2 flex items-center text-muted-foreground transition-colors hover:text-foreground"
									onClick={() => setShowNewPassword((previous) => !previous)}
									disabled={isSubmitting}
								>
									{showNewPassword ? (
										<Icons.eyeOff className="h-4 w-4" />
									) : (
										<Icons.eye className="h-4 w-4" />
									)}
									<span className="sr-only">
										Toggle new password visibility
									</span>
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
					</div>
					<div className="flex items-center justify-between gap-4 rounded-md border border-muted/40 bg-muted/10 p-4 text-sm">
						<div>
							<p className="font-medium">Revoke sessions on other devices</p>
							<p className="text-xs text-muted-foreground">
								Sign out active sessions elsewhere once this password changes.
							</p>
						</div>
						<Switch
							id="revoke-sessions"
							checked={revokeOtherSessions}
							onCheckedChange={setRevokeOtherSessions}
							disabled={isSubmitting}
						/>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
						<Button type="submit" disabled={isSubmitting} className="sm:w-48">
							{isSubmitting && (
								<Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
							)}
							Save new password
						</Button>
						<Button
							type="button"
							variant="link"
							className="text-muted-foreground"
							onClick={() => router.push("/")}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
