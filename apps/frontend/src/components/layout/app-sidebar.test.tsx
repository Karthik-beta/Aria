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

vi.mock("@/hooks/use-auth", () => ({
	useAuth: () => ({
		canAccessApp: () => true,
		isLoading: false,
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

vi.mock("../app-switcher", () => ({
	AppSwitcher: () => <div data-testid="app-switcher" />,
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
});
