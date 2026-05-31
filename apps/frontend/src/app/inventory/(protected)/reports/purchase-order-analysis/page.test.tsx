import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import PurchaseOrderAnalysisPage from "./page";

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
			listPurchaseOrderAnalysis: {
				useQuery: mockUseQuery,
			},
			exportPurchaseOrderAnalysisExcel: {
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
		rows: [
			{
				purchaseOrder: "PO-2024-001",
				purchaseOrderId: "PO-ID-001",
				date: new Date("2024-01-15T00:00:00.000Z"),
				requiredDate: new Date("2024-02-15T00:00:00.000Z"),
				status: "TO_RECEIVE" as const,
				supplier: "Acme Supplies",
				project: null,
				itemCode: "ITEM-001",
				qty: 10,
				receivedQty: 4,
				pendingQty: 6,
				billedQty: 0,
				qtyToBill: 10,
				amount: 1000,
				billedAmount: 0,
				pendingAmount: 1000,
				receivedQtyAmount: 400,
				warehouse: "Main WH",
				company: "My Company",
			},
			{
				purchaseOrder: "PO-2024-002",
				purchaseOrderId: "PO-ID-002",
				date: new Date("2024-01-20T00:00:00.000Z"),
				requiredDate: new Date("2024-02-20T00:00:00.000Z"),
				status: "COMPLETED" as const,
				supplier: "Beta Traders",
				project: "Project-Alpha",
				itemCode: "ITEM-002",
				qty: 5,
				receivedQty: 5,
				pendingQty: 0,
				billedQty: 5,
				qtyToBill: 0,
				amount: 2500,
				billedAmount: 2500,
				pendingAmount: 0,
				receivedQtyAmount: 2500,
				warehouse: "Warehouse B",
				company: "My Company",
			},
		],
		summary: {
			totalPendingAmount: 1000,
			totalBilledAmount: 2500,
		},
	};
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

describe("PurchaseOrderAnalysisPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<PurchaseOrderAnalysisPage />);
		expect(
			screen.getByRole("heading", { name: "Purchase Order Analysis" }),
		).toBeInTheDocument();
	});

	it("shows a validation error when company is empty", () => {
		renderWithProviders(<PurchaseOrderAnalysisPage />);
		expect(screen.getByText("Company is required.")).toBeInTheDocument();
	});

	it("does not query when company is empty", () => {
		renderWithProviders(<PurchaseOrderAnalysisPage />);
		const callArgs = mockUseQuery.mock.calls[0];
		expect(callArgs[1].enabled).toBe(false);
	});

	it("shows validation error when fromDate is later than toDate", async () => {
		renderWithProviders(<PurchaseOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		const fromInput = screen.getByLabelText("From date");
		const toInput = screen.getByLabelText("To date");

		fireEvent.change(fromInput, { target: { value: "2024-06-01" } });
		fireEvent.change(toInput, { target: { value: "2024-01-01" } });

		await waitFor(() => {
			expect(
				screen.getByText("From Date must not be later than To Date."),
			).toBeInTheDocument();
		});
	});

	it("enables the query when company is provided and dates are valid", async () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<PurchaseOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			expect(lastCall[1].enabled).toBe(true);
		});
	});

	it("shows data rows when query returns data", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<PurchaseOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("PO-2024-001")).toBeInTheDocument();
			expect(screen.getByText("PO-2024-002")).toBeInTheDocument();
		});
	});

	it("renders purchase order rows when data is loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<PurchaseOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("PO-2024-001")).toBeInTheDocument();
			expect(screen.getByText("PO-2024-002")).toBeInTheDocument();
		});
	});

	it("shows the billing summary when data is loaded with non-zero values", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<PurchaseOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("Billing Summary")).toBeInTheDocument();
		});
	});

	it("shows empty state when result has no rows", async () => {
		mockUseQuery.mockReturnValue({
			data: {
				rows: [],
				summary: { totalPendingAmount: 0, totalBilledAmount: 0 },
			},
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<PurchaseOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("No purchase orders found")).toBeInTheDocument();
		});
	});

	it("shows error state on query failure", async () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error("Database connection failed"),
			refetch: vi.fn(),
		});

		renderWithProviders(<PurchaseOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("Connection Problem")).toBeInTheDocument();
		});
	});

	it("renders status checkboxes for all six statuses", () => {
		renderWithProviders(<PurchaseOrderAnalysisPage />);

		expect(
			screen.getByLabelText("Filter by status To Pay"),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText("Filter by status To Bill"),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText("Filter by status To Receive"),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText("Filter by status To Receive and Bill"),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText("Filter by status Completed"),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText("Filter by status Closed"),
		).toBeInTheDocument();
	});

	it("renders the group by purchase order checkbox", () => {
		renderWithProviders(<PurchaseOrderAnalysisPage />);
		expect(
			screen.getByLabelText("Group by purchase order"),
		).toBeInTheDocument();
	});

	it("renders project and purchase orders filter inputs", () => {
		renderWithProviders(<PurchaseOrderAnalysisPage />);
		expect(screen.getByPlaceholderText("Project")).toBeInTheDocument();
		expect(
			screen.getByPlaceholderText("Purchase orders (comma-separated)"),
		).toBeInTheDocument();
	});
});
