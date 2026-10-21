import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import AssetListPage from "./page";

const mockPush = vi.fn();
const mockFetch = vi.fn();

const canManageAssets = vi.hoisted(() => ({ value: true }));

vi.mock("@/hooks/use-can-manage-assets", () => ({
	useCanManageAssets: () => canManageAssets.value,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
	}),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				getAssetByBarcode: {
					fetch: mockFetch,
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
			listAssets: {
				useQuery: () => ({
					data: { items: [], totalCount: 0 },
					isLoading: false,
				}),
			},
			listAssetCategories: {
				useQuery: () => ({
					data: { items: [] },
					isLoading: false,
				}),
			},
			listLocations: {
				useQuery: () => ({
					data: { items: [] },
					isLoading: false,
				}),
			},
			createAsset: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
			onAssetsChanged: {
				useSubscription: vi.fn(),
			},
			deleteAsset: {
				useMutation: () => ({
					mutateAsync: vi.fn().mockResolvedValue(undefined),
				}),
			},
			deleteManyAssets: {
				useMutation: () => ({
					mutateAsync: vi.fn().mockResolvedValue(undefined),
				}),
			},
		},
	},
}));

describe("AssetListPage", () => {
	beforeEach(() => {
		canManageAssets.value = true;
		mockPush.mockClear();
		mockFetch.mockClear();
	});

	it("renders Scan Barcode button inside actions toolbar", () => {
		renderWithProviders(<AssetListPage />);
		expect(
			screen.getByRole("button", { name: /Scan Barcode/i }),
		).toBeInTheDocument();
	});
});

describe("AssetListPage — read-only access", () => {
	beforeEach(() => {
		canManageAssets.value = false;
	});

	afterEach(() => {
		canManageAssets.value = true;
	});

	it("hides the Add Asset button and row selection", () => {
		renderWithProviders(<AssetListPage />);

		expect(
			screen.getByRole("button", { name: /Scan Barcode/i }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Add Asset/i }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("checkbox", { name: /Select all rows/i }),
		).not.toBeInTheDocument();
	});
});
