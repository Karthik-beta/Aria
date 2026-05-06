"use client";

import { useMemo } from "react";
import { useAuthStateContext } from "@/components/auth/auth-state-provider";

/**
 * Hook to access the current user's server-hydrated auth context.
 *
 * Returns role-based checks using the flat role model from better-auth's
 * admin plugin. No permission strings, no per-app access map.
 */
export function useAuth() {
	const authState = useAuthStateContext();

	return useMemo(() => {
		const session = authState?.session ?? null;
		const user = session?.user ?? null;
		const role = user?.role ?? null;
		const isAuthenticated = Boolean(user);
		const isActive = authState?.isActive ?? false;

		const hasRole = (roleKey: string) => role !== null && role === roleKey;
		const hasAnyRole = (...roleKeys: string[]) =>
			role !== null && roleKeys.includes(role);

		return {
			isAuthenticated,
			isActive,
			user,
			role,
			hasRole,
			hasAnyRole,
			isLoading: false,
		};
	}, [authState]);
}
