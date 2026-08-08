import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import AssetCategoryFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const existingCategory = {
	id: "clh123category",
	name: "Vehicles",
	depreciationMethod: "STRAIGHT_LINE" as const,
	totalNumberOfDepreciations: 60,
	frequencyOfDepreciation: 12,
	nonDepreciableCategory: false,
	enableCwipAccounting: false,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

const nonDepreciableCategory = {
	id: "clh456land",
	name: "Land",
	depreciationMethod: null,
	totalNumberOfDepreciations: null,
	frequencyOfDepreciation: null,
	nonDepreciableCategory: true,
	enableCwipAccounting: true,
	createdAt: new Date("2026-02-01"),
	updatedAt: new Date("2026-02-01"),
};

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
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

vi.mock("@aria/types", () => ({
	Asset: {
		createAssetCategorySchema: {
			safeParse: (input: unknown) => ({
				success: true as const,
				data: input,
			}),
		},
		updateAssetCategorySchema: {
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
			asset: {
				listAssetCategories: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getAssetCategoryById: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		company: {
			listCompanies: {
				useQuery: () => ({
					data: { items: [] },
					isLoading: false,
				}),
			},
		},
		asset: {
			listFinanceBooks: {
				useQuery: () => ({
					data: { items: [] },
					isLoading: false,
				}),
			},
			getAssetCategoryById: {
				useQuery: () => ({
					data:
						currentId === existingCategory.id
							? existingCategory
							: currentId === nonDepreciableCategory.id
								? nonDepreciableCategory
								: currentId
									? null
									: undefined,
					isLoading: false,
				}),
			},
			createAssetCategory: {
				useMutation: ({
					onSuccess,
					onError: _onError,
				}: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockCreateMutate(vars);
						if (typeof onSuccess === "function")
							onSuccess({ id: "clh999new" }, vars, undefined);
					},
				}),
			},
			updateAssetCategory: {
				useMutation: ({
					onSuccess,
					onError: _onError,
				}: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockUpdateMutate(vars);
						if (typeof onSuccess === "function")
							onSuccess({ id: currentId }, vars, undefined);
					},
				}),
			},
		},
	},
}));

describe("AssetCategoryFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form with empty fields and correct page title", () => {
		renderWithProviders(<AssetCategoryFormPage />);

		expect(
			screen.getByRole("heading", { name: /New Asset Category/i }),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/Category Name/i)).toHaveValue("");
	});

	it("renders depreciation settings section by default", () => {
		renderWithProviders(<AssetCategoryFormPage />);

		expect(screen.getByText(/Depreciation Settings/i)).toBeInTheDocument();
	});

	it("renders Back to List and Save buttons", () => {
		renderWithProviders(<AssetCategoryFormPage />);

		expect(
			screen.getByRole("button", { name: /Back to List/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
	});

	it("submits the create payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetCategoryFormPage />);

		await user.type(
			screen.getByLabelText(/Category Name/i),
			"Office Equipment",
		);
		await user.click(screen.getByRole("button", { name: /Save/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Office Equipment",
				}),
			);
		});
	});

	it("shows Not Saved badge after editing a field", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetCategoryFormPage />);

		await user.type(screen.getByLabelText(/Category Name/i), "Draft Category");

		expect(screen.getByText("Not Saved")).toBeInTheDocument();
	});

	it("prefills fields in edit mode for a depreciable category", async () => {
		currentId = existingCategory.id;
		renderWithProviders(<AssetCategoryFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Vehicles")).toBeInTheDocument();
		});
	});

	it("shows Non-Depreciable category fields in edit mode", async () => {
		currentId = nonDepreciableCategory.id;
		renderWithProviders(<AssetCategoryFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Land")).toBeInTheDocument();
		});

		// Depreciation settings section should be hidden
		expect(
			screen.queryByText(/Depreciation Settings/i),
		).not.toBeInTheDocument();
	});

	it("submits the update payload in edit mode", async () => {
		currentId = existingCategory.id;
		const user = userEvent.setup();
		renderWithProviders(<AssetCategoryFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Vehicles")).toBeInTheDocument();
		});

		await user.clear(screen.getByLabelText(/Category Name/i));
		await user.type(screen.getByLabelText(/Category Name/i), "Fleet Vehicles");
		await user.click(screen.getByRole("button", { name: /Save/i }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: existingCategory.id,
					name: "Fleet Vehicles",
				}),
			);
		});
	});

	it("redirects to list when a missing category is edited", async () => {
		currentId = "missing-id";
		renderWithProviders(<AssetCategoryFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/asset/categories");
		});
	});

	it("navigates back to list on Back to List click", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetCategoryFormPage />);

		await user.click(screen.getByRole("button", { name: /Back to List/i }));

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/asset/categories");
		});
	});

	it("hides depreciation settings when Non Depreciable is checked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetCategoryFormPage />);

		// Initially depreciation settings are visible
		expect(screen.getByText(/Depreciation Settings/i)).toBeInTheDocument();

		const nonDepreciableCheckbox = screen.getByRole("checkbox", {
			name: /Non Depreciable Category/i,
		});
		await user.click(nonDepreciableCheckbox);

		expect(
			screen.queryByText(/Depreciation Settings/i),
		).not.toBeInTheDocument();
	});

	it("renders Non Depreciable Category and Enable CWIP Accounting checkboxes", () => {
		renderWithProviders(<AssetCategoryFormPage />);

		expect(
			screen.getByRole("checkbox", {
				name: /Non Depreciable Category/i,
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("checkbox", {
				name: /Enable Capital Work in Progress Accounting/i,
			}),
		).toBeInTheDocument();
	});
});
