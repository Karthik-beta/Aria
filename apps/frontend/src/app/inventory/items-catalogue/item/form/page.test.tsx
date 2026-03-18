import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "../../../../../../test/utils";
import ItemFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockPush = vi.fn();

let currentSearchParams = new URLSearchParams();

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => async (values: unknown) => ({
		values,
		errors: {},
	}),
}));

vi.mock("@aria/types", () => ({
	Inventory: {
		createSchema: {},
	},
}));

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
		get: (key: string) => currentSearchParams.get(key),
	}),
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
			listItems: {
				useQuery: () => ({
					data: [],
					isLoading: false,
				}),
			},
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
			updateItem: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("ItemFormPage", () => {
	beforeEach(() => {
		currentSearchParams = new URLSearchParams({
			code: "ABC-123",
			name: "ABC-123",
			itemGroupId: "c111111111111111111111111",
			defaultUnitOfMeasureId: "c222222222222222222222222",
			maintainStock: "false",
			isFixedAsset: "true",
		});
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockInvalidate.mockClear();
		mockPush.mockClear();
	});

	it("prefills the full form from quick-create handoff query params", async () => {
		renderWithProviders(<ItemFormPage />);

		await waitFor(() => {
			expect(screen.getAllByDisplayValue("ABC-123")).toHaveLength(2);
		});

		expect(screen.getByLabelText("Maintain Stock")).not.toBeChecked();
		expect(screen.getByLabelText("Is Fixed Asset")).toBeChecked();
		expect(screen.getByRole("button", { name: "Furniture" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Nos" })).toBeInTheDocument();
	});
});
