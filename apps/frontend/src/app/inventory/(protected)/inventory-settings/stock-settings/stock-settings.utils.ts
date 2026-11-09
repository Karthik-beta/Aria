import type { Inventory } from "@aria/types";
import type { StockSettingsFormValues } from "./stock-settings.schema";

type StockSettingsFormSource = Inventory.UpdateStockSettingsInput & {
	id?: string;
	createdAt?: Date | string;
	updatedAt?: Date | string;
};

export const STOCK_SETTINGS_TABS = [
	{ value: "defaults", label: "Defaults" },
	{ value: "stock-validations", label: "Stock Validations" },
	{ value: "stock-reservation", label: "Stock Reservation" },
	{ value: "serial-batch-item", label: "Serial & Batch Item" },
	{ value: "stock-planning", label: "Stock Planning" },
	{ value: "stock-closing", label: "Stock Closing" },
] as const;

function normalizeOptionalText(value?: string | null): string | null {
	const normalized = value?.trim() ?? "";
	return normalized.length > 0 ? normalized : null;
}

export function createStockSettingsFormValues(
	settings?: StockSettingsFormSource | null,
): StockSettingsFormValues {
	return {
		itemNamingBy: settings?.itemNamingBy ?? "ITEM_CODE",
		defaultWarehouse: settings?.defaultWarehouse ?? "",
		defaultValuationMethod: settings?.defaultValuationMethod ?? "FIFO",
		defaultStockUom: settings?.defaultStockUom ?? "",
		autoInsertItemPriceIfMissing:
			settings?.autoInsertItemPriceIfMissing ?? false,
		updateExistingPriceListRate: settings?.updateExistingPriceListRate ?? false,
		allowToEditStockUomQtyForSalesDocuments:
			settings?.allowToEditStockUomQtyForSalesDocuments ?? false,
		allowToEditStockUomQtyForPurchaseDocuments:
			settings?.allowToEditStockUomQtyForPurchaseDocuments ?? false,
		overDeliveryReceiptAllowancePercent:
			settings?.overDeliveryReceiptAllowancePercent ?? 0,
		allowNegativeStock: settings?.allowNegativeStock ?? false,
		showBarcodeFieldInStockTransactions:
			settings?.showBarcodeFieldInStockTransactions ?? false,
		convertItemDescriptionToCleanHtmlInTransactions:
			settings?.convertItemDescriptionToCleanHtmlInTransactions ?? false,
		overTransferAllowancePercent: settings?.overTransferAllowancePercent ?? 0,
		allowInternalTransfersAtArmsLengthPrice:
			settings?.allowInternalTransfersAtArmsLengthPrice ?? false,
		overPickingAllowancePercent: settings?.overPickingAllowancePercent ?? 0,
		actionIfQualityInspectionIsNotSubmitted:
			settings?.actionIfQualityInspectionIsNotSubmitted ?? "STOP",
		actionIfQualityInspectionIsRejected:
			settings?.actionIfQualityInspectionIsRejected ?? "STOP",
		enableStockReservation: settings?.enableStockReservation ?? false,
		allowPartialReservation: settings?.allowPartialReservation ?? false,
		autoReserveStockForSalesOrderOnPurchase:
			settings?.autoReserveStockForSalesOrderOnPurchase ?? false,
		autoReserveSerialAndBatchNos:
			settings?.autoReserveSerialAndBatchNos ?? false,
		autoCreateSerialAndBatchBundleForOutward:
			settings?.autoCreateSerialAndBatchBundleForOutward ?? false,
		disableSerialNoAndBatchSelector:
			settings?.disableSerialNoAndBatchSelector ?? false,
		haveDefaultNamingSeriesForBatchId:
			settings?.haveDefaultNamingSeriesForBatchId ?? false,
		pickSerialBatchBasedOn: settings?.pickSerialBatchBasedOn ?? "FIFO",
		useSerialBatchFields: settings?.useSerialBatchFields ?? false,
		doNotUpdateSerialBatchOnCreationOfAutoBundle:
			settings?.doNotUpdateSerialBatchOnCreationOfAutoBundle ?? false,
		allowExistingSerialNoToBeManufacturedReceivedAgain:
			settings?.allowExistingSerialNoToBeManufacturedReceivedAgain ?? false,
		setSerialAndBatchBundleNamingBasedOnNamingSeries:
			settings?.setSerialAndBatchBundleNamingBasedOnNamingSeries ?? false,
		raiseMaterialRequestWhenStockReachesReorderLevel:
			settings?.raiseMaterialRequestWhenStockReachesReorderLevel ?? false,
		notifyByEmailOnCreationOfAutomaticMaterialRequest:
			settings?.notifyByEmailOnCreationOfAutomaticMaterialRequest ?? false,
		allowMaterialTransferFromDeliveryNoteToSalesInvoice:
			settings?.allowMaterialTransferFromDeliveryNoteToSalesInvoice ?? false,
		allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice:
			settings?.allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice ??
			false,
		freezeStocksOlderThanDays: settings?.freezeStocksOlderThanDays ?? 60,
	};
}

