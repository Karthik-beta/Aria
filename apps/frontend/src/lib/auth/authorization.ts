import type { AuthorizationData } from "@aria/types";

export type { AuthorizationData };

export const EMPTY_AUTHORIZATION_DATA: AuthorizationData = {
	roles: [],
	permissions: [],
	apps: {},
	supervisedApps: [],
	isActive: false,
};

export function isAuthorizationData(
	value: unknown,
): value is AuthorizationData {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return (
		Array.isArray(candidate.roles) &&
		Array.isArray(candidate.permissions) &&
		typeof candidate.apps === "object" &&
		candidate.apps !== null &&
		Array.isArray(candidate.supervisedApps) &&
		typeof candidate.isActive === "boolean"
	);
}

/**
 * Check whether the given authorization data includes a specific role.
 */
export function authorizationHasRole(
	authorization: AuthorizationData,
	roleKey: string,
): boolean {
	if (!authorization.isActive) {
		return false;
	}

	return authorization.roles.includes(roleKey);
}

/**
 * Check whether the given authorization data includes any of the supplied roles.
 */
export function authorizationHasAnyRole(
	authorization: AuthorizationData,
	...roleKeys: string[]
): boolean {
	if (!authorization.isActive) {
		return false;
	}

	return roleKeys.some((roleKey) => authorization.roles.includes(roleKey));
}

/**
 * Check whether the given authorization data includes a specific permission.
 */
export function authorizationHasPermission(
	authorization: AuthorizationData,
	permissionKey: string,
): boolean {
	if (!authorization.isActive) {
		return false;
	}

	const { permissions } = authorization;

	if (permissions.includes(permissionKey)) {
		return true;
	}

	const parts = permissionKey.split(":");

	if (parts[0] === "system" && permissions.includes("system:*")) {
		return true;
	}

	if (parts[0] === "app" && parts.length >= 2) {
		return permissions.includes(`app:${parts[1]}:*`);
	}

	if (parts[0] === "entity" && parts.length >= 3) {
		return (
			permissions.includes(`entity:${parts[1]}:${parts[2]}:*`) ||
			permissions.includes(`entity:${parts[1]}:*`)
		);
	}

	return false;
}

/**
 * Check whether the given authorization data includes any of the supplied permissions.
 */
export function authorizationHasAnyPermission(
	authorization: AuthorizationData,
	...permissionKeys: string[]
): boolean {
	return permissionKeys.some((permissionKey) =>
		authorizationHasPermission(authorization, permissionKey),
	);
}

/**
 * Check whether the current authorization can access the given app.
 */
export function authorizationCanAccessApp(
	authorization: AuthorizationData,
	appKey: string,
): boolean {
	if (!authorization.isActive) {
		return false;
	}

	if (authorizationHasRole(authorization, "super_admin")) {
		return true;
	}

	return (
		appKey in authorization.apps ||
		authorization.supervisedApps.includes(appKey)
	);
}

/**
 * Check whether the current authorization supervises the given app.
 */
export function authorizationIsSupervisorOf(
	authorization: AuthorizationData,
	appKey: string,
): boolean {
	if (!authorization.isActive) {
		return false;
	}

	return authorization.supervisedApps.includes(appKey);
}
