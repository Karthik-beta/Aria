import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import PurchaseReceiptFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const mockPurchaseReceipts = [
	{
		id: "clh123pre000001",
		series: "MAT-PRE-2026-00001",
		seriesPattern: "MAT-PRE-.YYYY.-",
		postingDate: new Date("2026-03-23"),
		postingTime: "09:00:00",
		editPostingDateTime: false,
		supplier: "ACME Supplies",
		company: "Aria Corp",
		status: "DRAFT" as const,
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
		reverseChargeApplicable: "N" as const,
		transporterName: null,
		vehicleNumber: null,
		vehicleDate: null,
		instructions: null,
		remarks: null,
		isInternalSupplier: false,
		items: [
			{
				id: "clh123preitem01",
				purchaseReceiptId: "clh123pre000001",
				itemCode: "PRE-ITEM-001",
				itemName: "Test Item",
				description: null,
				acceptedQuantity: 5,
				rejectedQuantity: 0,
				rate: 100,
				amount: 500,
				uom: null,
				acceptedWarehouse: "Main",
				rejectedWarehouse: null,
			},
		],
		taxes: [
			{
				id: "clh123pretax01",
				purchaseReceiptId: "clh123pre000001",
				type: "On Net Total",
				accountHead: "VAT 5%",
				taxRate: 5,
				amount: 25,
				total: 525,
			},
		],
		createdAt: new Date("2026-03-23"),
		updatedAt: new Date("2026-03-23"),
	},
];

const getMockReceiptById = (id: string | null) =>
	mockPurchaseReceipts.find((receipt) => receipt.id === id) ?? null;

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
		pathname: "/",
		query: {},
	}),
	useSearchParams: () => ({
		get: (key: string) => (key === "id" ? currentId : null),
	}),
}));

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => async (values: unknown) => ({
		values,
		errors: {},
	}),
}));

vi.mock("@aria/types", () => {
	const createItemShape = {
		itemCode: {} as never,
		itemName: {} as never,
		description: {} as never,
		acceptedQuantity: {} as never,
		rejectedQuantity: {} as never,
		rate: {} as never,
		uom: {} as never,
		acceptedWarehouse: {} as never,
		rejectedWarehouse: {} as never,
	};
	const createTaxShape = {
		type: {} as never,
		accountHead: {} as never,
		taxRate: {} as never,
		amount: {} as never,
	};
	const createShape = {
		supplier: {} as never,
		company: {} as never,
		items: {} as never,
		taxes: {} as never,
	};

	return {
		Inventory: {
			createPurchaseReceiptItemSchema: { shape: createItemShape },
			createPurchaseReceiptTaxSchema: { shape: createTaxShape },
			createPurchaseReceiptSchema: {
				shape: createShape,
				safeParse: (input: unknown) => ({
					success: true as const,
					data: input,
				}),
			},
			updatePurchaseReceiptSchema: {
				safeParse: (input: unknown) => ({
					success: true as const,
					data: input,
				}),
			},
		},
	};
});

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listPurchaseReceipts: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getPurchaseReceiptById: {
				useQuery: () => ({
					data: getMockReceiptById(currentId),
					isLoading: false,
				}),
			},
			createPurchaseReceipt: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updatePurchaseReceipt: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("PurchaseReceiptFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form with Save button", () => {
		renderWithProviders(<PurchaseReceiptFormPage />);

		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByText("New Purchase Receipt")).toBeInTheDocument();
	});

	it("submits create payload with supplier and company", async () => {
		const user = userEvent.setup();
		renderWithProviders(<PurchaseReceiptFormPage />);

		await user.clear(screen.getByLabelText(/Supplier \*/i));
		await user.type(screen.getByLabelText(/Supplier \*/i), "Supplier One");
		await user.clear(screen.getByLabelText(/Company \*/i));
		await user.type(screen.getByLabelText(/Company \*/i), "Company One");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					supplier: "Supplier One",
					company: "Company One",
				}),
			);
		});
	});

	it("prefills edit form with series from data", async () => {
		currentId = "clh123pre000001";
		renderWithProviders(<PurchaseReceiptFormPage />);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("MAT-PRE-2026-00001"),
			).toBeInTheDocument();
		});
	});

	it("submits update payload in edit mode", async () => {
		currentId = "clh123pre000001";
		const user = userEvent.setup();
		renderWithProviders(<PurchaseReceiptFormPage />);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("MAT-PRE-2026-00001"),
			).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ id: "clh123pre000001" }),
			);
		});
	});

	it("redirects to list when edit id is not found", async () => {
		currentId = "missing-id";
		renderWithProviders(<PurchaseReceiptFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/stock-transaction/purchase-receipt",
			);
		});
	});

	it("adds a tax row when Add Tax Row is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<PurchaseReceiptFormPage />);

		expect(screen.getByText("No tax rows")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /Add Tax Row/i }));

		expect(screen.queryByText("No tax rows")).not.toBeInTheDocument();
		expect(screen.getByPlaceholderText("On Net Total")).toBeInTheDocument();
	});
});
