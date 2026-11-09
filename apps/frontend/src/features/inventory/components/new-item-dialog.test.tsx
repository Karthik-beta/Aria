import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import { NewItemDialog } from "./new-item-dialog";

const mockCreateMutate = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);

vi.mock("@aria/types", () => ({
	Inventory: {
		createSchema: {
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
				listItems: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listItemGroups: {
				useQuery: () => ({
					data: [
						{
							id: "c111111111111111111111111",
							groupName: "Furniture",
						},
					],
				}),
			},
			listUnitsOfMeasure: {
				useQuery: () => ({
					data: [
						{
							id: "c222222222222222222222222",
							name: "Nos",
						},
					],
				}),
			},
			createItem: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
		},
	},
}));

describe("NewItemDialog", () => {
	beforeEach(() => {
		mockCreateMutate.mockClear();
		mockInvalidate.mockClear();
	});

	it("builds the full form handoff and submits the quick create payload", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		renderWithProviders(<NewItemDialog />);

		await user.click(screen.getByRole("button", { name: "Add Item" }));

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "New Item" }),
			).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Nos" })).toBeInTheDocument();
		});

		const itemCodeInput = screen.getByLabelText(/Item Code/i);
		await user.click(itemCodeInput);
		await user.paste("abc-123");
		await user.click(screen.getByRole("button", { name: "Item Group" }));
		await user.click(await screen.findByText("Furniture"));
		await user.click(screen.getByRole("button", { name: "Nos" }));

		const commandList = document.querySelector('[data-slot="command-list"]');
		expect(commandList).toHaveClass("max-h-full", "min-h-0");

		await user.click(screen.getByRole("button", { name: "Nos" }));
		await user.click(screen.getByLabelText(/Maintain Stock/i));
		await user.click(screen.getByLabelText(/Is Fixed Asset/i));

		expect(screen.getByText("Edit Full Form")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith({
				name: "ABC-123",
				code: "ABC-123",
				itemGroupId: "c111111111111111111111111",
				defaultUnitOfMeasureId: "c222222222222222222222222",
				maintainStock: false,
				isFixedAsset: true,
			});
		});
	});
});
