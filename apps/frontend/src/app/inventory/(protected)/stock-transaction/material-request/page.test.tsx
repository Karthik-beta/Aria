import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import MaterialRequestPage from "./page";

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listMaterialRequests: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listMaterialRequests: {
				useQuery: () => ({
					data: [
						{
							id: "clh123mr000001",
							series: "MAT-MR-2026-00001",
							transactionDate: "2026-03-23T00:00:00.000Z",
							purpose: "PURCHASE",
							company: "Aria Corp",
							requiredBy: "2026-04-01T00:00:00.000Z",
							status: "PENDING",
							targetWarehouse: "Main Warehouse",
							terms: null,
							termsContent: null,
							letterHead: null,
							printHeading: null,
							items: [],
							createdAt: "2026-03-23T00:00:00.000Z",
							updatedAt: "2026-03-23T00:00:00.000Z",
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			deleteMaterialRequest: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
		},
	},
}));

describe("MaterialRequestListPage", () => {
	it("renders page header and create button", () => {
		renderWithProviders(<MaterialRequestPage />);

		expect(screen.getByText("Material Requests")).toBeInTheDocument();
		expect(screen.getByText("New Material Request")).toBeInTheDocument();
	});

	it("renders material request row data", () => {
		renderWithProviders(<MaterialRequestPage />);

		expect(screen.getByText("MAT-MR-2026-00001")).toBeInTheDocument();
		expect(screen.getByText("Aria Corp")).toBeInTheDocument();
		expect(screen.getByText("Pending")).toBeInTheDocument();
	});
});
