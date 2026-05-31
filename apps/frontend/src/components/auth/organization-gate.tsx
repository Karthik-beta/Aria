"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useAuthStateContext } from "@/components/auth/auth-state-provider";
import { authClient } from "@/lib/auth/client";

interface OrganizationGateProps {
	children: ReactNode;
	orgSlug: string;
	requiredRole?: "owner" | "admin" | "member";
	fallback?: ReactNode;
}

/**
 * Renders children only when the current user is a member of the specified
 * organization and optionally has the required role.
 *
 * Super admins bypass organization membership checks entirely, mirroring the
 * backend tRPC behaviour (trpc/trpc.ts).
 *
 * Uses the reactive useListOrganizations hook for efficient membership checks.
 */
export function OrganizationGate({
	orgSlug,
	requiredRole,
	children,
	fallback,
}: OrganizationGateProps) {
	const authState = useAuthStateContext();
	const { data: orgs, isPending } = authClient.useListOrganizations();

	// Super admins have unrestricted cross-app access — skip org-gate checks.
	const role = authState?.session?.user?.role ?? null;
	if (role === "super_admin") {
		return <>{children}</>;
	}

	if (isPending) {
		return (
			<div className="flex min-h-[200px] items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const targetOrg = orgs?.find((org) => org.slug === orgSlug);
	if (!targetOrg) {
		if (fallback) return <>{fallback}</>;
		return <MembershipDenied />;
	}

	if (requiredRole) {
		const member = (targetOrg as Record<string, unknown>).members as
			| Array<{ role: string }>
			| undefined;
		const hasRole = member?.some((m) => m.role === requiredRole);
		if (!hasRole) {
			if (fallback) return <>{fallback}</>;
			return <MembershipDenied />;
		}
	}

	return <>{children}</>;
}

function MembershipDenied() {
	return (
		<div className="flex min-h-[calc(100dvh-4rem)] flex-1 items-center justify-center p-6">
			<div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
				<h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
				<p className="mt-3 text-sm text-muted-foreground">
					You do not have access to this app workspace. Please contact your
					administrator for membership.
				</p>
				<a
					href="/"
					className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
				>
					Return to Home
				</a>
			</div>
		</div>
	);
}
