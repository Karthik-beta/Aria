import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import BrandFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;
let currentSearchParams = new URLSearchParams();

const mockBrands = [
	{
		id: "clh123brand",
		name: "Acme",
		description: "Leading brand",
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
	},
];

const getMockBrandById = (id: string | null) =>
	mockBrands.find((b) => b.id === id) ?? null;

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
		get: (key: string) =>
			key === "id" ? currentId : currentSearchParams.get(key),
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
		createBrandSchema: {
			safeParse: (input: unknown) => ({
				success: true as const,
				data: input,
			}),
		},
		updateBrandSchema: {
			safeParse: (input: unknown) => ({
				success: true as const,
				data: input,
			}),
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listBrands: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getBrandById: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getBrandById: {
				useQuery: () => ({
					data: getMockBrandById(currentId),
					isLoading: false,
				}),
			},
			createBrand: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateBrand: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("BrandFormPage", () => {
	beforeEach(() => {
		currentId = null;
		currentSearchParams = new URLSearchParams();
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("submits the create payload", async () => {
		currentSearchParams = new URLSearchParams({ name: "Nike" });
		const user = userEvent.setup();
		renderWithProviders(<BrandFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Nike")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith({
				name: "Nike",
				description: null,
			});
		});
	});

	it("prefills edit form and submits the update payload", async () => {
		currentId = "clh123brand";
		const user = userEvent.setup();
		renderWithProviders(<BrandFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Acme")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith({
				id: "clh123brand",
				name: "Acme",
				description: "Leading brand",
			});
		});
	});

	it("redirects to the list page when the edit record is missing", async () => {
		currentId = "missing-id";
		renderWithProviders(<BrandFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/inventory-settings/brand",
			);
		});
	});
});
