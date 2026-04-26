import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import StockLedgerPage from "./page";

const { mockInvalidate, mockUseQuery, mockUseSubscription, mockUseMutation } =
	vi.hoisted(() => ({
		mockInvalidate: vi.fn().mockResolvedValue(undefined),
		mockUseQuery: vi.fn(),
		mockUseSubscription: vi.fn(),
		mockUseMutation: vi.fn(),
	}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listStockLedger: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listStockLedger: {
				useQuery: mockUseQuery,
			},
			onStockEntriesChanged: {
				useSubscription: mockUseSubscription,
			},
			exportStockLedgerExcel: {
				useMutation: () => ({ mutateAsync: mockUseMutation }),
			},
		},
	},
}));

describe("StockLedgerPage", () => {
	beforeEach(() => {
		mockInvalidate.mockClear();
		mockUseSubscription.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation(() => ({
			data: [
				{
					id: "ledger-row-1",
					stockEntryId: "stock-entry-1",
					stockEntryItemId: "stock-entry-item-1",
					series: "MAT-STE-2026-00001",
					voucherNo: "MAT-STE-2026-00001",
					postingDate: new Date("2026-03-24T00:00:00.000Z"),
					company: "Nova Gadget House",
					status: "DRAFT",
					stockEntryType: "MATERIAL_RECEIPT",
					project: null,
					itemCode: "ITEM-001",
					itemName: "iPhone 13",
					itemGroupName: "Phones",
					brandName: "Apple",
					description: "iPhone 13 - WHI - 256GB",
					warehouse: "Stores - GH",
					sourceWarehouse: null,
					targetWarehouse: "Stores - GH",
					batchNo: null,
					serialNo: null,
					movementType: "IN",
					qtyIn: 3,
					qtyOut: 0,
					balanceQty: 82,
					basicRate: 45000,
					basicAmount: 135000,
					valuationRate: 45071.79,
					balanceValue: 3695886.78,
					unitOfMeasure: "Nos",
					remarks: "Initial stock",
					createdAt: new Date("2026-03-24T08:00:00.000Z"),
					updatedAt: new Date("2026-03-24T08:00:00.000Z"),
				},
			],
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		}));
	});

	it("renders the stock ledger header and table row", () => {
		renderWithProviders(<StockLedgerPage />);

		expect(screen.getByText("Stock Ledger")).toBeInTheDocument();
		expect(screen.getByText("MAT-STE-2026-00001")).toBeInTheDocument();
		expect(screen.getByText("iPhone 13")).toBeInTheDocument();
		expect(screen.getByText("Inward")).toBeInTheDocument();
	});

	it("passes company filter changes into the report query", async () => {
		renderWithProviders(<StockLedgerPage />);

		fireEvent.change(screen.getByLabelText("Filter by company"), {
			target: { value: "Nova Gadget House" },
		});

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({ company: "Nova Gadget House", take: 250 }),
				expect.any(Object),
			);
		});
	});

	it("resets active filters", async () => {
		renderWithProviders(<StockLedgerPage />);

		fireEvent.change(screen.getByLabelText("Filter by warehouse"), {
			target: { value: "Stores - GH" },
		});

		const resetButton = screen.getByRole("button", { name: "Reset filters" });
		expect(resetButton).toBeEnabled();

		fireEvent.click(resetButton);

		await waitFor(() => {
			expect(screen.getByLabelText("Filter by warehouse")).toHaveValue("");
		});
	});
});
