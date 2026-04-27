import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import ItemShortageReportPage from "./page";

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
			listItemShortageReport: {
				useQuery: mockUseQuery,
			},
			exportItemShortageExcel: {
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
			id: "Co::ITEM-001::Stores",
			company: "My Company",
			warehouse: "Stores",
			itemCode: "ITEM-001",
			itemName: "Widget Alpha",
			description: "High-grade widget",
			actualQty: 5,
			orderedQty: 0,
			plannedQty: 0,
			requestedQty: 0,
			reservedQty: 10,
			reservedQtyForProduction: 2,
			projectedQty: -7,
		},
		{
			id: "Co::ITEM-002::Finished Goods",
			company: "My Company",
			warehouse: "Finished Goods",
			itemCode: "ITEM-002",
			itemName: "Bolt B12",
			description: null,
			actualQty: 3,
			orderedQty: 1,
			plannedQty: 0,
			requestedQty: 0,
			reservedQty: 8,
			reservedQtyForProduction: 0,
			projectedQty: -4,
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

describe("ItemShortageReportPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<ItemShortageReportPage />);
		expect(
			screen.getByRole("heading", { name: "Item Shortage Report" }),
		).toBeInTheDocument();
	});

	it("shows a validation error when company is empty", () => {
		renderWithProviders(<ItemShortageReportPage />);
		expect(screen.getByText("Company is required.")).toBeInTheDocument();
	});

	it("does not query when company is empty", () => {
		renderWithProviders(<ItemShortageReportPage />);
		const callArgs = mockUseQuery.mock.calls[0];
		expect(callArgs[1].enabled).toBe(false);
	});

	it("enables the query when company is provided", async () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<ItemShortageReportPage />);

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

		renderWithProviders(<ItemShortageReportPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		expect(screen.getByText("Loading shortage data…")).toBeInTheDocument();
	});

	it("renders shortage rows when data is loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeRows(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<ItemShortageReportPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("ITEM-001")).toBeInTheDocument();
			expect(screen.getByText("ITEM-002")).toBeInTheDocument();
		});
	});

	it("shows warehouse names in the table", async () => {
		mockUseQuery.mockReturnValue({
			data: makeRows(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<ItemShortageReportPage />);

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

		renderWithProviders(<ItemShortageReportPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("No shortage items found")).toBeInTheDocument();
		});
	});

	it("passes warehouses from the filter field to the query", async () => {
		renderWithProviders(<ItemShortageReportPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		const warehousesInput = screen.getByPlaceholderText(
			"Warehouses (comma-separated)",
		);
		fireEvent.change(warehousesInput, {
			target: { value: "Stores, Finished Goods" },
		});

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			const input = lastCall[0] as { warehouses?: string[] };
			expect(input.warehouses).toEqual(["Stores", "Finished Goods"]);
		});
	});

	it("leaves warehouses undefined when the input is empty", async () => {
		renderWithProviders(<ItemShortageReportPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			const input = lastCall[0] as { warehouses?: string[] };
			expect(input.warehouses).toBeUndefined();
		});
	});

	it("renders the chart section heading when rows are present", async () => {
		mockUseQuery.mockReturnValue({
			data: makeRows(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<ItemShortageReportPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText(/Most Critical Items/i)).toBeInTheDocument();
		});
	});

	it("clears company field when Reset is clicked", async () => {
		renderWithProviders(<ItemShortageReportPage />);

		const companyInput = screen.getByPlaceholderText(
			"Company *",
		) as HTMLInputElement;
		fireEvent.change(companyInput, { target: { value: "My Corp" } });
		expect(companyInput.value).toBe("My Corp");

		const resetBtn = screen.getByRole("button", { name: /reset/i });
		fireEvent.click(resetBtn);

		await waitFor(() => {
			expect(companyInput.value).toBe("");
		});
	});
});
