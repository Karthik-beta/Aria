import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "../../../../../test/utils";
import ItemAlternativeFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;
const mockItemAlternatives = [
	{
		id: "clh123alt",
		itemId: "clh1234567890abcde123450",
		itemCode: "43567-OR",
		itemName: "Orange Shirt",
		alternativeItemId: "clh1234567890abcde123451",
		alternativeItemCode: "43567-BLA",
		alternativeItemName: "Black Shirt",
		twoWay: true,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
	},
];

const getMockItemAlternativeById = (id: string | null) =>
	mockItemAlternatives.find((itemAlternative) => itemAlternative.id === id) ??
	null;

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
	const createShape = {
		itemId: {} as never,
		alternativeItemId: {} as never,
		twoWay: {} as never,
	};

	return {
		Inventory: {
			createItemAlternativeSchema: {
				shape: createShape,
				safeParse: (input: unknown) => ({
					success: true as const,
					data: input,
				}),
			},
			updateItemAlternativeSchema: {
				omit: () => ({
					extend: () => ({
						safeParse: (input: unknown) => ({
							success: true as const,
							data: input,
						}),
					}),
				}),
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
				listItemAlternatives: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getItemAlternativeById: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listBundleItems: {
				useQuery: () => ({
					data: [
						{
							id: "clh1234567890abcde123450",
							name: "Orange Shirt",
							code: "43567-OR",
							defaultUnitOfMeasureId: null,
						},
						{
							id: "clh1234567890abcde123451",
							name: "Black Shirt",
							code: "43567-BLA",
							defaultUnitOfMeasureId: null,
						},
					],
				}),
			},
			getItemAlternativeById: {
				useQuery: () => ({
					data: getMockItemAlternativeById(currentId),
					isLoading: false,
				}),
			},
			createItemAlternative: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateItemAlternative: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("ItemAlternativeFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("submits create payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<ItemAlternativeFormPage />);

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith({
				itemId: "clh1234567890abcde123450",
				alternativeItemId: "clh1234567890abcde123451",
				twoWay: false,
			});
		});
	});

	it("prefills edit form and submits update payload", async () => {
		currentId = "clh123alt";
		const user = userEvent.setup();
		renderWithProviders(<ItemAlternativeFormPage />);

		await waitFor(() => {
			expect(screen.getByText("43567-OR -> 43567-BLA")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith({
				id: "clh123alt",
				itemId: "clh1234567890abcde123450",
				alternativeItemId: "clh1234567890abcde123451",
				twoWay: true,
			});
		});
	});

	it("redirects to list when edit id is not found", async () => {
		currentId = "missing-id";
		renderWithProviders(<ItemAlternativeFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/inventory/item-alternatives");
		});
	});
});
