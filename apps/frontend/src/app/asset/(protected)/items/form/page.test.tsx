import "@testing-library/jest-dom";
import type { AppRouter } from "@aria/api-contract";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import AssetFormPage from "./page";

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockBarcodeFetch = vi.fn();
const mockPush = vi.fn();
const mockBack = vi.fn();

let currentId: string | null = null;

function createTRPCError(
	message: string,
	code: "INTERNAL_SERVER_ERROR" | "NOT_FOUND" | "UNAUTHORIZED",
	httpStatus: number,
): TRPCClientError<AppRouter> {
	const error = new TRPCClientError<AppRouter>(message);
	Object.defineProperty(error, "data", {
		value: { code, httpStatus },
	});
	return error;
}

const mockCategories = [
	{
		id: "clh123cat",
		name: "Vehicles",
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 60,
		frequencyOfDepreciation: 12,
		dailyProrataBased: null,
		shiftBased: null,
		rateOfDepreciation: null,
		expectedValueAfterUsefulLife: 5000,
		nonDepreciableCategory: false,
		enableCwipAccounting: false,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
	},
	{
		id: "clh456cat",
		name: "Electronics",
		depreciationMethod: "WRITTEN_DOWN_VALUE",
		totalNumberOfDepreciations: 36,
		frequencyOfDepreciation: 6,
		dailyProrataBased: null,
		shiftBased: null,
		rateOfDepreciation: 20,
		expectedValueAfterUsefulLife: 1000,
		nonDepreciableCategory: false,
		enableCwipAccounting: false,
		createdAt: new Date("2026-02-01"),
		updatedAt: new Date("2026-02-01"),
	},
];

const mockLocations = [
	{
		id: "clh789loc",
		name: "Head Office",
		parentLocationId: null,
		parentLocationName: null,
		isGroup: false,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-01"),
	},
];

const existingAsset = {
	id: "clhAsset001",
	series: "AST-2026-00001",
	assetName: "Company Vehicle",
	itemCode: "VEH-001",
	assetCategoryId: "clh123cat",
	assetCategoryName: "Vehicles",
	company: "Test Company",
	locationId: "clh789loc",
	locationName: "Head Office",
	custodian: "John Doe",
	department: "Operations",
	purchaseDate: new Date("2026-01-15"),
	availableForUseDate: new Date("2026-02-01"),
	disposalDate: null,
	netPurchaseAmount: 50000,
	assetQuantity: 1,
	calculateDepreciation: true,
	openingAccumulatedDepreciation: null,
	openingNumberOfBookedDepreciations: null,
	isFullyDepreciated: false,
	valueAfterDepreciation: 45000,
	maintenanceRequired: false,
	assetOwner: "COMPANY" as const,
	assetOwnerCompany: null,
	supplier: null,
	customer: null,
	policyNumber: null,
	insurer: null,
	insuredValue: null,
	insuranceStartDate: null,
	insuranceEndDate: null,
	depreciationMethod: "STRAIGHT_LINE",
	totalNumberOfDepreciations: 60,
	frequencyOfDepreciation: 12,
	purchaseReceipt: null,
	purchaseInvoice: null,
	status: "DRAFT" as const,
	activities: [],
	createdAt: new Date("2026-01-15"),
	updatedAt: new Date("2026-01-15"),
};

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: mockBack,
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

vi.mock("@/components/barcode-scanner-dialog", () => ({
	BarcodeScannerDialog: ({
		isOpen,
		onScanSuccess,
	}: {
		isOpen: boolean;
		onScanSuccess: (code: string) => void;
	}) =>
		isOpen ? (
			<button type="button" onClick={() => onScanSuccess("8904287602549")}>
				Complete barcode scan
			</button>
		) : null,
}));

