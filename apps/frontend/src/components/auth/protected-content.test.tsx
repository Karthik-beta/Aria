/**
 * Protected Content — AppGate and ProtectedContent Tests
 *
 * Validates that app-level access gating works correctly during app switching,
 * ensuring unauthorized users cannot see content from apps they lack access to.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ─── Mock setup ──────────────────────────────────────────────────────────────

interface MockAuthReturn {
	isAuthenticated: boolean;
	isActive: boolean;
	isLoading: boolean;
	hasPermission: (k: string) => boolean;
	hasAnyPermission: (...k: string[]) => boolean;
	hasRole: (k: string) => boolean;
	hasAnyRole: (...k: string[]) => boolean;
	canAccessApp: (k: string) => boolean;
	isSupervisorOf: (k: string) => boolean;
}

const deny: MockAuthReturn = {
	isAuthenticated: true,
	isActive: true,
	isLoading: false,
	hasPermission: () => false,
	hasAnyPermission: () => false,
	hasRole: () => false,
	hasAnyRole: () => false,
	canAccessApp: () => false,
	isSupervisorOf: () => false,
};

const mockAuth = vi.fn<() => MockAuthReturn>(() => ({ ...deny }));

vi.mock("@/hooks/use-auth", () => ({
	useAuth: () => mockAuth(),
	useAppAccess: (appKey: string) => mockAuth().canAccessApp(appKey),
}));

import { AppGate, AuthGate, ProtectedContent } from "./protected-content";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AppGate", () => {
	it("renders children when user can access the app", () => {
		mockAuth.mockReturnValue({ ...deny, canAccessApp: () => true });

		render(
			<AppGate appKey="inventory">
				<div>Inventory Content</div>
			</AppGate>,
		);

		expect(screen.getByText("Inventory Content")).toBeInTheDocument();
	});

	it("renders fallback when user cannot access the app", () => {
		mockAuth.mockReturnValue({ ...deny });

		render(
			<AppGate appKey="crm" fallback={<div>No Access</div>}>
				<div>CRM Content</div>
			</AppGate>,
		);

		expect(screen.queryByText("CRM Content")).not.toBeInTheDocument();
		expect(screen.getByText("No Access")).toBeInTheDocument();
	});

	it("renders nothing during loading", () => {
		mockAuth.mockReturnValue({
			...deny,
			isLoading: true,
			canAccessApp: () => true,
		});

		const { container } = render(
			<AppGate appKey="inventory">
				<div>Should Not Appear</div>
			</AppGate>,
		);

		expect(container.innerHTML).toBe("");
	});

	it("renders null fallback by default when access denied", () => {
		mockAuth.mockReturnValue({ ...deny });

		const { container } = render(
			<AppGate appKey="asset">
				<div>Asset Content</div>
			</AppGate>,
		);

		expect(container.innerHTML).toBe("");
	});
});

describe("AuthGate", () => {
	it("renders children when authenticated and active", () => {
		mockAuth.mockReturnValue({ ...deny });

		render(
			<AuthGate>
				<div>Protected</div>
			</AuthGate>,
		);

		expect(screen.getByText("Protected")).toBeInTheDocument();
	});

	it("renders fallback when not authenticated", () => {
		mockAuth.mockReturnValue({
			...deny,
			isAuthenticated: false,
			isActive: false,
		});

		render(
			<AuthGate fallback={<div>Login Required</div>}>
				<div>Protected</div>
			</AuthGate>,
		);

		expect(screen.queryByText("Protected")).not.toBeInTheDocument();
		expect(screen.getByText("Login Required")).toBeInTheDocument();
	});

	it("renders fallback when authenticated but inactive", () => {
		mockAuth.mockReturnValue({ ...deny, isActive: false });

		render(
			<AuthGate fallback={<div>Inactive</div>}>
				<div>Protected</div>
			</AuthGate>,
		);

		expect(screen.queryByText("Protected")).not.toBeInTheDocument();
		expect(screen.getByText("Inactive")).toBeInTheDocument();
	});
});

describe("ProtectedContent — combined gate with appKey", () => {
	it("renders children when app access and permission are granted", () => {
		mockAuth.mockReturnValue({
			...deny,
			hasAnyPermission: () => true,
			canAccessApp: () => true,
		});

		render(
			<ProtectedContent appKey="inventory" permission="app:inventory:read">
				<div>Visible</div>
			</ProtectedContent>,
		);

		expect(screen.getByText("Visible")).toBeInTheDocument();
	});

	it("hides content when appKey check fails", () => {
		mockAuth.mockReturnValue({
			...deny,
			hasPermission: () => true,
			hasAnyPermission: () => true,
			hasRole: () => true,
			hasAnyRole: () => true,
		});

		const { container } = render(
			<ProtectedContent appKey="hrms">
				<div>HRMS Content</div>
			</ProtectedContent>,
		);

		expect(screen.queryByText("HRMS Content")).not.toBeInTheDocument();
		expect(container.innerHTML).toBe("");
	});

	it("hides content when permission check fails despite app access", () => {
		mockAuth.mockReturnValue({ ...deny, canAccessApp: () => true });

		const { container } = render(
			<ProtectedContent appKey="inventory" permission="app:inventory:write">
				<div>Write Area</div>
			</ProtectedContent>,
		);

		expect(screen.queryByText("Write Area")).not.toBeInTheDocument();
		expect(container.innerHTML).toBe("");
	});

	it("hides content when role check fails despite app access", () => {
		mockAuth.mockReturnValue({ ...deny, canAccessApp: () => true });

		const el = (
			// biome-ignore lint/a11y/useValidAriaRole: `role` is a component prop, not an HTML attribute
			<ProtectedContent appKey="inventory" role="admin">
				<div>Admin Area</div>
			</ProtectedContent>
		);
		const { container } = render(el);

		expect(screen.queryByText("Admin Area")).not.toBeInTheDocument();
		expect(container.innerHTML).toBe("");
	});

	it("renders fallback when not authenticated", () => {
		mockAuth.mockReturnValue({
			...deny,
			isAuthenticated: false,
			isActive: false,
		});

		render(
			<ProtectedContent appKey="inventory" fallback={<div>Please log in</div>}>
				<div>Secret</div>
			</ProtectedContent>,
		);

		expect(screen.queryByText("Secret")).not.toBeInTheDocument();
		expect(screen.getByText("Please log in")).toBeInTheDocument();
	});
});
