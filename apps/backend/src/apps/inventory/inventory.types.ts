import { Inventory } from "@aria/types";
import type { Prisma } from "../../generated/prisma/client";

/**
 * Prisma model type for InventoryItem with optional relations
 */
export type InventoryItem = Prisma.InventoryItemGetPayload<{
	include: {
		itemGroup: true;
		barcodes: true;
		reorderSettings: true;
	};
}>;

/**
 * Prisma model type for ItemGroup with relations
 */
export type InventoryItemGroup = Prisma.ItemGroupGetPayload<{
	include: {
		parentItemGroup: {
			select: { groupName: true };
		};
		defaults: true;
	};
}>;

/**
 * Prisma model type for ProductBundle with relations
 */
export type InventoryProductBundle = Prisma.ProductBundleGetPayload<{
	include: {
		parentItem: {
			select: { id: true; name: true };
		};
		bundleItems: {
			include: {
				item: {
					select: { id: true; name: true };
				};
				unitOfMeasurement: {
					select: { id: true; name: true };
				};
			};
		};
	};
}>;

/**
 * Prisma model type for ShippingRule
 */
export type InventoryShippingRule = Prisma.ShippingRuleGetPayload<{
	select: {
		id: true;
		shippingRuleLabel: true;
		shippingRuleType: true;
		disabled: true;
		calculateBasedOn: true;
		shippingAmount: true;
		createdAt: true;
		updatedAt: true;
	};
}>;

/**
 * Prisma model type for Brand with scalar fields only
 */
export type InventoryBrand = Prisma.BrandGetPayload<{
	select: {
		id: true;
		name: true;
		description: true;
		createdAt: true;
		updatedAt: true;
	};
}>;

/**
 * Prisma model type for ItemAttribute with nested attribute values.
 * Values are ordered by position ascending.
 */
export type InventoryItemAttribute = Prisma.ItemAttributeGetPayload<{
	select: {
		id: true;
		name: true;
		disabled: true;
		numericValues: true;
		fromRange: true;
		toRange: true;
		increment: true;
		createdAt: true;
		updatedAt: true;
		attributeValues: {
			select: {
				id: true;
				attributeId: true;
				attributeValue: true;
				abbreviation: true;
				position: true;
				createdAt: true;
				updatedAt: true;
			};
			orderBy: { position: "asc" };
		};
	};
}>;

/**
 * Prisma model type for UnitOfMeasurement with scalar fields only
 */
export type InventoryUnitOfMeasure = Prisma.UnitOfMeasurementGetPayload<{
	select: {
		id: true;
		name: true;
		disabled: true;
		isWholeNumber: true;
		createdAt: true;
		updatedAt: true;
	};
}>;

/**
 * Prisma model type for Warehouse with related display names.
 */
export type InventoryWarehouse = Prisma.WarehouseGetPayload<{
	select: {
		id: true;
		name: true;
		disabled: true;
		isGroupWarehouse: true;
		parentWarehouseId: true;
		company: true;
		isRejectedWarehouse: true;
		phoneNo: true;
		mobileNo: true;
		addressLine1: true;
		addressLine2: true;
		city: true;
		state: true;
		pin: true;
		warehouseType: true;
		defaultInTransitWarehouseId: true;
		createdAt: true;
		updatedAt: true;
		parentWarehouse: {
			select: {
				id: true;
				name: true;
			};
		};
		defaultInTransitWarehouse: {
			select: {
				id: true;
				name: true;
			};
		};
	};
}>;

export interface InventoryBatch {
	id: string;
	batchId: string;
	itemId: string;
	company: string;
	currentWarehouseId: string | null;
	purchaseReceiptId: string | null;
	deliveryNoteId: string | null;
	stockEntryId: string | null;
	useBatchWiseValuation: boolean;
	manufacturingDate: Date | null;
	expiryDate: Date | null;
	description: string | null;
	quantity: number;
	isDisabled: boolean;
	createdAt: Date;
	updatedAt: Date;
	item: {
		id: string;
		code: string;
		name: string;
	};
	currentWarehouse?: {
		id: string;
		name: string;
	} | null;
	purchaseReceipt?: {
		id: string;
		series: string;
	} | null;
	deliveryNote?: {
		id: string;
		series: string;
	} | null;
	stockEntry?: {
		id: string;
		series: string;
	} | null;
}

/**
 * Prisma model type for SerialNo with display relations and ordered history.
 */
export type InventorySerialNo = Prisma.SerialNoGetPayload<{
	include: {
		item: {
			select: {
				id: true;
				code: true;
				name: true;
			};
		};
		currentWarehouse: {
			select: {
				id: true;
				name: true;
			};
		};
		purchaseReceipt: {
			select: {
				id: true;
				series: true;
			};
		};
		deliveryNote: {
			select: {
				id: true;
				series: true;
			};
		};
		stockEntry: {
			select: {
				id: true;
				series: true;
			};
		};
		pickList: {
			select: {
				id: true;
				series: true;
			};
		};
		history: {
			include: {
				warehouse: {
					select: {
						id: true;
						name: true;
					};
				};
			};
			orderBy: {
				createdAt: "desc";
			};
		};
	};
}>;

/**
 * Prisma model type for InstallationNote with header links and row relations.
 */
export type InventoryInstallationNote = Prisma.InstallationNoteGetPayload<{
	include: {
		deliveryNote: {
			select: {
				id: true;
				series: true;
			};
		};
		items: {
			include: {
				item: {
					select: {
						id: true;
						code: true;
						name: true;
					};
				};
				serialNo: {
					select: {
						id: true;
						serialNo: true;
					};
				};
			};
			orderBy: {
				id: "asc";
			};
		};
	};
}>;

/**
 * Prisma model type for singleton StockSettings.
 */
