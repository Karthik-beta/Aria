import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../../test/utils";
import ItemAlternativesPage from "./page";

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listItemAlternatives: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listItemAlternatives: {
				useQuery: () => ({
					data: [
						{
							id: "clh123alt",
							itemId: "clh123item",
							itemCode: "43567-OR",
							itemName: "Orange Shirt",
							alternativeItemId: "clh123item2",
							alternativeItemCode: "43567-BLA",
							alternativeItemName: "Black Shirt",
							createdAt: new Date("2026-01-01"),
							updatedAt: new Date("2026-01-02"),
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			deleteItemAlternative: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
		},
	},
}));

describe("ItemAlternativesPage", () => {
	it("renders list and add button", () => {
		renderWithProviders(<ItemAlternativesPage />);

		expect(screen.getByText("Add Item Alternative")).toBeInTheDocument();
		expect(screen.getByText("43567-OR")).toBeInTheDocument();
		expect(screen.getByText("43567-BLA")).toBeInTheDocument();
	});
});
