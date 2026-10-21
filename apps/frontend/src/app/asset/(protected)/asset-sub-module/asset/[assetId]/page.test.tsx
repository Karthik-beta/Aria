import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, within } from "@/test/utils";
import AssetDetailPage from "./page";

const canManageAssets = vi.hoisted(() => ({ value: true }));
const state = vi.hoisted(() => ({
	status: "PARTIALLY_DEPRECIATED",
	preview: undefined as unknown,
	previewError: false,
}));
const mockCancel = vi.fn();
const mockInvalidatePreview = vi.fn();

vi.mock("@/hooks/use-can-manage-assets", () => ({
	useCanManageAssets: () => canManageAssets.value,
}));

vi.mock("next/navigation", () => ({
	useParams: () => ({ assetId: "classet00000000000000000" }),
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				getAssetById: { invalidate: vi.fn().mockResolvedValue(undefined) },
				listAssets: { invalidate: vi.fn().mockResolvedValue(undefined) },
				getAssetCancellationPreview: { invalidate: mockInvalidatePreview },
			},
		}),
		asset: {
			getAssetById: {
				useQuery: () => ({
					isLoading: false,
					data: {
						id: "classet00000000000000000",
						assetName: "Laptop",
						series: "AST-2026-00001",
						status: state.status,
						company: "ACME",
						financeBooks: [],
						activities: [],
						createdAt: new Date("2026-01-01T00:00:00.000Z"),
						updatedAt: new Date("2026-01-01T00:00:00.000Z"),
					},
				}),
			},
			getAssetCancellationPreview: {
				useQuery: () => ({
					data: state.preview,
					isLoading: !state.preview && !state.previewError,
					isFetching: false,
					isError: state.previewError,
				}),
			},
			deleteAsset: { useMutation: () => ({ mutate: vi.fn() }) },
			submitAsset: { useMutation: () => ({ mutate: vi.fn() }) },
			cancelAsset: {
				useMutation: () => ({ mutate: mockCancel, isPending: false }),
			},
		},
	},
}));

const postedPreview = {
	canCancel: true,
	blockers: [],
	postedEntryCount: 3,
	postedDepreciationTotal: 30000,
	latestPostingDate: "2026-02-28",
	entries: [
		{
			series: "DEP-2026-00001",
			postingDate: "2026-01-31",
			depreciationAmount: 10000,
			financeBookName: "Statutory",
		},
	],
};

describe("AssetDetailPage cancel action", () => {
	beforeEach(() => {
		canManageAssets.value = true;
		state.status = "PARTIALLY_DEPRECIATED";
		state.preview = postedPreview;
		state.previewError = false;
		mockCancel.mockClear();
		mockInvalidatePreview.mockClear();
	});

	for (const status of [
		"SUBMITTED",
		"PARTIALLY_DEPRECIATED",
		"FULLY_DEPRECIATED",
	]) {
		it(`shows Cancel Asset for a ${status} asset`, () => {
			state.status = status;
			renderWithProviders(<AssetDetailPage />);

			expect(
				screen.getByRole("button", { name: "Cancel Asset" }),
			).toBeInTheDocument();
		});
	}

	for (const status of [
		"DRAFT",
		"CANCELLED",
		"SOLD",
		"SCRAPPED",
		"IN_MAINTENANCE",
	]) {
		it(`hides Cancel Asset for a ${status} asset`, () => {
			state.status = status;
			renderWithProviders(<AssetDetailPage />);

			expect(
				screen.queryByRole("button", { name: "Cancel Asset" }),
			).not.toBeInTheDocument();
		});
	}

	it("hides Cancel Asset for users who cannot manage assets", () => {
		canManageAssets.value = false;
		renderWithProviders(<AssetDetailPage />);

		expect(
			screen.queryByRole("button", { name: "Cancel Asset" }),
		).not.toBeInTheDocument();
	});

	it("summarises the posted depreciation before confirming", async () => {
		renderWithProviders(<AssetDetailPage />);

		await userEvent.click(screen.getByRole("button", { name: "Cancel Asset" }));

		const dialog = await screen.findByRole("alertdialog");
		expect(
			within(dialog).getByText(/3 posted depreciation entries/),
		).toBeInTheDocument();
		expect(within(dialog).getByText("₹30,000")).toBeInTheDocument();
		expect(within(dialog).getByText("28 Feb 2026")).toBeInTheDocument();
		expect(within(dialog).getByText("DEP-2026-00001")).toBeInTheDocument();

		await userEvent.click(
			within(dialog).getByRole("button", { name: "Cancel Asset" }),
		);
		expect(mockCancel).toHaveBeenCalledWith({ id: "classet00000000000000000" });
	});

	it("says so when no depreciation has been posted", async () => {
		state.status = "SUBMITTED";
		state.preview = {
			...postedPreview,
			postedEntryCount: 0,
			postedDepreciationTotal: 0,
			latestPostingDate: null,
			entries: [],
		};
		renderWithProviders(<AssetDetailPage />);

		await userEvent.click(screen.getByRole("button", { name: "Cancel Asset" }));

		const dialog = await screen.findByRole("alertdialog");
		expect(
			within(dialog).getByText(/No depreciation has been posted/),
		).toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: "Cancel Asset" }),
		).toBeEnabled();
	});

	it("lists blockers and disables the confirm button", async () => {
		state.preview = {
			...postedPreview,
			canCancel: false,
			blockers: [
				"Accounting is frozen through 2026-01-31 for ACME. Depreciation posted on or before that date cannot be reversed, so asset AST-2026-00001 cannot be cancelled.",
			],
		};
		renderWithProviders(<AssetDetailPage />);

		await userEvent.click(screen.getByRole("button", { name: "Cancel Asset" }));

		const dialog = await screen.findByRole("alertdialog");
		expect(
			within(dialog).getByText(/Accounting is frozen/),
		).toBeInTheDocument();
		const confirm = within(dialog).getByRole("button", {
			name: "Cancel Asset",
		});
		expect(confirm).toBeDisabled();
		await userEvent.click(confirm);
		expect(mockCancel).not.toHaveBeenCalled();
	});

	it("disables the confirm button when the preview cannot be loaded", async () => {
		state.preview = undefined;
		state.previewError = true;
		renderWithProviders(<AssetDetailPage />);

		await userEvent.click(screen.getByRole("button", { name: "Cancel Asset" }));

		const dialog = await screen.findByRole("alertdialog");
		expect(within(dialog).getByText(/Could not check/)).toBeInTheDocument();
		expect(
			within(dialog).getByRole("button", { name: "Cancel Asset" }),
		).toBeDisabled();
	});
});
