/**
 * Tests for the backend auth config module.
 *
 * Validates that the auth config object is properly created with the admin
 * plugin, access control, and session configuration.
 */
import { describe, expect, it } from "bun:test";
import { auth } from "../auth.config.js";

describe("auth.config", () => {
	it("exports an auth object with options", () => {
		expect(auth).toBeDefined();
		expect(auth.api).toBeDefined();
		expect(auth.handler).toBeDefined();
	});

	it("has session configuration", () => {
		expect(auth.options).toBeDefined();
		expect(auth.options.session).toBeDefined();
	});

	it("has baseURL set", () => {
		expect(auth.options.baseURL).toBeDefined();
	});

	it("has admin plugin API endpoints available", () => {
		expect(typeof auth.api.createUser).toBe("function");
		expect(typeof auth.api.listUsers).toBe("function");
		expect(typeof auth.api.banUser).toBe("function");
		expect(typeof auth.api.removeUser).toBe("function");
		expect(typeof auth.api.setUserPassword).toBe("function");
	});
});
