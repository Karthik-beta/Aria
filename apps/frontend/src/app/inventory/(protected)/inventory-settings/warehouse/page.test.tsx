import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import WarehousePage from "./page";

const mockDeleteMutate = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listWarehouses: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue({
						items: [],
						totalCount: 0,
					}),
					setData: vi.fn(),
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listWarehouses: {
				useQuery: () => ({
					data: {
						items: [
							{
								id: "clh123warehouse",
								name: "Stores - GH",
								disabled: false,
								isGroupWarehouse: false,
								parentWarehouseId: null,
								parentWarehouseName: null,
								company: "Aria Corp",
								isRejectedWarehouse: false,
								phoneNo: null,
								mobileNo: null,
								addressLine1: null,
								addressLine2: null,
								city: null,
								state: null,
								pin: null,
								warehouseType: "Retail",
								defaultInTransitWarehouseId: null,
								defaultInTransitWarehouseName: null,
								createdAt: new Date("2026-01-01"),
								updatedAt: new Date("2026-01-02"),
							},
						],
						totalCount: 1,
					},
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			deleteWarehouse: {
				useMutation: () => ({
					isPending: false,
					mutate: mockDeleteMutate,
				}),
			},
		},
	},
}));

describe("WarehousePage", () => {
	beforeEach(() => {
		mockDeleteMutate.mockClear();
		mockInvalidate.mockClear();
	});

	it("renders the warehouse list and inventory settings actions", () => {
		renderWithProviders(<WarehousePage />);

		expect(screen.getByText("Warehouse")).toBeInTheDocument();
		expect(screen.getByText("Stores - GH")).toBeInTheDocument();
		expect(screen.getByText("Aria Corp")).toBeInTheDocument();
		expect(screen.getByText(/Add Warehouse/i)).toBeInTheDocument();
	});

	it("submits delete through the row action menu", async () => {
		const user = userEvent.setup();
		renderWithProviders(<WarehousePage />);

		await user.click(
			screen.getByRole("button", { name: /Open actions for Stores - GH/i }),
		);
		await user.click(
			screen.getByRole("menuitem", { name: /Delete Warehouse/i }),
		);
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledWith({ id: "clh123warehouse" });
		});
	});
});
