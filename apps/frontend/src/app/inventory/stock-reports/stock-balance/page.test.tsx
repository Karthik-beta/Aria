import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fireEvent,
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "@/test/utils";
import StockBalancePage from "./page";

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
				listStockBalance: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listStockBalance: {
				useQuery: mockUseQuery,
			},
			onStockEntriesChanged: {
				useSubscription: mockUseSubscription,
			},
		},
	},
}));

describe("StockBalancePage", () => {
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
					itemGroupName: "Phones",
					brandName: "Apple",
					warehouse: "Stores - GH",
					unitOfMeasure: "Nos",
					openingQty: 10,
					openingValue: 450000,
					inQty: 2,
					inValue: 90000,
					outQty: 1,
					outValue: 45000,
					balanceQty: 11,
					valuationRate: 45000,
					balanceValue: 495000,
					lastPostingDate: new Date("2026-03-24T00:00:00.000Z"),
				},
			],
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		}));
	});

	it("renders the stock balance header and table row", () => {
		renderWithProviders(<StockBalancePage />);

		expect(screen.getByText("Stock Balance")).toBeInTheDocument();
		expect(screen.getByText("ITEM-001")).toBeInTheDocument();
		expect(screen.getByText("iPhone 13")).toBeInTheDocument();
	});

	it("passes company filter changes into the report query", async () => {
		renderWithProviders(<StockBalancePage />);

		fireEvent.change(screen.getByLabelText("Filter by company"), {
			target: { value: "Nova Gadget House" },
		});

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({
					company: "Nova Gadget House",
					status: "SUBMITTED",
					take: 250,
				}),
				expect.any(Object),
			);
		});
	});

	it("toggles zero-stock inclusion in the backend query", async () => {
		const user = userEvent.setup();
		renderWithProviders(<StockBalancePage />);

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
		renderWithProviders(<StockBalancePage />);

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
