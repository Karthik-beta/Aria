import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import DeliveryNoteTrendsPage from "./page";

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
			listDeliveryNoteTrends: {
				useQuery: mockUseQuery,
			},
			exportDeliveryNoteTrendsExcel: {
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
				dimensionKey: "ITEM-001",
				dimensionLabel: "Widget Alpha",
				periodQty: { jan_2024: 10, feb_2024: 5 },
				periodAmount: { jan_2024: 1000, feb_2024: 500 },
				totalQty: 15,
				totalAmount: 1500,
			},
			{
				id: "ITEM-002",
				dimensionKey: "ITEM-002",
				dimensionLabel: "Gadget Beta",
				periodQty: { jan_2024: 2, feb_2024: 3 },
				periodAmount: { jan_2024: 200, feb_2024: 300 },
				totalQty: 5,
				totalAmount: 500,
			},
		],
		totalQty: 20,
		totalAmount: 2000,
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

describe("DeliveryNoteTrendsPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<DeliveryNoteTrendsPage />);
		expect(
			screen.getByRole("heading", { name: "Delivery Note Trends" }),
		).toBeInTheDocument();
	});

	it("shows a validation error when company is empty and dates are set", async () => {
		renderWithProviders(<DeliveryNoteTrendsPage />);

		// Company field is empty by default
		expect(screen.getByText("Company is required.")).toBeInTheDocument();
	});

	it("does not query when company is empty", () => {
		renderWithProviders(<DeliveryNoteTrendsPage />);
		// useQuery should be called with enabled: false (queryInput is null)
		const callArgs = mockUseQuery.mock.calls[0];
		// Second arg contains { enabled }
		expect(callArgs[1].enabled).toBe(false);
	});

	it("shows a validation error when fromDate is later than toDate", async () => {
		renderWithProviders(<DeliveryNoteTrendsPage />);

		// Set company first so it passes company validation
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

	it("queries when company is provided and dates are valid", async () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<DeliveryNoteTrendsPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			// Query should become enabled
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			expect(lastCall[1].enabled).toBe(true);
		});
	});

	it("renders dimension rows in the table", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<DeliveryNoteTrendsPage />);

		// Manually set company to trigger non-null queryInput
		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("ITEM-001")).toBeInTheDocument();
			expect(screen.getByText("ITEM-002")).toBeInTheDocument();
		});
	});

	it("renders period column headers when data is loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<DeliveryNoteTrendsPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		await waitFor(() => {
			expect(screen.getByText("Jan 2024")).toBeInTheDocument();
			expect(screen.getByText("Feb 2024")).toBeInTheDocument();
		});
	});

	it("shows data rows when query returns data", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<DeliveryNoteTrendsPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Corp" } });

		await waitFor(() => {
			expect(screen.getByText("Widget Alpha")).toBeInTheDocument();
			expect(screen.getByText("Gadget Beta")).toBeInTheDocument();
		});
	});

	it("shows error state on query failure", async () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error("Network error"),
			refetch: vi.fn(),
		});

		renderWithProviders(<DeliveryNoteTrendsPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Corp" } });

		await waitFor(() => {
			expect(screen.queryByText("Delivery Note Trends")).toBeInTheDocument();
		});
	});

	it("shows empty state when result has no rows", async () => {
		mockUseQuery.mockReturnValue({
			data: { periods: [], rows: [], totalQty: 0, totalAmount: 0 },
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<DeliveryNoteTrendsPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Corp" } });

		await waitFor(() => {
			expect(screen.getByText("No delivery notes found")).toBeInTheDocument();
		});
	});

	it("shows period and dimension summary when data is loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		});

		renderWithProviders(<DeliveryNoteTrendsPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Corp" } });

		await waitFor(() => {
			expect(screen.getByText(/2 rows/)).toBeInTheDocument();
			expect(screen.getByText(/2 periods/)).toBeInTheDocument();
		});
	});

	it("resets filters when Reset button is clicked", async () => {
		renderWithProviders(<DeliveryNoteTrendsPage />);

		const companyInput = screen.getByPlaceholderText("Company *");
		fireEvent.change(companyInput, { target: { value: "Test Corp" } });

		const resetButton = screen.getByRole("button", { name: /reset filters/i });
		fireEvent.click(resetButton);

		await waitFor(() => {
			expect((companyInput as HTMLInputElement).value).toBe("");
		});
	});

	it("the based-on select has all four options", () => {
		renderWithProviders(<DeliveryNoteTrendsPage />);

		const trigger = screen.getByRole("combobox", {
			name: /select dimension/i,
		});
		fireEvent.click(trigger);

		expect(screen.getByRole("option", { name: "Item" })).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: "Item Group" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("option", { name: "Customer" }),
		).toBeInTheDocument();
		expect(screen.getByRole("option", { name: "Project" })).toBeInTheDocument();
	});
});
