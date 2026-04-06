"use client";

import { logger } from "@aria/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthorizationContext } from "@/components/auth/authorization-provider";
import type { AuthorizationData } from "@/lib/auth/authorization";
import { useSession } from "@/lib/auth-client";

/**
 * Hook to access the current user's authorization context
 *
 * Provides permission/role checking utilities and authorization data.
 */
export function useAuth() {
	const { data: session, isPending } = useSession();
	const serverAuthorization = useAuthorizationContext();
	const hasServerAuthorization = serverAuthorization !== null;
	const [authorizationData, setAuthorizationData] =
		useState<AuthorizationData | null>(serverAuthorization);
	const [authorizationStatus, setAuthorizationStatus] = useState<
		"idle" | "loading" | "resolved"
	>(hasServerAuthorization ? "resolved" : "idle");
	const isMountedRef = useRef(false);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// Development mode bypass - skip authentication for testing
	const isDevelopmentBypass =
		process.env.NODE_ENV === "development" &&
		process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

	useEffect(() => {
		if (hasServerAuthorization) {
			setAuthorizationData(serverAuthorization);
			setAuthorizationStatus("resolved");
			return;
		}

		if (!session?.user?.id) {
			setAuthorizationData(null);
			setAuthorizationStatus("idle");
			return;
		}

		const abortController = new AbortController();
		setAuthorizationStatus("loading");

		if (isDevelopmentBypass) {
			setAuthorizationData({
				roles: ["super_admin"],
				permissions: ["system:*"],
				apps: {
					inventory: { roles: ["admin"] },
					asset: { roles: ["admin"] },
					crm: { roles: ["admin"] },
					hrms: { roles: ["admin"] },
				},
				supervisedApps: ["inventory", "asset", "crm", "hrms"],
				isActive: true,
			});
			setAuthorizationStatus("resolved");
			return;
		}

		fetch("/api/auth/authorization", {
			signal: abortController.signal,
		})
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Authorization fetch failed: ${response.status}`);
				}
				return response.json();
			})
			.then((data: AuthorizationData) => {
				if (isMountedRef.current) {
					setAuthorizationData(data);
				}
			})
			.catch((error) => {
				if (abortController.signal.aborted) {
					return;
				}
				logger.error("Failed to fetch authorization data:", error);
				// Keep default empty authorization on error
			})
			.finally(() => {
				if (isMountedRef.current && !abortController.signal.aborted) {
					setAuthorizationStatus("resolved");
				}
			});

		return () => {
			abortController.abort();
		};
	}, [
		hasServerAuthorization,
		isDevelopmentBypass,
		serverAuthorization,
		session?.user?.id,
	]);

	const authContext = useMemo(() => {
		// Development bypass - return full access
		if (isDevelopmentBypass) {
			return {
				isAuthenticated: true,
				isActive: true,
				user: {
					id: "dev-user",
					email: "dev@example.com",
					name: "Development User",
				},
				roles: ["super_admin"],
				permissions: ["system:*"],
				apps: {
					inventory: { roles: ["admin"] },
					asset: { roles: ["admin"] },
					crm: { roles: ["admin"] },
					hrms: { roles: ["admin"] },
				},
				supervisedApps: ["inventory", "asset", "crm", "hrms"],
				hasPermission: () => true,
				hasAnyPermission: () => true,
				hasRole: () => true,
				hasAnyRole: () => true,
				canAccessApp: () => true,
				isSupervisorOf: () => true,
				isLoading: false,
			};
		}

		if (!session) {
			return {
				isAuthenticated: false,
				isActive: false,
				user: null,
				roles: [],
				permissions: [],
				apps: {},
				supervisedApps: [],
				hasPermission: () => false,
				hasAnyPermission: () => false,
				hasRole: () => false,
				hasAnyRole: () => false,
				canAccessApp: () => false,
				isSupervisorOf: () => false,
				isLoading: isPending,
			};
		}

		const resolvedAuthorization = serverAuthorization ?? authorizationData;
		const roles = resolvedAuthorization?.roles ?? [];
		const permissions = resolvedAuthorization?.permissions ?? [];
		const apps = resolvedAuthorization?.apps ?? {};
		const supervisedApps = resolvedAuthorization?.supervisedApps ?? [];
		const isActive = resolvedAuthorization?.isActive ?? true;
		const authorizationPending =
			!hasServerAuthorization &&
			!isDevelopmentBypass &&
			authorizationStatus !== "resolved";

		/**
		 * Check if user has a specific permission
		 */
		const hasPermission = (permissionKey: string): boolean => {
			if (!isActive) return false;

			// Check for exact match
			if (permissions.includes(permissionKey)) return true;

			// Check for wildcard permissions
			const parts = permissionKey.split(":");

			// Check system:* wildcard
			if (parts[0] === "system" && permissions.includes("system:*")) {
				return true;
			}

			// Check app:<appKey>:* wildcard
			if (parts[0] === "app" && parts.length >= 2) {
				if (permissions.includes(`app:${parts[1]}:*`)) return true;
			}

			// Check entity:<appKey>:<entity>:* wildcard
			if (parts[0] === "entity" && parts.length >= 3) {
				if (permissions.includes(`entity:${parts[1]}:${parts[2]}:*`)) {
					return true;
				}
				if (permissions.includes(`entity:${parts[1]}:*`)) return true;
			}

			return false;
		};

		/**
		 * Check if user has any of the specified permissions
		 */
		const hasAnyPermission = (...permissionKeys: string[]): boolean => {
			return permissionKeys.some(hasPermission);
		};

		/**
		 * Check if user has a specific role
		 */
		const hasRole = (roleKey: string): boolean => {
			if (!isActive) return false;
			return roles.includes(roleKey);
		};

		/**
		 * Check if user has any of the specified roles
		 */
		const hasAnyRole = (...roleKeys: string[]): boolean => {
			if (!isActive) return false;
			return roleKeys.some((role) => roles.includes(role));
		};

		/**
		 * Check if user can access a specific app
		 */
		const canAccessApp = (appKey: string): boolean => {
			if (!isActive) return false;

			// Super admin has access to all apps
			if (hasRole("super_admin")) return true;

			// Check if user has roles in the app
			return appKey in apps || supervisedApps.includes(appKey);
		};

		/**
		 * Check if user is a supervisor of an app
		 */
		const isSupervisorOf = (appKey: string): boolean => {
			if (!isActive) return false;
			return supervisedApps.includes(appKey);
		};

		return {
			isAuthenticated: true,
			isActive,
			user: session.user,
			roles,
			permissions,
			apps,
			supervisedApps,
			hasPermission,
			hasAnyPermission,
			hasRole,
			hasAnyRole,
			canAccessApp,
			isSupervisorOf,
			isLoading: isPending || authorizationPending,
		};
	}, [
		authorizationData,
		authorizationStatus,
		hasServerAuthorization,
		isDevelopmentBypass,
		isPending,
		serverAuthorization,
		session,
	]);

	return authContext;
}

/**
 * Hook to check if user has specific permission(s)
 *
 * @param permission - Single permission or array of permissions (any match)
 * @returns Boolean indicating if user has the permission
 */
export function usePermission(permission: string | string[]): boolean {
	const { hasPermission, hasAnyPermission } = useAuth();

	if (Array.isArray(permission)) {
		return hasAnyPermission(...permission);
	}

	return hasPermission(permission);
}

/**
 * Hook to check if user has specific role(s)
 *
 * @param role - Single role or array of roles (any match)
 * @returns Boolean indicating if user has the role
 */
export function useRole(role: string | string[]): boolean {
	const { hasRole, hasAnyRole } = useAuth();

	if (Array.isArray(role)) {
		return hasAnyRole(...role);
	}

	return hasRole(role);
}

/**
 * Hook to check if user can access an app
 *
 * @param appKey - App key to check
 * @returns Boolean indicating if user can access the app
 */
export function useAppAccess(appKey: string): boolean {
	const { canAccessApp } = useAuth();
	return canAccessApp(appKey);
}
