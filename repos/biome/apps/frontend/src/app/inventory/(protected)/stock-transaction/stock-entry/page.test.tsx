import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import StockEntryListPage from "./page";

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listStockEntries: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listStockEntries: {
				useQuery: () => ({
					data: [
						{
							id: "clh123ste000001",
							series: "MAT-STE-2026-00001",
							stockEntryType: "MATERIAL_RECEIPT",
							postingDate: new Date("2026-01-15"),
							company: "Aria Corp",
							status: "DRAFT",
							defaultSourceWarehouse: null,
							defaultTargetWarehouse: "Main Warehouse",
							project: null,
							isOpening: false,
							remarks: null,
							printHeading: null,
							letterHead: null,
							inspectionRequired: false,
							items: [],
							createdAt: new Date("2026-01-15"),
							updatedAt: new Date("2026-01-15"),
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			deleteStockEntry: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
		},
	},
}));

describe("StockEntryListPage", () => {
	it("renders list with header and new entry button", () => {
		renderWithProviders(<StockEntryListPage />);

		expect(screen.getByText("Stock Entries")).toBeInTheDocument();
		expect(screen.getByText("New Stock Entry")).toBeInTheDocument();
	});

	it("renders stock entry series in the table", () => {
		renderWithProviders(<StockEntryListPage />);

		expect(screen.getByText("MAT-STE-2026-00001")).toBeInTheDocument();
	});

	it("renders Material Receipt stock entry type", () => {
		renderWithProviders(<StockEntryListPage />);

		expect(screen.getByText("Material Receipt")).toBeInTheDocument();
	});

	it("renders Draft status badge", () => {
		renderWithProviders(<StockEntryListPage />);

		expect(screen.getByText("Draft")).toBeInTheDocument();
	});
});
