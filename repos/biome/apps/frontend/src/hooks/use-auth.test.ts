/**
 * Unit tests for the hydrated auth hook.
 *
 * @module use-auth.test
 */

import { renderHook } from "@testing-library/react";
import { createElement, Fragment, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
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
			role: "inventory_user",
		},
		session: {
			id: "session-1",
			userId: "user-1",
			expiresAt: new Date(),
		},
	},
	role: "inventory_user",
	isActive: true,
	activeOrganization: null,
	memberRole: null,
};

const superAdminState: AuthState = {
	session: {
		user: {
			id: "user-2",
			email: "admin@example.com",
			emailVerified: true,
			name: "Admin User",
			createdAt: new Date(),
			updatedAt: new Date(),
			mustChangePassword: false,
			role: "super_admin",
		},
		session: {
			id: "session-2",
			userId: "user-2",
			expiresAt: new Date(),
		},
	},
	role: "super_admin",
	isActive: true,
	activeOrganization: null,
	memberRole: null,
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
	describe("unauthenticated state", () => {
		it("returns isAuthenticated=false when no auth state is provided", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(),
			});
			expect(result.current.isAuthenticated).toBe(false);
			expect(result.current.user).toBeNull();
		});

		it("hasRole returns false when no session", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(),
			});
			expect(result.current.hasRole("admin")).toBe(false);
		});

		it("hasAnyRole returns false when no session", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(),
			});
			expect(result.current.hasAnyRole("admin", "user")).toBe(false);
		});
	});

	describe("authenticated state", () => {
		it("reports isAuthenticated=true", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.isAuthenticated).toBe(true);
		});

		it("hasRole checks user.role directly", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.role).toBe("inventory_user");
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

		it("hasAnyRole returns false when no match", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.hasAnyRole("admin", "super_admin")).toBe(false);
		});
	});

	describe("super_admin user", () => {
		it("hasRole returns true for super_admin", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(superAdminState),
			});
			expect(result.current.hasRole("super_admin")).toBe(true);
		});
	});

	describe("inactive user", () => {
		it("reports isActive=false", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper({
					session: authenticatedState.session,
					role: "inventory_user",
					isActive: false,
					activeOrganization: null,
					memberRole: null,
				}),
			});

			expect(result.current.isActive).toBe(false);
			expect(result.current.isAuthenticated).toBe(true);
		});
	});

	describe("organization fields", () => {
		const orgState: AuthState = {
			...authenticatedState,
			activeOrganization: {
				id: "org-1",
				name: "Aria Inventory",
				slug: "inventory",
				createdAt: new Date(),
			},
			memberRole: "admin",
		};

		it("returns activeOrganization when set", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(orgState),
			});
			expect(result.current.activeOrganization?.slug).toBe("inventory");
			expect(result.current.activeOrganization?.name).toBe("Aria Inventory");
		});

		it("returns memberRole when set", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(orgState),
			});
			expect(result.current.memberRole).toBe("admin");
		});

		it("isOrgAdmin is true when memberRole is admin", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(orgState),
			});
			expect(result.current.isOrgAdmin).toBe(true);
			expect(result.current.isOrgOwner).toBe(false);
		});

		it("isOrgOwner is true when memberRole is owner", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper({
					...orgState,
					memberRole: "owner",
				}),
			});
			expect(result.current.isOrgOwner).toBe(true);
			expect(result.current.isOrgAdmin).toBe(false);
		});

		it("hasOrgAccess matches slug against active organization", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(orgState),
			});
			expect(result.current.hasOrgAccess("inventory")).toBe(true);
			expect(result.current.hasOrgAccess("crm")).toBe(false);
		});

		it("returns null org fields when not set", () => {
			const { result } = renderHook(() => useAuth(), {
				wrapper: createWrapper(authenticatedState),
			});
			expect(result.current.activeOrganization).toBeNull();
			expect(result.current.memberRole).toBeNull();
			expect(result.current.isOrgAdmin).toBe(false);
			expect(result.current.isOrgOwner).toBe(false);
		});
	});
});
