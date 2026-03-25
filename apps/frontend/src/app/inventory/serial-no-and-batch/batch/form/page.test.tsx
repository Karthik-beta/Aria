import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import BatchFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const batchRecord = {
	id: "clbatch00000000000001",
	batchId: "BATCH-1001",
	itemId: "clitem000000000000001",
	itemCode: "LAP-001",
	itemName: "Laptop",
	company: "Aria Corp",
	currentWarehouseId: "clwarehouse0000000001",
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
	status: "ACTIVE" as const,
	isDisabled: false,
	createdAt: new Date("2026-03-20"),
	updatedAt: new Date("2026-03-21"),
};

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
	}),
	useSearchParams: () => ({
		get: (key: string) => (key === "id" ? currentId : null),
	}),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listBatches: { invalidate: vi.fn().mockResolvedValue(undefined) },
				getBatchById: { invalidate: vi.fn().mockResolvedValue(undefined) },
			},
		}),
		inventory: {
			getBatchById: {
				useQuery: () => ({
					data: currentId === batchRecord.id ? batchRecord : null,
					isLoading: false,
				}),
			},
			listItems: {
				useQuery: () => ({
					data: [
						{
							id: "clitem000000000000001",
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
								id: "clwarehouse0000000001",
								name: "Stores - GH",
								company: "Aria Corp",
							},
						],
						totalCount: 1,
					},
				}),
			},
			listPurchaseReceipts: { useQuery: () => ({ data: [] }) },
			listDeliveryNotes: { useQuery: () => ({ data: [] }) },
			listStockEntries: { useQuery: () => ({ data: [] }) },
			createBatch: {
				useMutation: () => ({ isPending: false, mutate: mockCreateMutate }),
			},
			updateBatch: {
				useMutation: () => ({ isPending: false, mutate: mockUpdateMutate }),
			},
		},
	},
}));

describe("BatchFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("submits the create payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<BatchFormPage />);

		await user.type(screen.getByLabelText(/Batch ID/i), "batch-2002");
		await user.click(screen.getByRole("combobox", { name: /Item/i }));
		await user.click(screen.getByText("LAP-001"));
		await user.click(
			screen.getByRole("combobox", { name: /Current Warehouse/i }),
		);
		await user.click(screen.getByText("Stores - GH"));
		await user.clear(screen.getByLabelText(/Batch Quantity/i));
		await user.type(screen.getByLabelText(/Batch Quantity/i), "5");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					batchId: "BATCH-2002",
					itemId: "clitem000000000000001",
					company: "Aria Corp",
					currentWarehouseId: "clwarehouse0000000001",
					quantity: 5,
				}),
			);
		});
	});

	it("prefills and submits the update payload", async () => {
		currentId = "clbatch00000000000001";
		const user = userEvent.setup();
		renderWithProviders(<BatchFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("BATCH-1001")).toBeInTheDocument();
		});

		await user.clear(screen.getByLabelText(/Batch ID/i));
		await user.type(screen.getByLabelText(/Batch ID/i), "batch-1001-rev");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "clbatch00000000000001",
					batchId: "BATCH-1001-REV",
				}),
			);
		});
	});

	it("redirects when the batch is missing", async () => {
		currentId = "missing";
		renderWithProviders(<BatchFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/serial-no-and-batch/batch",
			);
		});
	});
});
