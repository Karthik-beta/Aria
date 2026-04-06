export interface AuthorizationData {
	roles: string[];
	permissions: string[];
	apps: Record<string, { roles: string[] }>;
	supervisedApps: string[];
	isActive: boolean;
}

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