vi.mock("@aria/types", () => ({
	Asset: {
		assetOwnerSchema: {
			parse: vi.fn(() => "COMPANY"),
		},
		assetStatusSchema: {
			parse: vi.fn(() => "DRAFT"),
		},
		createAssetSchema: {
			safeParse: (input: unknown) => ({
				success: true as const,
				data: input,
			}),
		},
		updateAssetSchema: {
			safeParse: (input: unknown) => ({
				success: true as const,
				data: input,
			}),
		},
	},
}));

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				getAssetByBarcode: {
					fetch: mockBarcodeFetch,
				},
				listAssets: {
					invalidate: vi.fn().mockResolvedValue(undefined),
				},
			},
		}),
		company: {
			listCompanies: {
				useQuery: () => ({
					data: {
						items: [
							{ id: "comp-1", name: "Test Company" },
							{ id: "comp-2", name: "Acme Corp" },
						],
					},
					isLoading: false,
				}),
			},
		},
		asset: {
			listFinanceBooks: {
				useQuery: () => ({
					data: { items: [] },
					isLoading: false,
				}),
			},
			listAssetCategories: {
				useQuery: () => ({
					data: { items: mockCategories },
					isLoading: false,
				}),
			},
			listLocations: {
				useQuery: () => ({
					data: { items: mockLocations },
					isLoading: false,
				}),
			},
			getAssetById: {
				useQuery: () => ({
					data: currentId ? existingAsset : undefined,
					isLoading: false,
				}),
			},
			createAsset: {
				useMutation: ({ onSuccess }: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockCreateMutate(vars);
						if (typeof onSuccess === "function")
							onSuccess(
								{
									id: "clh999new",
									assetName:
										vars && (vars as Record<string, unknown>).assetName,
								},
								vars,
								undefined,
							);
					},
				}),
			},
			updateAsset: {
				useMutation: ({ onSuccess }: Record<string, unknown>) => ({
					isPending: false,
					mutate: (vars: unknown) => {
						mockUpdateMutate(vars);
						if (typeof onSuccess === "function")
							onSuccess({ id: currentId }, vars, undefined);
					},
				}),
			},
		},
	},
}));

