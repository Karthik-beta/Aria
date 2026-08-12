import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import { AssetMovementDialog } from "../movement-dialog";

const invalidate = vi.fn();

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: { listAssetMovements: { invalidate } },
		}),
		asset: {
			listAssets: {
				useQuery: () => ({
					data: {
						items: [
							{
								id: "asset-1",
								series: "AST-001",
								assetName: "Pump",
								companyId: "company-1",
								company: "Test Company",
								locationId: "location-1",
								locationName: "Warehouse",
								custodian: "Alex",
							},
						],
					},
					isLoading: false,
				}),
			},
			listLocations: {
				useQuery: () => ({
					data: { items: [{ id: "location-1", name: "Warehouse" }] },
					isLoading: false,
				}),
			},
			createAssetMovement: {
				useMutation: () => ({ isPending: false, mutate: vi.fn() }),
			},
		},
	},
}));

describe("AssetMovementDialog", () => {
	it("renders the complete movement purpose set and source-state fields", () => {
		renderWithProviders(<AssetMovementDialog open onOpenChange={vi.fn()} />);

		expect(screen.getByText("Transaction Date")).toBeInTheDocument();
		expect(screen.getByText("Current source")).toBeInTheDocument();
		expect(screen.getByText("Transfer and Issue")).toBeInTheDocument();
		expect(
			screen.getByDisplayValue("Select assets to derive company"),
		).toBeInTheDocument();
	});
});
