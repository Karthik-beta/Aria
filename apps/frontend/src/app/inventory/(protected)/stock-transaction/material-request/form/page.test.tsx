import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import MaterialRequestFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const mockMaterialRequests = [
	{
		id: "clh123mr000001",
		series: "MAT-MR-2026-00001",
		transactionDate: "2026-03-23T00:00:00.000Z",
		purpose: "PURCHASE" as const,
		company: "Aria Corp",
		requiredBy: "2026-04-01T00:00:00.000Z",
		status: "DRAFT" as const,
		targetWarehouse: "Main Warehouse",
		terms: null,
		termsContent: null,
		letterHead: null,
		printHeading: null,
		items: [
			{
				id: "clh123mritem01",
				materialRequestId: "clh123mr000001",
				itemCode: "ITEM-001",
				itemName: "Widget A",
				requiredBy: null,
				quantity: 10,
				orderedQty: 0,
				receivedQty: 0,
				targetWarehouse: "Main Warehouse",
				unitOfMeasure: "Nos",
			},
		],
		createdAt: "2026-03-23T00:00:00.000Z",
		updatedAt: "2026-03-23T00:00:00.000Z",
	},
];

const getMockMaterialRequestById = (id: string | null) =>
	mockMaterialRequests.find((mr) => mr.id === id) ?? null;

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
		createMaterialRequestItemSchema: { shape: {} },
		createMaterialRequestSchema: {
			shape: {},
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
		updateMaterialRequestSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listMaterialRequests: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getMaterialRequestById: {
				useQuery: () => ({
					data: getMockMaterialRequestById(currentId),
					isLoading: false,
				}),
			},
			createMaterialRequest: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateMaterialRequest: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("MaterialRequestFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form with Save button", () => {
		renderWithProviders(<MaterialRequestFormPage />);

		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByText("New Material Request")).toBeInTheDocument();
	});

	it("submits create payload with company", async () => {
		const user = userEvent.setup();
		renderWithProviders(<MaterialRequestFormPage />);

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
		currentId = "clh123mr000001";
		renderWithProviders(<MaterialRequestFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("MAT-MR-2026-00001")).toBeInTheDocument();
		});
	});

	it("submits update payload in edit mode", async () => {
		currentId = "clh123mr000001";
		const user = userEvent.setup();
		renderWithProviders(<MaterialRequestFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("MAT-MR-2026-00001")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ id: "clh123mr000001" }),
			);
		});
	});

	it("redirects to list when edit id is not found", async () => {
		currentId = "missing-id";
		renderWithProviders(<MaterialRequestFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/stock-transaction/material-request",
			);
		});
	});
});
