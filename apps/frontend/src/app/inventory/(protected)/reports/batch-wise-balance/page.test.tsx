import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import BatchWiseBalancePage from "./page";

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
			listBatchWiseBalance: {
				useQuery: mockUseQuery,
			},
			exportBatchWiseBalanceExcel: {
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
			id: "batch-001",
			company: "My Company",
			itemCode: "ITEM-001",
			itemName: "Widget Alpha",
			description: "High-grade widget",
			warehouse: "Stores",
			batchNo: "BATCH-2024-001",
			openingQty: 100,
			inQty: 0,
			outQty: 0,
			balanceQty: 100,
			valuationRate: 50,
			balanceValue: 5000,
			unitOfMeasure: "Nos",
			manufacturingDate: "2024-01-10",
			expiryDate: "2025-01-10",
		},
		{
			id: "batch-002",
			company: "My Company",
			itemCode: "ITEM-002",
			itemName: "Gadget Beta",
			description: null,
			warehouse: "Finished Goods",
			batchNo: "BATCH-2024-002",
			openingQty: 0,
			inQty: 25,
			outQty: 0,
			balanceQty: 25,
			valuationRate: 120,
			balanceValue: 3000,
			unitOfMeasure: "Kg",
			manufacturingDate: null,
			expiryDate: null,
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

describe("BatchWiseBalancePage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<BatchWiseBalancePage />);
		expect(
			screen.getByRole("heading", { name: "Batch-Wise Balance History" }),
		).toBeInTheDocument();
	});

	it("shows a validation error when company is empty", () => {
		renderWithProviders(<BatchWiseBalancePage />);
		expect(screen.getByText("Company is required.")).toBeInTheDocument();
	});

	it("does not query when company is empty", () => {
		renderWithProviders(<BatchWiseBalancePage />);
		const callArgs = mockUseQuery.mock.calls[0];
		expect(callArgs[1].enabled).toBe(false);
	});

	it("shows a validation error when fromDate is later than toDate", async () => {
		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		const fromInput = screen.getByLabelText("From date");
		const toInput = screen.getByLabelText("To date");

		fireEvent.change(fromInput, { target: { value: "2024-12-01" } });
		fireEvent.change(toInput, { target: { value: "2024-01-01" } });

		await waitFor(() => {
			expect(
				screen.getByText("From Date must not be later than To Date."),
			).toBeInTheDocument();
		});
	});

	it("enables the query when company is provided", async () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			expect(lastCall[1].enabled).toBe(true);
		});
	});

	it("shows loading indicator while fetching", () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Corp" } });

		expect(
			screen.getByLabelText("Loading batch-wise balance data"),
		).toBeInTheDocument();
	});

	it("renders batch rows when data is loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeRows(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("ITEM-001")).toBeInTheDocument();
			expect(screen.getByText("ITEM-002")).toBeInTheDocument();
		});
	});

	it("shows batch numbers in the table", async () => {
		mockUseQuery.mockReturnValue({
			data: makeRows(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("BATCH-2024-001")).toBeInTheDocument();
			expect(screen.getByText("BATCH-2024-002")).toBeInTheDocument();
		});
	});

	it("shows warehouse names in the table", async () => {
		mockUseQuery.mockReturnValue({
			data: makeRows(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("Stores")).toBeInTheDocument();
			expect(screen.getByText("Finished Goods")).toBeInTheDocument();
		});
	});

	it("shows empty state when result has no rows", async () => {
		mockUseQuery.mockReturnValue({
			data: [],
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("No batches found")).toBeInTheDocument();
		});
	});

	it("shows batch count when data is loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeRows(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("2 batches")).toBeInTheDocument();
		});
	});

	it("passes optional filters to the query input", async () => {
		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		const itemInput = screen.getByPlaceholderText("Item code");
		fireEvent.change(itemInput, { target: { value: "ITEM-001" } });

		const warehouseInput = screen.getByPlaceholderText("Warehouse");
		fireEvent.change(warehouseInput, { target: { value: "Stores" } });

		const batchInput = screen.getByPlaceholderText("Batch number");
		fireEvent.change(batchInput, { target: { value: "BATCH-001" } });

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			const input = lastCall[0] as {
				itemCode?: string;
				warehouse?: string;
				batchNo?: string;
			};
			expect(input.itemCode).toBe("ITEM-001");
			expect(input.warehouse).toBe("Stores");
			expect(input.batchNo).toBe("BATCH-001");
		});
	});

	it("leaves optional filters undefined when empty", async () => {
		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			const input = lastCall[0] as {
				itemCode?: string;
				warehouse?: string;
				batchNo?: string;
			};
			expect(input.itemCode).toBeUndefined();
			expect(input.warehouse).toBeUndefined();
			expect(input.batchNo).toBeUndefined();
		});
	});

	it("resets filters when Reset button is clicked", async () => {
		renderWithProviders(<BatchWiseBalancePage />);

		const companyInput = screen.getByPlaceholderText(
			"Company *",
		) as HTMLInputElement;
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });
		expect(companyInput.value).toBe("Test Corp");

		const resetBtn = screen.getByRole("button", { name: /reset/i });
		fireEvent.click(resetBtn);

		await waitFor(() => {
			expect(companyInput.value).toBe("");
		});
	});
});
