import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import SerialNoStatusPage from "./page";

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
				listSerialNoStatus: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			onSerialNosChanged: {
				useSubscription: mockUseSubscription,
			},
			listSerialNoStatus: {
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

describe("SerialNoStatusPage", () => {
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
						warrantyExpiryDate: new Date("2027-03-20T00:00:00.000Z"),
						serviceContractExpiryDate: new Date("2026-09-20T00:00:00.000Z"),
						lastStatusChangedAt: new Date("2026-03-21T00:00:00.000Z"),
						daysInCurrentStatus: 5,
						maintenanceStatus: "Healthy",
						notes: null,
						isDisabled: false,
						createdAt: new Date("2026-03-20T00:00:00.000Z"),
						updatedAt: new Date("2026-03-25T00:00:00.000Z"),
					},
				],
				totalCount: 1,
			},
			error: null,
			refetch: vi.fn(),
			input,
		}));
	});

	it("renders serial number status report rows", () => {
		renderWithProviders(<SerialNoStatusPage />);

		expect(
			screen.getByRole("heading", {
				name: "Serial No Status",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("SN-1001")).toBeInTheDocument();
		expect(screen.getByText("LAP-001")).toBeInTheDocument();
		expect(screen.getByText("Stores - GH")).toBeInTheDocument();
		expect(screen.getAllByText("Available")[0]).toBeInTheDocument();
	});

	it("passes status filters into the report query", async () => {
		const user = userEvent.setup();
		renderWithProviders(<SerialNoStatusPage />);

		await user.click(screen.getByLabelText("Status"));
		await user.click(screen.getByRole("option", { name: "Installed" }));

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({
					status: "INSTALLED",
				}),
				expect.any(Object),
			);
		});
	});

	it("switches to grouped output", async () => {
		const user = userEvent.setup();
		renderWithProviders(<SerialNoStatusPage />);

		await user.click(screen.getByLabelText(/Group By/i));
		await user.click(screen.getByRole("option", { name: "Status" }));

		expect(await screen.findByText("Group")).toBeInTheDocument();
		expect(screen.getAllByText("AVAILABLE")[0]).toBeInTheDocument();
	});
});
