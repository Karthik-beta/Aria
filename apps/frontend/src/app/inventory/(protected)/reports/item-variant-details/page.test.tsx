import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import ItemVariantDetailsPage from "./page";

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
			listItemVariantDetails: {
				useQuery: (input: unknown, _opts?: { enabled?: boolean }) => {
					capturedQueryInput = input;
					return {
						data: mockQueryData,
						isLoading: mockQueryIsLoading,
						error: mockQueryError,
						refetch: vi.fn().mockResolvedValue(undefined),
					};
				},
			},
			exportItemVariantDetailsExcel: {
				useMutation: () => ({ mutateAsync: mockUseMutation }),
			},
		},
	},
}));

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeResult() {
	return {
		attributeNames: ["Color", "Size"],
		rows: [
			{
				id: "v1",
				variantCode: "TS-RED-S",
				variantName: "T-Shirt Red Small",
				attributes: { Color: "Red", Size: "Small" },
				avgBuyingPriceListRate: 450.0,
				avgSellingPriceListRate: 799.0,
				currentStock: 50,
				openOrders: 5,
			},
			{
				id: "v2",
				variantCode: "TS-BLUE-L",
				variantName: "T-Shirt Blue Large",
				attributes: { Color: "Blue", Size: "Large" },
				avgBuyingPriceListRate: 460.0,
				avgSellingPriceListRate: 799.0,
				currentStock: 30,
				openOrders: 0,
			},
		],
	};
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

describe("ItemVariantDetailsPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<ItemVariantDetailsPage />);
		expect(screen.getByText("Item Variant Details")).toBeInTheDocument();
	});

	it("shows the item code input", () => {
		renderWithProviders(<ItemVariantDetailsPage />);
		expect(
			screen.getByPlaceholderText("Enter template item code"),
		).toBeInTheDocument();
	});

	it("shows initial empty state prompting to select a template item", () => {
		renderWithProviders(<ItemVariantDetailsPage />);
		expect(screen.getByText("Select a template item")).toBeInTheDocument();
	});

	it("shows Generate button", () => {
		renderWithProviders(<ItemVariantDetailsPage />);
		expect(
			screen.getByRole("button", { name: /generate/i }),
		).toBeInTheDocument();
	});

	it("shows loading text when fetching", async () => {
		mockQueryIsLoading = true;
		renderWithProviders(<ItemVariantDetailsPage />);

		const input = screen.getByPlaceholderText("Enter template item code");
		fireEvent.change(input, { target: { value: "TSHIRT" } });
		fireEvent.click(screen.getByRole("button", { name: /generate/i }));

		await waitFor(() => {
			expect(screen.getByText("Loading variant details…")).toBeInTheDocument();
		});
	});

	it("shows error state when query fails", async () => {
		mockQueryError = new Error("Server error");
		renderWithProviders(<ItemVariantDetailsPage />);

		const input = screen.getByPlaceholderText("Enter template item code");
		fireEvent.change(input, { target: { value: "TSHIRT" } });
		fireEvent.click(screen.getByRole("button", { name: /generate/i }));

		await waitFor(() => {
			expect(
				screen.getByText(/Failed to load item variant details/i),
			).toBeInTheDocument();
		});
	});

	it("shows no variants state when empty result returned", async () => {
		mockQueryData = { attributeNames: [], rows: [] };
		renderWithProviders(<ItemVariantDetailsPage />);

		const input = screen.getByPlaceholderText("Enter template item code");
		fireEvent.change(input, { target: { value: "TSHIRT" } });
		fireEvent.click(screen.getByRole("button", { name: /generate/i }));

		await waitFor(() => {
			expect(screen.getByText("No variants found")).toBeInTheDocument();
		});
	});

	it("renders table rows when data is available", async () => {
		mockQueryData = makeResult();
		renderWithProviders(<ItemVariantDetailsPage />);

		const input = screen.getByPlaceholderText("Enter template item code");
		fireEvent.change(input, { target: { value: "TSHIRT" } });
		fireEvent.click(screen.getByRole("button", { name: /generate/i }));

		await waitFor(() => {
			expect(screen.getByText("TS-RED-S")).toBeInTheDocument();
			expect(screen.getByText("T-Shirt Red Small")).toBeInTheDocument();
		});
	});

	it("shows variant count summary", async () => {
		mockQueryData = makeResult();
		renderWithProviders(<ItemVariantDetailsPage />);

		const input = screen.getByPlaceholderText("Enter template item code");
		fireEvent.change(input, { target: { value: "TSHIRT" } });
		fireEvent.click(screen.getByRole("button", { name: /generate/i }));

		await waitFor(() => {
			expect(screen.getByText(/2 variants/)).toBeInTheDocument();
		});
	});

	it("passes correct input to query after form submission", async () => {
		renderWithProviders(<ItemVariantDetailsPage />);

		const input = screen.getByPlaceholderText("Enter template item code");
		fireEvent.change(input, { target: { value: "  TSHIRT  " } });
		fireEvent.click(screen.getByRole("button", { name: /generate/i }));

		await waitFor(() => {
			const queryInput = capturedQueryInput as { itemCode: string };
			expect(queryInput.itemCode).toBe("TSHIRT");
		});
	});

	it("Reset button clears the input and submitted code", async () => {
		renderWithProviders(<ItemVariantDetailsPage />);

		const input = screen.getByPlaceholderText(
			"Enter template item code",
		) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "TSHIRT" } });
		fireEvent.click(screen.getByRole("button", { name: /generate/i }));

		const resetBtn = screen.getByRole("button", { name: /reset/i });
		fireEvent.click(resetBtn);

		await waitFor(() => {
			expect(input.value).toBe("");
			expect(screen.getByText("Select a template item")).toBeInTheDocument();
		});
	});
});
