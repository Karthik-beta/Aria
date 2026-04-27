/**
 * Unit tests for authorization pure functions.
 *
 * @module authorization.test
 */
import { describe, expect, it } from "vitest";
import {
	type AuthorizationData,
	authorizationCanAccessApp,
	authorizationHasAnyPermission,
	authorizationHasAnyRole,
	authorizationHasPermission,
	authorizationHasRole,
	authorizationIsSupervisorOf,
	EMPTY_AUTHORIZATION_DATA,
} from "@/lib/auth/authorization";

const adminAuth: AuthorizationData = {
	roles: ["inventory_admin", "super_admin"],
	permissions: ["system:*", "app:inventory:*"],
	apps: {
		inventory: { roles: ["admin"] },
		asset: { roles: ["viewer"] },
	},
	supervisedApps: ["inventory"],
	isActive: true,
};

const userAuth: AuthorizationData = {
	roles: ["inventory_user"],
	permissions: [
		"entity:inventory:item:read",
		"entity:inventory:item:write",
		"entity:crm:contact:read",
	],
	apps: {
		inventory: { roles: ["user"] },
	},
	supervisedApps: [],
	isActive: true,
};

const inactiveAuth: AuthorizationData = {
	roles: ["admin"],
	permissions: ["system:*"],
	apps: { inventory: { roles: ["admin"] } },
	supervisedApps: ["inventory"],
	isActive: false,
};

describe("authorizationHasRole", () => {
	it("returns true when user has the role", () => {
		expect(authorizationHasRole(adminAuth, "inventory_admin")).toBe(true);
	});

	it("returns false when user lacks the role", () => {
		expect(authorizationHasRole(userAuth, "admin")).toBe(false);
	});

	it("returns false for inactive user regardless of role", () => {
		expect(authorizationHasRole(inactiveAuth, "admin")).toBe(false);
	});

	it("returns false for empty role key", () => {
		expect(authorizationHasRole(adminAuth, "")).toBe(false);
	});
});

describe("authorizationHasAnyRole", () => {
	it("returns true when user has any of the roles", () => {
		expect(
			authorizationHasAnyRole(adminAuth, "viewer", "inventory_admin"),
		).toBe(true);
	});

	it("returns false when user has none of the roles", () => {
		expect(authorizationHasAnyRole(userAuth, "admin", "super_admin")).toBe(
			false,
		);
	});

	it("returns false for inactive user", () => {
		expect(authorizationHasAnyRole(inactiveAuth, "admin")).toBe(false);
	});
});

describe("authorizationHasPermission", () => {
	it("returns true for exact permission match", () => {
		expect(
			authorizationHasPermission(userAuth, "entity:inventory:item:read"),
		).toBe(true);
	});

	it("returns false for non-matching permission", () => {
		expect(
			authorizationHasPermission(userAuth, "entity:inventory:item:delete"),
		).toBe(false);
	});

	it("returns true for system:* wildcard", () => {
		expect(authorizationHasPermission(adminAuth, "system:manage")).toBe(true);
	});

	it("returns false for system:* when user lacks it", () => {
		expect(authorizationHasPermission(userAuth, "system:settings")).toBe(false);
	});

	it("returns true for app:<key>:* wildcard", () => {
		expect(
			authorizationHasPermission(adminAuth, "app:inventory:settings"),
		).toBe(true);
	});

	it("returns false for app:<key>:* when user lacks that app wildcard", () => {
		expect(authorizationHasPermission(userAuth, "app:inventory:report")).toBe(
			false,
		);
	});

	it("returns true for entity:<app>:<entity>:* wildcard", () => {
		const authWithEntityWildcard: AuthorizationData = {
			...adminAuth,
			permissions: [...adminAuth.permissions, "entity:inventory:item:*"],
		};
		expect(
			authorizationHasPermission(
				authWithEntityWildcard,
				"entity:inventory:item:delete",
			),
		).toBe(true);
	});

	it("returns false for entity:<app>:<entity>:* when user lacks it", () => {
		expect(
			authorizationHasPermission(userAuth, "entity:inventory:settings:write"),
		).toBe(false);
	});

	it("returns false for inactive user even with matching permission", () => {
		expect(authorizationHasPermission(inactiveAuth, "system:manage")).toBe(
			false,
		);
	});

	it("returns false for empty permission string", () => {
		expect(authorizationHasPermission(adminAuth, "")).toBe(false);
	});
});

describe("authorizationHasAnyPermission", () => {
	it("returns true when user has any of the permissions", () => {
		expect(
			authorizationHasAnyPermission(
				userAuth,
				"entity:inventory:item:delete",
				"entity:inventory:item:read",
			),
		).toBe(true);
	});

	it("returns false when user has none of the permissions", () => {
		expect(
			authorizationHasAnyPermission(
				userAuth,
				"entity:inventory:item:delete",
				"system:manage",
			),
		).toBe(false);
	});
});

describe("authorizationCanAccessApp", () => {
	it("returns true for super_admin regardless of app assignments", () => {
		expect(authorizationCanAccessApp(adminAuth, "hrms")).toBe(true);
	});

	it("returns true when user has an explicit app role", () => {
		expect(authorizationCanAccessApp(userAuth, "inventory")).toBe(true);
	});

	it("returns false when user has no role for the app", () => {
		expect(authorizationCanAccessApp(userAuth, "asset")).toBe(false);
	});

	it("returns true for supervised app", () => {
		expect(authorizationCanAccessApp(adminAuth, "inventory")).toBe(true);
	});

	it("returns false for inactive user", () => {
		expect(authorizationCanAccessApp(inactiveAuth, "inventory")).toBe(false);
	});

	it("returns false for unknown app key", () => {
		expect(authorizationCanAccessApp(userAuth, "nonexistent")).toBe(false);
	});

	it("returns false for super_admin on empty apps object", () => {
		const superAdminOnly: AuthorizationData = {
			...EMPTY_AUTHORIZATION_DATA,
			roles: ["super_admin"],
			isActive: true,
		};
		expect(authorizationCanAccessApp(superAdminOnly, "any-app")).toBe(true);
	});
});

describe("authorizationIsSupervisorOf", () => {
	it("returns true for supervised app", () => {
		expect(authorizationIsSupervisorOf(adminAuth, "inventory")).toBe(true);
	});

	it("returns false for non-supervised app", () => {
		expect(authorizationIsSupervisorOf(adminAuth, "hrms")).toBe(false);
	});

	it("returns false for user without supervisor role", () => {
		expect(authorizationIsSupervisorOf(userAuth, "inventory")).toBe(false);
	});

	it("returns false for inactive user", () => {
		expect(authorizationIsSupervisorOf(inactiveAuth, "inventory")).toBe(false);
	});
});
