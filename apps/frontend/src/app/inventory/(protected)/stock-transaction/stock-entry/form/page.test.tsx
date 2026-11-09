import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import StockEntryFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const mockStockEntries = [
	{
		id: "clh123ste000001",
		series: "MAT-STE-2026-00001",
		stockEntryType: "MATERIAL_RECEIPT" as const,
		postingDate: new Date("2026-01-15"),
		company: "Aria Corp",
		status: "DRAFT" as const,
		project: null,
		defaultSourceWarehouse: null,
		defaultTargetWarehouse: "Main Warehouse",
		isOpening: false,
		remarks: null,
		printHeading: null,
		letterHead: null,
		inspectionRequired: false,
		items: [
			{
				id: "clh123ste_item01",
				stockEntryId: "clh123ste000001",
				itemCode: "STE-ITM-001",
				itemName: "Stock Test Item",
				sourceWarehouse: null,
				targetWarehouse: null,
				description: null,
				qty: 10,
				basicRate: 100,
				basicAmount: 1000,
				unitOfMeasure: null,
			},
		],
		createdAt: new Date("2026-01-15"),
		updatedAt: new Date("2026-01-15"),
	},
];

const getMockEntryById = (id: string | null) =>
	mockStockEntries.find((entry) => entry.id === id) ?? null;

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

vi.mock("@aria/types", () => {
	const createItemShape = {
		itemCode: {} as never,
		itemName: {} as never,
		sourceWarehouse: {} as never,
		targetWarehouse: {} as never,
		qty: {} as never,
		basicRate: {} as never,
		unitOfMeasure: {} as never,
	};
	const createShape = {
		stockEntryType: {} as never,
		postingDate: {} as never,
		company: {} as never,
		project: {} as never,
		defaultSourceWarehouse: {} as never,
		defaultTargetWarehouse: {} as never,
		isOpening: {} as never,
		remarks: {} as never,
		printHeading: {} as never,
		letterHead: {} as never,
		inspectionRequired: {} as never,
		items: {} as never,
	};

	return {
		Inventory: {
			createStockEntryItemSchema: {
				shape: createItemShape,
			},
			createStockEntrySchema: {
				shape: createShape,
				safeParse: (input: unknown) => ({
					success: true as const,
					data: input,
				}),
			},
			updateStockEntrySchema: {
				safeParse: (input: unknown) => ({
					success: true as const,
					data: input,
				}),
			},
		},
	};
});

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listStockEntries: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getStockEntryById: {
				useQuery: () => ({
					data: getMockEntryById(currentId),
					isLoading: false,
				}),
			},
			createStockEntry: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateStockEntry: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("StockEntryFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form with Save button", () => {
		renderWithProviders(<StockEntryFormPage />);

		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByText("New Stock Entry")).toBeInTheDocument();
	});

	it("submits create payload with company field", async () => {
		const user = userEvent.setup();
		renderWithProviders(<StockEntryFormPage />);

		await user.clear(screen.getByLabelText(/Company/i));
		await user.type(screen.getByLabelText(/Company/i), "Test Corp");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ company: "Test Corp" }),
			);
		});
	});

	it("prefills edit form with series from data", async () => {
		currentId = "clh123ste000001";
		renderWithProviders(<StockEntryFormPage />);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("MAT-STE-2026-00001"),
			).toBeInTheDocument();
		});
	});

	it("submits update payload in edit mode", async () => {
		currentId = "clh123ste000001";
		const user = userEvent.setup();
		renderWithProviders(<StockEntryFormPage />);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("MAT-STE-2026-00001"),
			).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ id: "clh123ste000001" }),
			);
		});
	});

	it("redirects to list when edit id is not found", async () => {
		currentId = "missing-id";
		renderWithProviders(<StockEntryFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/stock-transaction/stock-entry",
			);
		});
	});
});
