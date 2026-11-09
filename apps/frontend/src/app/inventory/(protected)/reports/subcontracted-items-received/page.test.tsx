import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import SubcontractedItemToBeReceivedPage from "./page";

// ---------------------------------------------------------------------------
// Mock tRPC
// ---------------------------------------------------------------------------

const { mockUseQuery, mockUseMutation } = vi.hoisted(() => ({
	mockUseQuery: vi.fn(),
	mockUseMutation: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		inventory: {
			listSubcontractedItemToBeReceived: {
				useQuery: mockUseQuery,
			},
			exportSubcontractedItemToBeReceivedExcel: {
				useMutation: () => ({ mutateAsync: mockUseMutation }),
			},
		},
	},
}));

// ---------------------------------------------------------------------------
// Recharts mock — avoid ResizeObserver issues in JSDOM
// ---------------------------------------------------------------------------

vi.mock("recharts", () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
		children,
	BarChart: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="bar-chart">{children}</div>
	),
	Bar: () => null,
	CartesianGrid: () => null,
	XAxis: () => null,
	YAxis: () => null,
	Tooltip: () => null,
}));

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeResult() {
	return {
		summary: {
			orderCount: 2,
			rowCount: 2,
			totalRequiredQty: 200,
			totalReceivedQty: 40,
			totalPendingQty: 160,
		},
		rows: [
			{
				id: "item-1",
				subcontractingOrderId: "sco-1",
				subcontractOrder: "MAT-SCO-2026-00001",
				date: new Date("2026-03-01T00:00:00.000Z"),
				supplier: "Test Supplier",
				fgItemCode: "FG-001",
				itemName: "Finished Good Alpha",
				requiredQty: 100,
				receivedQty: 20,
				pendingQty: 80,
			},
			{
				id: "item-2",
				subcontractingOrderId: "sco-2",
				subcontractOrder: "MAT-SCO-2026-00002",
				date: new Date("2026-03-05T00:00:00.000Z"),
				supplier: "Test Supplier",
				fgItemCode: "FG-002",
				itemName: "Finished Good Beta",
				requiredQty: 100,
				receivedQty: 20,
				pendingQty: 80,
			},
		],
	};
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockUseQuery.mockReset();
	// Default: query disabled because supplier is empty
	mockUseQuery.mockReturnValue({
		data: undefined,
		isLoading: false,
		error: null,
	});
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SubcontractedItemToBeReceivedPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<SubcontractedItemToBeReceivedPage />);
		expect(
			screen.getByText("Subcontracted Item To Be Received"),
		).toBeInTheDocument();
	});

	it("renders the required supplier filter", () => {
		renderWithProviders(<SubcontractedItemToBeReceivedPage />);
		expect(screen.getByPlaceholderText("Supplier name…")).toBeInTheDocument();
	});

	it("shows validation message when supplier is empty", () => {
		renderWithProviders(<SubcontractedItemToBeReceivedPage />);
		const matches = screen.getAllByText("Supplier is required.");
		expect(matches.length).toBeGreaterThanOrEqual(1);
	});

	it("renders subcontracted items data when loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
		});
		renderWithProviders(<SubcontractedItemToBeReceivedPage />);

		await waitFor(() => {
			expect(screen.getByText("MAT-SCO-2026-00001")).toBeInTheDocument();
		});
	});

	it("shows error state when query fails", () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: new Error("Server error"),
		});
		renderWithProviders(<SubcontractedItemToBeReceivedPage />);
		expect(
			screen.getByText(
				/Failed to load subcontracted item to be received report/i,
			),
		).toBeInTheDocument();
	});

	it("renders summary cards and table rows when data is provided", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
		});
		renderWithProviders(<SubcontractedItemToBeReceivedPage />);

		await waitFor(() => {
			expect(screen.getByText("Open Orders")).toBeInTheDocument();
			expect(screen.getByText("MAT-SCO-2026-00001")).toBeInTheDocument();
			expect(screen.getByText("FG-001")).toBeInTheDocument();
		});
	});

	it("passes trimmed supplier to the query", async () => {
		renderWithProviders(<SubcontractedItemToBeReceivedPage />);

		fireEvent.change(screen.getByPlaceholderText("Supplier name…"), {
			target: { value: "  Test Supplier  " },
		});

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			expect(lastCall[0]).toMatchObject({ supplier: "Test Supplier" });
		});
	});

	it("resets all filters when Reset is clicked", async () => {
		renderWithProviders(<SubcontractedItemToBeReceivedPage />);

		const supplierInput = screen.getByPlaceholderText(
			"Supplier name…",
		) as HTMLInputElement;
		fireEvent.change(supplierInput, { target: { value: "Test Supplier" } });
		expect(supplierInput.value).toBe("Test Supplier");

		fireEvent.click(screen.getByRole("button", { name: /reset/i }));

		await waitFor(() => {
			expect(supplierInput.value).toBe("");
		});
	});
});
