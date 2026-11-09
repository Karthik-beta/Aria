import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import ItemGroupFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockPush = vi.fn();

let currentSearchParams = new URLSearchParams();

const mockItemGroups = [
	{
		id: "c111111111111111111111111",
		groupName: "Electronics",
		parentGroupName: "All Item Groups",
		parentId: null,
		isGroup: true,
		defaults: [],
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
	},
	{
		id: "c222222222222222222222222",
		groupName: "Furniture",
		parentGroupName: "All Item Groups",
		parentId: null,
		isGroup: true,
		defaults: [],
		createdAt: new Date("2026-01-03"),
		updatedAt: new Date("2026-01-04"),
	},
	{
		id: "c333333333333333333333333",
		groupName: "Kitchen Fixtures",
		parentGroupName: "Furniture",
		parentId: "c222222222222222222222222",
		isGroup: false,
		defaults: [],
		createdAt: new Date("2026-01-05"),
		updatedAt: new Date("2026-01-06"),
	},
];

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

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => async (values: unknown) => ({
		values,
		errors: {},
	}),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listItemGroups: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			listItemGroups: {
				useQuery: () => ({
					data: mockItemGroups,
					isLoading: false,
				}),
			},
			createItemGroup: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateItemGroup: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("ItemGroupFormPage", () => {
	beforeEach(() => {
		currentSearchParams = new URLSearchParams();
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockInvalidate.mockClear();
		mockPush.mockClear();
	});

	it("prefills the parent item group from the query string", async () => {
		currentSearchParams = new URLSearchParams({
			parentId: "c111111111111111111111111",
		});

		renderWithProviders(<ItemGroupFormPage />);

		await waitFor(() => {
			expect(screen.getByText("Electronics")).toBeInTheDocument();
		});
	});

	it("ignores an invalid parent item group query value", async () => {
		currentSearchParams = new URLSearchParams({
			parentId: "not-a-cuid",
		});

		renderWithProviders(<ItemGroupFormPage />);

		await waitFor(() => {
			expect(screen.getByText("Top-level group")).toBeInTheDocument();
		});
	});

	it("submits the selected parent item group from the dropdown", async () => {
		const user = userEvent.setup();
		renderWithProviders(<ItemGroupFormPage />);

		await user.type(screen.getAllByRole("textbox")[0], "Office Supplies");
		await user.click(screen.getByText("Top-level group"));
		await user.click(screen.getByText("Electronics"));

		await waitFor(() => {
			expect(screen.getByText("Electronics")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					groupName: "Office Supplies",
					parentId: "c111111111111111111111111",
					isGroup: false,
					defaults: [],
				}),
			);
		});
	});

	it("prefills edit mode from the existing item group data", async () => {
		currentSearchParams = new URLSearchParams({
			id: "c333333333333333333333333",
			parentId: "c111111111111111111111111",
		});

		renderWithProviders(<ItemGroupFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Kitchen Fixtures")).toBeInTheDocument();
		});

		expect(screen.getByRole("combobox")).toHaveTextContent("Furniture");
	});

	it("ignores query parentId in edit mode and submits the updated parent item group", async () => {
		currentSearchParams = new URLSearchParams({
			id: "c333333333333333333333333",
			parentId: "c111111111111111111111111",
		});

		const user = userEvent.setup();
		renderWithProviders(<ItemGroupFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Kitchen Fixtures")).toBeInTheDocument();
		});

		const parentGroupTrigger = screen.getByRole("combobox");
		expect(parentGroupTrigger).toHaveTextContent("Furniture");

		await user.click(parentGroupTrigger);
		await user.click(screen.getByText("Electronics"));

		await waitFor(() => {
			expect(parentGroupTrigger).toHaveTextContent("Electronics");
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "c333333333333333333333333",
					groupName: "Kitchen Fixtures",
					parentId: "c111111111111111111111111",
					isGroup: false,
					defaults: [],
				}),
			);
		});
	});
});
