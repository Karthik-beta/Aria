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
	it("returns true always (no custom permissions)", () => {
		expect(authorizationHasPermission()).toBe(true);
	});

	it("returns true for inactive user too", () => {
		expect(authorizationHasPermission()).toBe(true);
	});
});

describe("authorizationHasAnyPermission", () => {
	it("returns true always", () => {
		expect(authorizationHasAnyPermission()).toBe(true);
	});
});

describe("authorizationCanAccessApp", () => {
	it("returns true always", () => {
		expect(authorizationCanAccessApp()).toBe(true);
	});
});

describe("authorizationIsSupervisorOf", () => {
	it("returns false always (no supervisor concept)", () => {
		expect(authorizationIsSupervisorOf()).toBe(false);
	});

	it("returns false for inactive user", () => {
		expect(authorizationIsSupervisorOf()).toBe(false);
	});
});
