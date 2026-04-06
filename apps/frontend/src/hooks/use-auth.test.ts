/**
 * Unit tests for the hydrated auth hook.
 *
 * @module use-auth.test
 */
import { renderHook } from "@testing-library/react";
import { createElement, Fragment, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type AuthState,
	AuthStateProvider,
} from "@/components/auth/auth-state-provider";
import { useAuth } from "@/hooks/use-auth";

const authenticatedState: AuthState = {
	session: {
		user: {
			id: "user-1",
			email: "test@example.com",
			emailVerified: true,
			name: "Test User",
			createdAt: new Date(),
			updatedAt: new Date(),
			mustChangePassword: false,
		},
		session: {
			id: "session-1",
			userId: "user-1",
			expiresAt: new Date(),
		},
	},
	authorization: {
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
	},
};

function createWrapper(authState?: AuthState) {
	return function Wrapper({ children }: { children: ReactNode }) {
		if (!authState) {
			return createElement(Fragment, null, children);
		}

		return createElement(AuthStateProvider, {
			value: authState,
			children,
		});
	};
}

describe("useAuth", () => {
	beforeEach(() => {
		vi.stubEnv("NODE_ENV", "test");
		vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "false");
	});

	describe("unauthenticated state", () => {
		it("returns isAuthenticated=false when no auth state is provided", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(),
			});
			expect(result.current.isAuthenticated).toBe(false);
			expect(result.current.user).toBeNull();
		});

		it("all permission checks return false", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(),
			});
			expect(result.current.hasPermission("system:manage")).toBe(false);
			expect(result.current.hasRole("admin")).toBe(false);
			expect(result.current.canAccessApp("inventory")).toBe(false);
			expect(result.current.isSupervisorOf("inventory")).toBe(false);
		});

		it("hasAnyPermission returns false", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(),
			});
			expect(result.current.hasAnyPermission("a", "b")).toBe(false);
		});

		it("hasAnyRole returns false", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(),
			});
			expect(result.current.hasAnyRole("admin", "user")).toBe(false);
		});
	});

	describe("development bypass mode", () => {
		it("grants full access when bypass is enabled", () => {
			vi.stubEnv("NODE_ENV", "development");
			vi.stubEnv("NEXT_PUBLIC_DEV_AUTH_BYPASS", "true");

			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(),
			});

			expect(result.current.isAuthenticated).toBe(true);
			expect(result.current.hasPermission("anything")).toBe(true);
			expect(result.current.hasRole("any_role")).toBe(true);
			expect(result.current.canAccessApp("inventory")).toBe(true);
			expect(result.current.isSupervisorOf("crm")).toBe(true);
		});
	});

	describe("authenticated with authorization data", () => {
		it("reports isAuthenticated=true", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.isAuthenticated).toBe(true);
		});

		it("hasPermission with exact match", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.hasPermission("entity:inventory:item:read")).toBe(
				true,
			);
		});

		it("hasPermission with system:* wildcard", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.hasPermission("system:manage")).toBe(true);
			expect(result.current.hasPermission("system:settings")).toBe(true);
		});

		it("hasPermission with app:<key>:* wildcard", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.hasPermission("app:inventory:settings")).toBe(true);
			expect(result.current.hasPermission("app:inventory:anything")).toBe(true);
		});

		it("hasPermission with entity:<app>:<entity>:* wildcard", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.hasPermission("entity:crm:contact:read")).toBe(
				true,
			);
			expect(result.current.hasPermission("entity:crm:contact:delete")).toBe(
				true,
			);
		});

		it("hasPermission returns false for non-matching permission", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.hasPermission("app:hrms:settings")).toBe(false);
		});

		it("hasRole checks role list", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.hasRole("inventory_user")).toBe(true);
			expect(result.current.hasRole("nonexistent")).toBe(false);
		});

		it("hasAnyRole returns true if any match", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.hasAnyRole("nonexistent", "inventory_user")).toBe(
				true,
			);
		});

		it("canAccessApp for super_admin returns true for any app", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.canAccessApp("anything")).toBe(true);
		});

		it("isSupervisorOf checks supervisedApps", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.isSupervisorOf("inventory")).toBe(true);
			expect(result.current.isSupervisorOf("hrms")).toBe(false);
		});
	});

	describe("inactive user", () => {
		it("denies all permissions when isActive is false", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper({
					session: authenticatedState.session,
					authorization: {
						roles: ["admin"],
						permissions: ["system:*"],
						apps: { inventory: { roles: ["admin"] } },
						supervisedApps: ["inventory"],
						isActive: false,
					},
				}),
			});

			expect(result.current.isActive).toBe(false);
			expect(result.current.hasPermission("system:manage")).toBe(false);
			expect(result.current.hasRole("admin")).toBe(false);
			expect(result.current.canAccessApp("inventory")).toBe(false);
			expect(result.current.isSupervisorOf("inventory")).toBe(false);
		});
	});
});
