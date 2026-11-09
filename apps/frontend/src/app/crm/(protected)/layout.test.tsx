/**
 * Tests for the CRM ProtectedLayout component and its sidebar state integration.
 */
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import ProtectedLayout from "./layout";

vi.mock("next/headers", () => ({
	cookies: () =>
		Promise.resolve({
			get: (key: string) =>
				key === "sidebar_state" ? { value: "true" } : undefined,
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
					email: "crm@test.com",
					name: "CRM User",
					emailVerified: true,
					createdAt: new Date(),
					updatedAt: new Date(),
					mustChangePassword: false,
					role: "user",
				},
				session: {
					id: "session-1",
					userId: "user-1",
					expiresAt: new Date(),
				},
			},
			role: "user",
			isActive: true,
		}),
	getServerSession: () => Promise.resolve(null),
	getAuthorizationData: () => Promise.resolve(null),
}));

vi.mock("@/lib/active-theme.server", () => ({
	getActiveThemeValue: () => Promise.resolve("system"),
}));

vi.mock("@/config/auth", () => ({
	AUTH_CONFIG: { appRedirects: { crm: "/crm" } },
}));

vi.mock("@/components/kbar", () => ({
	default: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/layout/app-sidebar", () => ({
	default: ({ activeAppKey }: { activeAppKey: string }) => (
		<div data-testid="app-sidebar" data-active-app={activeAppKey}>
			Sidebar
		</div>
	),
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
	SidebarProvider: ({
		children,
		defaultOpen,
	}: {
		children: ReactNode;
		defaultOpen?: boolean;
	}) => (
		<div data-testid="sidebar-provider" data-default-open={String(defaultOpen)}>
			{children}
		</div>
	),
}));

vi.mock("@/components/ui/sonner", () => ({
	Toaster: () => null,
}));

vi.mock("@/lib/cookies", () => ({
	SIDEBAR_COOKIE_NAME: "sidebar_state",
}));

vi.mock("@/components/auth/auth-state-provider", () => ({
	AuthStateProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/auth/organization-gate", () => ({
	OrganizationGate: ({ children }: { children: ReactNode }) => (
		<div data-testid="org-gate">{children}</div>
	),
}));

describe("CRM ProtectedLayout", () => {
	it("renders sidebar with correct app key and sidebar state", async () => {
		const element = await ProtectedLayout({
			children: <div data-testid="crm-content">CRM Dashboard</div>,
		});
		renderWithProviders(element);

		expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
		expect(screen.getByTestId("app-sidebar")).toHaveAttribute(
			"data-active-app",
			"crm",
		);
		expect(screen.getByTestId("sidebar-provider")).toHaveAttribute(
			"data-default-open",
			"true",
		);
		expect(screen.getByTestId("crm-content")).toBeInTheDocument();
	});
});
