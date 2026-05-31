import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import SerialNoPage from "./page";

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
				listSerialNos: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue({ items: [], totalCount: 0 }),
					setData: vi.fn(),
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			onSerialNosChanged: {
				useSubscription: mockUseSubscription,
			},
			listSerialNos: {
				useQuery: () => ({
					data: {
						items: [
							{
								id: "serial-1",
								serialNo: "SN-1001",
								itemId: "item-1",
								itemCode: "LAP-001",
								itemName: "Laptop",
								company: "Aria Corp",
								status: "AVAILABLE",
								currentWarehouseId: "warehouse-1",
								currentWarehouseName: "Stores - GH",
								purchaseReceiptId: null,
								purchaseReceiptSeries: null,
								deliveryNoteId: null,
								deliveryNoteSeries: null,
								stockEntryId: null,
								stockEntrySeries: null,
								pickListId: null,
								pickListSeries: null,
								workOrder: null,
								purchaseDate: null,
								warrantyExpiryDate: null,
								serviceContractExpiryDate: null,
								maintenanceStatus: null,
								notes: null,
								isDisabled: false,
								createdAt: new Date("2026-03-20"),
								updatedAt: new Date("2026-03-21"),
								history: [],
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
								id: "warehouse-1",
								name: "Stores - GH",
								company: "Aria Corp",
							},
						],
						totalCount: 1,
					},
				}),
			},
			deleteSerialNo: {
				useMutation: () => ({
					isPending: false,
					mutate: mockDeleteMutate,
				}),
			},
		},
	},
}));

describe("SerialNoPage", () => {
	beforeEach(() => {
		mockDeleteMutate.mockClear();
		mockInvalidate.mockClear();
		mockUseSubscription.mockClear();
	});

	it("renders serial number list data", () => {
		renderWithProviders(<SerialNoPage />);

		expect(
			screen.getByRole("heading", { name: "Serial No" }),
		).toBeInTheDocument();
		expect(screen.getByText("SN-1001")).toBeInTheDocument();
		expect(screen.getByText("LAP-001")).toBeInTheDocument();
		expect(screen.getByText("Stores - GH")).toBeInTheDocument();
	});

	it("submits delete from the row actions menu", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		renderWithProviders(<SerialNoPage />);

		await user.click(
			screen.getByRole("button", { name: /Open actions for SN-1001/i }),
		);
		await user.click(
			await screen.findByRole("menuitem", { name: /Delete Serial No/i }),
		);
		await user.click(await screen.findByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledWith({ id: "serial-1" });
		});
	});
});
