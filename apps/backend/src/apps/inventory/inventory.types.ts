import type { Inventory } from "@aria/types";
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
