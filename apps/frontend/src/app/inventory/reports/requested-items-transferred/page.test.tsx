import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import RequestedItemsToBeTransferredPage from "./page";

const { mockUseQuery } = vi.hoisted(() => ({
	mockUseQuery: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		inventory: {
			listRequestedItemsToBeTransferred: {
				useQuery: mockUseQuery,
			},
		},
	},
}));

function makeResult() {
	return {
		summary: {
			requestCount: 2,
			rowCount: 2,
			totalQty: 15,
			totalTransferredQty: 5,
			totalQtyToTransfer: 10,
			transferRowCount: 1,
			issueRowCount: 1,
		},
		rows: [
			{
				id: "mri-1",
				materialRequestId: "mr-1",
				materialRequest: "MAT-MRQ-2026-00001",
				date: new Date("2026-03-01T00:00:00.000Z"),
				purpose: "MATERIAL_TRANSFER",
				status: "APPROVED",
				itemCode: "ITEM-001",
				itemName: "Widget Alpha",
				description: "Primary widget",
				company: "Aria Corp",
				targetWarehouse: "Stores - AC",
				requiredBy: new Date("2026-03-05T00:00:00.000Z"),
				unitOfMeasure: "Nos",
				qty: 10,
				transferredQty: 4,
				qtyToTransfer: 6,
			},
			{
				id: "mri-2",
				materialRequestId: "mr-2",
				materialRequest: "MAT-MRQ-2026-00002",
				date: new Date("2026-03-03T00:00:00.000Z"),
				purpose: "MATERIAL_ISSUE",
				status: "PENDING",
				itemCode: "ITEM-002",
				itemName: "Bolt B12",
				description: null,
				company: "Aria Corp",
				targetWarehouse: null,
				requiredBy: null,
				unitOfMeasure: "Nos",
				qty: 5,
				transferredQty: 1,
				qtyToTransfer: 4,
			},
		],
	};
}

beforeEach(() => {
	mockUseQuery.mockReset();
	mockUseQuery.mockReturnValue({
		data: makeResult(),
		isLoading: false,
		error: null,
	});
});

describe("RequestedItemsToBeTransferredPage", () => {
	it("renders the page heading", () => {
		renderWithProviders(<RequestedItemsToBeTransferredPage />);

		expect(
			screen.getByRole("heading", {
				name: "Requested Items To Be Transferred",
			}),
		).toBeInTheDocument();
	});

	it("renders summary totals from the result", () => {
		renderWithProviders(<RequestedItemsToBeTransferredPage />);

		expect(screen.getByText("Open Requests")).toBeInTheDocument();
		expect(screen.getByText("Pending Qty")).toBeInTheDocument();
		expect(screen.getByText(/Against 15 requested/i)).toBeInTheDocument();
	});

	it("passes trimmed filters to the query", async () => {
		renderWithProviders(<RequestedItemsToBeTransferredPage />);

		fireEvent.change(screen.getByPlaceholderText("All companies"), {
			target: { value: "  Aria Corp  " },
		});
		fireEvent.change(screen.getByPlaceholderText("Item code contains..."), {
			target: { value: "  ITEM-001 " },
		});

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			expect(lastCall[0]).toMatchObject({
				company: "Aria Corp",
				itemCode: "ITEM-001",
			});
		});
	});

	it("updates the purpose filter in the query", async () => {
		renderWithProviders(<RequestedItemsToBeTransferredPage />);

		fireEvent.click(screen.getByRole("combobox", { name: "Purpose" }));
		fireEvent.click(screen.getByRole("option", { name: "Material Issue" }));

		await waitFor(() => {
			const lastCall =
				mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1];
			expect(lastCall[0]).toMatchObject({ purpose: "MATERIAL_ISSUE" });
		});
	});

	it("renders report rows and material request links", async () => {
		renderWithProviders(<RequestedItemsToBeTransferredPage />);

		await waitFor(() => {
			expect(screen.getByText("MAT-MRQ-2026-00001")).toBeInTheDocument();
			expect(screen.getByText("ITEM-001")).toBeInTheDocument();
			expect(screen.getByText("Stores - AC")).toBeInTheDocument();
		});
	});

	it("shows the loading state", () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
		});

		renderWithProviders(<RequestedItemsToBeTransferredPage />);

		expect(
			screen.getByText("Loading requested items awaiting transfer…"),
		).toBeInTheDocument();
	});

	it("shows the empty state when no rows are returned", async () => {
		mockUseQuery.mockReturnValue({
			data: {
				summary: {
					requestCount: 0,
					rowCount: 0,
					totalQty: 0,
					totalTransferredQty: 0,
					totalQtyToTransfer: 0,
					transferRowCount: 0,
					issueRowCount: 0,
				},
				rows: [],
			},
			isLoading: false,
			error: null,
		});

		renderWithProviders(<RequestedItemsToBeTransferredPage />);

		await waitFor(() => {
			expect(
				screen.getByText("No pending transfer requests found"),
			).toBeInTheDocument();
		});
	});

	it("resets all filters", async () => {
		renderWithProviders(<RequestedItemsToBeTransferredPage />);

		const companyInput = screen.getByPlaceholderText(
			"All companies",
		) as HTMLInputElement;
		fireEvent.change(companyInput, { target: { value: "Aria Corp" } });
		expect(companyInput.value).toBe("Aria Corp");

		fireEvent.click(screen.getByRole("button", { name: /reset/i }));

		await waitFor(() => {
			expect(companyInput.value).toBe("");
		});
	});
});
