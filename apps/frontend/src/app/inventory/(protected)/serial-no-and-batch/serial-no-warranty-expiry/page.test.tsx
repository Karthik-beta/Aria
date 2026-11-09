import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import SerialNoWarrantyExpiryPage from "./page";

const { mockInvalidate, mockUseSubscription, mockUseQuery } = vi.hoisted(
	() => ({
		mockInvalidate: vi.fn().mockResolvedValue(undefined),
		mockUseSubscription: vi.fn(),
		mockUseQuery: vi.fn(),
	}),
);

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listSerialNoWarrantyExpiry: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			onSerialNosChanged: {
				useSubscription: mockUseSubscription,
			},
			listSerialNoWarrantyExpiry: {
				useQuery: mockUseQuery,
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
		},
	},
}));

describe("SerialNoWarrantyExpiryPage", () => {
	beforeEach(() => {
		mockInvalidate.mockClear();
		mockUseSubscription.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation(() => ({
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
						workOrder: "WO-1",
						purchaseDate: new Date("2025-03-20T00:00:00.000Z"),
						warrantyExpiryDate: new Date("2026-04-10T00:00:00.000Z"),
						daysUntilExpiry: 15,
						expiryState: "DUE_SOON",
						maintenanceStatus: "Active",
						notes: null,
						isDisabled: false,
						createdAt: new Date("2025-03-20T00:00:00.000Z"),
						updatedAt: new Date("2025-03-21T00:00:00.000Z"),
					},
				],
				totalCount: 1,
			},
			error: null,
			refetch: vi.fn(),
		}));
	});

	it("renders the warranty expiry report heading and row data", () => {
		renderWithProviders(<SerialNoWarrantyExpiryPage />);

		expect(
			screen.getByRole("heading", { name: "Serial No Warranty Expiry" }),
		).toBeInTheDocument();
		expect(screen.getByText("SN-1001")).toBeInTheDocument();
		expect(screen.getByText("LAP-001")).toBeInTheDocument();
		expect(screen.getByText("Stores - GH")).toBeInTheDocument();
		expect(screen.getByText("Due Soon")).toBeInTheDocument();
	});

	it("passes expiry state filter into the report query", async () => {
		const user = userEvent.setup();
		renderWithProviders(<SerialNoWarrantyExpiryPage />);

		await user.click(screen.getByLabelText(/Expiry State/i));
		await user.click(screen.getByRole("option", { name: "Expired" }));

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({
					expiryState: "EXPIRED",
					expiringWithinDays: 30,
				}),
				expect.any(Object),
			);
		});
	});

	it("initialises subscription and invalidates cache on event", () => {
		renderWithProviders(<SerialNoWarrantyExpiryPage />);

		expect(mockUseSubscription).toHaveBeenCalledWith(
			undefined,
			expect.objectContaining({ onData: expect.any(Function) }),
		);

		const { onData } = mockUseSubscription.mock.calls[0][1] as {
			onData: (event: { type: "created" | "updated" | "deleted" }) => void;
		};

		onData({ type: "created" });
		expect(mockInvalidate).toHaveBeenCalledTimes(1);
	});

	it("shows error state when query fails", () => {
		mockUseQuery.mockReturnValue({
			data: undefined,
			error: new Error("Network error"),
			refetch: vi.fn(),
		});

		renderWithProviders(<SerialNoWarrantyExpiryPage />);

		expect(
			screen.getByText(/Unable to load warranty expiry report/i),
		).toBeInTheDocument();
	});

	it("passes status filter into the report query", async () => {
		const user = userEvent.setup();
		renderWithProviders(<SerialNoWarrantyExpiryPage />);

		await user.click(screen.getByLabelText(/^Status$/i));
		await user.click(screen.getByRole("option", { name: "Available" }));

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({ status: "AVAILABLE" }),
				expect.any(Object),
			);
		});
	});
});
