import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import PickListPage from "./page";

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listPickLists: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listPickLists: {
				useQuery: () => ({
					data: [
						{
							id: "clh123pkl000001",
							series: "STO-PICK-2026-00001",
							seriesPattern: "STO-PICK-.YYYY.-",
							status: "OPEN",
							company: "Aria Corp",
							customer: "Acme Ltd",
							purpose: "DELIVERY",
							workOrder: null,
							warehouse: "Main Warehouse",
							considerRejectedWarehouses: false,
							pickManually: false,
							ignorePricingRule: false,
							scanMode: false,
							promptQty: false,
							scanBarcode: null,
							groupSameItems: false,
							items: [],
							createdAt: new Date("2026-03-23"),
							updatedAt: new Date("2026-03-23"),
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			deletePickList: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
		},
	},
}));

describe("PickListPage", () => {
	it("renders page header and create button", () => {
		renderWithProviders(<PickListPage />);

		expect(screen.getByText("Pick Lists")).toBeInTheDocument();
		expect(screen.getByText("New Pick List")).toBeInTheDocument();
	});

	it("renders pick list row data", () => {
		renderWithProviders(<PickListPage />);

		expect(screen.getByText("STO-PICK-2026-00001")).toBeInTheDocument();
		expect(screen.getByText("Acme Ltd")).toBeInTheDocument();
		expect(screen.getByText("Open")).toBeInTheDocument();
	});
});
