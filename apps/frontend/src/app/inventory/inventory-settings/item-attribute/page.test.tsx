import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import ItemAttributePage from "./page";

const mockCreateMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);

vi.mock("@aria/types", () => ({
	Inventory: {
		createItemAttributeSchema: {
			safeParse: (input: unknown) => {
				const value = input as {
					name?: string;
					disabled?: boolean;
					numericValues?: boolean;
					attributeValues?: unknown[];
				};
				return {
					success: true as const,
					data: {
						name: value.name ?? "",
						disabled: value.disabled ?? false,
						numericValues: value.numericValues ?? false,
						attributeValues: value.attributeValues ?? [],
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
				listItemAttributes: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listItemAttributes: {
				useQuery: () => ({
					data: [
						{
							id: "clh123ia0001",
							name: "Colour",
							disabled: false,
							numericValues: false,
							attributeValues: [
								{
									id: "clh123iav001",
									attributeId: "clh123ia0001",
									attributeValue: "Red",
									abbreviation: "R",
									position: 0,
									createdAt: new Date("2026-01-01"),
									updatedAt: new Date("2026-01-01"),
								},
							],
							createdAt: new Date("2026-01-01"),
							updatedAt: new Date("2026-01-02"),
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			createItemAttribute: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			deleteItemAttribute: {
				useMutation: () => ({
					isPending: false,
					mutate: mockDeleteMutate,
				}),
			},
		},
	},
}));

describe("ItemAttributePage", () => {
	it("renders the table with attribute rows and quick-create dialog", async () => {
		const user = userEvent.setup();
		renderWithProviders(<ItemAttributePage />);

		expect(screen.getByText("Add Item Attribute")).toBeInTheDocument();
		// Name appears in both ID and Attribute Name columns
		expect(screen.getAllByText("Colour")).toHaveLength(2);
		// Enabled badge for disabled=false
		expect(screen.getByText("Enabled")).toBeInTheDocument();

		await user.click(
			screen.getByRole("button", { name: "Add Item Attribute" }),
		);
		const nameInput = await screen.findByLabelText(/Attribute Name/i);
		await user.type(nameInput, "Size");

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith({
				name: "Size",
				disabled: false,
				numericValues: false,
				attributeValues: [],
			});
		});
	}, 15_000);
});
