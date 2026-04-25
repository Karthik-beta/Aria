import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import AssetDepreciationLedgerPage from "./page";

const { mockUseQuery, mockRefetch } = vi.hoisted(() => ({
	mockUseQuery: vi.fn(),
	mockRefetch: vi.fn().mockResolvedValue(undefined),
}));

const ledgerResponse = {
	rows: [
		{
			assetId: "asset-001",
			assetSeries: "AST-2026-00001",
			assetName: "Hydraulic Pump A",
			assetCategoryId: "cat-001",
			assetCategoryName: "Machinery",
			company: "ACME Corp",
			purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
			purchaseAmount: 100000,
			depreciationDate: new Date("2026-04-30T00:00:00.000Z"),
			openingAccumulatedDepreciation: 35000,
			depreciationAmount: 15000,
			accumulatedDepreciationAmount: 50000,
			valueAfterDepreciation: 80000,
			adjustmentId: "adj-002",
			adjustmentSeries: "AVA-2026-00002",
			adjustmentDate: new Date("2026-03-15T00:00:00.000Z"),
			revaluationEntrySeries: "JE-AVA-2026-00002",
			scheduleId: "sched-002",
			scheduleRevisionNumber: 2,
			costCenter: "Main Plant",
			depreciationMethod: "STRAIGHT_LINE" as const,
			assetStatus: "PARTIALLY_DEPRECIATED" as const,
		},
	],
	summary: {
		matchedAssetCount: 2,
		assetsWithLedgerCount: 1,
		assetsWithoutLedgerCount: 1,
		rowCount: 1,
		totalDepreciationAmount: 15000,
		closingValueTotal: 80000,
	},
};

vi.mock("@/lib/trpc", () => ({
	trpc: {
		asset: {
			listAssetDepreciationLedger: {
				useQuery: mockUseQuery,
			},
		},
	},
}));

describe("AssetDepreciationLedgerPage", () => {
	beforeEach(() => {
		mockRefetch.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation(() => ({
			data: ledgerResponse,
			isLoading: false,
			error: null,
			refetch: mockRefetch,
		}));
	});

	it("renders the report heading, summary, and ledger row", () => {
		renderWithProviders(<AssetDepreciationLedgerPage />);

		expect(
			screen.getByRole("heading", { name: /Asset Depreciation Ledger/i }),
		).toBeInTheDocument();
		expect(screen.getByText("Hydraulic Pump A")).toBeInTheDocument();
		expect(
			screen.getAllByText((_, node) =>
				(node?.textContent ?? "").includes("AVA-2026-00002"),
			).length,
		).toBeGreaterThan(0);
		expect(
			screen.getByText(/do not have schedule-backed ledger rows/i),
		).toBeInTheDocument();
	});

	it("passes filter changes into the ledger query", async () => {
		renderWithProviders(<AssetDepreciationLedgerPage />);

		fireEvent.change(screen.getByLabelText("Filter by cost center"), {
			target: { value: "Main Plant" },
		});

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({
					costCenter: "Main Plant",
				}),
				expect.any(Object),
			);
		});
	});

	it("resets the filter inputs", async () => {
		renderWithProviders(<AssetDepreciationLedgerPage />);

		const assetInput = screen.getByLabelText("Filter by asset");
		fireEvent.change(assetInput, {
			target: { value: "AST-2026-00001" },
		});

		expect(assetInput).toHaveValue("AST-2026-00001");

		fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

		await waitFor(() => {
			expect(screen.getByLabelText("Filter by asset")).toHaveValue("");
		});
	});
});
