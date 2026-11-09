import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test/utils";
import StockSettingsPage from "./page";

const mockUpdateMutate = vi.fn();
const mockInvalidate = vi.fn().mockResolvedValue(undefined);

const mockSettings = {
	id: "clh123stocksettings0000",
	itemNamingBy: "ITEM_CODE" as const,
	defaultWarehouse: "Stores - GH",
	defaultValuationMethod: "FIFO" as const,
	defaultStockUom: "Nos",
	autoInsertItemPriceIfMissing: false,
	updateExistingPriceListRate: false,
	allowToEditStockUomQtyForSalesDocuments: false,
	allowToEditStockUomQtyForPurchaseDocuments: false,
	overDeliveryReceiptAllowancePercent: 0,
	allowNegativeStock: false,
	showBarcodeFieldInStockTransactions: false,
	convertItemDescriptionToCleanHtmlInTransactions: false,
	overTransferAllowancePercent: 0,
	allowInternalTransfersAtArmsLengthPrice: false,
	overPickingAllowancePercent: 0,
	actionIfQualityInspectionIsNotSubmitted: "STOP" as const,
	actionIfQualityInspectionIsRejected: "STOP" as const,
	enableStockReservation: false,
	allowPartialReservation: false,
	autoReserveStockForSalesOrderOnPurchase: false,
	autoReserveSerialAndBatchNos: false,
	autoCreateSerialAndBatchBundleForOutward: false,
	disableSerialNoAndBatchSelector: false,
	haveDefaultNamingSeriesForBatchId: false,
	pickSerialBatchBasedOn: "FIFO" as const,
	useSerialBatchFields: false,
	doNotUpdateSerialBatchOnCreationOfAutoBundle: false,
	allowExistingSerialNoToBeManufacturedReceivedAgain: false,
	setSerialAndBatchBundleNamingBasedOnNamingSeries: false,
	raiseMaterialRequestWhenStockReachesReorderLevel: false,
	notifyByEmailOnCreationOfAutomaticMaterialRequest: false,
	allowMaterialTransferFromDeliveryNoteToSalesInvoice: false,
	allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: false,
	freezeStocksOlderThanDays: 60,
	createdAt: new Date("2026-03-01T00:00:00.000Z"),
	updatedAt: new Date("2026-03-02T00:00:00.000Z"),
};

vi.mock("@/lib/trpc", () => ({
	trpc: {
		useUtils: () => ({
			inventory: {
				getStockSettings: {
					invalidate: mockInvalidate,
				},
			},
		}),
		inventory: {
			getStockSettings: {
				useQuery: () => ({
					data: mockSettings,
					isLoading: false,
					error: null,
					refetch: vi.fn(),
				}),
			},
			listUnitsOfMeasure: {
				useQuery: () => ({
					data: [
						{ id: "uom-1", name: "Nos", disabled: false },
						{ id: "uom-2", name: "Kg", disabled: false },
					],
				}),
			},
			updateStockSettings: {
				useMutation: () => ({
					isPending: false,
					mutate: mockUpdateMutate,
				}),
			},
		},
	},
}));

describe("StockSettingsPage", () => {
	beforeEach(() => {
		mockUpdateMutate.mockClear();
		mockInvalidate.mockClear();
	});

	it("renders the tabbed stock settings editor with fetched values", async () => {
		renderWithProviders(<StockSettingsPage />);

		expect(screen.getByText("Stock Settings")).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Defaults" })).toBeInTheDocument();
		expect(
			screen.getByRole("tab", { name: "Stock Validations" }),
		).toBeInTheDocument();
		expect(screen.getByDisplayValue("Stores - GH")).toBeInTheDocument();
		expect(screen.getByDisplayValue("Nos")).toBeInTheDocument();
	});

	it("submits the normalized stock settings payload", async () => {
		const user = userEvent.setup();
		renderWithProviders(<StockSettingsPage />);

		const defaultWarehouse = screen.getByLabelText("Default Warehouse");
		await user.clear(defaultWarehouse);
		await user.type(defaultWarehouse, " Stores - Secondary ");

		const defaultStockUom = screen.getByLabelText("Default Stock UOM");
		await user.selectOptions(defaultStockUom, "");

		await user.click(screen.getByRole("tab", { name: "Stock Validations" }));
		await user.click(screen.getByLabelText("Allow Negative Stock"));
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => {
			expect(mockUpdateMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					defaultWarehouse: "Stores - Secondary",
					defaultStockUom: null,
					allowNegativeStock: true,
					defaultValuationMethod: "FIFO",
					freezeStocksOlderThanDays: 60,
				}),
			);
		});
	});
});
