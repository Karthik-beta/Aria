import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import WarehouseFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const warehouseRecord = {
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

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => async (values: unknown) => ({
		values,
		errors: {},
	}),
}));

vi.mock("@aria/types", () => ({
	Inventory: {
		createWarehouseSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
		updateWarehouseSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listWarehouses: { invalidate: vi.fn().mockResolvedValue(undefined) },
				getWarehouseById: { invalidate: vi.fn().mockResolvedValue(undefined) },
			},
		}),
		inventory: {
			getWarehouseById: {
				useQuery: () => ({
					data: currentId === warehouseRecord.id ? warehouseRecord : null,
					isLoading: false,
				}),
			},
			listWarehouses: {
				useQuery: () => ({
					data: {
						items: [warehouseRecord],
						totalCount: 1,
					},
				}),
			},
			createWarehouse: {
				useMutation: () => ({ isPending: false, mutate: mockCreateMutate }),
			},
			updateWarehouse: {
				useMutation: () => ({ isPending: false, mutate: mockUpdateMutate }),
			},
		},
	},
}));

describe("WarehouseFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("submits the create payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<WarehouseFormPage />);

		await user.type(screen.getByLabelText(/Warehouse Name/i), "Main Warehouse");
		await user.type(screen.getByLabelText(/Company/i), "Aria Corp");
		await user.type(screen.getByLabelText(/Warehouse Type/i), "Transit");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith({
				name: "Main Warehouse",
				disabled: false,
				isGroupWarehouse: false,
				parentWarehouseId: null,
				company: "Aria Corp",
				isRejectedWarehouse: false,
				phoneNo: null,
				mobileNo: null,
				addressLine1: null,
				addressLine2: null,
				city: null,
				state: null,
				pin: null,
				warehouseType: "Transit",
				defaultInTransitWarehouseId: null,
			});
		});
	});

	it("prefills and submits the update payload", async () => {
		currentId = warehouseRecord.id;
		const user = userEvent.setup();
		renderWithProviders(<WarehouseFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Stores - GH")).toBeInTheDocument();
		});

		await user.clear(screen.getByLabelText(/Warehouse Name/i));
		await user.type(screen.getByLabelText(/Warehouse Name/i), "Stores - Dubai");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith({
				id: "clh123warehouse",
				name: "Stores - Dubai",
				disabled: false,
				isGroupWarehouse: false,
				parentWarehouseId: null,
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
			});
		});
	});

	it("redirects when the edit warehouse is missing", async () => {
		currentId = "missing-id";
		renderWithProviders(<WarehouseFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/inventory-settings/warehouse",
			);
		});
	});
});