export type InventoryStockSettings = Prisma.StockSettingsGetPayload<{
	select: {
		id: true;
		itemNamingBy: true;
		defaultWarehouse: true;
		defaultValuationMethod: true;
		defaultStockUom: true;
		autoInsertItemPriceIfMissing: true;
		updateExistingPriceListRate: true;
		allowToEditStockUomQtyForSalesDocuments: true;
		allowToEditStockUomQtyForPurchaseDocuments: true;
		overDeliveryReceiptAllowancePercent: true;
		allowNegativeStock: true;
		showBarcodeFieldInStockTransactions: true;
		convertItemDescriptionToCleanHtmlInTransactions: true;
		overTransferAllowancePercent: true;
		allowInternalTransfersAtArmsLengthPrice: true;
		overPickingAllowancePercent: true;
		actionIfQualityInspectionIsNotSubmitted: true;
		actionIfQualityInspectionIsRejected: true;
		enableStockReservation: true;
		allowPartialReservation: true;
		autoReserveStockForSalesOrderOnPurchase: true;
		autoReserveSerialAndBatchNos: true;
		autoCreateSerialAndBatchBundleForOutward: true;
		disableSerialNoAndBatchSelector: true;
		haveDefaultNamingSeriesForBatchId: true;
		pickSerialBatchBasedOn: true;
		useSerialBatchFields: true;
		doNotUpdateSerialBatchOnCreationOfAutoBundle: true;
		allowExistingSerialNoToBeManufacturedReceivedAgain: true;
		setSerialAndBatchBundleNamingBasedOnNamingSeries: true;
		raiseMaterialRequestWhenStockReachesReorderLevel: true;
		notifyByEmailOnCreationOfAutomaticMaterialRequest: true;
		allowMaterialTransferFromDeliveryNoteToSalesInvoice: true;
		allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: true;
		freezeStocksOlderThanDays: true;
		createdAt: true;
		updatedAt: true;
	};
}>;

/**
 * Prisma model type for singleton ItemVariantSettings with ordered child rows.
 */
export type InventoryItemVariantSettings =
	Prisma.ItemVariantSettingsGetPayload<{
		select: {
			id: true;
			doNotUpdateVariantsOnSave: true;
			allowRenameAttributeValue: true;
			createdAt: true;
			updatedAt: true;
			copyFields: {
				select: {
					id: true;
					fieldKey: true;
					position: true;
				};
			};
		};
	}>;

/**
 * Prisma model type for ItemAlternate with relations
 */
export const itemAlternativeInclude = {
	item: {
		select: {
			id: true,
			name: true,
			code: true,
		},
	},
	alternateItem: {
		select: {
			id: true,
			name: true,
			code: true,
		},
	},
} as const satisfies Prisma.ItemAlternateInclude;

/**
 * Prisma model type for ItemAlternate with relations
 */
export type InventoryItemAlternative = Prisma.ItemAlternateGetPayload<{
	include: typeof itemAlternativeInclude;
}>;

/**
 * Prisma model type for ItemManufacturer with item relation
 */
export type InventoryItemManufacturer = Prisma.ItemManufacturerGetPayload<{
	include: {
		item: {
			select: {
				id: true;
				code: true;
				name: true;
				description: true;
			};
		};
	};
}>;

/**
 * Converts a Prisma ItemGroup to Inventory.ItemGroup
 */
export function toInventoryItemGroup(
	prismaGroup: InventoryItemGroup,
): Inventory.ItemGroup {
	return {
		id: prismaGroup.id,
		groupName: prismaGroup.groupName,
		parentId: prismaGroup.parentId,
		parentGroupName: prismaGroup.parentItemGroup?.groupName ?? null,
		isGroup: prismaGroup.isGroup,
		defaults: prismaGroup.defaults.map((d) => ({
			id: d.id,
			company: d.company,
			defaultWarehouse: d.defaultWarehouse,
			defaultPriceList: d.defaultPriceList,
		})),
		createdAt: prismaGroup.createdAt,
		updatedAt: prismaGroup.updatedAt,
	};
}

/**
 * Converts a Prisma InventoryItem to Inventory.Item
 * This ensures type safety when mapping database models to API types
 */
export function toInventoryItem(prismaItem: InventoryItem): Inventory.Item {
	return {
		id: prismaItem.id,
		name: prismaItem.name,
		code: prismaItem.code,
		quantity: prismaItem.quantity,
		description: prismaItem.description,
		disabled: prismaItem.disabled,
		maintainStock: prismaItem.maintainStock,
		allowAlternateItem: prismaItem.allowAlternateItem,
		hasVariants: prismaItem.hasVariants,
		openingStock: prismaItem.openingStock,
		valuationRate: prismaItem.valuationRate,
		standardSellingRate: prismaItem.standardSellingRate,
		isZeroRated: prismaItem.isZeroRated,
		isExempt: prismaItem.isExempt,
		isFixedAsset: prismaItem.isFixedAsset,
		taxCode: prismaItem.taxCode,

		// Inventory Settings
		shelfLifeInDays: prismaItem.shelfLifeInDays,
		warrantyPeriodInDays: prismaItem.warrantyPeriodInDays,
		endOfLife: prismaItem.endOfLife,
		weightPerUnit: prismaItem.weightPerUnit,
		weightUom: prismaItem.weightUom,
		allowNegativeStock: prismaItem.allowNegativeStock,
		valuationMethod: prismaItem.valuationMethod,
		defaultMaterialRequestType: prismaItem.defaultMaterialRequestType,
		safetyStock: prismaItem.safetyStock,
		leadTimeDays: prismaItem.leadTimeDays,

		// Serial Nos and Batches
		hasBatchNo: prismaItem.hasBatchNo,
		hasSerialNo: prismaItem.hasSerialNo,

		barcodes: prismaItem.barcodes.map((b) => ({
			id: b.id,
			barcode: b.barcode,
			barcodeType: b.barcodeType,
			uom: b.uom,
		})),
		reorderSettings: prismaItem.reorderSettings.map((r) => ({
			id: r.id,
			warehouse: r.warehouse,
			reorderLevel: r.reorderLevel,
			reorderQty: r.reorderQty,
			materialRequestType: r.materialRequestType,
		})),

		itemGroupId: prismaItem.itemGroupId,
		itemGroupName: prismaItem.itemGroup?.groupName ?? null,
		defaultUnitOfMeasureId: prismaItem.defaultUnitOfMeasureId,
		createdAt: prismaItem.createdAt,
		updatedAt: prismaItem.updatedAt,
	};
}

