import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import SerialNoFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const serialNoRecord = {
	id: "clserial00000000000001",
	serialNo: "SN-1001",
	itemId: "clitem000000000000001",
	itemCode: "LAP-001",
	itemName: "Laptop",
	company: "Aria Corp",
	status: "AVAILABLE" as const,
	currentWarehouseId: "clwarehouse0000000001",
	currentWarehouseName: "Stores - GH",
	purchaseReceiptId: null,
	purchaseReceiptSeries: null,
	deliveryNoteId: null,
	deliveryNoteSeries: null,
	stockEntryId: null,
	stockEntrySeries: null,
	pickListId: null,
	pickListSeries: null,
	workOrder: "WO-1",
	purchaseDate: new Date("2026-03-20"),
	warrantyExpiryDate: new Date("2027-03-20"),
	serviceContractExpiryDate: null,
	maintenanceStatus: "Active",
	notes: "Installed at site",
	isDisabled: false,
	createdAt: new Date("2026-03-20"),
	updatedAt: new Date("2026-03-21"),
	history: [],
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
				listSerialNos: { invalidate: vi.fn().mockResolvedValue(undefined) },
				getSerialNoById: { invalidate: vi.fn().mockResolvedValue(undefined) },
			},
		}),
		inventory: {
			getSerialNoById: {
				useQuery: () => ({
					data: currentId === serialNoRecord.id ? serialNoRecord : null,
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
							hasSerialNo: true,
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
			listPickLists: { useQuery: () => ({ data: [] }) },
			createSerialNo: {
				useMutation: () => ({ isPending: false, mutate: mockCreateMutate }),
			},
			updateSerialNo: {
				useMutation: () => ({ isPending: false, mutate: mockUpdateMutate }),
			},
		},
	},
}));

describe("SerialNoFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("submits the create payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<SerialNoFormPage />);

		await user.type(screen.getByLabelText(/Serial No/i), "SN-2002");
		await user.click(screen.getByRole("combobox", { name: /Item/i }));
		await user.click(screen.getByText("LAP-001"));
		await user.type(screen.getByLabelText(/Company/i), "Aria Corp");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					serialNo: "SN-2002",
					itemId: "clitem000000000000001",
					company: "Aria Corp",
				}),
			);
		});
	});

	it("prefills and submits the update payload", async () => {
		currentId = "clserial00000000000001";
		const user = userEvent.setup();
		renderWithProviders(<SerialNoFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("SN-1001")).toBeInTheDocument();
		});

		await user.clear(screen.getByLabelText(/Serial No/i));
		await user.type(screen.getByLabelText(/Serial No/i), "SN-1001-REV");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "clserial00000000000001",
					serialNo: "SN-1001-REV",
				}),
			);
		});
	});

	it("redirects when the serial number is missing", async () => {
		currentId = "missing";
		renderWithProviders(<SerialNoFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/serial-no-and-batch/serial-no",
			);
		});
	});
});
