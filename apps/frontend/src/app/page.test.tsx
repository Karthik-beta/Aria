/**
 * Root HomePage Tests
 *
 * Tests the server-side redirect logic that routes authenticated users to
 * their first accessible app based on priority and authorization.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedirect = vi.fn((url: string) => {
	throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockRequireProtectedAuthState = vi.fn();

vi.mock("next/navigation", () => ({
	redirect: (url: string) => mockRedirect(url),
}));

vi.mock("@/lib/auth/server", () => ({
	requireProtectedAuthState: () => mockRequireProtectedAuthState(),
}));

import HomePage from "./page";

describe("HomePage — app redirect logic", () => {
	beforeEach(() => {
		mockRedirect.mockClear();
		mockRequireProtectedAuthState.mockReset();
	});

	it("redirects unauthenticated requests through the protected auth helper", async () => {
		mockRequireProtectedAuthState.mockRejectedValue(
			new Error("NEXT_REDIRECT:/auth/sign-in?callbackUrl=%2F"),
		);

		await expect(HomePage()).rejects.toThrow(
			"NEXT_REDIRECT:/auth/sign-in?callbackUrl=%2F",
		);
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("redirects super_admin to /inventory (highest priority)", async () => {
		mockRequireProtectedAuthState.mockResolvedValue({
			authorization: {
				roles: ["super_admin"],
				permissions: ["system:*"],
				apps: { inventory: { roles: ["admin"] } },
				supervisedApps: [],
				isActive: true,
			},
		});

		await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/inventory");
		expect(mockRedirect).toHaveBeenCalledWith("/inventory");
	});

	it("redirects to first accessible app by APP_PRIORITY", async () => {
		mockRequireProtectedAuthState.mockResolvedValue({
			authorization: {
				roles: ["user"],
				permissions: [],
				apps: { crm: { roles: ["user"] }, hrms: { roles: ["user"] } },
				supervisedApps: [],
				isActive: true,
			},
		});

		await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/crm");
		expect(mockRedirect).toHaveBeenCalledWith("/crm");
	});

	it("redirects to /asset when only asset is accessible", async () => {
		mockRequireProtectedAuthState.mockResolvedValue({
			authorization: {
				roles: ["viewer"],
				permissions: [],
				apps: { asset: { roles: ["viewer"] } },
				supervisedApps: [],
				isActive: true,
			},
		});

		await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/asset");
		expect(mockRedirect).toHaveBeenCalledWith("/asset");
	});

	it("falls back to /inventory when authenticated but no apps match", async () => {
		mockRequireProtectedAuthState.mockResolvedValue({
			authorization: {
				roles: ["user"],
				permissions: [],
				apps: {},
				supervisedApps: [],
				isActive: true,
			},
		});

		await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/inventory");
		expect(mockRedirect).toHaveBeenCalledWith("/inventory");
	});

	it("redirects to /hrms when only hrms is accessible (lowest priority)", async () => {
		mockRequireProtectedAuthState.mockResolvedValue({
			authorization: {
				roles: ["user"],
				permissions: [],
				apps: { hrms: { roles: ["user"] } },
				supervisedApps: [],
				isActive: true,
			},
		});

		await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/hrms");
		expect(mockRedirect).toHaveBeenCalledWith("/hrms");
	});
});
