import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fireEvent,
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "@/test/utils";
import StockSummaryPage from "./page";

const {
	mockInvalidate,
	mockUseDeliveryNotesSubscription,
	mockUseMaterialRequestsSubscription,
	mockUsePickListsSubscription,
	mockUseQuery,
	mockUseStockEntriesSubscription,
	mockUseMutation,
} = vi.hoisted(() => ({
	mockInvalidate: vi.fn().mockResolvedValue(undefined),
	mockUseDeliveryNotesSubscription: vi.fn(),
	mockUseMaterialRequestsSubscription: vi.fn(),
	mockUsePickListsSubscription: vi.fn(),
	mockUseQuery: vi.fn(),
	mockUseStockEntriesSubscription: vi.fn(),
	mockUseMutation: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listStockSummary: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listStockSummary: {
				useQuery: mockUseQuery,
			},
			onStockEntriesChanged: {
				useSubscription: mockUseStockEntriesSubscription,
			},
			onMaterialRequestsChanged: {
				useSubscription: mockUseMaterialRequestsSubscription,
			},
			onDeliveryNotesChanged: {
				useSubscription: mockUseDeliveryNotesSubscription,
			},
			onPickListsChanged: {
				useSubscription: mockUsePickListsSubscription,
			},
			exportStockSummaryExcel: {
				useMutation: () => ({ mutateAsync: mockUseMutation }),
			},
		},
	},
}));

describe("StockSummaryPage", () => {
	beforeEach(() => {
		mockInvalidate.mockClear();
		mockUseStockEntriesSubscription.mockClear();
		mockUseMaterialRequestsSubscription.mockClear();
		mockUseDeliveryNotesSubscription.mockClear();
		mockUsePickListsSubscription.mockClear();
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
					actualQty: 8,
					plannedQty: 0,
					requestedQty: 12,
					orderedQty: 4,
					reservedQty: 2,
					reservedQtyForProduction: 0,
					reservedQtyForSubcontracting: 0,
					reservedQtyForProductionPlan: 0,
					projectedQty: 22,
					reorderLevel: 10,
					reorderQty: 5,
					shortageQty: 0,
					primaryMetric: "PROJECTED_QTY",
					primaryMetricValue: 22,
					stockHealth: "SURPLUS",
					recommendedAction: "MOVE_AND_ADD",
					lastActivityDate: new Date("2026-03-24T00:00:00.000Z"),
				},
			],
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		}));
	});

	it("renders the stock summary header and table row", () => {
		renderWithProviders(<StockSummaryPage />);

		expect(screen.getByText("Stock Summary")).toBeInTheDocument();
		expect(screen.getByText("ITEM-001")).toBeInTheDocument();
		expect(screen.getByText("Stores - GH")).toBeInTheDocument();
	});

	it("passes metric filter changes into the report query", async () => {
		const user = userEvent.setup();
		renderWithProviders(<StockSummaryPage />);

		await user.click(screen.getByLabelText("Primary stock metric"));
		await user.click(screen.getByRole("option", { name: "Shortage qty" }));

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({
					metric: "SHORTAGE_QTY",
					take: 250,
				}),
				expect.any(Object),
			);
		});
	});

	it("toggles zero-stock inclusion in the backend query", async () => {
		const user = userEvent.setup();
		renderWithProviders(<StockSummaryPage />);

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
		renderWithProviders(<StockSummaryPage />);

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
