"use client";

import { IconKey, IconShieldCheck, IconUser } from "@tabler/icons-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import type { AuthSessionUser } from "@/lib/auth/types";

/** Human-readable display names for each application key. */
const APP_DISPLAY_NAMES: Record<string, string> = {
	inventory: "Inventory",
	asset: "Asset Management",
	crm: "CRM",
	hrms: "HRMS",
};

/**
 * Derives up to two uppercase initials from a display name.
 *
 * @param name - Full display name of the user.
 * @returns One or two uppercase characters suitable for an avatar fallback.
 */
export function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.filter(Boolean)
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

/**
 * ProfileViewPage — universal user profile display.
 *
 * Renders three sections:
 * 1. **Personal Information** – avatar, name, username, and email with
 *    an email-verification badge.
 * 2. **Account Security** – a shortcut to the change-password flow.
 * 3. **Roles & App Access** – global system roles and per-app role badges
 *    derived from the server-hydrated auth context.
 *
 * Client component: reads auth state from context via `useAuth`.
 */
export default function ProfileViewPage() {
	const { user, roles, apps, supervisedApps } = useAuth();
	// Cast to the canonical session user type; the dev-bypass inline shape is a
	// structural subset of AuthSessionUser.
	const sessionUser = user as AuthSessionUser | null;

	const name = sessionUser?.name ?? "User";
	const email = sessionUser?.email ?? "";
	const username = sessionUser?.username ?? null;
	const emailVerified = sessionUser?.emailVerified ?? false;
	const initials = getInitials(name);
	const accessibleApps = Object.entries(apps);

	return (
		<div className="flex w-full flex-col gap-6 p-4 md:p-6">
			<div>
				<h2 className="text-2xl font-semibold tracking-tight">My Profile</h2>
				<p className="text-muted-foreground text-sm">
					View and manage your account details, security settings, and app
					access.
				</p>
			</div>

			{/* ── Personal Information ─────────────────────────────────────── */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<IconUser className="size-4" aria-hidden="true" />
						Personal Information
					</CardTitle>
					<CardDescription>
						Your account identity and contact details.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="mb-4 flex items-center gap-4">
						<Avatar className="h-16 w-16">
							<AvatarFallback className="text-lg font-semibold">
								{initials}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="text-lg font-semibold">{name}</p>
							{username && (
								<p className="text-muted-foreground text-sm">@{username}</p>
							)}
						</div>
					</div>

					<Separator className="my-4" />

					<div className="grid gap-3 sm:grid-cols-2">
						<div>
							<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
								Email
							</p>
							<div className="mt-1 flex items-center gap-2">
								<p className="truncate text-sm" title={email}>
									{email || "—"}
								</p>
								{email && emailVerified && (
									<Badge
										variant="outline"
										className="shrink-0 border-green-300 text-xs text-green-600"
									>
										Verified
									</Badge>
								)}
								{email && !emailVerified && (
									<Badge
										variant="outline"
										className="shrink-0 border-amber-300 text-xs text-amber-600"
									>
										Unverified
									</Badge>
								)}
							</div>
						</div>
						{username && (
							<div>
								<p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
									Username
								</p>
								<p className="mt-1 text-sm">{username}</p>
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{/* ── Account Security ─────────────────────────────────────────── */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<IconKey className="size-4" aria-hidden="true" />
						Account Security
					</CardTitle>
					<CardDescription>
						Manage your password and security settings.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex items-center justify-between gap-4">
						<div>
							<p className="text-sm font-medium">Password</p>
							<p className="text-muted-foreground text-xs">
								Keep your account secure by using a strong, unique password.
							</p>
						</div>
						<Button variant="outline" size="sm" asChild>
							<Link href="/auth/change-password">Change Password</Link>
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* ── Roles & App Access ───────────────────────────────────────── */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base">
						<IconShieldCheck className="size-4" aria-hidden="true" />
						Roles &amp; App Access
					</CardTitle>
					<CardDescription>
						Your assigned system roles and application permissions.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{roles.length > 0 && (
						<div>
							<p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
								System Roles
							</p>
							<div className="flex flex-wrap gap-2">
								{roles.map((role) => (
									<Badge key={role} variant="secondary">
										{role.replace(/_/g, " ")}
									</Badge>
								))}
							</div>
						</div>
					)}

					{accessibleApps.length > 0 && (
						<div className={roles.length > 0 ? "mt-4" : undefined}>
							{roles.length > 0 && <Separator className="mb-4" />}
							<p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
								Application Access
							</p>
							<div className="grid gap-3 sm:grid-cols-2">
								{accessibleApps.map(([appKey, appAccess]) => (
									<div
										key={appKey}
										className="flex items-start gap-3 rounded-lg border p-3"
										data-testid={`app-access-${appKey}`}
									>
										<div className="flex-1">
											<p className="text-sm font-medium">
												{APP_DISPLAY_NAMES[appKey] ?? appKey}
											</p>
											<div className="mt-1 flex flex-wrap gap-1">
												{appAccess.roles.map((r) => (
													<Badge key={r} variant="outline" className="text-xs">
														{r}
													</Badge>
												))}
											</div>
										</div>
										{supervisedApps.includes(appKey) && (
											<Badge className="shrink-0 text-xs">Supervisor</Badge>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{accessibleApps.length === 0 && roles.length === 0 && (
						<p className="text-muted-foreground text-sm">
							No roles or app access assigned.
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
