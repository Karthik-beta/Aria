import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import AssetListPage from "./page";

vi.mock("@/hooks/use-asset-write-access", () => ({
	useAssetWriteAccess: () => true,
}));

const mockPush = vi.fn();
const mockFetch = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockListCancel = vi.fn().mockResolvedValue(undefined);
const mockListGetData = vi.fn();
const mockListSetData = vi.fn();
const mockListRefetch = vi.fn().mockResolvedValue(undefined);
const testAsset = {
	id: "asset-001",
	series: "AST-001",
	assetName: "Hydraulic Pump A",
	status: "SUBMITTED" as const,
	assetCategoryName: "Machinery",
	locationName: "Warehouse",
	custodian: "Alex",
	company: "ACME Corp",
	createdAt: new Date("2026-01-01"),
};

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
				invalidate: mockInvalidate,
				getAssetByBarcode: {
					fetch: mockFetch,
				},
				listAssets: {
					cancel: mockListCancel,
					getData: mockListGetData,
					setData: mockListSetData,
					refetch: mockListRefetch,
					invalidate: mockInvalidate,
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
					data: { items: [testAsset], totalCount: 1 },
					isLoading: false,
					isFetching: false,
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
				useMutation: ({ onMutate, onSuccess }: Record<string, unknown>) => ({
					isPending: false,
					mutate: async (vars: unknown) => {
						if (typeof onMutate === "function") await onMutate(vars);
						if (typeof onSuccess === "function")
							await onSuccess(undefined, vars, undefined);
					},
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
		mockPush.mockClear();
		mockFetch.mockClear();
		mockInvalidate.mockClear();
		mockInvalidate.mockResolvedValue(undefined);
		mockListCancel.mockClear();
		mockListGetData.mockReturnValue({ items: [testAsset], totalCount: 1 });
		mockListSetData.mockClear();
		mockListRefetch.mockClear();
	});

	it("renders Scan Barcode button inside actions toolbar", () => {
		renderWithProviders(<AssetListPage />);
		expect(
			screen.getByRole("button", { name: /Scan Barcode/i }),
		).toBeInTheDocument();
	});

	it("keeps the delete confirmation open until invalidation completes", async () => {
		const user = userEvent.setup();
		let releaseInvalidation: (() => void) | undefined;
		mockInvalidate.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					releaseInvalidation = resolve;
				}),
		);
		renderWithProviders(<AssetListPage />);

		await user.click(await screen.findByRole("button", { name: "Open menu" }));
		await user.click(screen.getByRole("menuitem", { name: /Delete Asset/i }));
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockInvalidate).toHaveBeenCalled();
			expect(
				screen.getByRole("heading", { name: /Are you sure\?/i }),
			).toBeInTheDocument();
		});

		releaseInvalidation?.();
		await waitFor(() => {
			expect(
				screen.queryByRole("heading", { name: /Are you sure\?/i }),
			).not.toBeInTheDocument();
		});
	});
});
