import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fireEvent,
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "@/test/utils";
import WarehouseWiseStockBalancePage from "./page";

const { mockInvalidate, mockUseQuery, mockUseSubscription } = vi.hoisted(
	() => ({
		mockInvalidate: vi.fn().mockResolvedValue(undefined),
		mockUseQuery: vi.fn(),
		mockUseSubscription: vi.fn(),
	}),
);

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listWarehouseWiseStockBalance: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listWarehouseWiseStockBalance: {
				useQuery: mockUseQuery,
			},
			onStockEntriesChanged: {
				useSubscription: mockUseSubscription,
			},
		},
	},
}));

describe("WarehouseWiseStockBalancePage", () => {
	beforeEach(() => {
		mockInvalidate.mockClear();
		mockUseSubscription.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation(() => ({
			data: [
				{
					id: "mat-sle-1",
					stockEntryId: "entry-1",
					stockEntryItemId: "entry-item-1",
					company: "Nova Gadget House",
					itemCode: "ITEM-001",
					itemName: "iPhone 13",
					warehouse: "Stores - GH",
					postingDate: new Date("2026-03-24T00:00:00.000Z"),
					voucherNo: "MAT-STE-2026-00001",
					qtyChange: 10,
					incomingRate: 45000,
					movementType: "IN",
					createdAt: new Date("2026-03-24T09:00:00.000Z"),
					updatedAt: new Date("2026-03-24T09:00:00.000Z"),
				},
				{
					id: "mat-sle-2",
					stockEntryId: "entry-2",
					stockEntryItemId: "entry-item-2",
					company: "Nova Gadget House",
					itemCode: "ITEM-002",
					itemName: "iPhone 14",
					warehouse: "Stores - GH",
					postingDate: new Date("2026-03-23T00:00:00.000Z"),
					voucherNo: "MAT-STE-2026-00002",
					qtyChange: -2,
					incomingRate: 0,
					movementType: "OUT",
					createdAt: new Date("2026-03-23T09:00:00.000Z"),
					updatedAt: new Date("2026-03-23T09:00:00.000Z"),
				},
			],
			isLoading: false,
			error: null,
			refetch: vi.fn(),
		}));
	});

	it("renders the warehouse wise stock balance header and table rows", () => {
		renderWithProviders(<WarehouseWiseStockBalancePage />);

		expect(
			screen.getByText("Warehouse Wise Stock Balance"),
		).toBeInTheDocument();
		expect(screen.getByText("ITEM-001")).toBeInTheDocument();
		expect(screen.getByText("ITEM-002")).toBeInTheDocument();
	});

	it("passes company filter changes into the report query", async () => {
		renderWithProviders(<WarehouseWiseStockBalancePage />);

		fireEvent.change(screen.getByLabelText("Filter by company"), {
			target: { value: "Nova Gadget House" },
		});

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({
					company: "Nova Gadget House",
					status: "SUBMITTED",
					take: 250,
				}),
				expect.any(Object),
			);
		});
	});

	it("applies filter dialog rules", async () => {
		const user = userEvent.setup();
		renderWithProviders(<WarehouseWiseStockBalancePage />);

		await user.click(screen.getByRole("button", { name: "Filter" }));

		const valueInputs = screen.getAllByLabelText("Filter value");
		await user.clear(valueInputs[0] as HTMLInputElement);
		await user.type(valueInputs[0] as HTMLInputElement, "ITEM-001");
		await user.click(screen.getByRole("button", { name: "Apply Filters" }));

		expect(screen.getByText("ITEM-001")).toBeInTheDocument();
		expect(screen.queryByText("ITEM-002")).not.toBeInTheDocument();
	});

	it("applies grouping through the add group dialog", async () => {
		const user = userEvent.setup();
		renderWithProviders(<WarehouseWiseStockBalancePage />);

		await user.click(screen.getByRole("button", { name: "Add Group" }));
		await user.click(screen.getByRole("button", { name: "Apply Group" }));

		expect(screen.getByText("Group")).toBeInTheDocument();
		expect(screen.getByText("Stores - GH")).toBeInTheDocument();
		expect(screen.getAllByText("2").length).toBeGreaterThan(0);
	});
});
