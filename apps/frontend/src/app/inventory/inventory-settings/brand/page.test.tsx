import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import BrandPage from "./page";

const mockCreateMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);

vi.mock("@aria/types", () => ({
	Inventory: {
		createBrandSchema: {
			safeParse: (input: unknown) => {
				const value = input as { name?: string; description?: string | null };
				return {
					success: true as const,
					data: {
						name: value.name ?? "",
						description: value.description ?? null,
					},
				};
			},
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listBrands: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listBrands: {
				useQuery: () => ({
					data: [
						{
							id: "clh123brand",
							name: "Acme",
							description: "Leading brand",
							createdAt: new Date("2026-01-01"),
							updatedAt: new Date("2026-01-02"),
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			createBrand: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			deleteBrand: {
				useMutation: () => ({
					isPending: false,
					mutate: mockDeleteMutate,
				}),
			},
		},
	},
}));

describe("BrandPage", () => {
	it("renders the table and quick-create dialog", async () => {
		const user = userEvent.setup();
		renderWithProviders(<BrandPage />);

		expect(screen.getByText("Add Brand")).toBeInTheDocument();
		expect(screen.getAllByText("Acme")).toHaveLength(2);
		expect(screen.getByText("Leading brand")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Add Brand" }));
		const nameInput = await screen.findByLabelText(/Brand Name/i);
		await user.type(nameInput, "Nike");

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith({
				name: "Nike",
				description: null,
			});
		});
	}, 15_000);
});