/**
 * Converts a Prisma ProductBundle to Inventory.ProductBundle
 */
export function toInventoryProductBundle(
	prismaBundle: InventoryProductBundle,
): Inventory.ProductBundle {
	return {
		id: prismaBundle.id,
		parentItemId: prismaBundle.parentItemId,
		parentItemName: prismaBundle.parentItem?.name ?? null,
		description: prismaBundle.description,
		disabled: prismaBundle.disabled,
		bundleItems: prismaBundle.bundleItems.map((bundleItem) => ({
			id: bundleItem.id,
			bundleId: bundleItem.bundleId,
			itemId: bundleItem.itemId,
			itemName: bundleItem.item?.name ?? null,
			quantity: bundleItem.quantity,
			description: bundleItem.description,
			unitOfMeasurementId: bundleItem.UnitOfMeasurementId,
			unitOfMeasurementName: bundleItem.unitOfMeasurement?.name ?? null,
			createdAt: bundleItem.createdAt,
			updatedAt: bundleItem.updatedAt,
		})),
		createdAt: prismaBundle.createdAt,
		updatedAt: prismaBundle.updatedAt,
	};
}

/**
 * Converts a Prisma ShippingRule to Inventory.ShippingRule
 */
export function toInventoryShippingRule(
	prismaShippingRule: InventoryShippingRule,
): Inventory.ShippingRule {
	return {
		id: prismaShippingRule.id,
		shippingRuleLabel: prismaShippingRule.shippingRuleLabel,
		shippingRuleType: prismaShippingRule.shippingRuleType,
		disabled: prismaShippingRule.disabled,
		calculateBasedOn: prismaShippingRule.calculateBasedOn,
		shippingAmount: prismaShippingRule.shippingAmount,
		createdAt: prismaShippingRule.createdAt,
		updatedAt: prismaShippingRule.updatedAt,
	};
}

/**
 * Converts a Prisma Brand to Inventory.Brand
 */
export function toInventoryBrand(prismaBrand: InventoryBrand): Inventory.Brand {
	return {
		id: prismaBrand.id,
		name: prismaBrand.name,
		description: prismaBrand.description,
		createdAt: prismaBrand.createdAt,
		updatedAt: prismaBrand.updatedAt,
	};
}

/**
 * Converts a Prisma ItemAttribute (with nested values) to Inventory.ItemAttribute.
 */
export function toInventoryItemAttribute(
	prismaAttr: InventoryItemAttribute,
): Inventory.ItemAttribute {
	return {
		id: prismaAttr.id,
		name: prismaAttr.name,
		disabled: prismaAttr.disabled,
		numericValues: prismaAttr.numericValues,
		fromRange: prismaAttr.fromRange,
		toRange: prismaAttr.toRange,
		increment: prismaAttr.increment,
		attributeValues: prismaAttr.attributeValues.map((v) => ({
			id: v.id,
			attributeId: v.attributeId,
			attributeValue: v.attributeValue,
			abbreviation: v.abbreviation,
			position: v.position,
			createdAt: v.createdAt,
			updatedAt: v.updatedAt,
		})),
		createdAt: prismaAttr.createdAt,
		updatedAt: prismaAttr.updatedAt,
	};
}

/**
 * Converts a Prisma UnitOfMeasurement to Inventory.UnitOfMeasure
 */
export function toInventoryUnitOfMeasure(
	prismaUnitOfMeasure: InventoryUnitOfMeasure,
): Inventory.UnitOfMeasure {
	return {
		id: prismaUnitOfMeasure.id,
		name: prismaUnitOfMeasure.name,
		disabled: prismaUnitOfMeasure.disabled,
		isWholeNumber: prismaUnitOfMeasure.isWholeNumber,
		createdAt: prismaUnitOfMeasure.createdAt,
		updatedAt: prismaUnitOfMeasure.updatedAt,
	};
}

/**
 * Converts a Prisma Warehouse record to Inventory.Warehouse.
 */
export function toInventoryWarehouse(
	prismaWarehouse: InventoryWarehouse,
): Inventory.Warehouse {
	return {
		id: prismaWarehouse.id,
		name: prismaWarehouse.name,
		disabled: prismaWarehouse.disabled,
		isGroupWarehouse: prismaWarehouse.isGroupWarehouse,
		parentWarehouseId: prismaWarehouse.parentWarehouseId,
		parentWarehouseName: prismaWarehouse.parentWarehouse?.name ?? null,
		company: prismaWarehouse.company,
		isRejectedWarehouse: prismaWarehouse.isRejectedWarehouse,
		phoneNo: prismaWarehouse.phoneNo,
		mobileNo: prismaWarehouse.mobileNo,
		addressLine1: prismaWarehouse.addressLine1,
		addressLine2: prismaWarehouse.addressLine2,
		city: prismaWarehouse.city,
		state: prismaWarehouse.state,
		pin: prismaWarehouse.pin,
		warehouseType: prismaWarehouse.warehouseType,
		defaultInTransitWarehouseId: prismaWarehouse.defaultInTransitWarehouseId,
		defaultInTransitWarehouseName:
			prismaWarehouse.defaultInTransitWarehouse?.name ?? null,
		createdAt: prismaWarehouse.createdAt,
		updatedAt: prismaWarehouse.updatedAt,
	};
}

/**
 * Converts a Prisma Batch with relations to Inventory.Batch.
 */
