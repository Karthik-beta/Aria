import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
	type AuthState,
	AuthStateProvider,
} from "@/components/auth/auth-state-provider";
import {
	isAssetManagerRole,
	useCanManageAssets,
} from "@/hooks/use-can-manage-assets";

function renderWith(state: Partial<AuthState> | null) {
	const value: AuthState | null = state
		? {
				session: null,
				role: "user",
				isActive: true,
				activeOrganization: null,
				memberRole: null,
				...state,
			}
		: null;
	const wrapper = ({ children }: { children: ReactNode }) =>
		value
			? createElement(AuthStateProvider, { value, children })
			: createElement("div", null, children);
	return renderHook(() => useCanManageAssets(), { wrapper }).result.current;
}

describe("isAssetManagerRole", () => {
	it.each([
		["owner", true],
		["admin", true],
		["member,admin", true],
		["member, owner", true],
		["member", false],
		["", false],
		[null, false],
	])("%s → %s", (role, expected) => {
		expect(isAssetManagerRole(role)).toBe(expected);
	});
});

describe("useCanManageAssets", () => {
	it("allows org owners and admins", () => {
		expect(renderWith({ memberRole: "owner" })).toBe(true);
		expect(renderWith({ memberRole: "admin" })).toBe(true);
	});

	it("denies plain members", () => {
		expect(renderWith({ memberRole: "member" })).toBe(false);
	});

	it("allows super admins without an org role", () => {
		// useAuth reads the global role from the session user.
		const session = {
			user: { id: "user-1", role: "super_admin" },
			session: { id: "session-1", userId: "user-1" },
		} as unknown as AuthState["session"];
		expect(renderWith({ session, memberRole: null })).toBe(true);
	});

	it("denies when there is no auth state", () => {
		expect(renderWith(null)).toBe(false);
	});
});
