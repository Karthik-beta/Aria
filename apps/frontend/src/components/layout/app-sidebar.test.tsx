import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./app-sidebar";

let currentPathname = "/inventory/items-catalogue/item/";

vi.mock("next/navigation", () => ({
	usePathname: () => currentPathname,
}));

vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: () => false,
}));

vi.mock("../../hooks/use-media-query", () => ({
	useMediaQuery: () => ({ isOpen: false }),
}));

let mockCanAccessApp = (_key: string) => true;
let mockAuthLoading = false;

vi.mock("@/hooks/use-auth", () => ({
	useAuth: () => ({
		canAccessApp: (key: string) => mockCanAccessApp(key),
		isLoading: mockAuthLoading,
	}),
}));

vi.mock("@/lib/auth/client", () => ({
	useSession: () => ({
		data: {
			user: {
				name: "System Administrator",
				email: "admin@aria.local",
			},
		},
		isPending: false,
	}),
}));

// Use a spy for AppSwitcher to capture props
const mockAppSwitcher = vi.fn((_props: Record<string, unknown>) => (
	<div data-testid="app-switcher" />
));
vi.mock("../app-switcher", () => ({
	AppSwitcher: (props: Record<string, unknown>) => mockAppSwitcher(props),
}));

vi.mock("./user-dropdown-content", () => ({
	default: () => <div data-testid="user-dropdown-content" />,
}));

vi.mock("@/components/user-avatar-profile", () => ({
	UserAvatarProfile: () => <div data-testid="user-avatar-profile" />,
}));

function renderWithSidebar(ui: ReactNode) {
	return render(<SidebarProvider defaultOpen>{ui}</SidebarProvider>);
}

describe("AppSidebar", () => {
	beforeEach(() => {
		currentPathname = "/inventory/items-catalogue/item/";
		mockCanAccessApp = () => true;
		mockAuthLoading = false;
		mockAppSwitcher.mockClear();
	});

	it("keeps the current inventory section expanded for nested item routes", async () => {
		renderWithSidebar(<AppSidebar />);

		await waitFor(() => {
			expect(screen.getByText("Items Catalogue").closest("li")).toHaveAttribute(
				"data-state",
				"open",
			);
			expect(
				screen.getByRole("button", { name: "Items Catalogue" }),
			).toHaveAttribute("data-active", "true");
			expect(screen.getByText("Item Group")).toBeVisible();
		});
	});

	describe("App filtering based on authorization", () => {
		it("passes all apps when canAccessApp returns true for all", async () => {
			mockCanAccessApp = () => true;
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(mockAppSwitcher).toHaveBeenCalled();
			});

			const lastCallProps = mockAppSwitcher.mock.calls.at(-1)?.[0] as {
				apps: Array<{ key: string }>;
			};
			const appKeys = lastCallProps.apps.map((a: { key: string }) => a.key);
			expect(appKeys).toEqual(["inventory", "asset", "crm", "hrms"]);
		});

		it("filters apps when user has limited access", async () => {
			mockCanAccessApp = (key: string) => key === "inventory" || key === "crm";
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(mockAppSwitcher).toHaveBeenCalled();
			});

			const lastCallProps = mockAppSwitcher.mock.calls.at(-1)?.[0] as {
				apps: Array<{ key: string }>;
			};
			const appKeys = lastCallProps.apps.map((a: { key: string }) => a.key);
			expect(appKeys).toEqual(["inventory", "crm"]);
		});

		it("shows all apps when no access is granted (fallback)", async () => {
			mockCanAccessApp = () => false;
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(mockAppSwitcher).toHaveBeenCalled();
			});

			const lastCallProps = mockAppSwitcher.mock.calls.at(-1)?.[0] as {
				apps: Array<{ key: string }>;
			};
			// Falls back to all WORKSPACE_APPS when filter returns empty
			expect(lastCallProps.apps).toHaveLength(4);
		});

		it("shows all apps during auth loading", async () => {
			mockAuthLoading = true;
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(mockAppSwitcher).toHaveBeenCalled();
			});

			const lastCallProps = mockAppSwitcher.mock.calls.at(-1)?.[0] as {
				apps: Array<{ key: string }>;
			};
			expect(lastCallProps.apps).toHaveLength(4);
		});
	});

	describe("Active app detection", () => {
		it("passes correct defaultApp for /inventory routes", async () => {
			currentPathname = "/inventory/dashboard";
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(mockAppSwitcher).toHaveBeenCalled();
			});

			const lastCallProps = mockAppSwitcher.mock.calls.at(-1)?.[0] as {
				defaultApp: { key: string };
			};
			expect(lastCallProps.defaultApp.key).toBe("inventory");
		});

		it("passes correct defaultApp for /asset routes", async () => {
			currentPathname = "/asset/asset-category";
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(mockAppSwitcher).toHaveBeenCalled();
			});

			const lastCallProps = mockAppSwitcher.mock.calls.at(-1)?.[0] as {
				defaultApp: { key: string };
			};
			expect(lastCallProps.defaultApp.key).toBe("asset");
		});

		it("passes correct defaultApp for /crm routes", async () => {
			currentPathname = "/crm/leads";
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(mockAppSwitcher).toHaveBeenCalled();
			});

			const lastCallProps = mockAppSwitcher.mock.calls.at(-1)?.[0] as {
				defaultApp: { key: string };
			};
			expect(lastCallProps.defaultApp.key).toBe("crm");
		});

		it("passes correct defaultApp for /hrms routes", async () => {
			currentPathname = "/hrms/employees";
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(mockAppSwitcher).toHaveBeenCalled();
			});

			const lastCallProps = mockAppSwitcher.mock.calls.at(-1)?.[0] as {
				defaultApp: { key: string };
			};
			expect(lastCallProps.defaultApp.key).toBe("hrms");
		});

		it("falls back to first accessible app for unknown pathname", async () => {
			currentPathname = "/unknown-route";
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(mockAppSwitcher).toHaveBeenCalled();
			});

			const lastCallProps = mockAppSwitcher.mock.calls.at(-1)?.[0] as {
				defaultApp: { key: string };
			};
			// Should default to first accessible app (inventory)
			expect(lastCallProps.defaultApp.key).toBe("inventory");
		});
	});

	describe("Navigation items by active app", () => {
		it("renders inventory nav items for /inventory routes", async () => {
			currentPathname = "/inventory/dashboard";
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(screen.getByText("Items Catalogue")).toBeInTheDocument();
				expect(screen.getByText("Stock Transactions")).toBeInTheDocument();
			});
		});

		it("renders asset nav items for /asset routes", async () => {
			currentPathname = "/asset/dashboard";
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(screen.getByText("Assets")).toBeInTheDocument();
				expect(screen.getByText("Maintenance")).toBeInTheDocument();
			});
		});

		it("renders crm nav items for /crm routes", async () => {
			currentPathname = "/crm/dashboard";
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(screen.getByText("Sales Pipeline")).toBeInTheDocument();
				expect(screen.getByText("Masters")).toBeInTheDocument();
			});
		});

		it("renders hrms nav items for /hrms routes", async () => {
			currentPathname = "/hrms/dashboard";
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(screen.getByText("Employee")).toBeInTheDocument();
				expect(screen.getByText("Attendance")).toBeInTheDocument();
			});
		});
	});
});
