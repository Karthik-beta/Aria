import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fireEvent,
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "@/test/utils";
import ItemPriceStockPage from "./page";

const {
	mockInvalidate,
	mockUseItemsSubscription,
	mockUseQuery,
	mockUseStockEntriesSubscription,
} = vi.hoisted(() => ({
	mockInvalidate: vi.fn().mockResolvedValue(undefined),
	mockUseItemsSubscription: vi.fn(),
	mockUseQuery: vi.fn(),
	mockUseStockEntriesSubscription: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listItemPriceStock: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listItemPriceStock: {
				useQuery: mockUseQuery,
			},
			onStockEntriesChanged: {
				useSubscription: mockUseStockEntriesSubscription,
			},
			onItemsChanged: {
				useSubscription: mockUseItemsSubscription,
			},
		},
	},
}));

describe("ItemPriceStockPage", () => {
	beforeEach(() => {
		mockInvalidate.mockClear();
		mockUseItemsSubscription.mockClear();
		mockUseStockEntriesSubscription.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation(() => ({
			data: [
				{
					id: "Nova Gadget House::ITEM-001::Stores - GH",
					company: "Nova Gadget House",
					itemCode: "ITEM-001",
					itemName: "iPhone 13",
					itemGroupName: "Phones",
					brandName: "Apple",
					warehouse: "Stores - GH",
					availableQty: 25,
					buyingPriceList: "Standard Buying",
					buyingRate: 45000,
					sellingPriceList: "Standard Selling",
					sellingRate: 64999,
					lastActivityDate: new Date("2026-03-24T00:00:00.000Z"),
				},
			],
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		}));
	});

	it("renders the item price stock header and table row", () => {
		renderWithProviders(<ItemPriceStockPage />);

		expect(screen.getByText("Item Price Stock")).toBeInTheDocument();
		expect(screen.getByText("ITEM-001")).toBeInTheDocument();
		expect(screen.getByText("iPhone 13")).toBeInTheDocument();
	});

	it("passes company filter changes into the report query", async () => {
		renderWithProviders(<ItemPriceStockPage />);

		fireEvent.change(screen.getByLabelText("Filter by company"), {
			target: { value: "Nova Gadget House" },
		});

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({
					company: "Nova Gadget House",
					take: 250,
				}),
				expect.any(Object),
			);
		});
	});

	it("toggles zero-stock inclusion in the backend query", async () => {
		const user = userEvent.setup();
		renderWithProviders(<ItemPriceStockPage />);

		await user.click(screen.getByLabelText("Include zero stock items"));

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({ includeZeroStockItems: false }),
				expect.any(Object),
			);
		});
	});

	it("resets active filters", async () => {
		const user = userEvent.setup();
		renderWithProviders(<ItemPriceStockPage />);

		const warehouseInput = screen.getByLabelText("Filter by warehouse");
		fireEvent.change(warehouseInput, {
			target: { value: "Stores - GH" },
		});

		const resetButton = screen.getByRole("button", { name: "Reset filters" });
		expect(resetButton).toBeEnabled();

		await user.click(resetButton);

		await waitFor(() => {
			expect(warehouseInput).toHaveValue("");
		});
	});
});
