"use client";

import { useMemo } from "react";
import { useAuthStateContext } from "@/components/auth/auth-state-provider";

/**
 * Hook to access the current user's server-hydrated auth context.
 *
 * Returns role-based checks using the flat role model from better-auth's
 * admin plugin, plus organization-scoped helpers from the organization plugin.
 */
export function useAuth() {
	const authState = useAuthStateContext();

	return useMemo(() => {
		const session = authState?.session ?? null;
		const user = session?.user ?? null;
		const role = user?.role ?? null;
		const isAuthenticated = Boolean(user);
		const isActive = authState?.isActive ?? false;
		const activeOrganization = authState?.activeOrganization ?? null;
		const memberRole = authState?.memberRole ?? null;

		const hasRole = (roleKey: string) => role !== null && role === roleKey;
		const hasAnyRole = (...roleKeys: string[]) =>
			role !== null && roleKeys.includes(role);

		const isOrgAdmin = memberRole === "admin";
		const isOrgOwner = memberRole === "owner";
		const hasOrgAccess = (orgSlug: string) =>
			activeOrganization?.slug === orgSlug;

		return {
			isAuthenticated,
			isActive,
			user,
			role,
			hasRole,
			hasAnyRole,
			isLoading: false,
			activeOrganization,
			memberRole,
			isOrgAdmin,
			isOrgOwner,
			hasOrgAccess,
		};
	}, [authState]);
}
