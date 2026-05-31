import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/utils";
import DeliveryNoteListPage from "./page";

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listDeliveryNotes: {
					cancel: vi.fn().mockResolvedValue(undefined),
					getData: vi.fn().mockReturnValue([]),
					setData: vi.fn(),
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			listDeliveryNotes: {
				useQuery: () => ({
					data: [
						{
							id: "clh123dn000001",
							series: "MAT-DN-2026-00001",
							customer: "Acme Ltd",
							company: "Aria Corp",
							status: "DRAFT",
							postingDate: "2026-03-23",
							isReturn: false,
							currency: "USD",
							priceList: null,
							sourceWarehouse: null,
							totalQty: 10,
							totalNetWeight: null,
							totalBeforeDiscount: 500,
							additionalDiscountOn: null,
							additionalDiscountPercent: null,
							additionalDiscountAmount: null,
							grandTotal: 500,
							roundingAdjustment: null,
							shippingAddress: null,
							dispatchAddress: null,
							companyAddress: null,
							companyContact: null,
							companyTRN: null,
							terms: null,
							termsContent: null,
							transporter: null,
							driverName: null,
							driver: null,
							transportReceiptDate: null,
							transportReceiptNo: null,
							vehicleNo: null,
							customerPoNo: null,
							customerPoDate: null,
							salesPartner: null,
							commissionRate: null,
							letterHead: null,
							printHeading: null,
							printWithoutAmount: false,
							groupSameItems: false,
							permitNumber: null,
							vatEmirate: null,
							project: null,
							items: [],
							createdAt: "2026-03-23",
							updatedAt: "2026-03-23",
						},
					],
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			deleteDeliveryNote: {
				useMutation: () => ({
					isPending: false,
					mutate: vi.fn(),
				}),
			},
		},
	},
}));

describe("DeliveryNoteListPage", () => {
	it("renders page header and create button", () => {
		renderWithProviders(<DeliveryNoteListPage />);

		expect(screen.getByText("Delivery Notes")).toBeInTheDocument();
		expect(screen.getByText("New Delivery Note")).toBeInTheDocument();
	});

	it("renders delivery note row data", () => {
		renderWithProviders(<DeliveryNoteListPage />);

		expect(screen.getByText("MAT-DN-2026-00001")).toBeInTheDocument();
		expect(screen.getByText("Acme Ltd")).toBeInTheDocument();
		expect(screen.getByText("Draft")).toBeInTheDocument();
	});
});