export function toInventoryBatch(prismaBatch: InventoryBatch): Inventory.Batch {
	return {
		id: prismaBatch.id,
		batchId: prismaBatch.batchId,
		itemId: prismaBatch.itemId,
		itemCode: prismaBatch.item.code,
		itemName: prismaBatch.item.name,
		company: prismaBatch.company,
		currentWarehouseId: prismaBatch.currentWarehouseId,
		currentWarehouseName: prismaBatch.currentWarehouse?.name ?? null,
		purchaseReceiptId: prismaBatch.purchaseReceiptId,
		purchaseReceiptSeries: prismaBatch.purchaseReceipt?.series ?? null,
		deliveryNoteId: prismaBatch.deliveryNoteId,
		deliveryNoteSeries: prismaBatch.deliveryNote?.series ?? null,
		stockEntryId: prismaBatch.stockEntryId,
		stockEntrySeries: prismaBatch.stockEntry?.series ?? null,
		useBatchWiseValuation: prismaBatch.useBatchWiseValuation,
		manufacturingDate: prismaBatch.manufacturingDate,
		expiryDate: prismaBatch.expiryDate,
		description: prismaBatch.description,
		quantity: prismaBatch.quantity,
		status: Inventory.batchStatusSchema.parse(
			prismaBatch.isDisabled
				? "DISABLED"
				: prismaBatch.expiryDate && prismaBatch.expiryDate < new Date()
					? "EXPIRED"
					: prismaBatch.quantity <= 0
						? "EMPTY"
						: "ACTIVE",
		),
		isDisabled: prismaBatch.isDisabled,
		createdAt: prismaBatch.createdAt,
		updatedAt: prismaBatch.updatedAt,
	};
}

/**
 * Converts a Prisma SerialNo with relations to Inventory.SerialNo.
 */
export function toInventorySerialNo(
	prismaSerialNo: InventorySerialNo,
): Inventory.SerialNo {
	return {
		id: prismaSerialNo.id,
		serialNo: prismaSerialNo.serialNo,
		itemId: prismaSerialNo.itemId,
		itemCode: prismaSerialNo.item.code,
		itemName: prismaSerialNo.item.name,
		company: prismaSerialNo.company,
		status: prismaSerialNo.status as Inventory.SerialNoStatus,
		currentWarehouseId: prismaSerialNo.currentWarehouseId,
		currentWarehouseName: prismaSerialNo.currentWarehouse?.name ?? null,
		purchaseReceiptId: prismaSerialNo.purchaseReceiptId,
		purchaseReceiptSeries: prismaSerialNo.purchaseReceipt?.series ?? null,
		deliveryNoteId: prismaSerialNo.deliveryNoteId,
		deliveryNoteSeries: prismaSerialNo.deliveryNote?.series ?? null,
		stockEntryId: prismaSerialNo.stockEntryId,
		stockEntrySeries: prismaSerialNo.stockEntry?.series ?? null,
		pickListId: prismaSerialNo.pickListId,
		pickListSeries: prismaSerialNo.pickList?.series ?? null,
		workOrder: prismaSerialNo.workOrder,
		purchaseDate: prismaSerialNo.purchaseDate,
		warrantyExpiryDate: prismaSerialNo.warrantyExpiryDate,
		serviceContractExpiryDate: prismaSerialNo.serviceContractExpiryDate,
		maintenanceStatus: prismaSerialNo.maintenanceStatus,
		notes: prismaSerialNo.notes,
		isDisabled: prismaSerialNo.isDisabled,
		createdAt: prismaSerialNo.createdAt,
		updatedAt: prismaSerialNo.updatedAt,
		history: prismaSerialNo.history.map((entry) => ({
			id: entry.id,
			serialNoId: entry.serialNoId,
			eventType: entry.eventType,
			fromStatus: entry.fromStatus as Inventory.SerialNoStatus | null,
			toStatus: entry.toStatus as Inventory.SerialNoStatus | null,
			warehouseId: entry.warehouseId,
			warehouseName: entry.warehouse?.name ?? null,
			transactionLabel: entry.transactionLabel,
			notes: entry.notes,
			createdAt: entry.createdAt,
		})),
	};
}

/**
 * Converts a Prisma InstallationNote with relations to Inventory.InstallationNote.
 */
export function toInventoryInstallationNote(
	prismaNote: InventoryInstallationNote,
): Inventory.InstallationNote {
	return {
		id: prismaNote.id,
		series: prismaNote.series,
		seriesPattern: prismaNote.seriesPattern,
		installationDate: prismaNote.installationDate,
		installationTime: prismaNote.installationTime,
		customer: prismaNote.customer,
		customerName: prismaNote.customerName,
		customerAddress: prismaNote.customerAddress,
		contactPerson: prismaNote.contactPerson,
		territory: prismaNote.territory,
		customerGroup: prismaNote.customerGroup,
		company: prismaNote.company,
		status: prismaNote.status as Inventory.InstallationNoteStatus,
		deliveryNoteId: prismaNote.deliveryNoteId,
		deliveryNoteSeries: prismaNote.deliveryNote?.series ?? null,
		remarks: prismaNote.remarks,
		items: prismaNote.items.map((item) => ({
			id: item.id,
			installationNoteId: item.installationNoteId,
			itemId: item.itemId,
			itemCode: item.item.code,
			itemName: item.item.name,
			serialNoId: item.serialNoId,
			serialNo: item.serialNo?.serialNo ?? null,
			description: item.description,
			installedQty: item.installedQty,
		})),
		createdAt: prismaNote.createdAt,
		updatedAt: prismaNote.updatedAt,
	};
}

/**
 * Converts Prisma singleton stock settings to Inventory.StockSettings.
 */
