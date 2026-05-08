import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import SubcontractedRawMaterialsTransferredPage from "./page";

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
			listSubcontractedRawMaterials: {
				useQuery: mockUseQuery,
			},
			exportSubcontractedRawMaterialsExcel: {
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
			rowCount: 3,
			totalRequiredQty: 100,
			totalTransferredQty: 30,
			totalReturnedQty: 5,
			totalPendingQty: 65,
		},
		rows: [
			{
				id: "si-1",
				subcontractingOrderId: "sco-1",
				subcontractOrder: "MAT-SCO-2026-00001",
				date: new Date("2026-03-01T00:00:00.000Z"),
				supplier: "Test Supplier",
				rmItemCode: "RM-001",
				rmItemName: "Raw Material Alpha",
				requiredQty: 50,
				transferredQty: 20,
				returnedQty: 5,
				pendingQty: 25,
			},
			{
				id: "si-2",
				subcontractingOrderId: "sco-2",
				subcontractOrder: "MAT-SCO-2026-00002",
				date: new Date("2026-03-05T00:00:00.000Z"),
				supplier: "Test Supplier",
				rmItemCode: "RM-002",
				rmItemName: "Raw Material Beta",
				requiredQty: 50,
				transferredQty: 10,
				returnedQty: 0,
				pendingQty: 40,
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

describe("SubcontractedRawMaterialsTransferredPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<SubcontractedRawMaterialsTransferredPage />);
		expect(
			screen.getByText("Subcontracted Raw Materials To Be Transferred"),
		).toBeInTheDocument();
	});

	it("renders the required supplier filter", () => {
		renderWithProviders(<SubcontractedRawMaterialsTransferredPage />);
		expect(screen.getByPlaceholderText("Supplier name…")).toBeInTheDocument();
	});

	it("shows validation message when supplier is empty", () => {
		renderWithProviders(<SubcontractedRawMaterialsTransferredPage />);
		const matches = screen.getAllByText("Supplier is required.");
		expect(matches.length).toBeGreaterThanOrEqual(1);
	});

	it("renders raw materials data when loaded", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
		});
		renderWithProviders(<SubcontractedRawMaterialsTransferredPage />);

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
		renderWithProviders(<SubcontractedRawMaterialsTransferredPage />);
		expect(
			screen.getByText(/Failed to load subcontracted raw materials report/i),
		).toBeInTheDocument();
	});

	it("renders summary cards and table rows when data is provided", async () => {
		mockUseQuery.mockReturnValue({
			data: makeResult(),
			isLoading: false,
			error: null,
		});
		renderWithProviders(<SubcontractedRawMaterialsTransferredPage />);

		await waitFor(() => {
			expect(screen.getByText("Open Orders")).toBeInTheDocument();
			expect(screen.getByText("MAT-SCO-2026-00001")).toBeInTheDocument();
			expect(screen.getByText("RM-001")).toBeInTheDocument();
		});
	});

	it("passes trimmed supplier to the query", async () => {
		renderWithProviders(<SubcontractedRawMaterialsTransferredPage />);

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
		renderWithProviders(<SubcontractedRawMaterialsTransferredPage />);

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
