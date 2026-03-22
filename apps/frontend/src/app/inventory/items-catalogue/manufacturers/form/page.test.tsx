import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import ItemManufacturerFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;
const mockItemManufacturers = [
	{
		id: "clh123manufacturer",
		itemId: "clh1234567890abcde123450",
		itemCode: "01223",
		itemName: "iPhone 13",
		itemDescription: "Phone",
		manufacturer: "Apple",
		manufacturerPartNumber: "APL-001",
		isDefault: true,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
	},
];

const getMockManufacturerById = (id: string | null) =>
	mockItemManufacturers.find((manufacturer) => manufacturer.id === id) ?? null;

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
		manufacturer: {} as never,
		manufacturerPartNumber: {} as never,
		isDefault: {} as never,
	};

	return {
		Inventory: {
			createItemManufacturerSchema: {
				shape: createShape,
				safeParse: (input: unknown) => ({
					success: true as const,
					data: input,
				}),
			},
			updateItemManufacturerSchema: {
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
				listItemManufacturers: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getItemManufacturerById: {
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
							name: "iPhone 13",
							code: "01223",
							description: "Phone",
							defaultUnitOfMeasureId: null,
						},
					],
				}),
			},
			getItemManufacturerById: {
				useQuery: () => ({
					data: getMockManufacturerById(currentId),
					isLoading: false,
				}),
			},
			createItemManufacturer: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateItemManufacturer: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("ItemManufacturerFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("submits create payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<ItemManufacturerFormPage />);

		await user.type(screen.getByLabelText(/Manufacturer \*/i), "Apple");
		await user.type(
			screen.getByLabelText(/Manufacturer Part Number \*/i),
			"APL-001",
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith({
				itemId: "clh1234567890abcde123450",
				manufacturer: "Apple",
				manufacturerPartNumber: "APL-001",
				isDefault: false,
			});
		});
	});

	it("prefills edit form and submits update payload", async () => {
		currentId = "clh123manufacturer";
		const user = userEvent.setup();
		renderWithProviders(<ItemManufacturerFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Apple")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith({
				id: "clh123manufacturer",
				itemId: "clh1234567890abcde123450",
				manufacturer: "Apple",
				manufacturerPartNumber: "APL-001",
				isDefault: true,
			});
		});
	});

	it("redirects to list when edit id is not found", async () => {
		currentId = "missing-id";
		renderWithProviders(<ItemManufacturerFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/inventory/manufacturers");
		});
	});
});
