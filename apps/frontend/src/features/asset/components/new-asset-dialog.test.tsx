import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import { NewAssetDialog } from "./new-asset-dialog";

const mockState = vi.hoisted(() => ({
	invalidate: vi.fn(),
	createOnSuccess: null as (() => Promise<void>) | null,
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: { invalidate: mockState.invalidate },
		}),
		company: {
			listCompanies: {
				useQuery: () => ({
					data: { items: [{ id: "company-1", name: "Company A" }] },
				}),
			},
		},
		asset: {
			listAssetCategories: {
				useQuery: () => ({ data: { items: [] } }),
			},
			listLocations: {
				useQuery: () => ({ data: { items: [] } }),
			},
			createAsset: {
				useMutation: (options: { onSuccess?: () => Promise<void> }) => {
					mockState.createOnSuccess = options.onSuccess ?? null;
					return { isPending: false, mutate: vi.fn() };
				},
			},
		},
	},
}));

describe("NewAssetDialog mutation completion", () => {
	beforeEach(() => {
		mockState.invalidate.mockReset();
		mockState.invalidate.mockResolvedValue(undefined);
		mockState.createOnSuccess = null;
	});

	it("keeps the dialog open until Asset-domain invalidation completes", async () => {
		const user = userEvent.setup();
		let releaseInvalidation: (() => void) | undefined;
		mockState.invalidate.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					releaseInvalidation = resolve;
				}),
		);

		renderWithProviders(<NewAssetDialog />);
		await user.click(screen.getByRole("button", { name: "Add Asset" }));
		expect(
			screen.getByRole("heading", { name: "New Asset" }),
		).toBeInTheDocument();

		const onSuccess = mockState.createOnSuccess;
		if (!onSuccess)
			throw new Error("create success callback was not registered");
		const completion = onSuccess();
		await Promise.resolve();
		expect(
			screen.getByRole("heading", { name: "New Asset" }),
		).toBeInTheDocument();

		releaseInvalidation?.();
		await completion;
		await waitFor(() => {
			expect(
				screen.queryByRole("heading", { name: "New Asset" }),
			).not.toBeInTheDocument();
		});
	});
});
