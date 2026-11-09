import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import AssetCategoryPage from "./page";

const mockDeleteMutate = vi.fn();
const mockCancelQuery = vi.fn().mockResolvedValue(undefined);
const mockGetData = vi.fn().mockReturnValue({ items: [], totalCount: 0 });
const mockSetData = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockRefetch = vi.fn().mockResolvedValue(undefined);

const vehiclesCategory = {
	id: "clh001vehicles",
	name: "Vehicles",
	depreciationMethod: "STRAIGHT_LINE" as const,
	totalNumberOfDepreciations: 60,
	frequencyOfDepreciation: 12,
	nonDepreciableCategory: false,
	enableCwipAccounting: false,
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-02"),
};

const landCategory = {
	id: "clh002land",
	name: "Land",
	depreciationMethod: null,
	totalNumberOfDepreciations: null,
	frequencyOfDepreciation: null,
	nonDepreciableCategory: true,
	enableCwipAccounting: true,
	createdAt: new Date("2026-01-03"),
	updatedAt: new Date("2026-01-04"),
};

const canManageAssets = vi.hoisted(() => ({ value: true }));

vi.mock("@/hooks/use-can-manage-assets", () => ({
	useCanManageAssets: () => canManageAssets.value,
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				listAssetCategories: {
					cancel: mockCancelQuery,
					getData: mockGetData,
					setData: mockSetData,
					invalidate: mockInvalidate,
				},
			},
		}),
		asset: {
			listAssetCategories: {
				useQuery: () => ({
					data: {
						items: [vehiclesCategory, landCategory],
						totalCount: 2,
					},
					isLoading: false,
					error: null,
					refetch: mockRefetch,
				}),
			},
			deleteAssetCategory: {
				useMutation: ({
					onSuccess,
					onMutate,
					onError: _onError,
					onSettled,
				}: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockDeleteMutate(vars);
						if (typeof onMutate === "function") onMutate(vars);
						if (typeof onSuccess === "function")
							onSuccess(undefined, vars, undefined);
						if (typeof onSettled === "function")
							onSettled(undefined, null, vars, undefined);
					},
				}),
			},
			onAssetCategoriesChanged: {
				useSubscription: vi.fn(),
			},
		},
	},
}));

describe("AssetCategoryPage", () => {
	beforeEach(() => {
		canManageAssets.value = true;
		mockDeleteMutate.mockClear();
		mockInvalidate.mockClear();
		mockRefetch.mockClear();
	});

	it("renders the page heading and description", () => {
		renderWithProviders(<AssetCategoryPage />);

		expect(
			screen.getByRole("heading", { name: /Asset Categories/i }),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Manage asset categories and depreciation defaults/i),
		).toBeInTheDocument();
	});

	it("renders category names in the table", () => {
		renderWithProviders(<AssetCategoryPage />);

		expect(screen.getByText("Vehicles")).toBeInTheDocument();
		expect(screen.getByText("Land")).toBeInTheDocument();
	});

	it("shows the Add Category button", () => {
		renderWithProviders(<AssetCategoryPage />);

		expect(screen.getByText(/Add Category/i)).toBeInTheDocument();
	});

	it("shows 'Non-Depreciable' badge for non-depreciable categories", () => {
		renderWithProviders(<AssetCategoryPage />);
		expect(screen.getByText("Non-Depreciable")).toBeInTheDocument();
	});

	it("shows depreciation method for depreciable categories", () => {
		renderWithProviders(<AssetCategoryPage />);
		expect(screen.getByText("Straight Line")).toBeInTheDocument();
	});

	it("shows CWIP accounting status for each category", () => {
		renderWithProviders(<AssetCategoryPage />);
		expect(screen.getByText("Enabled")).toBeInTheDocument();
		expect(screen.getByText("Disabled")).toBeInTheDocument();
	});

	it("shows search filter control", () => {
		renderWithProviders(<AssetCategoryPage />);

		expect(
			screen.getByPlaceholderText(/Search categories/i),
		).toBeInTheDocument();
	});

	it("opens the delete confirmation dialog when Delete is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetCategoryPage />);

		const actionButtons = screen.getAllByRole("button", {
			name: /Open actions/i,
		});
		await user.click(actionButtons[0]);

		const deleteItem = screen.getByRole("menuitem", {
			name: /Delete Category/i,
		});
		await user.click(deleteItem);

		expect(
			screen.getByRole("heading", { name: /Are you sure\?/i }),
		).toBeInTheDocument();
	});

	it("calls delete mutation on confirmation", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetCategoryPage />);

		await user.click(
			screen.getByRole("button", {
				name: /Open actions for Vehicles/i,
			}),
		);
		await user.click(
			screen.getByRole("menuitem", { name: /Delete Category/i }),
		);
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledWith({
				id: vehiclesCategory.id,
			});
		});
	});
});

describe("AssetCategoryPage — read-only access", () => {
	beforeEach(() => {
		canManageAssets.value = false;
	});

	afterEach(() => {
		canManageAssets.value = true;
	});

	it("hides Add Category and row actions but keeps the list", () => {
		renderWithProviders(<AssetCategoryPage />);

		expect(screen.queryByText(/Add Category/i)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Open actions for/i }),
		).not.toBeInTheDocument();
	});
});
