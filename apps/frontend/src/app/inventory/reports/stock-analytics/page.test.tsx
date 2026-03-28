import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import StockAnalyticsPage from "./page";

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

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
				listStockAnalytics: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listStockAnalytics: {
				useQuery: mockUseQuery,
			},
			onStockEntriesChanged: {
				useSubscription: mockUseSubscription,
			},
		},
	},
}));

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeResult() {
	return {
		periods: [
			{
				from: new Date("2024-01-01T00:00:00.000Z"),
				to: new Date("2024-01-31T00:00:00.000Z"),
				label: "Jan 2024",
				key: "jan_2024",
			},
			{
				from: new Date("2024-02-01T00:00:00.000Z"),
				to: new Date("2024-02-29T00:00:00.000Z"),
				label: "Feb 2024",
				key: "feb_2024",
			},
		],
		rows: [
			{
				id: "ITEM-001",
				itemCode: "ITEM-001",
				itemName: "Widget Alpha",
				itemGroup: "Electronics",
				brand: "Acme",
				unitOfMeasure: "Nos",
				periodValues: { jan_2024: 10, feb_2024: 15 },
			},
			{
				id: "ITEM-002",
				itemCode: "ITEM-002",
				itemName: "Gadget Beta",
				itemGroup: "Accessories",
				brand: null,
				unitOfMeasure: "Pcs",
				periodValues: { jan_2024: 5, feb_2024: 5 },
			},
		],
	};
}

// ---------------------------------------------------------------------------
// Describe
// ---------------------------------------------------------------------------

describe("StockAnalyticsPage", () => {
	beforeEach(() => {
		mockInvalidate.mockClear();
		mockUseSubscription.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation(() => ({
			data: makeResult(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		}));
	});

	it("renders the page header", () => {
		renderWithProviders(<StockAnalyticsPage />);

		expect(screen.getByText("Stock Analytics")).toBeInTheDocument();
	});

	it("displays item codes and names from the query result", () => {
		renderWithProviders(<StockAnalyticsPage />);

		expect(screen.getByText("ITEM-001")).toBeInTheDocument();
		expect(screen.getByText("Widget Alpha")).toBeInTheDocument();
		expect(screen.getByText("ITEM-002")).toBeInTheDocument();
		expect(screen.getByText("Gadget Beta")).toBeInTheDocument();
	});

	it("shows period column headers from the result", () => {
		renderWithProviders(<StockAnalyticsPage />);

		expect(screen.getByText("Jan 2024")).toBeInTheDocument();
		expect(screen.getByText("Feb 2024")).toBeInTheDocument();
	});

	it("shows a loading spinner while data is loading", () => {
		mockUseQuery.mockImplementation(() => ({
			data: undefined,
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		}));

		renderWithProviders(<StockAnalyticsPage />);

		expect(
			screen.getByLabelText("Loading stock analytics"),
		).toBeInTheDocument();
	});

	it("shows an error state when the query fails", () => {
		mockUseQuery.mockImplementation(() => ({
			data: undefined,
			isLoading: false,
			error: { message: "Database connection failed" },
			refetch: vi.fn(),
		}));

		renderWithProviders(<StockAnalyticsPage />);

		expect(
			screen.getByText("Failed to load Stock Analytics"),
		).toBeInTheDocument();
	});

	it("shows an empty state when there are no rows", () => {
		mockUseQuery.mockImplementation(() => ({
			data: { periods: [], rows: [] },
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		}));

		renderWithProviders(<StockAnalyticsPage />);

		expect(screen.getByText("No stock movements found")).toBeInTheDocument();
	});

	it("shows a validation error when fromDate is after toDate", async () => {
		renderWithProviders(<StockAnalyticsPage />);

		const fromInput = screen.getByLabelText("From date");
		const toInput = screen.getByLabelText("To date");

		fireEvent.change(fromInput, { target: { value: "2024-12-31" } });
		fireEvent.change(toInput, { target: { value: "2024-01-01" } });

		await waitFor(() => {
			expect(
				screen.getByText("From Date must not be later than To Date."),
			).toBeInTheDocument();
		});
	});

	it("shows a validation error when fromDate is cleared", async () => {
		renderWithProviders(<StockAnalyticsPage />);

		const fromInput = screen.getByLabelText("From date");
		fireEvent.change(fromInput, { target: { value: "" } });

		await waitFor(() => {
			expect(screen.getByText("From Date is required.")).toBeInTheDocument();
		});
	});

	it("passes warehouse filter to the query", async () => {
		renderWithProviders(<StockAnalyticsPage />);

		fireEvent.change(screen.getByLabelText("Filter by warehouse"), {
			target: { value: "Stores - TC" },
		});

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({ warehouse: "Stores - TC" }),
				expect.any(Object),
			);
		});
	});

	it("resets all filters to initial state", async () => {
		renderWithProviders(<StockAnalyticsPage />);

		fireEvent.change(screen.getByLabelText("Filter by warehouse"), {
			target: { value: "Stores - TC" },
		});

		const resetButton = screen.getByRole("button", { name: "Reset filters" });
		expect(resetButton).toBeEnabled();

		fireEvent.click(resetButton);

		await waitFor(() => {
			expect(screen.getByLabelText("Filter by warehouse")).toHaveValue("");
		});
	});

	it("renders item count and period count summary", () => {
		renderWithProviders(<StockAnalyticsPage />);

		expect(screen.getByText(/2 items/)).toBeInTheDocument();
		expect(screen.getByText(/2 periods/)).toBeInTheDocument();
	});
});
