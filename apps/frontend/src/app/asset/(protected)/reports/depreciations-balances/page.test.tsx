import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import AssetDepreciationsAndBalancesPage from "./page";

let mockUseQuery: ReturnType<typeof vi.fn> & ((...args: unknown[]) => unknown);
let mockRefetch: ReturnType<typeof vi.fn>;
let mockUseMutation: ReturnType<typeof vi.fn>;

const balancesResponse = {
	rows: [
		{
			groupingKey: "ACME Corp::cat-001",
			groupingLabel: "Machinery",
			company: "ACME Corp",
			assetCount: 2,
			assetId: null,
			assetSeries: null,
			assetName: null,
			assetCategoryId: "cat-001",
			assetCategoryName: "Machinery",
			valueAsOnFromDate: 170000,
			valueOfNewPurchase: 0,
			valueOfSoldAsset: 60000,
			valueOfScrappedAsset: 0,
			valueOfCapitalizedAsset: 0,
			valueAdjustmentDuringPeriod: -5000,
			valueAsOnToDate: 105000,
			accumulatedDepreciationAsOnFromDate: 30000,
			depreciationAmountDuringPeriod: 30000,
			depreciationEliminatedDuringPeriod: 10000,
			accumulatedDepreciationAsOnToDate: 50000,
			depreciationEliminatedViaReversal: 0,
			netAssetValueAsOnFromDate: 140000,
			netAssetValueAsOnToDate: 55000,
		},
	],
	summary: {
		matchedAssetCount: 2,
		rowCount: 1,
		totalValueAsOnFromDate: 170000,
		totalValueAsOnToDate: 105000,
		totalNetAssetValueAsOnFromDate: 140000,
		totalNetAssetValueAsOnToDate: 55000,
		totalDepreciationAmountDuringPeriod: 30000,
		totalValueAdjustmentDuringPeriod: -5000,
	},
};

vi.mock("@/lib/trpc", () => ({
	trpc: {
		asset: {
			listAssetDepreciationsAndBalances: {
				useQuery: (...args: unknown[]) => mockUseQuery(...args),
			},
			exportAssetDepreciationsAndBalancesExcel: {
				useMutation: () => ({ mutateAsync: mockUseMutation }),
			},
		},
	},
}));

describe("AssetDepreciationsAndBalancesPage", () => {
	beforeEach(() => {
		mockUseQuery = vi.fn() as typeof mockUseQuery;
		mockRefetch = vi.fn().mockResolvedValue(undefined);
		mockUseMutation = vi.fn();
		mockRefetch.mockClear();
		mockUseQuery.mockReset();
		mockUseMutation.mockReset();
		mockUseQuery.mockImplementation(() => ({
			data: balancesResponse,
			isLoading: false,
			error: null,
			refetch: mockRefetch,
		}));
	});

	it("renders the report heading, summary cards, and grouped row", () => {
		renderWithProviders(<AssetDepreciationsAndBalancesPage />);

		expect(
			screen.getByRole("heading", {
				name: /Asset Depreciations and Balances/i,
			}),
		).toBeInTheDocument();
		expect(screen.getByText("Machinery")).toBeInTheDocument();
		expect(screen.getByText("Matched Assets")).toBeInTheDocument();
		expect(screen.getByText("Closing Net Asset Value")).toBeInTheDocument();
	});

	it("passes filter changes into the balances query", async () => {
		renderWithProviders(<AssetDepreciationsAndBalancesPage />);

		fireEvent.change(screen.getByLabelText("Filter by asset category"), {
			target: { value: "Machinery" },
		});
		fireEvent.change(screen.getByLabelText("Filter by company"), {
			target: { value: "ACME Corp" },
		});

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({
					company: "ACME Corp",
					assetCategory: "Machinery",
				}),
				expect.any(Object),
			);
		});
	});

	it("resets the filter inputs", async () => {
		renderWithProviders(<AssetDepreciationsAndBalancesPage />);

		const companyInput = screen.getByLabelText("Filter by company");
		fireEvent.change(companyInput, {
			target: { value: "ACME Corp" },
		});

		expect(companyInput).toHaveValue("ACME Corp");

		fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

		await waitFor(() => {
			expect(screen.getByLabelText("Filter by company")).toHaveValue("");
		});
	});
});
