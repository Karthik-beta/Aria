import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import PurchaseReceiptListPage from "./page";

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listPurchaseReceipts: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listPurchaseReceipts: {
				useQuery: () => ({
					data: [
						{
							id: "clh123pre000001",
							series: "MAT-PRE-2026-00001",
							seriesPattern: "MAT-PRE-.YYYY.-",
							postingDate: new Date("2026-03-23"),
							postingTime: "09:00:00",
							editPostingDateTime: false,
							supplier: "ACME Supplies",
							company: "Aria Corp",
							status: "TO_BILL",
							isReturn: false,
							applyPutawayRule: false,
							supplierDeliveryNote: null,
							acceptedWarehouse: "Main",
							rejectedWarehouse: null,
							isSubcontracted: false,
							currency: "INR",
							priceList: null,
							totalQuantity: 5,
							totalAcceptedQuantity: 5,
							totalRejectedQuantity: 0,
							totalAmount: 500,
							taxesAndChargesAdded: 25,
							taxesAndChargesDeducted: 0,
							totalTaxesAndCharges: 25,
							grandTotal: 525,
							roundingAdjustment: 0,
							roundedTotal: 525,
							disableRoundedTotal: false,
							supplierAddress: null,
							contactPerson: null,
							shippingAddressTemplate: null,
							companyTRN: null,
							billingAddress: null,
							terms: null,
							termsContent: null,
							letterHead: null,
							printHeading: null,
							groupSameItems: false,
							permitNumber: null,
							recoverableStandardRatedExpenses: 0,
							reverseChargeApplicable: "N",
							transporterName: null,
							vehicleNumber: null,
							vehicleDate: null,
							instructions: null,
							remarks: null,
							isInternalSupplier: false,
							items: [],
							taxes: [],
							createdAt: new Date("2026-03-23"),
							updatedAt: new Date("2026-03-23"),
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			deletePurchaseReceipt: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
		},
	},
}));

describe("PurchaseReceiptListPage", () => {
	it("renders page header and create button", () => {
		renderWithProviders(<PurchaseReceiptListPage />);

		expect(screen.getByText("Purchase Receipts")).toBeInTheDocument();
		expect(screen.getByText("New Purchase Receipt")).toBeInTheDocument();
	});

	it("renders purchase receipt row data", () => {
		renderWithProviders(<PurchaseReceiptListPage />);

		expect(screen.getByText("ACME Supplies")).toBeInTheDocument();
		expect(screen.getByText("MAT-PRE-2026-00001")).toBeInTheDocument();
		expect(screen.getByText("To Bill")).toBeInTheDocument();
	});
});
