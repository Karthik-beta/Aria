/**
 * Root HomePage Tests
 *
 * Tests the initial redirect logic that routes authenticated users
 * to their first accessible app based on priority and authorization.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		replace: mockReplace,
		push: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
	}),
}));

// Default mock: unauthenticated
interface MockAuthReturn {
	apps: Record<string, unknown>;
	isAuthenticated: boolean;
	isLoading: boolean;
	hasRole: (r: string) => boolean;
	canAccessApp: (k: string) => boolean;
}

const defaultAuth: MockAuthReturn = {
	apps: {},
	isAuthenticated: false,
	isLoading: false,
	hasRole: () => false,
	canAccessApp: () => false,
};

const mockAuth = vi.fn<() => MockAuthReturn>(() => ({ ...defaultAuth }));

vi.mock("@/hooks/use-auth", () => ({
	useAuth: () => mockAuth(),
}));

import HomePage from "./page";

describe("HomePage — app redirect logic", () => {
	beforeEach(() => {
		mockReplace.mockClear();
		mockAuth.mockClear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("shows loading UI while auth is pending", () => {
		mockAuth.mockReturnValue({ ...defaultAuth, isLoading: true });

		render(<HomePage />);
		expect(screen.getByText("Preparing your workspace...")).toBeInTheDocument();
		expect(mockReplace).not.toHaveBeenCalled();
	});

	it("does not redirect when unauthenticated", () => {
		mockAuth.mockReturnValue({ ...defaultAuth });

		render(<HomePage />);
		expect(mockReplace).not.toHaveBeenCalled();
	});

	it("redirects super_admin to /inventory (highest priority)", async () => {
		mockAuth.mockReturnValue({
			...defaultAuth,
			apps: { inventory: { roles: ["admin"] } },
			isAuthenticated: true,
			hasRole: (r: string) => r === "super_admin",
			canAccessApp: () => true,
		});

		render(<HomePage />);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/inventory");
		});
	});

	it("redirects to first accessible app by APP_PRIORITY", async () => {
		// User can only access crm and hrms — crm comes first in priority
		mockAuth.mockReturnValue({
			...defaultAuth,
			apps: { crm: { roles: ["user"] }, hrms: { roles: ["user"] } },
			isAuthenticated: true,
			canAccessApp: (key: string) => key === "crm" || key === "hrms",
		});

		render(<HomePage />);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/crm");
		});
	});

	it("redirects to /asset when only asset is accessible", async () => {
		mockAuth.mockReturnValue({
			...defaultAuth,
			apps: { asset: { roles: ["viewer"] } },
			isAuthenticated: true,
			canAccessApp: (key: string) => key === "asset",
		});

		render(<HomePage />);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/asset");
		});
	});

	it("falls back to /inventory when authenticated but no apps match", async () => {
		mockAuth.mockReturnValue({ ...defaultAuth, isAuthenticated: true });

		render(<HomePage />);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/inventory");
		});
	});

	it("redirects to /hrms when only hrms is accessible (lowest priority)", async () => {
		mockAuth.mockReturnValue({
			...defaultAuth,
			apps: { hrms: { roles: ["user"] } },
			isAuthenticated: true,
			canAccessApp: (key: string) => key === "hrms",
		});

		render(<HomePage />);

		await waitFor(() => {
			expect(mockReplace).toHaveBeenCalledWith("/hrms");
		});
	});
});
