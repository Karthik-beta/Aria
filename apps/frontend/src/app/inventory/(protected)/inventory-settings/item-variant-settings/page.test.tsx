import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import ItemVariantSettingsPage from "./page";

const mockMutate = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);

const mockSettings = {
	id: "clh123variantsettings",
	doNotUpdateVariantsOnSave: false,
	allowRenameAttributeValue: true,
	copyFields: [
		{
			id: "clh123field1",
			fieldKey: "description",
			label: "Details",
			category: "Basics",
			itemProperty: "description",
			position: 0,
		},
	],
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				getItemVariantSettings: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			getItemVariantSettings: {
				useQuery: () => ({
					data: mockSettings,
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			updateItemVariantSettings: {
				useMutation: () => ({
					isPending: false,
					mutate: mockMutate,
				}),
			},
		},
	},
}));

describe("ItemVariantSettingsPage", () => {
	beforeEach(() => {
		mockMutate.mockClear();
		mockInvalidate.mockClear();
	});

	it("renders the singleton settings editor", () => {
		renderWithProviders(<ItemVariantSettingsPage />);

		expect(screen.getByText("Item Variant Settings")).toBeInTheDocument();
		expect(
			screen.getByLabelText(/Allow Rename Attribute Value/i),
		).toBeChecked();
		expect(screen.getByDisplayValue("description")).toBeInTheDocument();
	});

	it("submits the updated boolean flags and copy field rows", async () => {
		const user = userEvent.setup();
		renderWithProviders(<ItemVariantSettingsPage />);

		await user.click(screen.getByLabelText(/Do not update variants on save/i));
		await user.click(screen.getByRole("button", { name: /Add Row/i }));

		const fieldSelects = screen.getAllByLabelText(/Field Name/i);
		await user.selectOptions(fieldSelects[1], "stock_uom");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockMutate).toHaveBeenCalledWith({
				doNotUpdateVariantsOnSave: true,
				allowRenameAttributeValue: true,
				copyFields: [
					{ id: "clh123field1", fieldKey: "description" },
					{ fieldKey: "stock_uom" },
				],
			});
		});
	});
});
