import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import AssetValueAdjustmentPage from "./page";

const mockToast = vi.hoisted(() => ({
	error: vi.fn(),
	success: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: mockToast }));

vi.mock("@/hooks/use-asset-write-access", () => ({
	useAssetWriteAccess: () => true,
}));

const mockDeleteMutate = vi.fn();
const mockSubmitMutate = vi.fn();
const mockCancelMutate = vi.fn();
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

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				invalidate: mockInvalidate,
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
				useMutation: ({ onSuccess }: Record<string, unknown>) => ({
					isPending: false,
					mutate: async (vars: unknown) => {
						mockSubmitMutate(vars);
						if (typeof onSuccess === "function")
							await onSuccess(undefined, vars, undefined);
					},
				}),
			},
			cancelAssetValueAdjustment: {
				useMutation: ({ onSuccess }: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockCancelMutate(vars);
						if (typeof onSuccess === "function")
							onSuccess(undefined, vars, undefined);
					},
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
		mockDeleteMutate.mockClear();
		mockSubmitMutate.mockClear();
		mockCancelMutate.mockClear();
		mockInvalidate.mockClear();
		mockInvalidate.mockResolvedValue(undefined);
		mockRefetch.mockClear();
		mockToast.error.mockClear();
		mockToast.success.mockClear();
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

	it("keeps the cancel confirmation open until invalidation completes", async () => {
		const user = userEvent.setup();
		let releaseInvalidation: (() => void) | undefined;
		mockInvalidate.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					releaseInvalidation = resolve;
				}),
		);
		renderWithProviders(<AssetValueAdjustmentPage />);

		await user.click(
			screen.getByRole("button", {
				name: /Open actions for AVA-2026-00002/i,
			}),
		);
		await user.click(
			screen.getByRole("menuitem", { name: /Cancel Adjustment/i }),
		);
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockCancelMutate).toHaveBeenCalledWith({ id: "adj-002" });
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

	it("waits to announce a submitted adjustment until invalidation completes", async () => {
		const user = userEvent.setup();
		let releaseInvalidation: (() => void) | undefined;
		mockInvalidate.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					releaseInvalidation = resolve;
				}),
		);
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
		expect(mockToast.success).not.toHaveBeenCalled();

		releaseInvalidation?.();
		await waitFor(() => {
			expect(mockToast.success).toHaveBeenCalledWith(
				"Asset value adjustment submitted successfully",
			);
		});
	});
});
