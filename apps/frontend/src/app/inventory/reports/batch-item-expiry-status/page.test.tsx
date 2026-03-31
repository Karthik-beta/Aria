import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import BatchItemExpiryStatusPage from "./page";

// ---------------------------------------------------------------------------
// Mock state
// ---------------------------------------------------------------------------

let mockQueryData: unknown;
let mockQueryIsLoading = false;
let mockQueryError: Error | null = null;

function resetMockState() {
	mockQueryData = undefined;
	mockQueryIsLoading = false;
	mockQueryError = null;
}

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

vi.mock("@/lib/trpc", () => ({
	trpc: {
		inventory: {
			listBatchItemExpiry: {
				useQuery: (_input: unknown, _options?: unknown) => {
					return {
						data: mockQueryData,
						isLoading: mockQueryIsLoading,
						error: mockQueryError,
					};
				},
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
			id: "batch-1",
			itemCode: "ITEM-001",
			itemName: "Widget Alpha",
			batchNo: "BATCH-001",
			stockUom: "Nos",
			quantity: 50,
			expiresOn: new Date("2026-06-15T00:00:00.000Z"),
			expiryInDays: 120,
		},
		{
			id: "batch-2",
			itemCode: "ITEM-002",
			itemName: "Bolt B12",
			batchNo: "BATCH-002",
			stockUom: "Pcs",
			quantity: 200,
			expiresOn: null,
			expiryInDays: null,
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

describe("BatchItemExpiryStatusPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<BatchItemExpiryStatusPage />);
		expect(screen.getByText("Batch Item Expiry Status")).toBeInTheDocument();
	});

	it("shows from-date and to-date filter inputs", () => {
		renderWithProviders(<BatchItemExpiryStatusPage />);
		expect(screen.getByLabelText("From date")).toBeInTheDocument();
		expect(screen.getByLabelText("To date")).toBeInTheDocument();
	});

	it("shows the item code filter input", () => {
		renderWithProviders(<BatchItemExpiryStatusPage />);
		expect(screen.getByPlaceholderText("Item code")).toBeInTheDocument();
	});

	it("shows loading spinner while fetching", () => {
		mockQueryIsLoading = true;
		renderWithProviders(<BatchItemExpiryStatusPage />);
		expect(
			screen.getByLabelText("Loading batch item expiry data"),
		).toBeInTheDocument();
	});

	it("shows error state when query fails", () => {
		mockQueryError = new Error("Server error");
		renderWithProviders(<BatchItemExpiryStatusPage />);
		expect(
			screen.getByText(/Failed to load batch item expiry data/i),
		).toBeInTheDocument();
	});

	it("shows empty state when no rows are returned", () => {
		mockQueryData = [];
		renderWithProviders(<BatchItemExpiryStatusPage />);
		expect(screen.getByText("No batches found")).toBeInTheDocument();
	});

	it("renders table rows when data is available", async () => {
		mockQueryData = makeRows();
		renderWithProviders(<BatchItemExpiryStatusPage />);

		await waitFor(() => {
			expect(screen.getByText("ITEM-001")).toBeInTheDocument();
			expect(screen.getByText("BATCH-001")).toBeInTheDocument();
		});
	});

	it("shows batch count summary when rows are present", async () => {
		mockQueryData = makeRows();
		renderWithProviders(<BatchItemExpiryStatusPage />);

		await waitFor(() => {
			expect(screen.getByText("2 batches")).toBeInTheDocument();
		});
	});

	it("uses singular 'batch' for a single row", async () => {
		mockQueryData = [makeRows()[0]];
		renderWithProviders(<BatchItemExpiryStatusPage />);

		await waitFor(() => {
			expect(screen.getByText("1 batch")).toBeInTheDocument();
		});
	});

	it("Reset button is disabled when no active filters", () => {
		renderWithProviders(<BatchItemExpiryStatusPage />);
		const resetBtn = screen.getByRole("button", { name: /reset/i });
		expect(resetBtn).toBeDisabled();
	});

	it("Reset button is enabled when filters are changed", async () => {
		renderWithProviders(<BatchItemExpiryStatusPage />);

		const itemCodeInput = screen.getByPlaceholderText("Item code");
		fireEvent.change(itemCodeInput, { target: { value: "ITEM-001" } });

		await waitFor(() => {
			const resetBtn = screen.getByRole("button", { name: /reset/i });
			expect(resetBtn).not.toBeDisabled();
		});
	});

	it("resets filters on Reset button click", async () => {
		renderWithProviders(<BatchItemExpiryStatusPage />);

		const itemCodeInput = screen.getByPlaceholderText(
			"Item code",
		) as HTMLInputElement;
		fireEvent.change(itemCodeInput, { target: { value: "ITEM-001" } });
		expect(itemCodeInput.value).toBe("ITEM-001");

		const resetBtn = screen.getByRole("button", { name: /reset/i });
		fireEvent.click(resetBtn);

		await waitFor(() => {
			expect(itemCodeInput.value).toBe("");
		});
	});

	it("shows validation error when from-date is after to-date", async () => {
		renderWithProviders(<BatchItemExpiryStatusPage />);

		const fromDateInput = screen.getByLabelText("From date");
		const toDateInput = screen.getByLabelText("To date");

		fireEvent.change(fromDateInput, { target: { value: "2026-12-31" } });
		fireEvent.change(toDateInput, { target: { value: "2026-01-01" } });

		await waitFor(() => {
			expect(
				screen.getByText("From Date must not be later than To Date."),
			).toBeInTheDocument();
		});
	});
});