export function toInventoryStockSettings(
	prismaStockSettings: InventoryStockSettings,
): Inventory.StockSettings {
	const parsedSettings = Inventory.updateStockSettingsSchema.parse({
		itemNamingBy: prismaStockSettings.itemNamingBy,
		defaultWarehouse: prismaStockSettings.defaultWarehouse,
		defaultValuationMethod: prismaStockSettings.defaultValuationMethod,
		defaultStockUom: prismaStockSettings.defaultStockUom,
		autoInsertItemPriceIfMissing:
			prismaStockSettings.autoInsertItemPriceIfMissing,
		updateExistingPriceListRate:
			prismaStockSettings.updateExistingPriceListRate,
		allowToEditStockUomQtyForSalesDocuments:
			prismaStockSettings.allowToEditStockUomQtyForSalesDocuments,
		allowToEditStockUomQtyForPurchaseDocuments:
			prismaStockSettings.allowToEditStockUomQtyForPurchaseDocuments,
		overDeliveryReceiptAllowancePercent:
			prismaStockSettings.overDeliveryReceiptAllowancePercent,
		allowNegativeStock: prismaStockSettings.allowNegativeStock,
		showBarcodeFieldInStockTransactions:
			prismaStockSettings.showBarcodeFieldInStockTransactions,
		convertItemDescriptionToCleanHtmlInTransactions:
			prismaStockSettings.convertItemDescriptionToCleanHtmlInTransactions,
		overTransferAllowancePercent:
			prismaStockSettings.overTransferAllowancePercent,
		allowInternalTransfersAtArmsLengthPrice:
			prismaStockSettings.allowInternalTransfersAtArmsLengthPrice,
		overPickingAllowancePercent:
			prismaStockSettings.overPickingAllowancePercent,
		actionIfQualityInspectionIsNotSubmitted:
			prismaStockSettings.actionIfQualityInspectionIsNotSubmitted,
		actionIfQualityInspectionIsRejected:
			prismaStockSettings.actionIfQualityInspectionIsRejected,
		enableStockReservation: prismaStockSettings.enableStockReservation,
		allowPartialReservation: prismaStockSettings.allowPartialReservation,
		autoReserveStockForSalesOrderOnPurchase:
			prismaStockSettings.autoReserveStockForSalesOrderOnPurchase,
		autoReserveSerialAndBatchNos:
			prismaStockSettings.autoReserveSerialAndBatchNos,
		autoCreateSerialAndBatchBundleForOutward:
			prismaStockSettings.autoCreateSerialAndBatchBundleForOutward,
		disableSerialNoAndBatchSelector:
			prismaStockSettings.disableSerialNoAndBatchSelector,
		haveDefaultNamingSeriesForBatchId:
			prismaStockSettings.haveDefaultNamingSeriesForBatchId,
		pickSerialBatchBasedOn: prismaStockSettings.pickSerialBatchBasedOn,
		useSerialBatchFields: prismaStockSettings.useSerialBatchFields,
		doNotUpdateSerialBatchOnCreationOfAutoBundle:
			prismaStockSettings.doNotUpdateSerialBatchOnCreationOfAutoBundle,
		allowExistingSerialNoToBeManufacturedReceivedAgain:
			prismaStockSettings.allowExistingSerialNoToBeManufacturedReceivedAgain,
		setSerialAndBatchBundleNamingBasedOnNamingSeries:
			prismaStockSettings.setSerialAndBatchBundleNamingBasedOnNamingSeries,
		raiseMaterialRequestWhenStockReachesReorderLevel:
			prismaStockSettings.raiseMaterialRequestWhenStockReachesReorderLevel,
		notifyByEmailOnCreationOfAutomaticMaterialRequest:
			prismaStockSettings.notifyByEmailOnCreationOfAutomaticMaterialRequest,
		allowMaterialTransferFromDeliveryNoteToSalesInvoice:
			prismaStockSettings.allowMaterialTransferFromDeliveryNoteToSalesInvoice,
		allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice:
			prismaStockSettings.allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice,
		freezeStocksOlderThanDays: prismaStockSettings.freezeStocksOlderThanDays,
	});

	return {
		id: prismaStockSettings.id,
		...parsedSettings,
		defaultWarehouse: parsedSettings.defaultWarehouse ?? null,
		defaultStockUom: parsedSettings.defaultStockUom ?? null,
		createdAt: prismaStockSettings.createdAt,
		updatedAt: prismaStockSettings.updatedAt,
	};
}

/**
 * Converts Prisma singleton item variant settings to Inventory.ItemVariantSettings.
 */
export function toInventoryItemVariantSettings(
	prismaSettings: InventoryItemVariantSettings,
): Inventory.ItemVariantSettings {
	const parsedSettings = Inventory.updateItemVariantSettingsSchema.parse({
		doNotUpdateVariantsOnSave: prismaSettings.doNotUpdateVariantsOnSave,
		allowRenameAttributeValue: prismaSettings.allowRenameAttributeValue,
		copyFields: prismaSettings.copyFields.map((field) => ({
			id: field.id,
			fieldKey: field.fieldKey,
		})),
	});

	const optionsByKey = new Map<
		Inventory.ItemVariantCopyFieldKey,
		Inventory.ItemVariantCopyFieldOption
	>(
		Inventory.ITEM_VARIANT_COPY_FIELD_OPTIONS.map((option) => [
			option.value,
			option,
		]),
	);

	return {
		id: prismaSettings.id,
		doNotUpdateVariantsOnSave: parsedSettings.doNotUpdateVariantsOnSave,
		allowRenameAttributeValue: parsedSettings.allowRenameAttributeValue,
		copyFields: parsedSettings.copyFields.map((field, index) => {
			const persistedField = prismaSettings.copyFields[index];
			const option = optionsByKey.get(field.fieldKey);

			if (!persistedField || !option) {
				throw new Error(
					`Unknown item variant copy field option: ${field.fieldKey}`,
				);
			}

			return {
				id: persistedField.id,
				fieldKey: field.fieldKey,
				label: option.label,
				category: option.category,
				itemProperty: option.itemProperty,
				position: persistedField.position ?? index,
			};
		}),
		createdAt: prismaSettings.createdAt,
		updatedAt: prismaSettings.updatedAt,
	};
}

/**
 * Converts a Prisma ItemAlternate to Inventory.ItemAlternative
 */
export function toInventoryItemAlternative(
	prismaItemAlternative: InventoryItemAlternative,
): Inventory.ItemAlternative {
	return {
		id: prismaItemAlternative.id,
		itemId: prismaItemAlternative.itemId,
		itemCode: prismaItemAlternative.item.code,
		itemName: prismaItemAlternative.item.name,
		alternativeItemId: prismaItemAlternative.alternateItemId,
		alternativeItemCode: prismaItemAlternative.alternateItem.code,
		alternativeItemName: prismaItemAlternative.alternateItem.name,
		createdAt: prismaItemAlternative.createdAt,
		updatedAt: prismaItemAlternative.updatedAt,
	};
}

/**
 * Converts a Prisma ItemManufacturer to Inventory.ItemManufacturer
 */
