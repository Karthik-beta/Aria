import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import PickListFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const mockPickLists = [
	{
		id: "clh123pkl000001",
		series: "STO-PICK-2026-00001",
		seriesPattern: "STO-PICK-.YYYY.-",
		status: "DRAFT" as const,
		company: "Aria Corp",
		customer: "Acme Ltd",
		purpose: "DELIVERY" as const,
		workOrder: null,
		warehouse: "Main Warehouse",
		considerRejectedWarehouses: false,
		pickManually: false,
		ignorePricingRule: false,
		scanMode: false,
		promptQty: false,
		scanBarcode: null,
		groupSameItems: false,
		items: [
			{
				id: "clh123pklitem01",
				pickListId: "clh123pkl000001",
				item: "ITEM-001",
				warehouse: "Main Warehouse",
				qty: 5,
				stockQty: null,
				pickedQty: null,
			},
		],
		createdAt: new Date("2026-03-23"),
		updatedAt: new Date("2026-03-23"),
	},
];

const getMockPickListById = (id: string | null) =>
	mockPickLists.find((pl) => pl.id === id) ?? null;

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		pathname: "/",
		query: {},
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
		createPickListItemSchema: { shape: {} },
		createPickListSchema: {
			shape: {},
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
		updatePickListSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listPickLists: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getPickListById: {
				useQuery: () => ({
					data: getMockPickListById(currentId),
					isLoading: false,
				}),
			},
			createPickList: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updatePickList: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("PickListFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form with Save button", () => {
		renderWithProviders(<PickListFormPage />);

		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByText("New Pick List")).toBeInTheDocument();
	});

	it("submits create payload with company", async () => {
		const user = userEvent.setup();
		renderWithProviders(<PickListFormPage />);

		await user.clear(screen.getByLabelText(/Company \*/i));
		await user.type(screen.getByLabelText(/Company \*/i), "Aria Corp");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ company: "Aria Corp" }),
			);
		});
	});

	it("prefills edit form with series from data", async () => {
		currentId = "clh123pkl000001";
		renderWithProviders(<PickListFormPage />);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("STO-PICK-2026-00001"),
			).toBeInTheDocument();
		});
	});

	it("submits update payload in edit mode", async () => {
		currentId = "clh123pkl000001";
		const user = userEvent.setup();
		renderWithProviders(<PickListFormPage />);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("STO-PICK-2026-00001"),
			).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ id: "clh123pkl000001" }),
			);
		});
	});

	it("redirects to list when edit id is not found", async () => {
		currentId = "missing-id";
		renderWithProviders(<PickListFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/stock-transaction/pick-list",
			);
		});
	});

	it("adds an item row when Add Item is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<PickListFormPage />);

		expect(screen.getByText(/No items added/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Add Item/i }));

		expect(screen.queryByText(/No items added/i)).not.toBeInTheDocument();
	});
});
