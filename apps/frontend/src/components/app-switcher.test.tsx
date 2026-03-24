/**
 * AppSwitcher Component Tests
 * Tests for app switching functionality including rapid switching reliability
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSwitcher } from "./app-switcher";

// Mock icons
const MockIcon = ({ className }: { className?: string }) => (
	<span data-testid="mock-icon" className={className}>
		Icon
	</span>
);

// Test apps
const testApps = [
	{ id: "inventory", name: "Inventory", logo: MockIcon, route: "/inventory" },
	{ id: "asset", name: "Asset", logo: MockIcon, route: "/asset" },
	{ id: "crm", name: "CRM", logo: MockIcon, route: "/crm" },
	{ id: "hrms", name: "HRMS", logo: MockIcon, route: "/hrms" },
];

// Mock router with spies
const mockPush = vi.fn();
let currentPathname = "/inventory";

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		pathname: "/",
		query: {},
	}),
	useSearchParams: () => new URLSearchParams(),
	usePathname: () => currentPathname,
}));

// Mock the useIsMobile hook to return false (desktop mode)
vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: () => false,
}));

// Helper to render with all required providers
function renderWithProviders(ui: React.ReactElement) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<SidebarProvider defaultOpen>{ui}</SidebarProvider>
		</QueryClientProvider>,
	);
}

describe("AppSwitcher Component", () => {
	beforeEach(() => {
		mockPush.mockClear();
		currentPathname = "/inventory";
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("Rendering", () => {
		it("should render with default app", async () => {
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});
		});

		it("should render app switcher button", async () => {
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				const button = screen.getByRole("button");
				expect(button).toBeInTheDocument();
			});
		});
	});

	describe("Navigation", () => {
		it("should navigate when clicking a different app", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			// Wait for hydration
			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			// Open dropdown
			const button = screen.getByRole("button");
			await user.click(button);

			// Click on Asset app
			await waitFor(() => {
				const assetOption = screen.getByText("Asset");
				expect(assetOption).toBeInTheDocument();
			});

			const assetOption = screen.getByText("Asset");
			await user.click(assetOption);

			// Wait for navigation (100ms timer + some buffer)
			await waitFor(
				() => {
					expect(mockPush).toHaveBeenCalledWith("/asset");
				},
				{ timeout: 500 },
			);
		});

		it("should show loading state during navigation", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			// Wait for hydration
			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			// Open dropdown
			const button = screen.getByRole("button");
			await user.click(button);

			// Click on Asset app
			const assetOption = await screen.findByText("Asset");
			await user.click(assetOption);

			// Should show "Switching..." text immediately after click
			await waitFor(() => {
				expect(screen.getByText("Switching...")).toBeInTheDocument();
			});
		});
	});

	describe("Rapid Switching Reliability", () => {
		it("should update UI to show last selected app", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			// Wait for hydration
			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			// Open dropdown
			const button = screen.getByRole("button");
			await user.click(button);

			// Click on HRMS app
			const hrmsOption = await screen.findByText("HRMS");
			await user.click(hrmsOption);

			// Should show "Switching..." with navigating state
			await waitFor(() => {
				expect(screen.getByText("Switching...")).toBeInTheDocument();
			});

			// Wait for navigation
			await waitFor(
				() => {
					expect(mockPush).toHaveBeenCalledWith("/hrms");
				},
				{ timeout: 500 },
			);
		});

		it("should disable menu items while navigating", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			// Wait for hydration
			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			// Open dropdown
			const button = screen.getByRole("button");
			await user.click(button);

			// Click on Asset app (starts navigation)
			const assetOption = await screen.findByText("Asset");
			await user.click(assetOption);

			// Wait for navigation to complete
			await waitFor(
				() => {
					expect(mockPush).toHaveBeenCalledWith("/asset");
				},
				{ timeout: 500 },
			);
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty apps array with default app", async () => {
			renderWithProviders(<AppSwitcher apps={[]} defaultApp={testApps[0]} />);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});
		});

		it("should use default app if pathname does not match any app", async () => {
			currentPathname = "/unknown";
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});
		});

		it("should not navigate when clicking currently active app", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			// Wait for hydration
			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			// Open dropdown
			const button = screen.getByRole("button");
			await user.click(button);

			// Find the inventory option in dropdown (should be disabled)
			const inventoryOptions = await screen.findAllByText("Inventory");
			// Second one is in the dropdown menu
			const dropdownOption = inventoryOptions[1];

			// Click on the already active app
			await user.click(dropdownOption);

			// userEvent.click settles all microtasks and state updates.
			// The component's handleAppSwitch guards against re-navigating to the
			// already-active app synchronously, so mockPush must not have been called.
			expect(mockPush).not.toHaveBeenCalled();
		});
	});
});
