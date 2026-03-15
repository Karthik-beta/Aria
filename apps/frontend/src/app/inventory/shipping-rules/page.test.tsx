import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "../../../../test/utils";
import ShippingRulesPage from "./page";

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listShippingRules: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listShippingRules: {
				useQuery: () => ({
					data: [
						{
							id: "clh123rule",
							shippingRuleLabel: "Standard Shipping",
							shippingRuleType: "SELLING",
							disabled: false,
							calculateBasedOn: "FIXED",
							shippingAmount: 10,
							createdAt: new Date("2026-01-01"),
							updatedAt: new Date("2026-01-02"),
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			deleteShippingRule: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
		},
	},
}));

describe("ShippingRulesPage", () => {
	it("renders list and add button", () => {
		renderWithProviders(<ShippingRulesPage />);

		expect(screen.getByText("Add Shipping Rule")).toBeInTheDocument();
		expect(screen.getByText("Standard Shipping")).toBeInTheDocument();
		expect(screen.getByText("Fixed")).toBeInTheDocument();
	});
});
