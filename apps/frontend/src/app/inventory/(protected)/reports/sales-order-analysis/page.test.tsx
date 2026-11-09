import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import SalesOrderAnalysisPage from "./page";

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
			listSalesOrderAnalysis: {
				useQuery: mockUseQuery,
			},
			exportSalesOrderAnalysisExcel: {
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
				salesOrder: "SO-2024-001",
				salesOrderId: "SO-ID-001",
				date: new Date("2024-01-15T00:00:00.000Z"),
				deliveryDate: new Date("2024-02-15T00:00:00.000Z"),
				status: "TO_DELIVER" as const,
				customer: "Acme Corp",
				itemCode: "ITEM-001",
				description: "Widget Alpha",
				qty: 10,
				deliveredQty: 4,
				pendingQty: 6,
				billedQty: 0,
				qtyToBill: 10,
				amount: 1000,
				billedAmount: 0,
				pendingAmount: 1000,
				deliveredQtyAmount: 400,
				delayDays: 0,
				timeTakenToDeliverSeconds: 0,
				warehouse: "Main WH",
				company: "My Company",
			},
			{
				salesOrder: "SO-2024-002",
				salesOrderId: "SO-ID-002",
				date: new Date("2024-01-20T00:00:00.000Z"),
				deliveryDate: new Date("2024-02-20T00:00:00.000Z"),
				status: "COMPLETED" as const,
				customer: "Beta Ltd",
				itemCode: "ITEM-002",
				description: "Gadget Beta",
				qty: 5,
				deliveredQty: 5,
				pendingQty: 0,
				billedQty: 5,
				qtyToBill: 0,
				amount: 2500,
				billedAmount: 2500,
				pendingAmount: 0,
				deliveredQtyAmount: 2500,
				delayDays: 0,
				timeTakenToDeliverSeconds: 86400 * 10,
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

describe("SalesOrderAnalysisPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<SalesOrderAnalysisPage />);
		expect(
			screen.getByRole("heading", { name: "Sales Order Analysis" }),
		).toBeInTheDocument();
	});

	it("shows a validation error when company is empty", () => {
		renderWithProviders(<SalesOrderAnalysisPage />);
		expect(screen.getByText("Company is required.")).toBeInTheDocument();
	});

	it("does not query when company is empty", () => {
		renderWithProviders(<SalesOrderAnalysisPage />);
		const callArgs = mockUseQuery.mock.calls[0];
		expect(callArgs[1].enabled).toBe(false);
	});

	it("shows validation error when fromDate is later than toDate", async () => {
		renderWithProviders(<SalesOrderAnalysisPage />);

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

		renderWithProviders(<SalesOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			expect(lastCall[1].enabled).toBe(true);
		});
	});

	it("renders sales order rows when data is loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<SalesOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("SO-2024-001")).toBeInTheDocument();
			expect(screen.getByText("SO-2024-002")).toBeInTheDocument();
		});
	});

	it("shows the billing summary when data is loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<SalesOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("Billing Summary")).toBeInTheDocument();
		});
	});

	it("shows error state on query failure", async () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error("Network error"),
			refetch: vi.fn(),
		});

		renderWithProviders(<SalesOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("Connection Problem")).toBeInTheDocument();
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

		renderWithProviders(<SalesOrderAnalysisPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("No sales orders found")).toBeInTheDocument();
		});
	});

	it("renders status checkboxes for all five statuses", () => {
		renderWithProviders(<SalesOrderAnalysisPage />);

		expect(
			screen.getByLabelText("Filter by status To Deliver and Bill"),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText("Filter by status To Deliver"),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText("Filter by status To Bill"),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText("Filter by status Completed"),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText("Filter by status Closed"),
		).toBeInTheDocument();
	});

	it("renders the group by sales order checkbox", () => {
		renderWithProviders(<SalesOrderAnalysisPage />);
		expect(screen.getByLabelText("Group by sales order")).toBeInTheDocument();
	});
});
