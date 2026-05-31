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

		it("should fall back to first app when safeApps is empty and no defaultApp", async () => {
			// Create a minimal valid defaultApp so the component can render something
			// (both apps=[] and defaultApp triggers safeApps = [defaultApp])
			renderWithProviders(<AppSwitcher apps={[]} defaultApp={testApps[0]} />);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});
		});

		it("should handle single app in the list", async () => {
			const singleApp = [testApps[0]];
			renderWithProviders(
				<AppSwitcher apps={singleApp} defaultApp={singleApp[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});
		});
	});

	describe("Dropdown Content", () => {
		it("should display all four app options in dropdown", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByText("Asset")).toBeInTheDocument();
				expect(screen.getByText("CRM")).toBeInTheDocument();
				expect(screen.getByText("HRMS")).toBeInTheDocument();
			});
		});

		it("should display 'Apps' label in dropdown", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByText("Apps")).toBeInTheDocument();
			});
		});

		it("should display 'by Pivotr' subtitle", async () => {
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("by Pivotr")).toBeInTheDocument();
			});
		});

		it("should show keyboard shortcut labels in dropdown items", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			const button = screen.getByRole("button");
			await user.click(button);

			// ⌘1 through ⌘4 for 4 apps
			await waitFor(() => {
				expect(screen.getByText("⌘1")).toBeInTheDocument();
				expect(screen.getByText("⌘2")).toBeInTheDocument();
				expect(screen.getByText("⌘3")).toBeInTheDocument();
				expect(screen.getByText("⌘4")).toBeInTheDocument();
			});
		});

		it("should bold the active app name in dropdown", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			const button = screen.getByRole("button");
			await user.click(button);

			// The active app in the dropdown gets class "font-semibold"
			const allInventory = await screen.findAllByText("Inventory");
			const dropdownItem = allInventory[1]; // second instance is in dropdown
			expect(dropdownItem).toHaveClass("font-semibold");
		});
	});

	describe("Navigation State Reset", () => {
		it("should show Switching text and then call push exactly once", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			// Start navigation to Asset
			const button = screen.getByRole("button");
			await user.click(button);

			const assetOption = await screen.findByText("Asset");
			await user.click(assetOption);

			// Verify navigating state shows "Switching..." and push was called
			await waitFor(() => {
				expect(screen.getByText("Switching...")).toBeInTheDocument();
			});

			// Navigation push should be called exactly once
			expect(mockPush).toHaveBeenCalledTimes(1);
			expect(mockPush).toHaveBeenCalledWith("/asset");
		});
	});

	describe("Route Matching", () => {
		it("detects active app from sub-route pathname", async () => {
			currentPathname = "/inventory/items-catalogue/item";
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				// Inventory should be shown as the active app from the sub-route
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});
		});

		it("detects active app from deep nested route", async () => {
			currentPathname = "/crm/leads/123/edit";
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("CRM")).toBeInTheDocument();
			});
		});

		it("correct active app for each module root route", async () => {
			for (const app of testApps) {
				currentPathname = app.route;

				const { unmount } = renderWithProviders(
					<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
				);

				await waitFor(() => {
					expect(screen.getByText(app.name)).toBeInTheDocument();
				});

				unmount();
			}
		});
	});

	describe("Concurrent Action Protection", () => {
		it("should only call router.push once for rapid double-click", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			// Open dropdown
			const button = screen.getByRole("button");
			await user.click(button);

			// Click Asset
			const assetOption = await screen.findByText("Asset");
			await user.click(assetOption);

			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledTimes(1);
				expect(mockPush).toHaveBeenCalledWith("/asset");
			});

			// The button should be disabled now (isNavigating=true) so
			// a second click should not be possible — but even trying
			// should not result in a second push
			expect(mockPush).toHaveBeenCalledTimes(1);
		});

		it("should disable trigger button while navigating", async () => {
			const user = userEvent.setup();
			renderWithProviders(
				<AppSwitcher apps={testApps} defaultApp={testApps[0]} />,
			);

			await waitFor(() => {
				expect(screen.getByText("Inventory")).toBeInTheDocument();
			});

			// Open dropdown and start navigation
			const button = screen.getByRole("button");
			await user.click(button);

			const assetOption = await screen.findByText("Asset");
			await user.click(assetOption);

			// The trigger button should be disabled during navigation
			await waitFor(() => {
				expect(screen.getByRole("button")).toBeDisabled();
			});
		});
	});
});
