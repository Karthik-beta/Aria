import "@testing-library/jest-dom";
import type { AppRouter } from "@aria/api-contract";
import { TRPCClientError } from "@trpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	fireEvent,
	renderWithProviders,
	screen,
	userEvent,
	waitFor,
} from "@/test/utils";
import AssetFormPage, { assetFormSchema } from "./page";

vi.mock("@/hooks/use-asset-write-access", () => ({
	useAssetWriteAccess: () => true,
}));

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockBarcodeFetch = vi.fn();
const mockPush = vi.fn();
const mockBack = vi.fn();

let currentId: string | null = null;
let initialCategoryId: string | null = null;

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
		id: "clh1234567890123456789012",
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
		id: "clh4567890123456789012345",
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

let categoryItems = mockCategories;

const mockLocations = [
	{
		id: "clh7890123456789012345678",
		name: "Head Office",
		parentLocationId: null,
		parentLocationName: null,
		isGroup: false,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-01"),
	},
];

const existingAsset = {
	id: "clhasset00123456789012345",
	series: "AST-2026-00001",
	assetName: "Company Vehicle",
	assetType: "COMPOSITE_COMPONENT" as const,
	itemCode: "VEH-001",
	assetCategoryId: "clh1234567890123456789012",
	assetCategoryName: "Vehicles",
	companyId: "cm1234567890123456789012",
	company: "Test Company",
	locationId: "clh7890123456789012345678",
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
	expectedValueAfterUsefulLife: 4500,
	depreciationStartDate: new Date("2026-03-15T00:00:00.000Z"),
	financeBooks: [
		{
			id: "clhassetbook0012345678901",
			financeBookId: "clhfinancebook00123456789",
			financeBookName: "Corporate Book",
			depreciationMethod: "STRAIGHT_LINE" as const,
			totalNumberOfDepreciations: 3,
			increaseInAssetLife: 0,
			frequencyOfDepreciation: 12,
			depreciationStartDate: "2026-02-28",
			dailyProrataBased: true,
			shiftBased: true,
			precision: 3,
			ratePrecision: 4,
			calculateUsingTotalDays: true,
			shiftAllocations: [
				{ periodIndex: 0, shift: "Day:Night", factor: 1 },
				{ periodIndex: 1, shift: "Night,Weekend", factor: 2 },
				{ periodIndex: 2, shift: "Two Shifts", factor: 1 },
			],
			rateOfDepreciation: 20,
			expectedValueAfterUsefulLife: 5000,
			openingAccumulatedDepreciation: 0,
			openingNumberOfBookedDepreciations: 0,
			valueAfterDepreciation: 50000,
			totalNumberOfBookedDepreciations: 0,
			lastPostedDepreciationDate: null,
			postingStatus: "PENDING" as const,
		},
	],
	purchaseReceipt: null,
	purchaseInvoice: null,
	status: "DRAFT" as const,
	activities: [],
	createdAt: new Date("2026-01-15"),
	updatedAt: new Date("2026-01-15"),
};

