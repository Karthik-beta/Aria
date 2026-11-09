import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumbs } from "@/components/breadcrumbs";

// Track what useBreadcrumbs returns per test
const mockItems = vi.fn(() => [] as { title: string; link: string }[]);

vi.mock("@/hooks/use-breadcrumbs", () => ({
	useBreadcrumbs: () => mockItems(),
}));

describe("Breadcrumbs", () => {
	it("renders nothing when there are no items", () => {
		mockItems.mockReturnValue([]);
		const { container } = render(<Breadcrumbs />);

		expect(container.innerHTML).toBe("");
	});

	it("renders a single breadcrumb as a page (not a link)", () => {
		mockItems.mockReturnValue([{ title: "Dashboard", link: "/dashboard" }]);
		render(<Breadcrumbs />);

		expect(screen.getByText("Dashboard")).toBeInTheDocument();
	});

	it("renders multiple breadcrumbs with separators", () => {
		mockItems.mockReturnValue([
			{ title: "Inventory", link: "/inventory" },
			{ title: "Items", link: "/inventory/items" },
			{ title: "New", link: "/inventory/items/new" },
		]);
		render(<Breadcrumbs />);

		// First two are links, last is the page
		expect(screen.getByText("Inventory")).toBeInTheDocument();
		expect(screen.getByText("Items")).toBeInTheDocument();
		expect(screen.getByText("New")).toBeInTheDocument();

		// The last item should be a BreadcrumbPage (not a link)
		const lastItem = screen.getByText("New");
		expect(lastItem.closest("a")).toBeNull();
	});
});
