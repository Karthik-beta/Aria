/**
 * Tests for the AdminLayout component and its RoleGate access control.
 */
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import AdminLayout from "./layout";

vi.mock("next/headers", () => ({
	cookies: () =>
		Promise.resolve({
			get: () => ({ value: "true" }),
		}),
}));

vi.mock("sonner", () => ({
	Toaster: () => null,
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/link", () => ({
	default: ({ children, ...props }: { children: ReactNode }) => (
		// biome-ignore lint/a11y/useValidAnchor: test mock
		<a {...props} href="#">
			{children}
		</a>
	),
}));

vi.mock("@/lib/auth/server", () => ({
	requireProtectedAuthState: () =>
		Promise.resolve({
			session: {
				user: {
					id: "user-1",
					email: "admin@test.com",
					name: "Admin User",
					emailVerified: true,
					createdAt: new Date(),
					updatedAt: new Date(),
					mustChangePassword: false,
					role: "super_admin",
				},
				session: {
					id: "session-1",
					userId: "user-1",
					expiresAt: new Date(),
				},
			},
			role: "super_admin",
			isActive: true,
		}),
	getServerSession: () => Promise.resolve(null),
	getAuthorizationData: () => Promise.resolve(null),
}));

vi.mock("@/lib/active-theme.server", () => ({
	getActiveThemeValue: () => Promise.resolve("system"),
}));

vi.mock("@/config/auth", () => ({
	AUTH_CONFIG: { appRedirects: { admin: "/admin" } },
}));

vi.mock("@/components/kbar", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/layout/app-sidebar", () => ({
	default: () => <div data-testid="app-sidebar">Sidebar</div>,
}));

vi.mock("@/components/layout/header", () => ({
	default: () => <div data-testid="header">Header</div>,
}));

vi.mock("@/components/layout/providers", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/layout/ThemeToggle/theme-provider", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/ui/sidebar", () => ({
	SidebarInset: ({ children }: { children: ReactNode }) => children,
	SidebarProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/ui/sonner", () => ({
	Toaster: () => null,
}));

vi.mock("@/lib/cookies", () => ({
	SIDEBAR_COOKIE_NAME: "sidebar-state",
}));

vi.mock("@/components/auth/auth-state-provider", () => ({
	AuthStateProvider: ({
		children,
		value,
	}: {
		children: ReactNode;
		value: unknown;
	}) => {
		return (
			<div
				data-testid="auth-provider"
				data-role={(value as Record<string, unknown>)?.role}
			>
				{children}
			</div>
		);
	},
}));

vi.mock("@/components/auth/protected-content", () => ({
	RoleGate: ({
		children,
		role,
		fallback,
	}: {
		children: ReactNode;
		role: string[];
		fallback?: ReactNode;
	}) => {
		if (role.includes("super_admin")) {
			return <div data-testid="role-gate-allowed">{children}</div>;
		}
		return <div data-testid="role-gate-denied">{fallback}</div>;
	},
	AuthGate: ({ children }: { children: ReactNode }) => (
		<div data-testid="auth-gate">{children}</div>
	),
}));

describe("AdminLayout", () => {
	it("renders sidebar for admin users", async () => {
		const element = await AdminLayout({
			children: <div data-testid="content">Dashboard</div>,
		});
		renderWithProviders(element);
		expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
	});

	it("renders children inside RoleGate", async () => {
		const element = await AdminLayout({
			children: <div data-testid="content">Dashboard</div>,
		});
		renderWithProviders(element);
		expect(screen.getByTestId("role-gate-allowed")).toBeInTheDocument();
	});
});