export function toInventoryItemManufacturer(
	prismaManufacturer: InventoryItemManufacturer,
): Inventory.ItemManufacturer {
	return {
		id: prismaManufacturer.id,
		itemId: prismaManufacturer.itemId,
		itemCode: prismaManufacturer.item.code,
		itemName: prismaManufacturer.item.name,
		itemDescription: prismaManufacturer.item.description,
		manufacturer: prismaManufacturer.manufacturer,
		manufacturerPartNumber: prismaManufacturer.manufacturerPartNumber,
		isDefault: prismaManufacturer.isDefault,
		createdAt: prismaManufacturer.createdAt,
		updatedAt: prismaManufacturer.updatedAt,
	};
}

/**
 * Type guard to check if a value is a valid InventoryItem
 */
export function isInventoryItem(value: unknown): value is InventoryItem {
	return (
		value !== null &&
		typeof value === "object" &&
		"id" in value &&
		"name" in value &&
		"code" in value &&
		"quantity" in value &&
		"createdAt" in value &&
		"updatedAt" in value
	);
}

/**
 * Prisma model type for MaterialRequest with items
 */
export type InventoryMaterialRequest = Prisma.MaterialRequestGetPayload<{
	include: {
		items: true;
	};
}>;

/**
 * Converts a Prisma MaterialRequest to Inventory.MaterialRequest
 */
export function toInventoryMaterialRequest(
	prismaMR: InventoryMaterialRequest,
): Inventory.MaterialRequest {
	return {
		id: prismaMR.id,
		series: prismaMR.series,
		transactionDate: prismaMR.transactionDate,
		purpose: prismaMR.purpose as Inventory.MaterialRequestPurpose,
		company: prismaMR.company,
		requiredBy: prismaMR.requiredBy,
		status: prismaMR.status as Inventory.MaterialRequestStatus,
		targetWarehouse: prismaMR.targetWarehouse,
		terms: prismaMR.terms,
		termsContent: prismaMR.termsContent,
		letterHead: prismaMR.letterHead,
		printHeading: prismaMR.printHeading,
		items: prismaMR.items.map((item) => ({
			id: item.id,
			materialRequestId: item.materialRequestId,
			itemCode: item.itemCode,
			itemName: item.itemName,
			requiredBy: item.requiredBy,
			quantity: item.quantity,
			orderedQty: item.orderedQty,
			receivedQty: item.receivedQty,
			targetWarehouse: item.targetWarehouse,
			unitOfMeasure: item.unitOfMeasure,
		})),
		createdAt: prismaMR.createdAt,
		updatedAt: prismaMR.updatedAt,
	};
}

/**
 * Prisma model type for StockEntry with items
 */
export type InventoryStockEntry = Prisma.StockEntryGetPayload<{
	include: {
		items: true;
	};
}>;

/**
 * Converts a Prisma StockEntry to Inventory.StockEntry
 */
export function toInventoryStockEntry(
	prismaEntry: InventoryStockEntry,
): Inventory.StockEntry {
	return {
		id: prismaEntry.id,
		series: prismaEntry.series,
		stockEntryType: prismaEntry.stockEntryType as Inventory.StockEntryType,
		postingDate: prismaEntry.postingDate,
		company: prismaEntry.company,
		status: prismaEntry.status as Inventory.StockEntryStatus,
		project: prismaEntry.project,
		defaultSourceWarehouse: prismaEntry.defaultSourceWarehouse,
		defaultTargetWarehouse: prismaEntry.defaultTargetWarehouse,
		isOpening: prismaEntry.isOpening,
		remarks: prismaEntry.remarks,
		printHeading: prismaEntry.printHeading,
		letterHead: prismaEntry.letterHead,
		inspectionRequired: prismaEntry.inspectionRequired,
		items: prismaEntry.items.map((item) => ({
			id: item.id,
			stockEntryId: item.stockEntryId,
			sourceWarehouse: item.sourceWarehouse,
			targetWarehouse: item.targetWarehouse,
			itemCode: item.itemCode,
			itemName: item.itemName,
			description: item.description,
			qty: item.qty,
			basicRate: item.basicRate,
			basicAmount: item.basicAmount,
			unitOfMeasure: item.unitOfMeasure,
		})),
		createdAt: prismaEntry.createdAt,
		updatedAt: prismaEntry.updatedAt,
	};
}

/**
 * Prisma model type for DeliveryNote with items
 */
export type InventoryDeliveryNote = Prisma.DeliveryNoteGetPayload<{
	include: {
		items: true;
	};
}>;

/**
 * Converts a Prisma DeliveryNote to Inventory.DeliveryNote
 */
export function toInventoryDeliveryNote(
	prismaNote: InventoryDeliveryNote,
): Inventory.DeliveryNote {
	return {
		id: prismaNote.id,
		series: prismaNote.series,
		postingDate: prismaNote.postingDate,
		customer: prismaNote.customer,
		company: prismaNote.company,
		status: prismaNote.status as Inventory.DeliveryNoteStatus,
		isReturn: prismaNote.isReturn,
		currency: prismaNote.currency,
		priceList: prismaNote.priceList,
		sourceWarehouse: prismaNote.sourceWarehouse,
		totalQuantity: prismaNote.totalQuantity,
		totalAmount: prismaNote.totalAmount,
		grandTotal: prismaNote.grandTotal,
		roundingAdjustment: prismaNote.roundingAdjustment,
		roundedTotal: prismaNote.roundedTotal,
		additionalDiscountOn: prismaNote.additionalDiscountOn,
		additionalDiscountPercent: prismaNote.additionalDiscountPercent,
		additionalDiscountAmount: prismaNote.additionalDiscountAmount,
		shippingAddress: prismaNote.shippingAddress,
		dispatchAddress: prismaNote.dispatchAddress,
		companyAddress: prismaNote.companyAddress,
		companyContact: prismaNote.companyContact,
		companyTRN: prismaNote.companyTRN,
		terms: prismaNote.terms,
		termsContent: prismaNote.termsContent,
		transporter: prismaNote.transporter,
		driverName: prismaNote.driverName,
		driver: prismaNote.driver,
		transportReceiptDate: prismaNote.transportReceiptDate,
		transportReceiptNo: prismaNote.transportReceiptNo,
		vehicleNo: prismaNote.vehicleNo,
		customerPoNo: prismaNote.customerPoNo,
		customerPoDate: prismaNote.customerPoDate,
		salesPartner: prismaNote.salesPartner,
		commissionRate: prismaNote.commissionRate,
		letterHead: prismaNote.letterHead,
		printHeading: prismaNote.printHeading,
		printWithoutAmount: prismaNote.printWithoutAmount,
		groupSameItems: prismaNote.groupSameItems,
		permitNumber: prismaNote.permitNumber,
		vatEmirate: prismaNote.vatEmirate,
		project: prismaNote.project,
		items: prismaNote.items.map((item) => ({
			id: item.id,
			deliveryNoteId: item.deliveryNoteId,
			itemCode: item.itemCode,
			itemName: item.itemName,
			description: item.description,
			quantity: item.quantity,
			packedQty: item.packedQty,
			uom: item.uom,
			rate: item.rate,
			amount: item.amount,
			warehouse: item.warehouse,
		})),
		createdAt: prismaNote.createdAt,
		updatedAt: prismaNote.updatedAt,
	};
}

