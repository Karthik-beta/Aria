/**
 * Protected Content — AuthGate and RoleGate Tests
 *
 * Validates that authentication and role-based access gating work correctly,
 * ensuring unauthorized users cannot see protected content.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

interface MockAuthReturn {
	isAuthenticated: boolean;
	isActive: boolean;
	isLoading: boolean;
	user: null;
	role: null;
	hasRole: (k: string) => boolean;
	hasAnyRole: (...k: string[]) => boolean;
}

const deny: MockAuthReturn = {
	isAuthenticated: true,
	isActive: true,
	isLoading: false,
	user: null,
	role: null,
	hasRole: () => false,
	hasAnyRole: () => false,
};

const mockAuth = vi.fn<() => MockAuthReturn>(() => ({ ...deny }));

vi.mock("@/hooks/use-auth", () => ({
	useAuth: () => mockAuth(),
}));

import { AuthGate, RoleGate } from "./protected-content";

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

	it("renders fallback when inactive", () => {
		mockAuth.mockReturnValue({ ...deny, isActive: false });

		render(
			<AuthGate fallback={<div>Inactive</div>}>
				<div>Protected</div>
			</AuthGate>,
		);

		expect(screen.queryByText("Protected")).not.toBeInTheDocument();
		expect(screen.getByText("Inactive")).toBeInTheDocument();
	});

	it("renders nothing during loading", () => {
		mockAuth.mockReturnValue({ ...deny, isLoading: true });

		const { container } = render(
			<AuthGate>
				<div>Protected</div>
			</AuthGate>,
		);

		expect(container.innerHTML).toBe("");
	});
});

describe("RoleGate", () => {
	it("renders children when user has the role", () => {
		mockAuth.mockReturnValue({
			...deny,
			hasRole: () => true,
		});

		render(
			// biome-ignore lint/a11y/useValidAriaRole: `role` is a component prop, not an ARIA attribute
			<RoleGate role="admin" requireAll>
				<div>Is Admin</div>
			</RoleGate>,
		);

		expect(screen.getByText("Is Admin")).toBeInTheDocument();
	});

	it("renders children when user has any of the roles (array, any match)", () => {
		mockAuth.mockReturnValue({
			...deny,
			hasAnyRole: (...roles: string[]) => roles.includes("admin"),
		});

		render(
			<RoleGate role={["super_admin", "admin"]}>
				<div>Has Role</div>
			</RoleGate>,
		);

		expect(screen.getByText("Has Role")).toBeInTheDocument();
	});

	it("renders fallback when user lacks the role", () => {
		mockAuth.mockReturnValue({ ...deny, hasRole: () => false });

		render(
			// biome-ignore lint/a11y/useValidAriaRole: `role` is a component prop, not an ARIA attribute
			<RoleGate role="admin" fallback={<div>Not Admin</div>}>
				<div>Is Admin</div>
			</RoleGate>,
		);

		expect(screen.queryByText("Is Admin")).not.toBeInTheDocument();
		expect(screen.getByText("Not Admin")).toBeInTheDocument();
	});

	it("renders fallback when user has role but requireAll=true and not all match", () => {
		mockAuth.mockReturnValue({
			...deny,
			hasRole: (r: string) => r === "admin",
		});

		render(
			<RoleGate
				role={["admin", "inventory_admin"]}
				requireAll
				fallback={<div>Missing Roles</div>}
			>
				<div>Has All Roles</div>
			</RoleGate>,
		);

		expect(screen.queryByText("Has All Roles")).not.toBeInTheDocument();
		expect(screen.getByText("Missing Roles")).toBeInTheDocument();
	});

	it("renders nothing during loading", () => {
		mockAuth.mockReturnValue({ ...deny, isLoading: true });

		const { container } = render(
			// biome-ignore lint/a11y/useValidAriaRole: `role` is a component prop, not an ARIA attribute
			<RoleGate role="admin">
				<div>Loading</div>
			</RoleGate>,
		);

		expect(container.innerHTML).toBe("");
	});

	it("renders null fallback by default when access denied", () => {
		mockAuth.mockReturnValue({ ...deny, hasRole: () => false });

		const { container } = render(
			// biome-ignore lint/a11y/useValidAriaRole: `role` is a component prop, not an ARIA attribute
			<RoleGate role="super_admin">
				<div>Secret</div>
			</RoleGate>,
		);

		expect(container.innerHTML).toBe("");
	});
});
