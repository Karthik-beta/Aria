import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fireEvent,
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "@/test/utils";
import StockProjectedQtyPage from "./page";

const { mockInvalidate, mockUseQuery, mockUseSubscription } = vi.hoisted(
	() => ({
		mockInvalidate: vi.fn().mockResolvedValue(undefined),
		mockUseQuery: vi.fn(),
		mockUseSubscription: vi.fn(),
	}),
);

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listStockProjectedQty: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listStockProjectedQty: {
				useQuery: mockUseQuery,
			},
			onStockEntriesChanged: {
				useSubscription: mockUseSubscription,
			},
		},
	},
}));

describe("StockProjectedQtyPage", () => {
	beforeEach(() => {
		mockInvalidate.mockClear();
		mockUseSubscription.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation(() => ({
			data: [
				{
					id: "Nova Gadget House::ITEM-001::Stores - GH",
					company: "Nova Gadget House",
					itemCode: "ITEM-001",
					itemName: "iPhone 13",
					description: "128 GB",
					itemGroupName: "Phones",
					brandName: "Apple",
					warehouse: "Stores - GH",
					unitOfMeasure: "Nos",
					actualQty: 11,
					plannedQty: 0,
					requestedQty: 0,
					orderedQty: 45,
					reservedQty: 5,
					reservedQtyForProduction: 0,
					reservedQtyForSubcontracting: 0,
					reservedQtyForProductionPlan: 0,
					projectedQty: 51,
					reorderLevel: 60,
					reorderQty: 10,
					shortageQty: 9,
					lastActivityDate: new Date("2026-03-24T00:00:00.000Z"),
				},
			],
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		}));
	});

	it("renders the projected qty header and table row", () => {
		renderWithProviders(<StockProjectedQtyPage />);

		expect(screen.getByText("Stock Projected Qty")).toBeInTheDocument();
		expect(screen.getByText("ITEM-001")).toBeInTheDocument();
		expect(screen.getByText("iPhone 13")).toBeInTheDocument();
	});

	it("passes company filter changes into the report query", async () => {
		renderWithProviders(<StockProjectedQtyPage />);

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
		renderWithProviders(<StockProjectedQtyPage />);

		await user.click(screen.getByLabelText("Include zero stock items"));

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({ includeZeroStockItems: true }),
				expect.any(Object),
			);
		});
	});

	it("resets active filters", async () => {
		const user = userEvent.setup();
		renderWithProviders(<StockProjectedQtyPage />);

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
