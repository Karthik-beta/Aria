import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import AssetValueAdjustmentFormPage from "./page";

const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockSubmitMutateAsync = vi.fn();
const mockCancelMutateAsync = vi.fn();
const mockPush = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);

let currentId: string | null = null;
let currentAssetId: string | null = null;

const preview = {
	assetId: "asset-001",
	assetSeries: "AST-2026-00001",
	assetName: "Hydraulic Pump A",
	assetCategoryName: "Machinery",
	company: "ACME Corp",
	adjustmentDate: new Date("2026-04-15"),
	currentAssetValue: 80000,
	newAssetValue: 90000,
	differenceAmount: 10000,
	direction: "INCREASE" as const,
	fixedAssetAccount: "Machinery Fixed Asset",
	resultingStatus: "PARTIALLY_DEPRECIATED" as const,
	resultingIsFullyDepreciated: false,
	validationMessages: [],
	depreciationSchedule: null,
};

const draftRecord = {
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

const submittedRecord = {
	...draftRecord,
	id: "adj-002",
	series: "AVA-2026-00002",
	status: "SUBMITTED" as const,
	submittedAt: new Date("2026-04-16T10:00:00Z"),
	revaluationEntry: {
		id: "entry-001",
		series: "JE-AVA-2026-00001",
		adjustmentId: "adj-002",
		assetId: "asset-001",
		company: "ACME Corp",
		postingDate: new Date("2026-04-16"),
		remarks: "Revaluation entry",
		status: "POSTED" as const,
		reversedAt: null,
		lines: [],
		createdAt: new Date("2026-04-16T10:00:00Z"),
		updatedAt: new Date("2026-04-16T10:00:00Z"),
	},
};

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
	}),
	useSearchParams: () => ({
		get: (key: string) => {
			if (key === "id") return currentId;
			if (key === "assetId") return currentAssetId;
			return null;
		},
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
		createAssetValueAdjustmentSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
		updateAssetValueAdjustmentSchema: {
			safeParse: (input: unknown) => ({ success: true as const, data: input }),
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				listAssetValueAdjustments: {
					invalidate: mockInvalidate,
				},
				getAssetValueAdjustmentById: {
					invalidate: mockInvalidate,
				},
				listAssets: {
					invalidate: mockInvalidate,
				},
			},
		}),
		asset: {
			getAssetValueAdjustmentById: {
				useQuery: () => ({
					data:
						currentId === submittedRecord.id
							? submittedRecord
							: currentId === draftRecord.id
								? draftRecord
								: null,
					isLoading: false,
				}),
			},
			listAssets: {
				useQuery: () => ({
					data: {
						items: [
							{
								id: "asset-001",
								series: "AST-2026-00001",
								assetName: "Hydraulic Pump A",
								company: "ACME Corp",
								status: "SUBMITTED",
							},
						],
						totalCount: 1,
					},
					isLoading: false,
				}),
			},
			previewAssetValueAdjustment: {
				useQuery: (input: { assetId: string }) => ({
					data: input.assetId ? preview : null,
					error: null,
				}),
			},
			createAssetValueAdjustment: {
				useMutation: () => ({
					isPending: false,
					mutateAsync: mockCreateMutateAsync,
				}),
			},
			updateAssetValueAdjustment: {
				useMutation: () => ({
					isPending: false,
					mutateAsync: mockUpdateMutateAsync,
				}),
			},
			submitAssetValueAdjustment: {
				useMutation: () => ({
					isPending: false,
					mutateAsync: mockSubmitMutateAsync,
				}),
			},
			cancelAssetValueAdjustment: {
				useMutation: () => ({
					isPending: false,
					mutateAsync: mockCancelMutateAsync,
				}),
			},
		},
	},
}));

describe("AssetValueAdjustmentFormPage", () => {
	beforeEach(() => {
		currentId = null;
		currentAssetId = null;
		mockPush.mockClear();
		mockInvalidate.mockClear();
		mockCreateMutateAsync.mockReset();
		mockUpdateMutateAsync.mockReset();
		mockSubmitMutateAsync.mockReset();
		mockCancelMutateAsync.mockReset();

		mockCreateMutateAsync.mockResolvedValue({ id: "adj-new" });
		mockUpdateMutateAsync.mockResolvedValue({ id: "adj-001" });
		mockSubmitMutateAsync.mockResolvedValue({ id: "adj-new" });
		mockCancelMutateAsync.mockResolvedValue({ id: "adj-002" });
	});

	it("renders the new adjustment heading and action buttons", () => {
		renderWithProviders(<AssetValueAdjustmentFormPage />);

		expect(
			screen.getByRole("heading", { name: /New Asset Value Adjustment/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Save Draft/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Create & Submit/i }),
		).toBeInTheDocument();
	});

	it("creates and submits a new adjustment", async () => {
		currentAssetId = "asset-001";
		const user = userEvent.setup();
		renderWithProviders(<AssetValueAdjustmentFormPage />);

		await user.type(screen.getByLabelText(/New Asset Value/i), "90000");
		await user.type(
			screen.getByLabelText(/Difference Account/i),
			"Asset Revaluation Reserve",
		);
		await user.click(screen.getByRole("button", { name: /Create & Submit/i }));

		await waitFor(() => {
			expect(mockCreateMutateAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					assetId: "asset-001",
					newAssetValue: 90000,
					differenceAccount: "Asset Revaluation Reserve",
				}),
			);
		});

		await waitFor(() => {
			expect(mockSubmitMutateAsync).toHaveBeenCalledWith({ id: "adj-new" });
		});

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/asset/value-adjustments/form?id=adj-new",
			);
		});
	});

	it("prefills fields in draft edit mode", async () => {
		currentId = draftRecord.id;
		renderWithProviders(<AssetValueAdjustmentFormPage />);

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: draftRecord.series }),
			).toBeInTheDocument();
		});

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("Asset Revaluation Reserve"),
			).toBeInTheDocument();
		});
	});

	it("cancels a submitted adjustment from the form", async () => {
		currentId = submittedRecord.id;
		const user = userEvent.setup();
		renderWithProviders(<AssetValueAdjustmentFormPage />);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /Cancel Adjustment/i }),
			).toBeInTheDocument();
		});

		await user.click(
			screen.getByRole("button", { name: /Cancel Adjustment/i }),
		);
		await user.click(screen.getByRole("button", { name: /Continue/i }));

		await waitFor(() => {
			expect(mockCancelMutateAsync).toHaveBeenCalledWith({
				id: submittedRecord.id,
			});
		});
	});
});
