import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import ItemPricesPage from "./page";

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

let mockQueryData: unknown;
let mockQueryIsLoading = false;
let mockQueryError: Error | null = null;
let capturedQueryInput: unknown;
let mockUseMutation: ReturnType<typeof vi.fn>;

function resetMockState() {
	mockQueryData = undefined;
	mockQueryIsLoading = false;
	mockQueryError = null;
	capturedQueryInput = undefined;
	mockUseMutation = vi.fn().mockResolvedValue(Buffer.from([]));
}

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({}),
		inventory: {
			listItemPrices: {
				useQuery: (input: unknown) => {
					capturedQueryInput = input;
					return {
						data: mockQueryData,
						isLoading: mockQueryIsLoading,
						error: mockQueryError,
					};
				},
			},
			exportItemPricesExcel: {
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
			itemGroupName: "Electronics",
			brandName: "Acme Corp",
			description: "A sturdy widget",
			stockUom: "Nos",
			lastPurchaseRate: 320.0,
			valuationRate: 350.0,
			standardSellingRate: 499.99,
		},
		{
			id: "ITEM-002",
			itemCode: "ITEM-002",
			itemName: "Bolt B12",
			itemGroupName: "Hardware",
			brandName: null,
			description: null,
			stockUom: "Pcs",
			lastPurchaseRate: null,
			valuationRate: 0,
			standardSellingRate: 12.5,
		},
	];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	resetMockState();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ItemPricesPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<ItemPricesPage />);
		expect(screen.getByText("Item Prices")).toBeInTheDocument();
	});

	it("shows the items filter select with default value", () => {
		renderWithProviders(<ItemPricesPage />);
		expect(screen.getByLabelText("Items filter")).toBeInTheDocument();
	});

	it("shows the item code filter input", () => {
		renderWithProviders(<ItemPricesPage />);
		expect(
			screen.getByPlaceholderText("Filter by item code"),
		).toBeInTheDocument();
	});

	it("shows the item group filter input", () => {
		renderWithProviders(<ItemPricesPage />);
		expect(
			screen.getByPlaceholderText("Filter by item group"),
		).toBeInTheDocument();
	});

	it("shows the brand filter input", () => {
		renderWithProviders(<ItemPricesPage />);
		expect(screen.getByPlaceholderText("Filter by brand")).toBeInTheDocument();
	});

	it("renders item prices when data is available", async () => {
		mockQueryData = makeRows();
		renderWithProviders(<ItemPricesPage />);

		await waitFor(() => {
			expect(screen.getByText("ITEM-001")).toBeInTheDocument();
		});
	});

	it("shows error state when query fails", () => {
		mockQueryError = new Error("Server error");
		renderWithProviders(<ItemPricesPage />);
		expect(screen.getByText(/Failed to load item prices/i)).toBeInTheDocument();
	});

	it("shows empty state when no rows are returned", () => {
		mockQueryData = [];
		renderWithProviders(<ItemPricesPage />);
		expect(screen.getByText("No items found")).toBeInTheDocument();
	});

	it("renders table rows when data is available", async () => {
		mockQueryData = makeRows();
		renderWithProviders(<ItemPricesPage />);

		await waitFor(() => {
			expect(screen.getByText("ITEM-001")).toBeInTheDocument();
			expect(screen.getByText("Widget Alpha")).toBeInTheDocument();
		});
	});

	it("shows item count summary when rows are present", async () => {
		mockQueryData = makeRows();
		renderWithProviders(<ItemPricesPage />);

		await waitFor(() => {
			expect(screen.getByText("2 items")).toBeInTheDocument();
		});
	});

	it("uses singular 'item' for a single row", async () => {
		mockQueryData = [makeRows()[0]];
		renderWithProviders(<ItemPricesPage />);

		await waitFor(() => {
			expect(screen.getByText("1 item")).toBeInTheDocument();
		});
	});

	it("updates itemCode filter and calls query with trimmed value", async () => {
		renderWithProviders(<ItemPricesPage />);

		const itemCodeInput = screen.getByPlaceholderText(
			"Filter by item code",
		) as HTMLInputElement;
		fireEvent.change(itemCodeInput, { target: { value: "  ITEM  " } });

		await waitFor(() => {
			const input = capturedQueryInput as { itemCode?: string };
			expect(input.itemCode).toBe("ITEM");
		});
	});

	it("passes itemCode as undefined when empty", async () => {
		renderWithProviders(<ItemPricesPage />);

		await waitFor(() => {
			const input = capturedQueryInput as { itemCode?: string };
			expect(input.itemCode).toBeUndefined();
		});
	});

	it("Reset button is disabled when no active filters", () => {
		renderWithProviders(<ItemPricesPage />);
		const resetBtn = screen.getByRole("button", { name: /reset/i });
		expect(resetBtn).toBeDisabled();
	});

	it("Reset button is enabled when filters are changed", async () => {
		renderWithProviders(<ItemPricesPage />);

		const itemCodeInput = screen.getByPlaceholderText("Filter by item code");
		fireEvent.change(itemCodeInput, { target: { value: "ITEM-001" } });

		await waitFor(() => {
			const resetBtn = screen.getByRole("button", { name: /reset/i });
			expect(resetBtn).not.toBeDisabled();
		});
	});

	it("resets filters on Reset button click", async () => {
		renderWithProviders(<ItemPricesPage />);

		const itemCodeInput = screen.getByPlaceholderText(
			"Filter by item code",
		) as HTMLInputElement;
		fireEvent.change(itemCodeInput, { target: { value: "ITEM-001" } });

		const resetBtn = screen.getByRole("button", { name: /reset/i });
		fireEvent.click(resetBtn);

		await waitFor(() => {
			expect(itemCodeInput.value).toBe("");
		});
	});
});
