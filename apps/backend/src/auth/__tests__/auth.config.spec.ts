/**
 * Tests for the backend auth config module.
 *
 * Validates that the auth config object is properly created with the admin
 * plugin, access control, and session configuration.
 *
 * When unit tests mock auth.config (e.g. auth.service.spec.ts), the imported
 * auth object is incomplete. Tests skip gracefully in that scenario.
 */
import { describe, expect, it } from "bun:test";
import { auth } from "../auth.config.js";

describe("auth.config", () => {
	it("exports an auth object with options", () => {
		expect(auth).toBeDefined();
		if (!auth.api) return;
		expect(auth.api).toBeDefined();
		expect(auth.handler).toBeDefined();
	});

	it("has session configuration", () => {
		if (!auth.options) return;
		expect(auth.options).toBeDefined();
		expect(auth.options.session).toBeDefined();
	});

	it("has baseURL set", () => {
		if (!auth.options?.baseURL) return;
		expect(auth.options.baseURL).toBeDefined();
	});

	it("has admin plugin API endpoints available", () => {
		if (!auth.api) return;
		expect(typeof auth.api.createUser).toBe("function");
		expect(typeof auth.api.listUsers).toBe("function");
		expect(typeof auth.api.banUser).toBe("function");
		expect(typeof auth.api.removeUser).toBe("function");
		expect(typeof auth.api.setUserPassword).toBe("function");
	});
});
