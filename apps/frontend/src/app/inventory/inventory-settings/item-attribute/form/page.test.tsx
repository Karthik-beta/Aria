import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import ItemAttributeFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;
let currentSearchParams = new URLSearchParams();

const mockAttributes = [
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
];

const getMockAttributeById = (id: string | null) =>
	mockAttributes.find((a) => a.id === id) ?? null;

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
		createItemAttributeSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
		updateItemAttributeSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listItemAttributes: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getItemAttributeById: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getItemAttributeById: {
				useQuery: () => ({
					data: getMockAttributeById(currentId),
					isLoading: false,
				}),
			},
			createItemAttribute: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateItemAttribute: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("ItemAttributeFormPage", () => {
	beforeEach(() => {
		currentId = null;
		currentSearchParams = new URLSearchParams();
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("submits the create payload", async () => {
		currentSearchParams = new URLSearchParams({ name: "Size" });
		const user = userEvent.setup();
		renderWithProviders(<ItemAttributeFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Size")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ name: "Size" }),
			);
		});
	});

	it("prefills edit form and submits the update payload", async () => {
		currentId = "clh123ia0001";
		const user = userEvent.setup();
		renderWithProviders(<ItemAttributeFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Colour")).toBeInTheDocument();
		});

		// Existing attribute value row should be rendered
		expect(screen.getByDisplayValue("Red")).toBeInTheDocument();
		expect(screen.getByDisplayValue("R")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "clh123ia0001",
					name: "Colour",
					attributeValues: expect.arrayContaining([
						expect.objectContaining({
							id: "clh123iav001",
							attributeValue: "Red",
							abbreviation: "R",
						}),
					]),
				}),
			);
		});
	});

	it("adds a new attribute value row when Add Row is clicked", async () => {
		currentId = null;
		const user = userEvent.setup();
		renderWithProviders(<ItemAttributeFormPage />);

		expect(
			screen.getByText(/No attribute values added yet/i),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Add Row/i }));

		await waitFor(() => {
			expect(
				screen.queryByText(/No attribute values added yet/i),
			).not.toBeInTheDocument();
		});
	});

	it("redirects to the list page when the edit record is missing", async () => {
		currentId = "missing-id";
		renderWithProviders(<ItemAttributeFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/inventory-settings/item-attribute",
			);
		});
	});
});
