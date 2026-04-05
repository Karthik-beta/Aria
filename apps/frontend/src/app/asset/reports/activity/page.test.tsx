import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "@/test/utils";
import AssetActivityPage from "./page";

const { mockUseQuery, mockRefetch } = vi.hoisted(() => ({
	mockUseQuery: vi.fn(),
	mockRefetch: vi.fn().mockResolvedValue(undefined),
}));

const activityResponse = {
	rows: [
		{
			activityId: "activity-001",
			assetId: "asset-001",
			assetSeries: "AST-2026-00001",
			assetName: "Hydraulic Pump A",
			assetCategoryId: "cat-001",
			assetCategoryName: "Machinery",
			company: "ACME Corp",
			assetStatus: "PARTIALLY_DEPRECIATED" as const,
			activity: "Asset value adjustment AVA-2026-00003 submitted.",
			createdAt: new Date("2026-04-18T08:30:00.000Z"),
		},
	],
	summary: {
		rowCount: 1,
		distinctAssetCount: 1,
		firstActivityAt: new Date("2026-04-18T08:30:00.000Z"),
		lastActivityAt: new Date("2026-04-18T08:30:00.000Z"),
	},
};

vi.mock("@/lib/trpc", () => ({
	trpc: {
		asset: {
			listAssetActivityReport: {
				useQuery: mockUseQuery,
			},
		},
	},
}));

describe("AssetActivityPage", () => {
	beforeEach(() => {
		mockRefetch.mockClear();
		mockUseQuery.mockReset();
		mockUseQuery.mockImplementation(() => ({
			data: activityResponse,
			isLoading: false,
			error: null,
			refetch: mockRefetch,
		}));
	});

	it("renders the report heading, summary, and activity row", () => {
		renderWithProviders(<AssetActivityPage />);

		expect(
			screen.getByRole("heading", { name: /Asset Activity/i }),
		).toBeInTheDocument();
		expect(screen.getByText("Hydraulic Pump A")).toBeInTheDocument();
		expect(screen.getByText("Distinct Assets")).toBeInTheDocument();
		expect(screen.getByText(/AVA-2026-00003 submitted/i)).toBeInTheDocument();
	});

	it("passes filter changes into the activity query", async () => {
		renderWithProviders(<AssetActivityPage />);

		fireEvent.change(screen.getByLabelText("Filter by company"), {
			target: { value: "ACME Corp" },
		});
		fireEvent.change(screen.getByLabelText("Filter by activity"), {
			target: { value: "submitted" },
		});

		await waitFor(() => {
			expect(mockUseQuery).toHaveBeenLastCalledWith(
				expect.objectContaining({
					company: "ACME Corp",
					activity: "submitted",
				}),
				expect.any(Object),
			);
		});
	});

	it("resets the filter inputs", async () => {
		renderWithProviders(<AssetActivityPage />);

		const activityInput = screen.getByLabelText("Filter by activity");
		fireEvent.change(activityInput, {
			target: { value: "submitted" },
		});

		expect(activityInput).toHaveValue("submitted");

		fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));

		await waitFor(() => {
			expect(screen.getByLabelText("Filter by activity")).toHaveValue("");
		});
	});
});