export function buildStockSettingsMutationInput(
	values: StockSettingsFormValues,
): Inventory.UpdateStockSettingsInput {
	return {
		itemNamingBy: values.itemNamingBy,
		defaultWarehouse: normalizeOptionalText(values.defaultWarehouse),
		defaultValuationMethod: values.defaultValuationMethod,
		defaultStockUom: normalizeOptionalText(values.defaultStockUom),
		autoInsertItemPriceIfMissing: values.autoInsertItemPriceIfMissing,
		updateExistingPriceListRate: values.updateExistingPriceListRate,
		allowToEditStockUomQtyForSalesDocuments:
			values.allowToEditStockUomQtyForSalesDocuments,
		allowToEditStockUomQtyForPurchaseDocuments:
			values.allowToEditStockUomQtyForPurchaseDocuments,
		overDeliveryReceiptAllowancePercent:
			values.overDeliveryReceiptAllowancePercent,
		allowNegativeStock: values.allowNegativeStock,
		showBarcodeFieldInStockTransactions:
			values.showBarcodeFieldInStockTransactions,
		convertItemDescriptionToCleanHtmlInTransactions:
			values.convertItemDescriptionToCleanHtmlInTransactions,
		overTransferAllowancePercent: values.overTransferAllowancePercent,
		allowInternalTransfersAtArmsLengthPrice:
			values.allowInternalTransfersAtArmsLengthPrice,
		overPickingAllowancePercent: values.overPickingAllowancePercent,
		actionIfQualityInspectionIsNotSubmitted:
			values.actionIfQualityInspectionIsNotSubmitted,
		actionIfQualityInspectionIsRejected:
			values.actionIfQualityInspectionIsRejected,
		enableStockReservation: values.enableStockReservation,
		allowPartialReservation: values.allowPartialReservation,
		autoReserveStockForSalesOrderOnPurchase:
			values.autoReserveStockForSalesOrderOnPurchase,
		autoReserveSerialAndBatchNos: values.autoReserveSerialAndBatchNos,
		autoCreateSerialAndBatchBundleForOutward:
			values.autoCreateSerialAndBatchBundleForOutward,
		disableSerialNoAndBatchSelector: values.disableSerialNoAndBatchSelector,
		haveDefaultNamingSeriesForBatchId: values.haveDefaultNamingSeriesForBatchId,
		pickSerialBatchBasedOn: values.pickSerialBatchBasedOn,
		useSerialBatchFields: values.useSerialBatchFields,
		doNotUpdateSerialBatchOnCreationOfAutoBundle:
			values.doNotUpdateSerialBatchOnCreationOfAutoBundle,
		allowExistingSerialNoToBeManufacturedReceivedAgain:
			values.allowExistingSerialNoToBeManufacturedReceivedAgain,
		setSerialAndBatchBundleNamingBasedOnNamingSeries:
			values.setSerialAndBatchBundleNamingBasedOnNamingSeries,
		raiseMaterialRequestWhenStockReachesReorderLevel:
			values.raiseMaterialRequestWhenStockReachesReorderLevel,
		notifyByEmailOnCreationOfAutomaticMaterialRequest:
			values.notifyByEmailOnCreationOfAutomaticMaterialRequest,
		allowMaterialTransferFromDeliveryNoteToSalesInvoice:
			values.allowMaterialTransferFromDeliveryNoteToSalesInvoice,
		allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice:
			values.allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice,
		freezeStocksOlderThanDays: values.freezeStocksOlderThanDays,
	};
}
