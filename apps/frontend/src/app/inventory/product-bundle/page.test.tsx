import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../../test/utils";
import ProductBundleListPage from "./page";

vi.mock("@/lib/trpc", () => ({
	trpc: {
		inventory: {
			listProductBundles: {
				useQuery: () => ({
					data: [
						{
							id: "clh123bundle",
							parentItemId: "clhparent",
							parentItemName: "iPhone 13",
							description: "iPhone + Case",
							disabled: false,
							bundleItems: [],
							createdAt: new Date("2026-01-01"),
							updatedAt: new Date("2026-01-02"),
						},
					],
					isLoading: false,
					refetch: vi.fn(),
				}),
			},
		},
	},
}));

describe("ProductBundleListPage", () => {
	it("renders list and add button", () => {
		renderWithProviders(<ProductBundleListPage />);

		expect(screen.getByText("Add Product Bundle")).toBeInTheDocument();
		expect(screen.getByText("iPhone 13")).toBeInTheDocument();
		expect(screen.getByText("iPhone + Case")).toBeInTheDocument();
	});
});
