/**
 * Unit tests for useAuth hook — permission checking, role checking, app access.
 *
 * @module use-auth.test
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUseSession = vi.fn<() => { data: unknown; isPending: boolean }>();

vi.mock("@/lib/auth-client", () => ({
	useSession: () => mockUseSession(),
}));

vi.mock("@aria/utils", () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}));

import { useAuth } from "@/hooks/use-auth";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockSession(user: { id: string; email: string; name: string }) {
	mockUseSession.mockReturnValue({
		data: { user },
		isPending: false,
	});
}

function mockNoSession() {
	mockUseSession.mockReturnValue({ data: null, isPending: false });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useAuth", () => {
	beforeEach(() => {
		vi.stubEnv("NODE_ENV", "test");
		vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "false");
		mockNoSession();
		// Mock fetch for authorization endpoint
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					roles: [],
					permissions: [],
					apps: {},
					supervisedApps: [],
					isActive: true,
				}),
		});
	});

	describe("unauthenticated state", () => {
		it("returns isAuthenticated=false when no session", () => {
			const { result } = renderHook(() => useAuth());
			expect(result.current.isAuthenticated).toBe(false);
			expect(result.current.user).toBeNull();
		});

		it("all permission checks return false", () => {
			const { result } = renderHook(() => useAuth());
			expect(result.current.hasPermission("system:manage")).toBe(false);
			expect(result.current.hasRole("admin")).toBe(false);
			expect(result.current.canAccessApp("inventory")).toBe(false);
			expect(result.current.isSupervisorOf("inventory")).toBe(false);
		});

		it("hasAnyPermission returns false", () => {
			const { result } = renderHook(() => useAuth());
			expect(result.current.hasAnyPermission("a", "b")).toBe(false);
		});

		it("hasAnyRole returns false", () => {
			const { result } = renderHook(() => useAuth());
			expect(result.current.hasAnyRole("admin", "user")).toBe(false);
		});
	});

	describe("development bypass mode", () => {
		it("grants full access when bypass is enabled", () => {
			vi.stubEnv("NODE_ENV", "development");
			vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "true");
			const { result } = renderHook(() => useAuth());
			expect(result.current.isAuthenticated).toBe(true);
			expect(result.current.hasPermission("anything")).toBe(true);
			expect(result.current.hasRole("any_role")).toBe(true);
			expect(result.current.canAccessApp("inventory")).toBe(true);
			expect(result.current.isSupervisorOf("crm")).toBe(true);
		});
	});

	describe("authenticated with authorization data", () => {
		beforeEach(() => {
			mockSession({
				id: "user-1",
				email: "test@example.com",
				name: "Test User",
			});
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						roles: ["inventory_user", "super_admin"],
						permissions: [
							"system:*",
							"app:inventory:*",
							"entity:inventory:item:read",
							"entity:inventory:item:write",
							"entity:crm:contact:*",
						],
						apps: {
							inventory: { roles: ["admin"] },
							crm: { roles: ["viewer"] },
						},
						supervisedApps: ["inventory"],
						isActive: true,
					}),
			});
		});

		it("reports isAuthenticated=true", async () => {
			const { result } = renderHook(() => useAuth());
			expect(result.current.isAuthenticated).toBe(true);
		});

		it("hasPermission with exact match", async () => {
			const { result } = renderHook(() => useAuth());
			await waitFor(() => {
				expect(result.current.hasPermission("entity:inventory:item:read")).toBe(
					true,
				);
			});
		});

		it("hasPermission with system:* wildcard", async () => {
			const { result } = renderHook(() => useAuth());
			await waitFor(() => {
				expect(result.current.hasPermission("system:manage")).toBe(true);
				expect(result.current.hasPermission("system:settings")).toBe(true);
			});
		});

		it("hasPermission with app:<key>:* wildcard", async () => {
			const { result } = renderHook(() => useAuth());
			await waitFor(() => {
				expect(result.current.hasPermission("app:inventory:settings")).toBe(
					true,
				);
				expect(result.current.hasPermission("app:inventory:anything")).toBe(
					true,
				);
			});
		});

		it("hasPermission with entity:<app>:<entity>:* wildcard", async () => {
			const { result } = renderHook(() => useAuth());
			await waitFor(() => {
				expect(result.current.hasPermission("entity:crm:contact:read")).toBe(
					true,
				);
				expect(result.current.hasPermission("entity:crm:contact:delete")).toBe(
					true,
				);
			});
		});

		it("hasPermission returns false for non-matching permission", async () => {
			const { result } = renderHook(() => useAuth());
			await waitFor(() => {
				expect(result.current.hasPermission("app:hrms:settings")).toBe(false);
			});
		});

		it("hasRole checks role list", async () => {
			const { result } = renderHook(() => useAuth());
			await waitFor(() => {
				expect(result.current.hasRole("inventory_user")).toBe(true);
				expect(result.current.hasRole("nonexistent")).toBe(false);
			});
		});

		it("hasAnyRole returns true if any match", async () => {
			const { result } = renderHook(() => useAuth());
			await waitFor(() => {
				expect(result.current.hasAnyRole("nonexistent", "inventory_user")).toBe(
					true,
				);
			});
		});

		it("canAccessApp for super_admin returns true for any app", async () => {
			const { result } = renderHook(() => useAuth());
			await waitFor(() => {
				expect(result.current.canAccessApp("anything")).toBe(true);
			});
		});

		it("isSupervisorOf checks supervisedApps", async () => {
			const { result } = renderHook(() => useAuth());
			await waitFor(() => {
				expect(result.current.isSupervisorOf("inventory")).toBe(true);
				expect(result.current.isSupervisorOf("hrms")).toBe(false);
			});
		});
	});

	describe("inactive user", () => {
		beforeEach(() => {
			mockSession({
				id: "user-2",
				email: "inactive@example.com",
				name: "Inactive",
			});
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						roles: ["admin"],
						permissions: ["system:*"],
						apps: { inventory: { roles: ["admin"] } },
						supervisedApps: ["inventory"],
						isActive: false,
					}),
			});
		});

		it("denies all permissions when isActive is false", async () => {
			const { result } = renderHook(() => useAuth());
			await waitFor(() => {
				expect(result.current.isActive).toBe(false);
			});
			expect(result.current.hasPermission("system:manage")).toBe(false);
			expect(result.current.hasRole("admin")).toBe(false);
			expect(result.current.canAccessApp("inventory")).toBe(false);
			expect(result.current.isSupervisorOf("inventory")).toBe(false);
		});
	});
});
