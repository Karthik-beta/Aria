import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import SerialNoServiceContractExpiryPage from "./page";

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
				listSerialNoServiceContractExpiry: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			onSerialNosChanged: {
				useSubscription: mockUseSubscription,
			},
			listSerialNoServiceContractExpiry: {
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

describe("SerialNoServiceContractExpiryPage", () => {
	beforeEach(() => {
		mockInvalidate.mockClear();
		mockUseSubscription.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation((input: unknown) => ({
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
						purchaseDate: new Date("2026-03-20T00:00:00.000Z"),
						serviceContractExpiryDate: new Date("2026-04-10T00:00:00.000Z"),
						daysUntilExpiry: 15,
						expiryState: "DUE_SOON",
						maintenanceStatus: "Active",
						notes: null,
						isDisabled: false,
						createdAt: new Date("2026-03-20T00:00:00.000Z"),
						updatedAt: new Date("2026-03-21T00:00:00.000Z"),
					},
				],
				totalCount: 1,
			},
			error: null,
			refetch: vi.fn(),
			input,
		}));
	});

	it("renders service contract expiry report rows", () => {
		renderWithProviders(<SerialNoServiceContractExpiryPage />);

		expect(
			screen.getByRole("heading", {
				name: "Serial No Service Contract Expiry",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("SN-1001")).toBeInTheDocument();
		expect(screen.getByText("LAP-001")).toBeInTheDocument();
		expect(screen.getByText("Stores - GH")).toBeInTheDocument();
		expect(screen.getByText("Due Soon")).toBeInTheDocument();
	});

	it("passes expiry state filters into the report query", async () => {
		const user = userEvent.setup();
		renderWithProviders(<SerialNoServiceContractExpiryPage />);

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
});