/**
 * Prisma model type for PurchaseReceipt with items and taxes.
 */
export type InventoryPurchaseReceipt = Prisma.PurchaseReceiptGetPayload<{
	include: {
		items: true;
		taxes: true;
	};
}>;

/**
 * Converts a Prisma PurchaseReceipt to Inventory.PurchaseReceipt.
 */
export function toInventoryPurchaseReceipt(
	prismaReceipt: InventoryPurchaseReceipt,
): Inventory.PurchaseReceipt {
	return {
		id: prismaReceipt.id,
		series: prismaReceipt.series,
		seriesPattern: prismaReceipt.seriesPattern,
		postingDate: prismaReceipt.postingDate,
		postingTime: prismaReceipt.postingTime,
		editPostingDateTime: prismaReceipt.editPostingDateTime,
		supplier: prismaReceipt.supplier,
		company: prismaReceipt.company,
		status: prismaReceipt.status as Inventory.PurchaseReceiptStatus,
		isReturn: prismaReceipt.isReturn,
		applyPutawayRule: prismaReceipt.applyPutawayRule,
		supplierDeliveryNote: prismaReceipt.supplierDeliveryNote,
		acceptedWarehouse: prismaReceipt.acceptedWarehouse,
		rejectedWarehouse: prismaReceipt.rejectedWarehouse,
		isSubcontracted: prismaReceipt.isSubcontracted,
		currency: prismaReceipt.currency,
		priceList: prismaReceipt.priceList,
		totalQuantity: prismaReceipt.totalQuantity,
		totalAcceptedQuantity: prismaReceipt.totalAcceptedQuantity,
		totalRejectedQuantity: prismaReceipt.totalRejectedQuantity,
		totalAmount: prismaReceipt.totalAmount,
		taxesAndChargesAdded: prismaReceipt.taxesAndChargesAdded,
		taxesAndChargesDeducted: prismaReceipt.taxesAndChargesDeducted,
		totalTaxesAndCharges: prismaReceipt.totalTaxesAndCharges,
		grandTotal: prismaReceipt.grandTotal,
		roundingAdjustment: prismaReceipt.roundingAdjustment,
		roundedTotal: prismaReceipt.roundedTotal,
		disableRoundedTotal: prismaReceipt.disableRoundedTotal,
		supplierAddress: prismaReceipt.supplierAddress,
		contactPerson: prismaReceipt.contactPerson,
		shippingAddressTemplate: prismaReceipt.shippingAddressTemplate,
		companyTRN: prismaReceipt.companyTRN,
		billingAddress: prismaReceipt.billingAddress,
		terms: prismaReceipt.terms,
		termsContent: prismaReceipt.termsContent,
		letterHead: prismaReceipt.letterHead,
		printHeading: prismaReceipt.printHeading,
		groupSameItems: prismaReceipt.groupSameItems,
		permitNumber: prismaReceipt.permitNumber,
		recoverableStandardRatedExpenses:
			prismaReceipt.recoverableStandardRatedExpenses,
		reverseChargeApplicable: prismaReceipt.reverseChargeApplicable as "Y" | "N",
		transporterName: prismaReceipt.transporterName,
		vehicleNumber: prismaReceipt.vehicleNumber,
		vehicleDate: prismaReceipt.vehicleDate,
		instructions: prismaReceipt.instructions,
		remarks: prismaReceipt.remarks,
		isInternalSupplier: prismaReceipt.isInternalSupplier,
		items: prismaReceipt.items.map((item) => ({
			id: item.id,
			purchaseReceiptId: item.purchaseReceiptId,
			itemCode: item.itemCode,
			itemName: item.itemName,
			description: item.description,
			acceptedQuantity: item.acceptedQuantity,
			rejectedQuantity: item.rejectedQuantity,
			rate: item.rate,
			amount: item.amount,
			uom: item.uom,
			acceptedWarehouse: item.acceptedWarehouse,
			rejectedWarehouse: item.rejectedWarehouse,
		})),
		taxes: prismaReceipt.taxes.map((tax) => ({
			id: tax.id,
			purchaseReceiptId: tax.purchaseReceiptId,
			type: tax.type,
			accountHead: tax.accountHead,
			taxRate: tax.taxRate,
			amount: tax.amount,
			total: tax.total,
		})),
		createdAt: prismaReceipt.createdAt,
		updatedAt: prismaReceipt.updatedAt,
	};
}

/**
 * Prisma model type for PickList with items
 */
export type InventoryPickList = Prisma.PickListGetPayload<{
	include: {
		items: true;
	};
}>;

/**
 * Converts a Prisma PickList to Inventory.PickList
 */
