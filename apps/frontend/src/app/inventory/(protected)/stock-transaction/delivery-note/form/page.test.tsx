import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import DeliveryNoteFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const mockDeliveryNotes = [
	{
		id: "clh123dn000001",
		series: "MAT-DN-2026-00001",
		customer: "Test Customer",
		company: "Aria Corp",
		status: "DRAFT" as const,
		postingDate: new Date("2026-01-15"),
		isReturn: false,
		currency: null,
		priceList: null,
		sourceWarehouse: null,
		totalQty: 5,
		totalNetWeight: null,
		totalBeforeDiscount: 1000,
		additionalDiscountOn: null,
		additionalDiscountPercent: null,
		additionalDiscountAmount: null,
		grandTotal: 1000,
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
		items: [
			{
				id: "clh123dn_item01",
				deliveryNoteId: "clh123dn000001",
				itemCode: "DN-ITM-001",
				itemName: "Delivery Test Item",
				description: null,
				quantity: 5,
				uom: null,
				rate: 200,
				amount: 1000,
				warehouse: null,
			},
		],
		createdAt: new Date("2026-01-15"),
		updatedAt: new Date("2026-01-15"),
	},
];

const getMockNoteById = (id: string | null) =>
	mockDeliveryNotes.find((note) => note.id === id) ?? null;

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
	zodResolver: () => async (values: unknown) => {
		const input = values as Record<string, unknown>;
		const errors: Record<string, { type: string; message: string }> = {};
		const customer = typeof input.customer === "string" ? input.customer : "";
		const company = typeof input.company === "string" ? input.company : "";
		const items = Array.isArray(input.items) ? input.items : [];

		if (customer.trim() === "") {
			errors.customer = {
				type: "required",
				message: "Customer is required",
			};
		}
		if (company.trim() === "") {
			errors.company = {
				type: "required",
				message: "Company is required",
			};
		}
		if (items.length === 0) {
			errors.items = {
				type: "min",
				message: "At least one item is required",
			};
		}

		return {
			values,
			errors,
		};
	},
}));

vi.mock("@aria/types", () => {
	const createItemShape = {
		itemCode: {} as never,
		itemName: {} as never,
		description: {} as never,
		quantity: {} as never,
		uom: {} as never,
		rate: {} as never,
		warehouse: {} as never,
	};
	const createShape = {
		customer: {} as never,
		company: {} as never,
		postingDate: {} as never,
		isReturn: {} as never,
		currency: {} as never,
		priceList: {} as never,
		sourceWarehouse: {} as never,
		additionalDiscountOn: {} as never,
		additionalDiscountPercent: {} as never,
		additionalDiscountAmount: {} as never,
		shippingAddress: {} as never,
		dispatchAddress: {} as never,
		companyAddress: {} as never,
		companyContact: {} as never,
		companyTRN: {} as never,
		terms: {} as never,
		termsContent: {} as never,
		transporter: {} as never,
		driverName: {} as never,
		driver: {} as never,
		transportReceiptDate: {} as never,
		transportReceiptNo: {} as never,
		vehicleNo: {} as never,
		customerPoNo: {} as never,
		customerPoDate: {} as never,
		salesPartner: {} as never,
		commissionRate: {} as never,
		letterHead: {} as never,
		printHeading: {} as never,
		printWithoutAmount: {} as never,
		groupSameItems: {} as never,
		permitNumber: {} as never,
		vatEmirate: {} as never,
		project: {} as never,
		items: {} as never,
	};

	return {
		Inventory: {
			createDeliveryNoteItemSchema: {
				shape: createItemShape,
			},
			createDeliveryNoteSchema: {
				shape: createShape,
				safeParse: (input: unknown) => ({
					success: true as const,
					data: input,
				}),
			},
			updateDeliveryNoteSchema: {
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
				listDeliveryNotes: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		inventory: {
			getDeliveryNoteById: {
				useQuery: () => ({
					data: getMockNoteById(currentId),
					isLoading: false,
				}),
			},
			createDeliveryNote: {
				useMutation: () => ({
					isPending: false,
					mutate: mockCreateMutate,
				}),
			},
			updateDeliveryNote: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("DeliveryNoteFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("renders create form with Save button", () => {
		renderWithProviders(<DeliveryNoteFormPage />);

		expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
		expect(screen.getByText("New Delivery Note")).toBeInTheDocument();
	});

	it("submits create payload with customer and company fields", async () => {
		const user = userEvent.setup();
		renderWithProviders(<DeliveryNoteFormPage />);

		await user.clear(screen.getByLabelText(/Customer/i));
		await user.type(screen.getByLabelText(/Customer/i), "ACME Corp");
		await user.clear(screen.getByLabelText(/Company \*/i));
		await user.type(screen.getByLabelText(/Company \*/i), "Test Corp");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					customer: "ACME Corp",
					company: "Test Corp",
				}),
			);
		});
	});

	it("shows validation errors and blocks submission with missing required fields", async () => {
		const user = userEvent.setup();
		renderWithProviders(<DeliveryNoteFormPage />);

		await user.clear(screen.getByLabelText(/Customer/i));
		await user.clear(screen.getByLabelText(/Company \*/i));
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(screen.getByText(/Customer is required/i)).toBeInTheDocument();
			expect(screen.getByText(/Company is required/i)).toBeInTheDocument();
			expect(mockCreateMutate).not.toHaveBeenCalled();
		});
	});

	it("prefills edit form with series from data", async () => {
		currentId = "clh123dn000001";
		renderWithProviders(<DeliveryNoteFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("MAT-DN-2026-00001")).toBeInTheDocument();
		});
	});

	it("submits update payload in edit mode", async () => {
		currentId = "clh123dn000001";
		const user = userEvent.setup();
		renderWithProviders(<DeliveryNoteFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("MAT-DN-2026-00001")).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ id: "clh123dn000001" }),
			);
		});
	});

	it("redirects to list when edit id is not found", async () => {
		currentId = "missing-id";
		renderWithProviders(<DeliveryNoteFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/stock-transaction/delivery-note",
			);
		});
	});

	it("renders all four tabs", () => {
		renderWithProviders(<DeliveryNoteFormPage />);

		expect(screen.getByRole("tab", { name: /Details/i })).toBeInTheDocument();
		expect(
			screen.getByRole("tab", { name: /Address.*Contact/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /Terms/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /More Info/i })).toBeInTheDocument();
	});

	it("renders item row with Add Row button", () => {
		renderWithProviders(<DeliveryNoteFormPage />);

		expect(
			screen.getByRole("button", { name: /Add Row/i }),
		).toBeInTheDocument();
	});

	it("adds a new item row when Add Row is clicked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<DeliveryNoteFormPage />);

		const addRowBtn = screen.getByRole("button", { name: /Add Row/i });
		await user.click(addRowBtn);

		// After adding a row there should be two rows (No. 1 and No. 2)
		const cells = screen.getAllByText(/^[12]$/);
		expect(cells.length).toBeGreaterThanOrEqual(2);
	});
});
