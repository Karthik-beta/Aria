/**
 * Root HomePage Tests
 *
 * Tests the server-side redirect logic that routes all authenticated users to /inventory.
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

	it("redirects unauthenticated requests through protected auth helper", async () => {
		mockRequireProtectedAuthState.mockRejectedValue(
			new Error("NEXT_REDIRECT:/auth/sign-in?callbackUrl=%2F"),
		);

		await expect(HomePage()).rejects.toThrow(
			"NEXT_REDIRECT:/auth/sign-in?callbackUrl=%2F",
		);
		expect(mockRedirect).not.toHaveBeenCalled();
	});

	it("redirects super_admin to /inventory", async () => {
		mockRequireProtectedAuthState.mockResolvedValue({
			session: {
				user: { id: "1", email: "admin@test.com", name: "Admin" },
				session: { id: "s1", expiresAt: "" },
			},
			role: "super_admin",
			isActive: true,
		});

		await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/inventory");
		expect(mockRedirect).toHaveBeenCalledWith("/inventory");
	});

	it("redirects regular user to /inventory", async () => {
		mockRequireProtectedAuthState.mockResolvedValue({
			session: {
				user: { id: "2", email: "user@test.com", name: "User" },
				session: { id: "s2", expiresAt: "" },
			},
			role: "user",
			isActive: true,
		});

		await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/inventory");
		expect(mockRedirect).toHaveBeenCalledWith("/inventory");
	});

	it("redirects viewer to /inventory", async () => {
		mockRequireProtectedAuthState.mockResolvedValue({
			session: {
				user: { id: "3", email: "viewer@test.com", name: "Viewer" },
				session: { id: "s3", expiresAt: "" },
			},
			role: "viewer",
			isActive: true,
		});

		await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/inventory");
		expect(mockRedirect).toHaveBeenCalledWith("/inventory");
	});

	it("redirects any role to /inventory", async () => {
		mockRequireProtectedAuthState.mockResolvedValue({
			session: {
				user: { id: "4", email: "admin@test.com", name: "Admin" },
				session: { id: "s4", expiresAt: "" },
			},
			role: "admin",
			isActive: true,
		});

		await expect(HomePage()).rejects.toThrow("NEXT_REDIRECT:/inventory");
		expect(mockRedirect).toHaveBeenCalledWith("/inventory");
	});
});