export function toInventoryPickList(
	prismaPickList: InventoryPickList,
): Inventory.PickList {
	return {
		id: prismaPickList.id,
		series: prismaPickList.series,
		seriesPattern: prismaPickList.seriesPattern,
		status: prismaPickList.status as Inventory.PickListStatus,
		company: prismaPickList.company,
		customer: prismaPickList.customer,
		purpose: prismaPickList.purpose as Inventory.PickListPurpose,
		workOrder: prismaPickList.workOrder,
		warehouse: prismaPickList.warehouse,
		considerRejectedWarehouses: prismaPickList.considerRejectedWarehouses,
		pickManually: prismaPickList.pickManually,
		ignorePricingRule: prismaPickList.ignorePricingRule,
		scanMode: prismaPickList.scanMode,
		promptQty: prismaPickList.promptQty,
		scanBarcode: prismaPickList.scanBarcode,
		groupSameItems: prismaPickList.groupSameItems,
		items: prismaPickList.items.map((item) => ({
			id: item.id,
			pickListId: item.pickListId,
			item: item.item,
			warehouse: item.warehouse,
			qty: item.qty,
			stockQty: item.stockQty,
			pickedQty: item.pickedQty,
		})),
		createdAt: prismaPickList.createdAt,
		updatedAt: prismaPickList.updatedAt,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery Trip
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Prisma model type for DeliveryTrip with stops
 */
export type InventoryDeliveryTrip = Prisma.DeliveryTripGetPayload<{
	include: {
		stops: true;
	};
}>;

/**
 * Converts a Prisma DeliveryTripStop to Inventory.DeliveryTripStop
 */
export function toInventoryDeliveryTripStop(
	stop: InventoryDeliveryTrip["stops"][number],
): Inventory.DeliveryTripStop {
	return {
		id: stop.id,
		deliveryTripId: stop.deliveryTripId,
		stopNumber: stop.stopNumber,
		customer: stop.customer,
		addressName: stop.addressName,
		locked: stop.locked,
		deliveryNote: stop.deliveryNote,
		estimatedArrival: stop.estimatedArrival,
	};
}

/**
 * Converts a Prisma DeliveryTrip (with stops) to Inventory.DeliveryTrip
 */
export function toInventoryDeliveryTrip(
	prismaDeliveryTrip: InventoryDeliveryTrip,
): Inventory.DeliveryTrip {
	return {
		id: prismaDeliveryTrip.id,
		series: prismaDeliveryTrip.series,
		seriesPattern: prismaDeliveryTrip.seriesPattern,
		status: prismaDeliveryTrip.status as Inventory.DeliveryTripStatus,
		company: prismaDeliveryTrip.company,
		driver: prismaDeliveryTrip.driver,
		driverAddress: prismaDeliveryTrip.driverAddress,
		vehicle: prismaDeliveryTrip.vehicle,
		departureTime: prismaDeliveryTrip.departureTime,
		initialEmailNotificationSent:
			prismaDeliveryTrip.initialEmailNotificationSent,
		stops: prismaDeliveryTrip.stops
			.sort((a, b) => a.stopNumber - b.stopNumber)
			.map(toInventoryDeliveryTripStop),
		createdAt: prismaDeliveryTrip.createdAt,
		updatedAt: prismaDeliveryTrip.updatedAt,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Packing Slip
// ─────────────────────────────────────────────────────────────────────────────

export type InventoryPackingSlip = Prisma.PackingSlipGetPayload<{
	include: { items: true };
}>;

/**
 * Converts a Prisma PackingSlip (with items) to Inventory.PackingSlip.
 */
export function toInventoryPackingSlip(
	ps: InventoryPackingSlip,
): Inventory.PackingSlip {
	return {
		id: ps.id,
		series: ps.series,
		status: ps.status as Inventory.PackingSlipStatus,
		deliveryNoteId: ps.deliveryNoteId,
		fromCaseNo: ps.fromCaseNo,
		toCaseNo: ps.toCaseNo,
		netWeightPkg: ps.netWeightPkg,
		netWeightUom: ps.netWeightUom,
		grossWeightPkg: ps.grossWeightPkg,
		grossWeightUom: ps.grossWeightUom,
		letterHead: ps.letterHead,
		items: ps.items.map((item) => ({
			id: item.id,
			packingSlipId: item.packingSlipId,
			deliveryNoteItemId: item.deliveryNoteItemId,
			itemCode: item.itemCode,
			itemName: item.itemName,
			description: item.description,
			qty: item.qty,
			netWeight: item.netWeight,
			weightUom: item.weightUom,
			batchNo: item.batchNo,
		})),
		createdAt: ps.createdAt,
		updatedAt: ps.updatedAt,
	};
}
// ─── Quality Inspection Types & Mappers ───────────────────────────────────────

export type InventoryQiParameterGroup = Prisma.QiParameterGroupGetPayload<{
	select: { id: true; name: true; createdAt: true; updatedAt: true };
}>;

export type InventoryQiParameter = Prisma.QiParameterGetPayload<{
	include: { group: true };
}>;

export type InventoryQiTemplate = Prisma.QiTemplateGetPayload<{
	include: { items: { include: { parameter: { include: { group: true } } } } };
}>;

export function toInventoryQiParameterGroup(
	g: InventoryQiParameterGroup,
): Inventory.QiParameterGroup {
	return {
		id: g.id,
		name: g.name,
		createdAt: g.createdAt,
		updatedAt: g.updatedAt,
	};
}

export function toInventoryQiParameter(
	p: InventoryQiParameter,
): Inventory.QiParameter {
	return {
		id: p.id,
		parameter: p.parameter,
		description: p.description,
		groupId: p.groupId,
		groupName: p.group?.name ?? null,
		createdAt: p.createdAt,
		updatedAt: p.updatedAt,
	};
}

export function toInventoryQiTemplate(
	t: InventoryQiTemplate,
): Inventory.QiTemplate {
	return {
		id: t.id,
		name: t.name,
		items: t.items.map((item) => ({
			id: item.id,
			templateId: item.templateId,
			parameterId: item.parameterId,
			parameterName: item.parameter.parameter,
			parameterGroupId: item.parameter.groupId,
			parameterGroupName: item.parameter.group?.name ?? null,
			sortOrder: item.sortOrder,
			numeric: item.numeric,
			formulaBased: item.formulaBased,
			value: item.value,
			minValue: item.minValue,
			maxValue: item.maxValue,
			acceptanceFormula: item.acceptanceFormula,
		})),
		createdAt: t.createdAt,
		updatedAt: t.updatedAt,
	};
}
