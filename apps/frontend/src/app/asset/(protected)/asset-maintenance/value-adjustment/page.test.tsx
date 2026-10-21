import "@testing-library/jest-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import AssetValueAdjustmentPage from "./page";

const mockDeleteMutate = vi.fn();
const mockSubmitMutate = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);
const mockRefetch = vi.fn().mockResolvedValue(undefined);

const draftAdjustment = {
	id: "adj-001",
	series: "AVA-2026-00001",
	assetId: "asset-001",
	assetSeries: "AST-2026-00001",
	assetName: "Hydraulic Pump A",
	assetCategoryName: "Machinery",
	company: "ACME Corp",
	adjustmentDate: new Date("2026-04-15"),
	currentAssetValue: 80000,
	newAssetValue: 90000,
	differenceAmount: 10000,
	differenceAccount: "Asset Revaluation Reserve",
	fixedAssetAccount: "Machinery Fixed Asset",
	costCenter: "Main Plant",
	notes: "Annual valuation uplift",
	status: "DRAFT" as const,
	direction: "INCREASE" as const,
	previousAssetStatus: "SUBMITTED" as const,
	previousIsFullyDepreciated: false,
	submittedAt: null,
	cancelledAt: null,
	revaluationEntry: null,
	depreciationSchedule: null,
	createdAt: new Date("2026-04-15T10:00:00Z"),
	updatedAt: new Date("2026-04-15T10:00:00Z"),
};

const submittedAdjustment = {
	...draftAdjustment,
	id: "adj-002",
	series: "AVA-2026-00002",
	assetId: "asset-002",
	assetSeries: "AST-2026-00002",
	assetName: "Air Compressor B",
	company: "Beta Corp",
	status: "SUBMITTED" as const,
	direction: "DECREASE" as const,
	differenceAmount: -5000,
	newAssetValue: 75000,
	revaluationEntry: {
		id: "entry-001",
		series: "JE-AVA-2026-00001",
		adjustmentId: "adj-002",
		assetId: "asset-002",
		company: "Beta Corp",
		postingDate: new Date("2026-04-16"),
		remarks: "Revaluation entry",
		status: "POSTED" as const,
		reversedAt: null,
		lines: [],
		createdAt: new Date("2026-04-16T10:00:00Z"),
		updatedAt: new Date("2026-04-16T10:00:00Z"),
	},
};

const canManageAssets = vi.hoisted(() => ({ value: true }));

vi.mock("@/hooks/use-can-manage-assets", () => ({
	useCanManageAssets: () => canManageAssets.value,
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				listAssetValueAdjustments: {
					invalidate: mockInvalidate,
				},
				listAssets: {
					invalidate: mockInvalidate,
				},
			},
		}),
		asset: {
			listAssetValueAdjustments: {
				useQuery: () => ({
					data: {
						items: [draftAdjustment, submittedAdjustment],
						totalCount: 2,
					},
					isLoading: false,
					error: null,
					refetch: mockRefetch,
				}),
			},
			deleteAssetValueAdjustment: {
				useMutation: () => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockDeleteMutate(vars);
					},
				}),
			},
			submitAssetValueAdjustment: {
				useMutation: () => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockSubmitMutate(vars);
					},
				}),
			},
			cancelAssetValueAdjustment: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
			onAssetValueAdjustmentsChanged: {
				useSubscription: vi.fn(),
			},
		},
	},
}));

describe("AssetValueAdjustmentPage", () => {
	beforeEach(() => {
		canManageAssets.value = true;
		mockDeleteMutate.mockClear();
		mockSubmitMutate.mockClear();
		mockInvalidate.mockClear();
		mockRefetch.mockClear();
	});

	it("renders the page heading and listed adjustments", () => {
		renderWithProviders(<AssetValueAdjustmentPage />);

		expect(
			screen.getByRole("heading", { name: /Asset Value Adjustment/i }),
		).toBeInTheDocument();
		expect(screen.getByText("AVA-2026-00001")).toBeInTheDocument();
		expect(screen.getByText("AVA-2026-00002")).toBeInTheDocument();
		expect(screen.getByText("Hydraulic Pump A")).toBeInTheDocument();
	});

	it("submits a draft adjustment from the action menu", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetValueAdjustmentPage />);

		await user.click(
			screen.getByRole("button", {
				name: /Open actions for AVA-2026-00001/i,
			}),
		);
		await user.click(
			screen.getByRole("menuitem", { name: /Submit Adjustment/i }),
		);

		await waitFor(() => {
			expect(mockSubmitMutate).toHaveBeenCalledWith({ id: "adj-001" });
		});
	});

	it("opens the confirmation dialog and deletes a draft adjustment", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetValueAdjustmentPage />);

		await user.click(
			screen.getByRole("button", {
				name: /Open actions for AVA-2026-00001/i,
			}),
		);
		await user.click(screen.getByRole("menuitem", { name: /Delete Draft/i }));

		expect(
			screen.getByRole("heading", { name: /Are you sure\?/i }),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledWith({ id: "adj-001" });
		});
	});
});

describe("AssetValueAdjustmentPage — read-only access", () => {
	beforeEach(() => {
		canManageAssets.value = false;
	});

	afterEach(() => {
		canManageAssets.value = true;
	});

	it("hides New Adjustment and row actions but keeps the list", () => {
		renderWithProviders(<AssetValueAdjustmentPage />);

		expect(screen.getByText("AVA-2026-00001")).toBeInTheDocument();
		expect(screen.queryByText(/New Adjustment/i)).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /Open actions for/i }),
		).not.toBeInTheDocument();
	});
});