describe("AssetFormPage", () => {
	beforeEach(() => {
		currentId = null;
		mockCreateMutate.mockClear();
		mockUpdateMutate.mockClear();
		mockBarcodeFetch.mockReset();
		mockPush.mockClear();
		mockBack.mockClear();
	});

	it("renders create form with correct page title", () => {
		renderWithProviders(<AssetFormPage />);
		expect(
			screen.getByRole("heading", { name: /New Asset/i }),
		).toBeInTheDocument();
	});

	it("renders Basic Information, Purchase & Valuation, and Options cards", () => {
		renderWithProviders(<AssetFormPage />);
		expect(screen.getByText(/Basic Information/i)).toBeInTheDocument();
		expect(screen.getByText(/Purchase & Valuation/i)).toBeInTheDocument();
		expect(screen.getByText(/Options/i)).toBeInTheDocument();
	});

	it("renders Calculate Depreciation checkbox unchecked by default", () => {
		renderWithProviders(<AssetFormPage />);
		const checkbox = screen.getByRole("checkbox", {
			name: /Calculate Depreciation/i,
		});
		expect(checkbox).not.toBeChecked();
	});

	it("shows depreciation details fields when Calculate Depreciation is checked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetFormPage />);

		const checkbox = screen.getByRole("checkbox", {
			name: /Calculate Depreciation/i,
		});
		await user.click(checkbox);

		await waitFor(() => {
			expect(screen.getByText(/Depreciation Details/i)).toBeInTheDocument();
		});
		expect(screen.getByLabelText(/Depreciation Method/i)).toBeInTheDocument();
		expect(
			screen.getByLabelText(/Total Number of Depreciations/i),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText(/Frequency of Depreciation/i),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText(/Expected Value After Useful Life/i),
		).toBeInTheDocument();
	});

	it("hides depreciation details fields when Calculate Depreciation is unchecked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetFormPage />);

		const checkbox = screen.getByRole("checkbox", {
			name: /Calculate Depreciation/i,
		});
		await user.click(checkbox);
		await waitFor(() => {
			expect(screen.getByText(/Depreciation Details/i)).toBeInTheDocument();
		});

		await user.click(checkbox);
		await waitFor(() => {
			expect(
				screen.queryByText(/Depreciation Details/i),
			).not.toBeInTheDocument();
		});
	});

	it("renders all three checkboxes in Options section", () => {
		renderWithProviders(<AssetFormPage />);
		expect(
			screen.getByRole("checkbox", { name: /Calculate Depreciation/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("checkbox", { name: /Fully Depreciated/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("checkbox", { name: /Maintenance Required/i }),
		).toBeInTheDocument();
	});

	it("shows Depreciation Method dropdown when Calculate Depreciation is checked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetFormPage />);

		const checkbox = screen.getByRole("checkbox", {
			name: /Calculate Depreciation/i,
		});
		await user.click(checkbox);

		await waitFor(() => {
			expect(screen.getByLabelText(/Depreciation Method/i)).toBeInTheDocument();
		});
	});

	it("submits create payload with depreciation fields when Calculate Depreciation is checked", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetFormPage />);

		await user.type(screen.getByLabelText(/Asset Name/i), "Test Asset");
		const companyButton = screen.getByRole("button", {
			name: /company/i,
		});
		await user.click(companyButton);
		const companyOption = await screen.findByText("Test Company");
		await user.click(companyOption);

		const checkbox = screen.getByRole("checkbox", {
			name: /Calculate Depreciation/i,
		});
		await user.click(checkbox);

		await waitFor(() => {
			expect(screen.getByText(/Depreciation Details/i)).toBeInTheDocument();
		});

		await user.click(screen.getByRole("button", { name: /Create Asset/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					assetName: "Test Asset",
					company: "Test Company",
					calculateDepreciation: true,
				}),
			);
		});
	});

	it("renders Create Asset and Cancel buttons", () => {
		renderWithProviders(<AssetFormPage />);
		expect(
			screen.getByRole("button", { name: /Create Asset/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
	});

	it("renders Depreciation section", () => {
		renderWithProviders(<AssetFormPage />);
		expect(screen.getByText(/Depreciation/i)).toBeInTheDocument();
	});

	it("loads depreciation values in edit mode", async () => {
		currentId = existingAsset.id;
		renderWithProviders(<AssetFormPage />);

		await waitFor(() => {
			expect(screen.getByDisplayValue("Company Vehicle")).toBeInTheDocument();
		});

		const checkbox = screen.getByRole("checkbox", {
			name: /Calculate Depreciation/i,
		});
		expect(checkbox).toBeChecked();

		await waitFor(() => {
			expect(screen.getByText(/Depreciation Details/i)).toBeInTheDocument();
		});
	});

	it("shows depreciation fields in edit mode even if Calculate Depreciation was false on asset", async () => {
		currentId = existingAsset.id;
		renderWithProviders(<AssetFormPage />);

		await waitFor(() => {
			const checkbox = screen.getByRole("checkbox", {
				name: /Calculate Depreciation/i,
			});
			expect(checkbox).toBeChecked();
		});

		await waitFor(() => {
			expect(screen.getByText(/Depreciation Details/i)).toBeInTheDocument();
		});
	});

	it("navigates back on Cancel click", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetFormPage />);

		await user.click(screen.getByRole("button", { name: /Cancel/i }));

		await waitFor(() => {
			expect(mockBack).toHaveBeenCalled();
		});
	});

	it("renders location, category, and company comboboxes", () => {
		renderWithProviders(<AssetFormPage />);
		expect(screen.getByText("Select category…")).toBeInTheDocument();
		expect(screen.getByText("Select location…")).toBeInTheDocument();
		expect(screen.getByText("Select company…")).toBeInTheDocument();
	});

	it("renders all input fields in Basic Information section", () => {
		renderWithProviders(<AssetFormPage />);
		expect(screen.getByLabelText(/Asset Name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Item Code/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Custodian/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Department/i)).toBeInTheDocument();
		expect(document.getElementById("company")).toBeInTheDocument();
	});

	it("renders Purchase & Valuation fields", () => {
		renderWithProviders(<AssetFormPage />);
		expect(screen.getByLabelText(/Purchase Date/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Available For Use/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Net Purchase Amount/i)).toBeInTheDocument();
		expect(screen.getByText("Asset Owner")).toBeInTheDocument();
	});

	it("renders barcode field and scan button", () => {
		renderWithProviders(<AssetFormPage />);
		expect(screen.getByLabelText(/Barcode \/ QR Code/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Scan/i })).toBeInTheDocument();
	});

	it("submits create payload with barcode when provided", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetFormPage />);

		await user.type(screen.getByLabelText(/Asset Name/i), "Test Asset");
		const companyButton = screen.getByRole("button", {
			name: /company/i,
		});
		await user.click(companyButton);
		const companyOption = await screen.findByText("Test Company");
		await user.click(companyOption);
		await user.type(screen.getByLabelText(/Barcode \/ QR Code/i), "987654321");

		await user.click(screen.getByRole("button", { name: /Create Asset/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					assetName: "Test Asset",
					company: "Test Company",
					barcode: "987654321",
				}),
			);
		});
	});

	it("fills a scanned barcode only when lookup returns NOT_FOUND", async () => {
		const user = userEvent.setup();
		mockBarcodeFetch.mockRejectedValueOnce(
			createTRPCError("Asset not found", "NOT_FOUND", 404),
		);
		renderWithProviders(<AssetFormPage />);

		await user.click(screen.getByRole("button", { name: /^Scan$/i }));
		await user.click(
			screen.getByRole("button", { name: /Complete barcode scan/i }),
		);

		await waitFor(() => {
			expect(screen.getByLabelText(/Barcode \/ QR Code/i)).toHaveValue(
				"8904287602549",
			);
		});
		expect(mockBarcodeFetch).toHaveBeenCalledWith({
			barcode: "8904287602549",
		});
	});

	it("rejects a scanned barcode registered to another asset", async () => {
		const user = userEvent.setup();
		mockBarcodeFetch.mockResolvedValueOnce({
			id: "different-asset",
			assetName: "Existing Asset",
		});
		renderWithProviders(<AssetFormPage />);

		await user.click(screen.getByRole("button", { name: /^Scan$/i }));
		await user.click(
			screen.getByRole("button", { name: /Complete barcode scan/i }),
		);

		await waitFor(() => expect(mockBarcodeFetch).toHaveBeenCalledOnce());
		expect(screen.getByLabelText(/Barcode \/ QR Code/i)).toHaveValue("");
	});

	it("accepts the current asset barcode while editing", async () => {
		const user = userEvent.setup();
		currentId = existingAsset.id;
		mockBarcodeFetch.mockResolvedValueOnce({
			id: existingAsset.id,
			assetName: existingAsset.assetName,
		});
		renderWithProviders(<AssetFormPage />);

		await waitFor(() =>
			expect(screen.getByDisplayValue("Company Vehicle")).toBeInTheDocument(),
		);
		await user.click(screen.getByRole("button", { name: /^Scan$/i }));
		await user.click(
			screen.getByRole("button", { name: /Complete barcode scan/i }),
		);

		await waitFor(() => {
			expect(screen.getByLabelText(/Barcode \/ QR Code/i)).toHaveValue(
				"8904287602549",
			);
		});
	});

	it("does not approve a barcode when lookup fails unexpectedly", async () => {
		const user = userEvent.setup();
		mockBarcodeFetch.mockRejectedValueOnce(
			createTRPCError(
				"Barcode lookup service unavailable",
				"INTERNAL_SERVER_ERROR",
				500,
			),
		);
		renderWithProviders(<AssetFormPage />);
		const barcodeInput = screen.getByLabelText(/Barcode \/ QR Code/i);
		await user.type(barcodeInput, "ORIGINAL-BARCODE");

		await user.click(screen.getByRole("button", { name: /^Scan$/i }));
		await user.click(
			screen.getByRole("button", { name: /Complete barcode scan/i }),
		);

		await waitFor(() => expect(mockBarcodeFetch).toHaveBeenCalledOnce());
		expect(barcodeInput).toHaveValue("ORIGINAL-BARCODE");
	});

	it("preserves the previous value when the lookup fails at the network layer", async () => {
		const user = userEvent.setup();
		mockBarcodeFetch.mockRejectedValueOnce(new Error("Network request failed"));
		renderWithProviders(<AssetFormPage />);
		const barcodeInput = screen.getByLabelText(/Barcode \/ QR Code/i);
		await user.type(barcodeInput, "ORIGINAL-BARCODE");

		await user.click(screen.getByRole("button", { name: /^Scan$/i }));
		await user.click(
			screen.getByRole("button", { name: /Complete barcode scan/i }),
		);

		await waitFor(() => expect(mockBarcodeFetch).toHaveBeenCalledOnce());
		expect(barcodeInput).toHaveValue("ORIGINAL-BARCODE");
	});

	it("does not treat authentication failures as barcode availability", async () => {
		const user = userEvent.setup();
		mockBarcodeFetch.mockRejectedValueOnce(
			createTRPCError("Authentication required", "UNAUTHORIZED", 401),
		);
		renderWithProviders(<AssetFormPage />);
		const barcodeInput = screen.getByLabelText(/Barcode \/ QR Code/i);
		await user.type(barcodeInput, "ORIGINAL-BARCODE");

		await user.click(screen.getByRole("button", { name: /^Scan$/i }));
		await user.click(
			screen.getByRole("button", { name: /Complete barcode scan/i }),
		);

		await waitFor(() => expect(mockBarcodeFetch).toHaveBeenCalledOnce());
		expect(barcodeInput).toHaveValue("ORIGINAL-BARCODE");
	});
});
