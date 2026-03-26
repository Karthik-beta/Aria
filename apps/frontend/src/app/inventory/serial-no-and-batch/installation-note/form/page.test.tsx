import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import InstallationNoteFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockPush = vi.fn();

let currentId: string | null = null;

const installationNoteRecord = {
	id: "clins0000000000000001",
	series: "MAT-INS-2026-00001",
	seriesPattern: "MAT-INS-.YYYY.-",
	installationDate: new Date("2026-03-26"),
	installationTime: "10:30:00",
	customer: "Acme Industries",
	customerName: "Acme Industries",
	customerAddress: "Dubai",
	contactPerson: "John",
	territory: "All Territories",
	customerGroup: "Corporate",
	company: "Aria Corp",
	status: "DRAFT" as const,
	deliveryNoteId: null,
	deliveryNoteSeries: null,
	remarks: "Ready to install",
	items: [
		{
			id: "row-1",
			installationNoteId: "clins0000000000000001",
			itemId: "clitem000000000000001",
			itemCode: "LAP-001",
			itemName: "Laptop",
			serialNoId: "clserial0000000000001",
			serialNo: "SN-1001",
			description: "Onsite setup",
			installedQty: 1,
		},
	],
	createdAt: new Date("2026-03-26"),
	updatedAt: new Date("2026-03-26"),
};

vi.mock("@aria/types", () => ({
	Inventory: {
		installationNoteStatusSchema: {
			options: ["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
		},
		createInstallationNoteSchema: {
			safeParse: (input: unknown) => ({ success: true, data: input }),
		},
		updateInstallationNoteSchema: {
			safeParse: (input: unknown) => ({ success: true, data: input }),
		},
	},
}));

vi.mock("@hookform/resolvers/zod", () => ({
	zodResolver: () => async (values: unknown) => ({ values, errors: {} }),
}));

vi.mock("../installation-note.schema", () => ({
	installationNoteFormSchema: {},
	getInstallationNoteFormDefaults: () => ({
		seriesPattern: "MAT-INS-.YYYY.-",
		installationDate: "2026-03-26",
		installationTime: "",
		customer: "",
		customerName: "",
		customerAddress: "",
		contactPerson: "",
		territory: "All Territories",
		customerGroup: "",
		company: "",
		status: "DRAFT",
		deliveryNoteId: "",
		remarks: "",
		items: [
			{
				itemId: "",
				serialNoId: "",
				description: "",
				installedQty: 1,
			},
		],
	}),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: vi.fn(),
	}),
	useSearchParams: () => ({
		get: (key: string) => (key === "id" ? currentId : null),
	}),
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				listInstallationNotes: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				getInstallationNoteById: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
				listSerialNos: { invalidate: vi.fn().mockResolvedValue(undefined) },
			},
		}),
		inventory: {
			getInstallationNoteById: {
				useQuery: () => ({
					data:
						currentId === installationNoteRecord.id
							? installationNoteRecord
							: null,
					isLoading: false,
				}),
			},
			listItems: {
				useQuery: () => ({
					data: [
						{
							id: "clitem000000000000001",
							code: "LAP-001",
							name: "Laptop",
							hasSerialNo: true,
							disabled: false,
						},
					],
				}),
			},
			listDeliveryNotes: {
				useQuery: () => ({
					data: [
						{
							id: "cldn0000000000000001",
							series: "MAT-DN-2026-00001",
							postingDate: new Date("2026-03-20"),
							customer: "Acme Industries",
							company: "Aria Corp",
							status: "DRAFT",
							isReturn: false,
							currency: null,
							priceList: null,
							sourceWarehouse: null,
							totalQuantity: 1,
							totalAmount: 0,
							grandTotal: 0,
							roundingAdjustment: 0,
							roundedTotal: 0,
							additionalDiscountOn: null,
							additionalDiscountPercent: null,
							additionalDiscountAmount: null,
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
							createdAt: new Date("2026-03-20"),
							updatedAt: new Date("2026-03-21"),
						},
					],
				}),
			},
			listSerialNos: {
				useQuery: () => ({
					data: {
						items: [
							{
								id: "clserial0000000000001",
								serialNo: "SN-1001",
								itemId: "clitem000000000000001",
								itemCode: "LAP-001",
								itemName: "Laptop",
								company: "Aria Corp",
								status: "AVAILABLE",
								currentWarehouseId: null,
								currentWarehouseName: null,
								purchaseReceiptId: null,
								purchaseReceiptSeries: null,
								deliveryNoteId: null,
								deliveryNoteSeries: null,
								stockEntryId: null,
								stockEntrySeries: null,
								pickListId: null,
								pickListSeries: null,
								workOrder: null,
								purchaseDate: null,
								warrantyExpiryDate: null,
								serviceContractExpiryDate: null,
								maintenanceStatus: null,
								notes: null,
								isDisabled: false,
								createdAt: new Date("2026-03-20"),
								updatedAt: new Date("2026-03-21"),
								history: [],
							},
						],
						totalCount: 1,
					},
				}),
			},
			createInstallationNote: {
				useMutation: () => ({ isPending: false, mutate: mockCreateMutate }),
			},
			updateInstallationNote: {
				useMutation: () => ({ isPending: false, mutate: mockUpdateMutate }),
			},
		},
	},
}));

describe("InstallationNoteFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockPush.mockClear();
	});

	it("submits the create payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<InstallationNoteFormPage />);

		await user.clear(screen.getByRole("textbox", { name: /^Customer \*$/i }));
		await user.type(
			screen.getByRole("textbox", { name: /^Customer \*$/i }),
			"Acme Industries",
		);
		await user.type(
			screen.getByRole("textbox", { name: /^Company \*$/i }),
			"Aria Corp",
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					customer: "Acme Industries",
					company: "Aria Corp",
				}),
			);
		});
	});

	it("prefills and submits the update payload", async () => {
		currentId = "clins0000000000000001";
		const user = userEvent.setup();
		renderWithProviders(<InstallationNoteFormPage />);

		await waitFor(() => {
			expect(
				screen.getByRole("heading", { name: "MAT-INS-2026-00001" }),
			).toBeInTheDocument();
		});

		await user.clear(screen.getByLabelText(/Remarks/i));
		await user.type(
			screen.getByLabelText(/Remarks/i),
			"Installation completed",
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "clins0000000000000001",
					remarks: "Installation completed",
				}),
			);
		});
	});

	it("redirects when the installation note is missing", async () => {
		currentId = "missing";
		renderWithProviders(<InstallationNoteFormPage />);

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith(
				"/inventory/serial-no-and-batch/installation-note",
			);
		});
	});
});
