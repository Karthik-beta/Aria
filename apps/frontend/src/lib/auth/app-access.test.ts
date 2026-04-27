/**
 * Unit tests for requireAppAccess server utility.
 *
 * @module app-access.test
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAppAccess } from "@/lib/auth/app-access";

vi.mock("next/navigation", () => ({
	redirect: vi.fn((_url: string) => {
		throw new Error("NEXT_REDIRECT");
	}),
}));

const mockRequireProtectedAuthState = vi.fn();

vi.mock("@/lib/auth/server", () => ({
	requireProtectedAuthState: (...args: unknown[]) =>
		mockRequireProtectedAuthState(...args),
}));

describe("requireAppAccess", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not throw when user can access the app", async () => {
		mockRequireProtectedAuthState.mockResolvedValueOnce({
			session: {},
			authorization: {
				roles: ["inventory_user"],
				permissions: ["app:inventory:*"],
				apps: { inventory: { roles: ["user"] } },
				supervisedApps: [],
				isActive: true,
			},
		});

		await expect(requireAppAccess("inventory")).resolves.toBeUndefined();
	});

	it("redirects when user cannot access the app", async () => {
		mockRequireProtectedAuthState.mockResolvedValueOnce({
			session: {},
			authorization: {
				roles: ["crm_user"],
				permissions: ["app:crm:*"],
				apps: { crm: { roles: ["user"] } },
				supervisedApps: [],
				isActive: true,
			},
		});

		await expect(requireAppAccess("inventory")).rejects.toThrow();
	});

	it("allows super_admin to access any app", async () => {
		mockRequireProtectedAuthState.mockResolvedValueOnce({
			session: {},
			authorization: {
				roles: ["super_admin"],
				permissions: ["system:*"],
				apps: {},
				supervisedApps: [],
				isActive: true,
			},
		});

		await expect(requireAppAccess("asset")).resolves.toBeUndefined();
	});

	it("redirects for inactive user even with app role", async () => {
		mockRequireProtectedAuthState.mockResolvedValueOnce({
			session: {},
			authorization: {
				roles: ["admin"],
				permissions: ["system:*"],
				apps: { inventory: { roles: ["admin"] } },
				supervisedApps: ["inventory"],
				isActive: false,
			},
		});

		await expect(requireAppAccess("inventory")).rejects.toThrow();
	});

	it("redirects when user has no app roles at all", async () => {
		mockRequireProtectedAuthState.mockResolvedValueOnce({
			session: {},
			authorization: {
				roles: [],
				permissions: [],
				apps: {},
				supervisedApps: [],
				isActive: true,
			},
		});

		await expect(requireAppAccess("hrms")).rejects.toThrow();
	});
});
