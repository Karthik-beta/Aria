"use client";

import { useMemo } from "react";
import { useAuthStateContext } from "@/components/auth/auth-state-provider";
import {
	authorizationCanAccessApp,
	authorizationHasAnyPermission,
	authorizationHasAnyRole,
	authorizationHasPermission,
	authorizationHasRole,
	authorizationIsSupervisorOf,
	EMPTY_AUTHORIZATION_DATA,
} from "@/lib/auth/authorization";

/**
 * Hook to access the current user's server-hydrated authorization context.
 *
 * This hook is intentionally context-based so protected layouts can hydrate a
 * single auth state on the server and avoid client-side session or
 * authorization waterfalls during layout rendering.
 */
export function useAuth() {
	const authState = useAuthStateContext();

	return useMemo(() => {
		const session = authState?.session ?? null;
		const authorization = authState?.authorization ?? EMPTY_AUTHORIZATION_DATA;
		const isAuthenticated = Boolean(session?.user);
		const isActive = authorization.isActive;

		const hasPermission = (permissionKey: string) =>
			authorizationHasPermission(authorization, permissionKey);
		const hasAnyPermission = (...permissionKeys: string[]) =>
			authorizationHasAnyPermission(authorization, ...permissionKeys);
		const hasRole = (roleKey: string) =>
			authorizationHasRole(authorization, roleKey);
		const hasAnyRole = (...roleKeys: string[]) =>
			authorizationHasAnyRole(authorization, ...roleKeys);
		const canAccessApp = (appKey: string) =>
			authorizationCanAccessApp(authorization, appKey);
		const isSupervisorOf = (appKey: string) =>
			authorizationIsSupervisorOf(authorization, appKey);

		return {
			isAuthenticated,
			isActive,
			user: session?.user ?? null,
			roles: authorization.roles,
			permissions: authorization.permissions,
			apps: authorization.apps,
			supervisedApps: authorization.supervisedApps,
			hasPermission,
			hasAnyPermission,
			hasRole,
			hasAnyRole,
			canAccessApp,
			isSupervisorOf,
			isLoading: false,
		};
	}, [authState]);
}

/**
 * Hook to check if user has specific permission(s).
 */
export function usePermission(permission: string | string[]): boolean {
	const { hasPermission, hasAnyPermission } = useAuth();

	if (Array.isArray(permission)) {
		return hasAnyPermission(...permission);
	}

	return hasPermission(permission);
}

/**
 * Hook to check if user has specific role(s).
 */
export function useRole(role: string | string[]): boolean {
	const { hasRole, hasAnyRole } = useAuth();

	if (Array.isArray(role)) {
		return hasAnyRole(...role);
	}

	return hasRole(role);
}

/**
 * Hook to check if user can access an app.
 */
export function useAppAccess(appKey: string): boolean {
	const { canAccessApp } = useAuth();
	return canAccessApp(appKey);
}