const submittedAsset = {
	...existingAsset,
	id: "clhassetsubmitted123456789",
	status: "SUBMITTED" as const,
};

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		replace: vi.fn(),
		prefetch: vi.fn(),
		back: mockBack,
	}),
	useSearchParams: () => ({
		get: (key: string) => {
			if (key === "id") return currentId;
			if (key === "assetCategoryId") return initialCategoryId;
			return null;
		},
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

vi.mock("@aria/types", async () => {
	const actual =
		await vi.importActual<typeof import("@aria/types")>("@aria/types");
	return {
		...actual,
		Asset: {
			...actual.Asset,
		},
	};
});

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			asset: {
				invalidate: vi.fn().mockResolvedValue(undefined),
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
							{ id: "cm1234567890123456789012", name: "Test Company" },
							{ id: "cm2234567890123456789012", name: "Acme Corp" },
						],
					},
					isLoading: false,
				}),
			},
		},
		asset: {
			listFinanceBooks: {
				useQuery: () => ({
					data: {
						items: [
							{ id: "clhfinancebook00123456789", name: "Corporate Book" },
						],
					},
					isLoading: false,
				}),
			},
			listAssetCategories: {
				useQuery: () => ({
					data: { items: categoryItems },
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
					data:
						currentId === submittedAsset.id
							? submittedAsset
							: currentId
								? existingAsset
								: undefined,
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
	const validFormValues = {
		assetName: "Test Asset",
		assetType: "EXISTING_ASSET" as const,
		companyId: "cm1234567890123456789012",
		assetQuantity: 1,
		calculateDepreciation: true,
		isFullyDepreciated: false,
		maintenanceRequired: false,
		status: "DRAFT",
		assetOwner: "COMPANY",
		purchaseDate: "2026-01-01",
		availableForUseDate: "2026-01-02",
		financeBooks: [
			{
				financeBookId: "cm3234567890123456789012",
				depreciationMethod: "STRAIGHT_LINE" as const,
				totalNumberOfDepreciations: "3",
				frequencyOfDepreciation: "1",
				depreciationStartDate: "2026-02-28",
				dailyProrataBased: true,
				shiftBased: true,
				precision: "2",
				ratePrecision: "2",
				calculateUsingTotalDays: true,
				rateOfDepreciation: "",
				shiftAllocations: JSON.stringify([
					{ periodIndex: 0, shift: "Day:Night", factor: 1 },
					{ periodIndex: 1, shift: "Night,Weekend", factor: 2 },
					{ periodIndex: 2, shift: "Two Shifts", factor: 1 },
				]),
				expectedValueAfterUsefulLife: "0",
				openingAccumulatedDepreciation: "0",
				openingNumberOfBookedDepreciations: "0",
				manualEntriesText: "",
			},
		],
	};

	beforeEach(() => {
		currentId = null;
		initialCategoryId = null;
		categoryItems = mockCategories;
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

	it("rejects unsupported finance-book option combinations before submission", () => {
		const totalDaysWithoutDailyProrata = assetFormSchema.safeParse({
			...validFormValues,
			financeBooks: [
				{
					...validFormValues.financeBooks[0],
					dailyProrataBased: false,
				},
			],
		});
		expect(totalDaysWithoutDailyProrata.success).toBe(false);

		const inertRateForStraightLine = assetFormSchema.safeParse({
			...validFormValues,
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: "3",
			frequencyOfDepreciation: "1",
			financeBooks: [
				{
					...validFormValues.financeBooks[0],
					rateOfDepreciation: "20",
				},
			],
		});
		expect(inertRateForStraightLine.success).toBe(false);
		for (const depreciationMethod of [
			"STRAIGHT_LINE",
			"DOUBLE_DECLINING_BALANCE",
			"MANUAL",
		] as const) {
			const inertRate = assetFormSchema.safeParse({
				...validFormValues,
				depreciationMethod,
				totalNumberOfDepreciations: "3",
				frequencyOfDepreciation: "1",
				financeBooks: [
					{
						...validFormValues.financeBooks[0],
						depreciationMethod,
						dailyProrataBased: false,
						shiftBased: false,
						calculateUsingTotalDays: false,
						rateOfDepreciation: "20",
						shiftAllocations: "",
					},
				],
			});
			expect(inertRate.success).toBe(false);
		}

		const writtenDownValueRate = assetFormSchema.safeParse({
			...validFormValues,
			depreciationMethod: "WRITTEN_DOWN_VALUE",
			totalNumberOfDepreciations: "3",
			frequencyOfDepreciation: "1",
			financeBooks: [
				{
					...validFormValues.financeBooks[0],
					depreciationMethod: "WRITTEN_DOWN_VALUE",
					dailyProrataBased: false,
					shiftBased: false,
					calculateUsingTotalDays: false,
					rateOfDepreciation: "20",
					shiftAllocations: "",
				},
			],
		});
		expect(writtenDownValueRate.success).toBe(true);

		const allocationsWithoutShiftMode = assetFormSchema.safeParse({
			...validFormValues,
			financeBooks: [
				{
					...validFormValues.financeBooks[0],
					shiftBased: false,
				},
			],
		});
		expect(allocationsWithoutShiftMode.success).toBe(false);

		const malformedAllocation = assetFormSchema.safeParse({
			...validFormValues,
			financeBooks: [
				{
					...validFormValues.financeBooks[0],
					shiftAllocations: '{"periodIndex":0,"shift":"DAY","factor":1}',
				},
			],
		});
		expect(malformedAllocation.success).toBe(false);
	});

	it("rejects an unknown asset type instead of forwarding it", () => {
		const result = assetFormSchema.safeParse({
			...validFormValues,
			assetType: "UNSUPPORTED_ASSET_TYPE",
		});
		expect(result.success).toBe(false);
	});

	it("accepts blank optional DateOnly fields and preserves canonical dates", () => {
		const blankDates = assetFormSchema.safeParse({
			...validFormValues,
			calculateDepreciation: false,
			financeBooks: [],
			purchaseDate: "",
			availableForUseDate: "",
			insuranceStartDate: "",
			insuranceEndDate: "",
			depreciationStartDate: "",
		});

		expect(blankDates.success).toBe(true);

		const canonicalDates = assetFormSchema.safeParse({
			...validFormValues,
			calculateDepreciation: false,
			financeBooks: [],
			purchaseDate: "2026-08-10",
			availableForUseDate: "2026-08-10",
			insuranceStartDate: "2026-08-01",
			insuranceEndDate: "2026-08-31",
			depreciationStartDate: "2026-08-31",
		});

		expect(canonicalDates.success).toBe(true);
		if (canonicalDates.success) {
			expect(canonicalDates.data).toEqual(
				expect.objectContaining({
					purchaseDate: "2026-08-10",
					availableForUseDate: "2026-08-10",
					insuranceStartDate: "2026-08-01",
					insuranceEndDate: "2026-08-31",
					depreciationStartDate: "2026-08-31",
				}),
			);
		}
	});

	it("matches the shared purchase and available-for-use date ordering", () => {
		const result = assetFormSchema.safeParse({
			...validFormValues,
			purchaseDate: "2026-08-31",
			availableForUseDate: "2026-08-10",
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: ["availableForUseDate"],
					message: "Available for use date must be on or after purchase date",
				}),
			]),
		);
	});

	it("matches the backend depreciation start ordering", () => {
		const result = assetFormSchema.safeParse({
			...validFormValues,
			purchaseDate: "2026-08-10",
			availableForUseDate: "2026-08-31",
			depreciationStartDate: "2026-08-30",
		});

		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: ["depreciationStartDate"],
					message: "Must be on or after available for use date",
				}),
			]),
		);
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

	it("keeps create category defaults clean until a user edits the form", async () => {
		initialCategoryId = mockCategories[0].id;
		renderWithProviders(<AssetFormPage />);

		await waitFor(() => {
			expect(screen.getByText("Vehicles")).toBeInTheDocument();
		});
		expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();

		await userEvent
			.setup()
			.click(screen.getByRole("checkbox", { name: /Calculate Depreciation/i }));
		await waitFor(() => {
			expect(screen.getByLabelText(/Depreciation Method/i)).toHaveTextContent(
				"Straight Line",
			);
		});
	});

	it("keeps a user override after defaults in the dirty payload", async () => {
		initialCategoryId = mockCategories[0].id;
		const user = userEvent.setup();
		renderWithProviders(<AssetFormPage />);

		await user.type(screen.getByLabelText(/Asset Name/i), "Defaulted Asset");
		await user.click(screen.getByRole("button", { name: /company/i }));
		await user.click(await screen.findByText("Test Company"));

		await user.click(
			screen.getByRole("checkbox", { name: /Calculate Depreciation/i }),
		);
		await waitFor(() =>
			expect(
				screen.getByLabelText(/Total Number of Depreciations/i),
			).toHaveValue(60),
		);
		await user.clear(screen.getByLabelText(/Total Number of Depreciations/i));
		await user.type(
			screen.getByLabelText(/Total Number of Depreciations/i),
			"48",
		);

		expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /Create Asset/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({ totalNumberOfDepreciations: 48 }),
			);
		});
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
					companyId: "cm1234567890123456789012",
					calculateDepreciation: true,
				}),
			);
		});
	});

	it("submits the typed asset type and every supported finance-book control", async () => {
		const user = userEvent.setup();
		renderWithProviders(<AssetFormPage />);

		await user.type(
			screen.getByLabelText(/Asset Name/i),
			"Composite Component",
		);
		await user.click(screen.getByRole("button", { name: /company/i }));
		await user.click(await screen.findByText("Test Company"));
		fireEvent.change(screen.getByLabelText(/Purchase Date/i), {
			target: { value: "2026-08-10" },
		});
		fireEvent.change(screen.getByLabelText(/Available For Use/i), {
			target: { value: "2026-08-10" },
		});

		await user.selectOptions(
			screen.getByRole("combobox", { name: /Asset Type/i }),
			"COMPOSITE_COMPONENT",
		);

		await user.click(
			screen.getByRole("checkbox", { name: /Calculate Depreciation/i }),
		);
		await waitFor(() =>
			expect(screen.getByText(/Depreciation Details/i)).toBeInTheDocument(),
		);
		await user.click(screen.getByRole("button", { name: /Add Book/i }));

		await user.click(
			screen.getByRole("checkbox", { name: /Daily Prorata Based/i }),
		);
		await user.click(screen.getByRole("checkbox", { name: /Shift Based/i }));
		await user.click(
			screen.getByRole("checkbox", { name: /Calculate Using Total Days/i }),
		);
		await user.clear(screen.getByLabelText(/Periods/i));
		await user.type(screen.getByLabelText(/Periods/i), "3");
		await user.clear(screen.getByLabelText(/Currency Precision/i));
		await user.type(screen.getByLabelText(/Currency Precision/i), "3");
		await user.clear(screen.getByLabelText(/Rate Precision/i));
		await user.type(screen.getByLabelText(/Rate Precision/i), "4");
		fireEvent.change(screen.getByLabelText(/Shift Allocations/i), {
			target: {
				value: JSON.stringify([
					{ periodIndex: 0, shift: "Day:Night", factor: 1 },
					{ periodIndex: 1, shift: "Night,Weekend", factor: 2 },
					{ periodIndex: 2, shift: "Two Shifts", factor: 1 },
				]),
			},
		});

		await user.click(screen.getByRole("button", { name: /Create Asset/i }));

		await waitFor(() => {
			expect(mockCreateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					assetType: "COMPOSITE_COMPONENT",
					financeBooks: [
						expect.objectContaining({
							totalNumberOfDepreciations: 3,
							frequencyOfDepreciation: 1,
							depreciationStartDate: "2026-08-31",
							dailyProrataBased: true,
							shiftBased: true,
							precision: 3,
							ratePrecision: 4,
							calculateUsingTotalDays: true,
							rateOfDepreciation: null,
							expectedValueAfterUsefulLife: 0,
							openingAccumulatedDepreciation: 0,
							openingNumberOfBookedDepreciations: 0,
							shiftAllocations: [
								{ periodIndex: 0, shift: "Day:Night", factor: 1 },
								{ periodIndex: 1, shift: "Night,Weekend", factor: 2 },
								{ periodIndex: 2, shift: "Two Shifts", factor: 1 },
							],
						}),
					],
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

	it("hydrates and sends persisted asset type and finance-book controls on a draft edit", async () => {
		currentId = existingAsset.id;
		renderWithProviders(<AssetFormPage />);

		await waitFor(() =>
			expect(screen.getByDisplayValue("Company Vehicle")).toBeInTheDocument(),
		);
		expect(
			screen.getByRole("combobox", { name: /Asset Type/i }),
		).toHaveTextContent("Composite Component");
		await waitFor(() =>
			expect(screen.getByText(/Depreciation Details/i)).toBeInTheDocument(),
		);
		expect(screen.getByLabelText(/Daily Prorata Based/i)).toBeChecked();
		expect(screen.getByLabelText(/Shift Based/i)).toBeChecked();
		expect(screen.getByLabelText(/Calculate Using Total Days/i)).toBeChecked();
		expect(screen.getByLabelText(/Depreciation Start Date/i)).toHaveValue(
			"2026-03-15",
		);
		expect(screen.getByLabelText(/Currency Precision/i)).toHaveValue(3);
		expect(screen.getByLabelText(/Rate Precision/i)).toHaveValue(4);
		expect(
			screen.queryByLabelText(/Rate of Depreciation/i),
		).not.toBeInTheDocument();
		expect(screen.getByLabelText(/Shift Allocations/i)).toHaveValue(
			JSON.stringify([
				{ periodIndex: 0, shift: "Day:Night", factor: 1 },
				{ periodIndex: 1, shift: "Night,Weekend", factor: 2 },
				{ periodIndex: 2, shift: "Two Shifts", factor: 1 },
			]),
		);

		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: /Update Asset/i }));
		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					assetType: "COMPOSITE_COMPONENT",
					financeBooks: [
						expect.objectContaining({
							totalNumberOfDepreciations: 3,
							frequencyOfDepreciation: 12,
							depreciationStartDate: "2026-02-28",
							dailyProrataBased: true,
							shiftBased: true,
							precision: 3,
							ratePrecision: 4,
							calculateUsingTotalDays: true,
							rateOfDepreciation: null,
							expectedValueAfterUsefulLife: 5000,
							openingAccumulatedDepreciation: 0,
							openingNumberOfBookedDepreciations: 0,
							shiftAllocations: [
								{ periodIndex: 0, shift: "Day:Night", factor: 1 },
								{ periodIndex: 1, shift: "Night,Weekend", factor: 2 },
								{ periodIndex: 2, shift: "Two Shifts", factor: 1 },
							],
						}),
					],
				}),
			);
		});
	});

	it("preserves clean persisted edit values when the category arrives late", async () => {
		currentId = existingAsset.id;
		categoryItems = [];
		const view = renderWithProviders(<AssetFormPage />);

		await waitFor(() =>
			expect(screen.getByDisplayValue("Company Vehicle")).toBeInTheDocument(),
		);
		await waitFor(() =>
			expect(screen.getByText(/Depreciation Details/i)).toBeInTheDocument(),
		);
		expect(screen.getByLabelText(/Depreciation Method/i)).toHaveTextContent(
			"Straight Line",
		);
		expect(screen.getByLabelText(/Total Number of Depreciations/i)).toHaveValue(
			60,
		);
		expect(screen.getByLabelText(/Frequency of Depreciation/i)).toHaveValue(12);
		expect(
			screen.getByLabelText(/Expected Value After Useful Life/i),
		).toHaveValue(4500);
		expect(screen.getByLabelText(/Daily Prorata Based/i)).toBeChecked();
		expect(screen.getByLabelText(/Shift Based/i)).toBeChecked();
		expect(screen.getByLabelText(/Currency Precision/i)).toHaveValue(3);
		expect(screen.getByLabelText(/Rate Precision/i)).toHaveValue(4);
		expect(screen.getByLabelText(/Shift Allocations/i)).toHaveValue(
			JSON.stringify([
				{ periodIndex: 0, shift: "Day:Night", factor: 1 },
				{ periodIndex: 1, shift: "Night,Weekend", factor: 2 },
				{ periodIndex: 2, shift: "Two Shifts", factor: 1 },
			]),
		);
		expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();

		categoryItems = [
			{
				...mockCategories[0],
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				totalNumberOfDepreciations: 999,
				frequencyOfDepreciation: 99,
				expectedValueAfterUsefulLife: 1,
			},
		];
		view.rerender(<AssetFormPage />);

		await waitFor(() =>
			expect(screen.getByLabelText(/Depreciation Method/i)).toHaveTextContent(
				"Straight Line",
			),
		);
		expect(screen.getByLabelText(/Total Number of Depreciations/i)).toHaveValue(
			60,
		);
		expect(screen.getByLabelText(/Frequency of Depreciation/i)).toHaveValue(12);
		expect(
			screen.getByLabelText(/Expected Value After Useful Life/i),
		).toHaveValue(4500);
		expect(screen.getByLabelText(/Daily Prorata Based/i)).toBeChecked();
		expect(screen.getByLabelText(/Shift Based/i)).toBeChecked();
		expect(screen.getByLabelText(/Currency Precision/i)).toHaveValue(3);
		expect(screen.getByLabelText(/Rate Precision/i)).toHaveValue(4);
		expect(
			screen.queryByLabelText(/Rate of Depreciation/i),
		).not.toBeInTheDocument();
		expect(screen.getByLabelText(/Shift Allocations/i)).toHaveValue(
			JSON.stringify([
				{ periodIndex: 0, shift: "Day:Night", factor: 1 },
				{ periodIndex: 1, shift: "Night,Weekend", factor: 2 },
				{ periodIndex: 2, shift: "Two Shifts", factor: 1 },
			]),
		);
		expect(screen.queryByText("Unsaved Changes")).not.toBeInTheDocument();

		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: /Update Asset/i }));
		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 60,
					frequencyOfDepreciation: 12,
					expectedValueAfterUsefulLife: 4500,
				}),
			);
		});
	});

	it("does not send lifecycle-critical fields for a submitted edit", async () => {
		currentId = submittedAsset.id;
		renderWithProviders(<AssetFormPage />);

		await waitFor(() =>
			expect(screen.getByDisplayValue("Company Vehicle")).toBeInTheDocument(),
		);
		expect(
			screen.getByRole("combobox", { name: /Asset Type/i }),
		).toBeDisabled();
		await waitFor(() =>
			expect(screen.getByLabelText(/Daily Prorata Based/i)).toBeDisabled(),
		);

		await userEvent
			.setup()
			.click(screen.getByRole("button", { name: /Update Asset/i }));
		await waitFor(() => expect(mockUpdateMutate).toHaveBeenCalled());
		const [payload] = mockUpdateMutate.mock.calls.at(-1) as [
			Record<string, unknown>,
		];
		expect(payload).not.toHaveProperty("assetType");
		expect(payload).not.toHaveProperty("financeBooks");
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
					companyId: "cm1234567890123456789012",
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
