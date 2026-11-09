import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import BatchPage from "./page";

const { mockDeleteMutate, mockInvalidate, mockUseSubscription } = vi.hoisted(
	() => ({
		mockDeleteMutate: vi.fn(),
		mockInvalidate: vi.fn().mockResolvedValue(undefined),
		mockUseSubscription: vi.fn(),
	}),
);

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listBatches: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue({ items: [], totalCount: 0 }),
					setData: vi.fn(),
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			onBatchesChanged: {
				useSubscription: mockUseSubscription,
			},
			listBatches: {
				useQuery: () => ({
					data: {
						items: [
							{
								id: "batch-1",
								batchId: "BATCH-1001",
								itemId: "item-1",
								itemCode: "LAP-001",
								itemName: "Laptop",
								company: "Aria Corp",
								currentWarehouseId: "warehouse-1",
								currentWarehouseName: "Stores - GH",
								purchaseReceiptId: null,
								purchaseReceiptSeries: null,
								deliveryNoteId: null,
								deliveryNoteSeries: null,
								stockEntryId: null,
								stockEntrySeries: null,
								useBatchWiseValuation: false,
								manufacturingDate: new Date("2026-03-20"),
								expiryDate: new Date("2026-12-31"),
								description: "Lot 01",
								quantity: 10,
								status: "ACTIVE",
								isDisabled: false,
								createdAt: new Date("2026-03-20"),
								updatedAt: new Date("2026-03-21"),
							},
						],
						totalCount: 1,
					},
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			listItems: {
				useQuery: () => ({
					data: [
						{
							id: "item-1",
							code: "LAP-001",
							name: "Laptop",
							hasBatchNo: true,
							disabled: false,
						},
					],
				}),
			},
			listWarehouses: {
				useQuery: () => ({
					data: {
						items: [
							{
								id: "warehouse-1",
								name: "Stores - GH",
								company: "Aria Corp",
							},
						],
						totalCount: 1,
					},
				}),
			},
			deleteBatch: {
				useMutation: () => ({
					isPending: false,
					mutate: mockDeleteMutate,
				}),
			},
		},
	},
}));

describe("BatchPage", () => {
	beforeEach(() => {
		mockDeleteMutate.mockClear();
		mockInvalidate.mockClear();
		mockUseSubscription.mockClear();
	});

	it("renders batch list data", () => {
		renderWithProviders(<BatchPage />);

		expect(screen.getByRole("heading", { name: "Batch" })).toBeInTheDocument();
		expect(screen.getByText("BATCH-1001")).toBeInTheDocument();
		expect(screen.getByText("LAP-001")).toBeInTheDocument();
		expect(screen.getByText("Stores - GH")).toBeInTheDocument();
	});

	it("submits delete from the row actions menu", async () => {
		const user = userEvent.setup();
		renderWithProviders(<BatchPage />);

		await user.click(
			screen.getByRole("button", { name: /Open actions for BATCH-1001/i }),
		);
		await user.click(screen.getByRole("menuitem", { name: /Delete Batch/i }));
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledWith({ id: "batch-1" });
		});
	});
});
