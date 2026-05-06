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
} from "@/lib/auth/authorization";

const adminAuth: AuthorizationData = {
	role: "admin",
	roles: ["admin"],
	permissions: [],
	apps: {},
	supervisedApps: [],
	isActive: true,
};

const userAuth: AuthorizationData = {
	role: "user",
	roles: ["user"],
	permissions: [],
	apps: {},
	supervisedApps: [],
	isActive: true,
};

const superAdminAuth: AuthorizationData = {
	role: "super_admin",
	roles: ["super_admin"],
	permissions: [],
	apps: {},
	supervisedApps: [],
	isActive: true,
};

const inactiveAuth: AuthorizationData = {
	role: "admin",
	roles: ["admin"],
	permissions: [],
	apps: {},
	supervisedApps: [],
	isActive: false,
};

describe("authorizationHasRole", () => {
	it("returns true when user has the role", () => {
		expect(authorizationHasRole(adminAuth, "admin")).toBe(true);
	});

	it("returns false when user lacks the role", () => {
		expect(authorizationHasRole(userAuth, "admin")).toBe(false);
	});

	it("returns false for inactive user regardless of role", () => {
		expect(authorizationHasRole(inactiveAuth, "admin")).toBe(false);
	});

	it("returns true for super_admin for any role", () => {
		expect(authorizationHasRole(superAdminAuth, "any_role")).toBe(true);
	});
});

describe("authorizationHasAnyRole", () => {
	it("returns true when user has any of the roles", () => {
		expect(authorizationHasAnyRole(adminAuth, "viewer", "admin")).toBe(true);
	});

	it("returns false when user has none of the roles", () => {
		expect(authorizationHasAnyRole(userAuth, "admin", "super_admin")).toBe(
			false,
		);
	});

	it("returns false for inactive user", () => {
		expect(authorizationHasAnyRole(inactiveAuth, "admin")).toBe(false);
	});

	it("returns true for super_admin with any role", () => {
		expect(authorizationHasAnyRole(superAdminAuth, "any_role")).toBe(true);
	});
});

describe("authorizationHasPermission", () => {
	it("returns false when permission is not in list", () => {
		expect(authorizationHasPermission(adminAuth, "system:manage")).toBe(false);
	});

	it("returns true for super_admin regardless of permission list", () => {
		expect(authorizationHasPermission(superAdminAuth, "system:manage")).toBe(
			true,
		);
	});

	it("returns false for inactive user", () => {
		expect(authorizationHasPermission(inactiveAuth, "system:manage")).toBe(
			false,
		);
	});

	it("returns true for exact permission match", () => {
		const auth: AuthorizationData = {
			...adminAuth,
			permissions: ["system:manage"],
		};
		expect(authorizationHasPermission(auth, "system:manage")).toBe(true);
	});

	it("returns true for system:* wildcard", () => {
		const auth: AuthorizationData = {
			...adminAuth,
			permissions: ["system:*"],
		};
		expect(authorizationHasPermission(auth, "system:manage")).toBe(true);
	});
});

describe("authorizationHasAnyPermission", () => {
	it("returns true when any permission matches", () => {
		const auth: AuthorizationData = {
			...adminAuth,
			permissions: ["system:manage", "app:inventory:read"],
		};
		expect(
			authorizationHasAnyPermission(auth, "system:foo", "system:manage"),
		).toBe(true);
	});

	it("returns false when no permissions match", () => {
		expect(
			authorizationHasAnyPermission(adminAuth, "system:foo", "app:bar"),
		).toBe(false);
	});

	it("returns true for super_admin regardless of permission list", () => {
		expect(
			authorizationHasAnyPermission(superAdminAuth, "anything", "atall"),
		).toBe(true);
	});
});

describe("authorizationCanAccessApp", () => {
	it("returns true when app is in apps", () => {
		const auth: AuthorizationData = {
			...adminAuth,
			apps: { inventory: { roles: ["admin"] } },
		};
		expect(authorizationCanAccessApp(auth, "inventory")).toBe(true);
	});

	it("returns false when app is not in apps", () => {
		expect(authorizationCanAccessApp(adminAuth, "inventory")).toBe(false);
	});

	it("returns true for super_admin for any app", () => {
		expect(authorizationCanAccessApp(superAdminAuth, "anyapp")).toBe(true);
	});

	it("returns false for inactive user", () => {
		expect(authorizationCanAccessApp(inactiveAuth, "inventory")).toBe(false);
	});
});

describe("authorizationIsSupervisorOf", () => {
	it("returns true when app is in supervisedApps", () => {
		const auth: AuthorizationData = {
			...adminAuth,
			supervisedApps: ["inventory", "crm"],
		};
		expect(authorizationIsSupervisorOf(auth, "inventory")).toBe(true);
	});

	it("returns false when app is not in supervisedApps", () => {
		const auth: AuthorizationData = {
			...adminAuth,
			supervisedApps: ["inventory"],
		};
		expect(authorizationIsSupervisorOf(auth, "crm")).toBe(false);
	});

	it("returns true for super_admin for any app", () => {
		expect(authorizationIsSupervisorOf(superAdminAuth, "anyapp")).toBe(true);
	});

	it("returns false for inactive user", () => {
		expect(authorizationIsSupervisorOf(inactiveAuth, "inventory")).toBe(false);
	});
});
