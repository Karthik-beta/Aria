import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import UnitOfMeasurePage from "./page";

const mockCreateMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);

vi.mock("@aria/types", () => ({
	Inventory: {
		createUnitOfMeasureSchema: {
			safeParse: (input: unknown) => {
				const value = input as { name?: string };
				return {
					success: true as const,
					data: {
						name: value.name ?? "",
						disabled: false,
						isWholeNumber: true,
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
				listUnitsOfMeasure: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listUnitsOfMeasure: {
				useQuery: () => ({
					data: [
						{
							id: "clh123uom",
							name: "Nos",
							disabled: false,
							isWholeNumber: true,
							createdAt: new Date("2026-01-01"),
							updatedAt: new Date("2026-01-02"),
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			createUnitOfMeasure: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			deleteUnitOfMeasure: {
				useMutation: () => ({
					isPending: false,
					mutate: mockDeleteMutate,
				}),
			},
		},
	},
}));

describe("UnitOfMeasurePage", () => {
	it("renders the table and quick-create dialog", async () => {
		const user = userEvent.setup();
		renderWithProviders(<UnitOfMeasurePage />);

		expect(screen.getByText("Add UOM")).toBeInTheDocument();
		expect(screen.getAllByText("Nos")).toHaveLength(2);
		expect(screen.getByText("Enabled")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Add UOM" }));
		const nameInput = await screen.findByLabelText(/UOM Name/i);
		await user.type(nameInput, "Box");

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith({
				name: "Box",
				disabled: false,
				isWholeNumber: true,
			});
		});
	}, 15_000);
});
