import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../../../test/utils";
import ItemManufacturersPage from "./page";

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => async (values: unknown) => ({
		values,
		errors: {},
	}),
}));

vi.mock("@aria/types", () => ({
	Inventory: {
		createItemManufacturerSchema: {
			safeParse: (input: unknown) => ({
				success: true as const,
				data: input,
			}),
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listItemManufacturers: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listItemManufacturers: {
				useQuery: () => ({
					data: [
						{
							id: "clh123manufacturer",
							itemId: "clh123item",
							itemCode: "01223",
							itemName: "iPhone 13",
							itemDescription: "Phone",
							manufacturer: "Apple",
							manufacturerPartNumber: "APL-001",
							isDefault: true,
							createdAt: new Date("2026-01-01"),
							updatedAt: new Date("2026-01-02"),
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			listBundleItems: {
				useQuery: () => ({
					data: [
						{
							id: "clh123item",
							name: "iPhone 13",
							code: "01223",
							description: "Phone",
							defaultUnitOfMeasureId: null,
						},
					],
				}),
			},
			createItemManufacturer: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
			deleteItemManufacturer: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
		},
	},
}));

describe("ItemManufacturersPage", () => {
	it("renders list and add button", () => {
		renderWithProviders(<ItemManufacturersPage />);

		expect(screen.getByText("Add Item Manufacturer")).toBeInTheDocument();
		expect(screen.getByText("01223")).toBeInTheDocument();
		expect(screen.getByText("Apple")).toBeInTheDocument();
		expect(screen.getByText("APL-001")).toBeInTheDocument();
	});
});
