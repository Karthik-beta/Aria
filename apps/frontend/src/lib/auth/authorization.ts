import type { AuthorizationData } from "@aria/types";

export type { AuthorizationData };

export const EMPTY_AUTHORIZATION_DATA: AuthorizationData = {
	role: null,
	roles: [],
	permissions: [],
	apps: {},
	supervisedApps: [],
	isActive: false,
};

function isSuperAdmin(authorization: AuthorizationData): boolean {
	return (
		authorization.role === "super_admin" ||
		authorization.roles.includes("super_admin")
	);
}

export function authorizationHasRole(
	authorization: AuthorizationData,
	roleKey: string,
): boolean {
	if (!authorization.isActive) {
		return false;
	}

	if (isSuperAdmin(authorization)) {
		return true;
	}

	return authorization.roles.includes(roleKey);
}

export function authorizationHasAnyRole(
	authorization: AuthorizationData,
	...roleKeys: string[]
): boolean {
	return roleKeys.some((roleKey) =>
		authorizationHasRole(authorization, roleKey),
	);
}

export function authorizationHasPermission(
	authorization: AuthorizationData,
	permissionKey: string,
): boolean {
	if (!authorization.isActive) {
		return false;
	}

	if (isSuperAdmin(authorization)) {
		return true;
	}

	return matchPermission(authorization.permissions, permissionKey);
}

export function authorizationHasAnyPermission(
	authorization: AuthorizationData,
	...permissionKeys: string[]
): boolean {
	return permissionKeys.some((key) =>
		authorizationHasPermission(authorization, key),
	);
}

export function authorizationCanAccessApp(
	authorization: AuthorizationData,
	appKey: string,
): boolean {
	if (!authorization.isActive) {
		return false;
	}

	if (isSuperAdmin(authorization)) {
		return true;
	}

	return appKey in authorization.apps;
}

export function authorizationIsSupervisorOf(
	authorization: AuthorizationData,
	appKey: string,
): boolean {
	if (!authorization.isActive) {
		return false;
	}

	if (isSuperAdmin(authorization)) {
		return true;
	}

	return authorization.supervisedApps.includes(appKey);
}

function matchPermission(
	permissions: string[],
	permissionKey: string,
): boolean {
	if (permissions.includes(permissionKey)) {
		return true;
	}

	const [type] = permissionKey.split(":");
	if (type === "system" && permissions.some((p) => p === "system:*")) {
		return true;
	}

	const appMatch = permissionKey.match(/^app:([^:]+):/);
	if (appMatch) {
		const appKey = appMatch[1];
		if (permissions.some((p) => p === `app:${appKey}:*`)) {
			return true;
		}
	}

	const entityMatch = permissionKey.match(/^entity:([^:]+):([^:]+):/);
	if (entityMatch) {
		const entityApp = entityMatch[1];
		const entityName = entityMatch[2];
		if (
			permissions.some((p) => p === `entity:${entityApp}:${entityName}:*`) ||
			permissions.some((p) => p === `entity:${entityApp}:*`)
		) {
			return true;
		}
	}

	return false;
}
