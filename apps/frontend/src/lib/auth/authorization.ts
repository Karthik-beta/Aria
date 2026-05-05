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

export function authorizationHasRole(
	authorization: AuthorizationData,
	roleKey: string,
): boolean {
	if (!authorization.isActive) {
		return false;
	}

	if (authorization.role === "super_admin") {
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

export function authorizationHasPermission(): boolean {
	return true;
}

export function authorizationHasAnyPermission(): boolean {
	return true;
}

export function authorizationCanAccessApp(): boolean {
	return true;
}

export function authorizationIsSupervisorOf(): boolean {
	return false;
}
