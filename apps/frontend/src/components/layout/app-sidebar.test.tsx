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

let mockHasAdminAccess = false;
let mockAuthLoading = false;

vi.mock("@/hooks/use-auth", () => ({
	useAuth: () => ({
		isAuthenticated: true,
		isActive: true,
		user: { name: "System Administrator", email: "admin@aria.local" },
		role: mockHasAdminAccess ? "admin" : "user",
		hasRole: (roleKey: string) =>
			roleKey === (mockHasAdminAccess ? "admin" : "user"),
		hasAnyRole: (..._roles: string[]) => mockHasAdminAccess,
		isLoading: mockAuthLoading,
	}),
}));

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
		mockHasAdminAccess = false;
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

		it("passes correct defaultApp for /admin routes", async () => {
			currentPathname = "/admin/users";
			mockHasAdminAccess = true;
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(mockAppSwitcher).toHaveBeenCalled();
			});

			const lastCallProps = mockAppSwitcher.mock.calls.at(-1)?.[0] as {
				defaultApp: { key: string };
			};
			expect(lastCallProps.defaultApp.key).toBe("admin");
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

		it("renders admin nav items for /admin routes", async () => {
			currentPathname = "/admin/users";
			mockHasAdminAccess = true;
			renderWithSidebar(<AppSidebar />);

			await waitFor(() => {
				expect(screen.getByText("Administration")).toBeInTheDocument();
				expect(screen.getByText("Users")).toBeInTheDocument();
			});
		});
	});
});
