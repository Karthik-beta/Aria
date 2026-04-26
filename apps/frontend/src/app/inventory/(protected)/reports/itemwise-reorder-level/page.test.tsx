import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import ItemwiseRecommendedReorderLevelPage from "./page";

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const { mockUseQuery, mockUseMutation } = vi.hoisted(() => ({
	mockUseQuery: vi.fn(),
	mockUseMutation: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({}),
		inventory: {
			listItemwiseRecommendedReorderLevel: {
				useQuery: mockUseQuery,
			},
			exportItemwiseRecommendedReorderLevelExcel: {
				useMutation: () => ({ mutateAsync: mockUseMutation }),
			},
		},
	},
}));

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeRows() {
	return [
		{
			id: "ITEM-001",
			itemCode: "ITEM-001",
			itemName: "Widget Alpha",
			itemGroup: "Raw Material",
			brand: "BrandX",
			description: "Standard widget",
			safetyStock: 10,
			leadTimeDays: 5,
			consumed: 150,
			delivered: 50,
			totalOutgoing: 200,
			avgDailyOutgoing: 6.667,
			reorderLevel: 43.333,
		},
		{
			id: "ITEM-002",
			itemCode: "ITEM-002",
			itemName: "Bolt B12",
			itemGroup: null,
			brand: null,
			description: null,
			safetyStock: 0,
			leadTimeDays: 3,
			consumed: 90,
			delivered: 0,
			totalOutgoing: 90,
			avgDailyOutgoing: 3,
			reorderLevel: 9,
		},
	];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockUseQuery.mockReset();
	mockUseQuery.mockReturnValue({
		data: undefined,
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	});
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ItemwiseRecommendedReorderLevelPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);
		expect(
			screen.getByRole("heading", {
				name: "Itemwise Recommended Reorder Level",
			}),
		).toBeInTheDocument();
	});

	it("renders all four filter inputs", () => {
		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);
		expect(screen.getByLabelText("From date")).toBeInTheDocument();
		expect(screen.getByLabelText("To date")).toBeInTheDocument();
		expect(screen.getByLabelText("Filter by item group")).toBeInTheDocument();
		expect(screen.getByLabelText("Filter by brand")).toBeInTheDocument();
	});

	it("shows loading indicator while fetching", async () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		expect(screen.getByText("Loading reorder level data…")).toBeInTheDocument();
	});

	it("renders data rows when data is loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeRows(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		await waitFor(() => {
			expect(screen.getByText("ITEM-001")).toBeInTheDocument();
			expect(screen.getByText("ITEM-002")).toBeInTheDocument();
		});
	});

	it("shows item names in the table", async () => {
		mockUseQuery.mockReturnValue({
			data: makeRows(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		await waitFor(() => {
			expect(screen.getByText("Widget Alpha")).toBeInTheDocument();
			expect(screen.getByText("Bolt B12")).toBeInTheDocument();
		});
	});

	it("shows empty state when result has no rows", async () => {
		mockUseQuery.mockReturnValue({
			data: [],
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		await waitFor(() => {
			expect(
				screen.getByText("No items found for the selected filters"),
			).toBeInTheDocument();
		});
	});

	it("shows validation error when fromDate is cleared", async () => {
		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		const fromDateInput = screen.getByLabelText("From date");
		fireEvent.change(fromDateInput, { target: { value: "" } });

		await waitFor(() => {
			expect(screen.getByText("From Date is required.")).toBeInTheDocument();
		});
	});

	it("shows validation error when fromDate is after toDate", async () => {
		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		const fromDateInput = screen.getByLabelText("From date");
		const toDateInput = screen.getByLabelText("To date");

		fireEvent.change(fromDateInput, { target: { value: "2025-12-31" } });
		fireEvent.change(toDateInput, { target: { value: "2025-01-01" } });

		await waitFor(() => {
			expect(
				screen.getByText("From Date must not be later than To Date."),
			).toBeInTheDocument();
		});
	});

	it("disables query when validation fails", async () => {
		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		const fromDateInput = screen.getByLabelText("From date");
		fireEvent.change(fromDateInput, { target: { value: "" } });

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			expect(lastCall[1].enabled).toBe(false);
		});
	});

	it("enables query when all required filters are valid", async () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		// Dates should be pre-filled, so query should be enabled by default
		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			expect(lastCall[1].enabled).toBe(true);
		});
	});

	it("passes optional filters to the query input", async () => {
		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		const itemGroupInput = screen.getByPlaceholderText("Item Group");
		const brandInput = screen.getByPlaceholderText("Brand");

		fireEvent.change(itemGroupInput, {
			target: { value: "Raw Material" },
		});
		fireEvent.change(brandInput, { target: { value: "BrandX" } });

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			const input = lastCall[0] as {
				itemGroup?: string;
				brand?: string;
			};
			expect(input.itemGroup).toBe("Raw Material");
			expect(input.brand).toBe("BrandX");
		});
	});

	it("omits optional filters when empty", async () => {
		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			const input = lastCall[0] as {
				itemGroup?: string;
				brand?: string;
			};
			expect(input.itemGroup).toBeUndefined();
			expect(input.brand).toBeUndefined();
		});
	});

	it("resets filters when Reset button is clicked", async () => {
		renderWithProviders(<ItemwiseRecommendedReorderLevelPage />);

		const itemGroupInput = screen.getByPlaceholderText(
			"Item Group",
		) as HTMLInputElement;
		fireEvent.change(itemGroupInput, {
			target: { value: "Finished Goods" },
		});
		expect(itemGroupInput.value).toBe("Finished Goods");

		const resetBtn = screen.getByRole("button", { name: /reset/i });
		fireEvent.click(resetBtn);

		await waitFor(() => {
			expect(itemGroupInput.value).toBe("");
		});
	});
});
