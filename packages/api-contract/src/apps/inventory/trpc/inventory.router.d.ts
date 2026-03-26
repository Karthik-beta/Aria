// biome-ignore-all lint/suspicious/noConfusingVoidType: tRPC no-input procedure declarations intentionally use void in this shared contract surface.
import { Inventory } from "@aria/types";
import type {
	TRPCBuiltRouter,
	TRPCDecorateCreateRouterOptions,
	TRPCMutationProcedure,
	TRPCQueryProcedure,
} from "@trpc/server";
import type { LegacyObservableSubscriptionProcedure } from "@trpc/server/unstable-core-do-not-import";
import type { accountRouter } from "../../../trpc/routers/account.router";

type ItemGroupsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.ItemGroup | { id: string };
};

type ItemsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.Item | { id: string };
};

type MaterialRequestsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.MaterialRequest | { id: string };
};

type StockEntriesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.StockEntry | { id: string };
};

type DeliveryNotesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.DeliveryNote | { id: string };
};

type PickListsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.PickList | { id: string };
};

type DeliveryTripsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.DeliveryTrip | { id: string };
};

type SerialNosChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.SerialNo | { id: string };
};

type BatchesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.Batch | { id: string };
};

type InstallationNotesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.InstallationNote | { id: string };
};

type InventoryRouterInput = {
	listItems: TRPCQueryProcedure<{
		input: void;
		output: Inventory.Item[];
		meta: object;
	}>;
	listItemGroups: TRPCQueryProcedure<{
		input:
			| {
					search?: string | undefined;
			  }
			| undefined;
		output: Inventory.ItemGroup[];
		meta: object;
	}>;
	listUnitsOfMeasure: TRPCQueryProcedure<{
		input:
			| {
					search?: string | undefined;
			  }
			| undefined;
		output: Inventory.UnitOfMeasure[];
		meta: object;
	}>;
	listWarehouses: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					company?: string | undefined;
					disabled?: boolean | undefined;
					isGroupWarehouse?: boolean | undefined;
			  }
			| undefined;
		output: Inventory.WarehouseListResult;
		meta: object;
	}>;
	getWarehouseById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.Warehouse | null;
		meta: object;
	}>;
	createWarehouse: TRPCMutationProcedure<{
		input: {
			name: string;
			disabled?: boolean | undefined;
			isGroupWarehouse?: boolean | undefined;
			parentWarehouseId?: string | null | undefined;
			company: string;
			isRejectedWarehouse?: boolean | undefined;
			phoneNo?: string | null | undefined;
			mobileNo?: string | null | undefined;
			addressLine1?: string | null | undefined;
			addressLine2?: string | null | undefined;
			city?: string | null | undefined;
			state?: string | null | undefined;
			pin?: string | null | undefined;
			warehouseType?: string | null | undefined;
			defaultInTransitWarehouseId?: string | null | undefined;
		};
		output: Inventory.Warehouse;
		meta: object;
	}>;
	updateWarehouse: TRPCMutationProcedure<{
		input: {
			id: string;
			name?: string | undefined;
			disabled?: boolean | undefined;
			isGroupWarehouse?: boolean | undefined;
			parentWarehouseId?: string | null | undefined;
			company?: string | undefined;
			isRejectedWarehouse?: boolean | undefined;
			phoneNo?: string | null | undefined;
			mobileNo?: string | null | undefined;
			addressLine1?: string | null | undefined;
			addressLine2?: string | null | undefined;
			city?: string | null | undefined;
			state?: string | null | undefined;
			pin?: string | null | undefined;
			warehouseType?: string | null | undefined;
			defaultInTransitWarehouseId?: string | null | undefined;
		};
		output: Inventory.Warehouse;
		meta: object;
	}>;
	deleteWarehouse: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	getItemVariantSettings: TRPCQueryProcedure<{
		input: void;
		output: Inventory.ItemVariantSettings;
		meta: object;
	}>;
	updateItemVariantSettings: TRPCMutationProcedure<{
		input: {
			doNotUpdateVariantsOnSave: boolean;
			allowRenameAttributeValue: boolean;
			copyFields: {
				id?: string | undefined;
				fieldKey: Inventory.ItemVariantCopyFieldKey;
			}[];
		};
		output: Inventory.ItemVariantSettings;
		meta: object;
	}>;
	getStockSettings: TRPCQueryProcedure<{
		input: void;
		output: Inventory.StockSettings;
		meta: object;
	}>;
	updateStockSettings: TRPCMutationProcedure<{
		input: {
			itemNamingBy: "ITEM_CODE" | "NAMING_SERIES";
			defaultWarehouse?: string | null | undefined;
			defaultValuationMethod: "FIFO" | "MOVING_AVERAGE";
			defaultStockUom?: string | null | undefined;
			autoInsertItemPriceIfMissing: boolean;
			updateExistingPriceListRate: boolean;
			allowToEditStockUomQtyForSalesDocuments: boolean;
			allowToEditStockUomQtyForPurchaseDocuments: boolean;
			overDeliveryReceiptAllowancePercent: number;
			allowNegativeStock: boolean;
			showBarcodeFieldInStockTransactions: boolean;
			convertItemDescriptionToCleanHtmlInTransactions: boolean;
			overTransferAllowancePercent: number;
			allowInternalTransfersAtArmsLengthPrice: boolean;
			overPickingAllowancePercent: number;
			actionIfQualityInspectionIsNotSubmitted: "STOP" | "WARN";
			actionIfQualityInspectionIsRejected: "STOP" | "WARN";
			enableStockReservation: boolean;
			allowPartialReservation: boolean;
			autoReserveStockForSalesOrderOnPurchase: boolean;
			autoReserveSerialAndBatchNos: boolean;
			autoCreateSerialAndBatchBundleForOutward: boolean;
			disableSerialNoAndBatchSelector: boolean;
			haveDefaultNamingSeriesForBatchId: boolean;
			pickSerialBatchBasedOn: "FIFO" | "LIFO" | "EXPIRY";
			useSerialBatchFields: boolean;
			doNotUpdateSerialBatchOnCreationOfAutoBundle: boolean;
			allowExistingSerialNoToBeManufacturedReceivedAgain: boolean;
			setSerialAndBatchBundleNamingBasedOnNamingSeries: boolean;
			raiseMaterialRequestWhenStockReachesReorderLevel: boolean;
			notifyByEmailOnCreationOfAutomaticMaterialRequest: boolean;
			allowMaterialTransferFromDeliveryNoteToSalesInvoice: boolean;
			allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: boolean;
			freezeStocksOlderThanDays: number;
		};
		output: Inventory.StockSettings;
		meta: object;
	}>;
	getUnitOfMeasureById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.UnitOfMeasure | null;
		meta: object;
	}>;
	createUnitOfMeasure: TRPCMutationProcedure<{
		input: {
			name: string;
			disabled?: boolean | undefined;
			isWholeNumber?: boolean | undefined;
		};
		output: Inventory.UnitOfMeasure;
		meta: object;
	}>;
	updateUnitOfMeasure: TRPCMutationProcedure<{
		input: {
			id: string;
			name?: string | undefined;
			disabled?: boolean | undefined;
			isWholeNumber?: boolean | undefined;
		};
		output: Inventory.UnitOfMeasure;
		meta: object;
	}>;
	deleteUnitOfMeasure: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	listBrands: TRPCQueryProcedure<{
		input:
			| {
					search?: string | undefined;
			  }
			| undefined;
		output: Inventory.Brand[];
		meta: object;
	}>;
	getBrandById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.Brand | null;
		meta: object;
	}>;
	createBrand: TRPCMutationProcedure<{
		input: {
			name: string;
			description?: string | null | undefined;
		};
		output: Inventory.Brand;
		meta: object;
	}>;
	updateBrand: TRPCMutationProcedure<{
		input: {
			id: string;
			name?: string | undefined;
			description?: string | null | undefined;
		};
		output: Inventory.Brand;
		meta: object;
	}>;
	deleteBrand: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	listItemAttributes: TRPCQueryProcedure<{
		input:
			| {
					search?: string | undefined;
			  }
			| undefined;
		output: Inventory.ItemAttribute[];
		meta: object;
	}>;
	getItemAttributeById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.ItemAttribute | null;
		meta: object;
	}>;
	createItemAttribute: TRPCMutationProcedure<{
		input: {
			name: string;
			disabled?: boolean | undefined;
			numericValues?: boolean | undefined;
			attributeValues?: {
				attributeValue: string;
				abbreviation: string;
				position?: number | undefined;
			}[];
		};
		output: Inventory.ItemAttribute;
		meta: object;
	}>;
	updateItemAttribute: TRPCMutationProcedure<{
		input: {
			id: string;
			name?: string | undefined;
			disabled?: boolean | undefined;
			numericValues?: boolean | undefined;
			attributeValues?: {
				id?: string | undefined;
				attributeValue: string;
				abbreviation: string;
				position?: number | undefined;
			}[];
		};
		output: Inventory.ItemAttribute;
		meta: object;
	}>;
	deleteItemAttribute: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	listBundleItems: TRPCQueryProcedure<{
		input:
			| {
					search?: string | undefined;
			  }
			| undefined;
		output: Inventory.BundleSelectableItem[];
		meta: object;
	}>;
	listProductBundles: TRPCQueryProcedure<{
		input: void;
		output: Inventory.ProductBundle[];
		meta: object;
	}>;
	createProductBundle: TRPCMutationProcedure<{
		input: {
			parentItemId: string;
			description?: string | undefined;
			disabled?: boolean | undefined;
			bundleItems: {
				itemId: string;
				quantity: number;
				description?: string | undefined;
				unitOfMeasurementId?: string | undefined;
			}[];
		};
		output: Inventory.ProductBundle;
		meta: object;
	}>;
	updateProductBundle: TRPCMutationProcedure<{
		input: {
			id: string;
			parentItemId?: string | undefined;
			description?: string | undefined;
			disabled?: boolean | undefined;
			bundleItems?:
				| {
						id?: string | undefined;
						itemId: string;
						quantity: number;
						description?: string | undefined;
						unitOfMeasurementId?: string | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.ProductBundle;
		meta: object;
	}>;
	deleteProductBundle: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	listShippingRules: TRPCQueryProcedure<{
		input: void;
		output: Inventory.ShippingRule[];
		meta: object;
	}>;
	getShippingRuleById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.ShippingRule | null;
		meta: object;
	}>;
	createShippingRule: TRPCMutationProcedure<{
		input: {
			shippingRuleLabel: string;
			shippingRuleType: "SELLING" | "BUYING";
			disabled?: boolean | undefined;
			calculateBasedOn: "FIXED" | "NET_TOTAL" | "NET_WEIGHT";
			shippingAmount?: number | undefined;
		};
		output: Inventory.ShippingRule;
		meta: object;
	}>;
	updateShippingRule: TRPCMutationProcedure<{
		input: {
			id: string;
			shippingRuleLabel?: string | undefined;
			shippingRuleType?: "SELLING" | "BUYING" | undefined;
			disabled?: boolean | undefined;
			calculateBasedOn?: "FIXED" | "NET_TOTAL" | "NET_WEIGHT" | undefined;
			shippingAmount?: number | undefined;
		};
		output: Inventory.ShippingRule;
		meta: object;
	}>;
	deleteShippingRule: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	listItemManufacturers: TRPCQueryProcedure<{
		input: void;
		output: Inventory.ItemManufacturer[];
		meta: object;
	}>;
	getItemManufacturerById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.ItemManufacturer | null;
		meta: object;
	}>;
	createItemManufacturer: TRPCMutationProcedure<{
		input: {
			itemId: string;
			manufacturer: string;
			manufacturerPartNumber: string;
			isDefault?: boolean | undefined;
		};
		output: Inventory.ItemManufacturer;
		meta: object;
	}>;
	updateItemManufacturer: TRPCMutationProcedure<{
		input: {
			id: string;
			itemId?: string | undefined;
			manufacturer?: string | undefined;
			manufacturerPartNumber?: string | undefined;
			isDefault?: boolean | undefined;
		};
		output: Inventory.ItemManufacturer;
		meta: object;
	}>;
	deleteItemManufacturer: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	listItemAlternatives: TRPCQueryProcedure<{
		input: void;
		output: Inventory.ItemAlternative[];
		meta: object;
	}>;
	getItemAlternativeById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.ItemAlternative | null;
		meta: object;
	}>;
	createItemAlternative: TRPCMutationProcedure<{
		input: {
			itemId: string;
			alternativeItemId: string;
			twoWay?: boolean | undefined;
		};
		output: Inventory.ItemAlternative;
		meta: object;
	}>;
	updateItemAlternative: TRPCMutationProcedure<{
		input: {
			id: string;
			itemId?: string | undefined;
			alternativeItemId?: string | undefined;
			twoWay?: boolean | undefined;
		};
		output: Inventory.ItemAlternative;
		meta: object;
	}>;
	deleteItemAlternative: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	createItem: TRPCMutationProcedure<{
		input: {
			name: string;
			code: string;
			quantity?: number | undefined;
			description?: string | undefined;
			disabled?: boolean | undefined;
			maintainStock?: boolean | undefined;
			allowAlternateItem?: boolean | undefined;
			hasVariants?: boolean | undefined;
			openingStock?: number | undefined;
			valuationRate?: number | undefined;
			standardSellingRate?: number | undefined;
			isZeroRated?: boolean | undefined;
			isExempt?: boolean | undefined;
			isFixedAsset?: boolean | undefined;
			taxCode?: string | undefined;
			shelfLifeInDays?: number | undefined;
			warrantyPeriodInDays?: number | undefined;
			endOfLife?: unknown;
			weightPerUnit?: number | undefined;
			weightUom?: string | undefined;
			allowNegativeStock?: boolean | undefined;
			valuationMethod?: string | undefined;
			defaultMaterialRequestType?: string | undefined;
			hasBatchNo?: boolean | undefined;
			hasSerialNo?: boolean | undefined;
			barcodes?:
				| {
						barcode: string;
						barcodeType?: string | null | undefined;
						uom?: string | null | undefined;
				  }[]
				| undefined;
			reorderSettings?:
				| {
						warehouse: string;
						reorderLevel?: number | undefined;
						reorderQty?: number | undefined;
						materialRequestType?: string | null | undefined;
				  }[]
				| undefined;
			itemGroupId?: string | undefined;
			defaultUnitOfMeasureId?: string | undefined;
		};
		output: Inventory.Item;
		meta: object;
	}>;
	updateItem: TRPCMutationProcedure<{
		input: {
			id: string;
			name?: string | undefined;
			code?: string | undefined;
			quantity?: number | undefined;
			description?: string | undefined;
			disabled?: boolean | undefined;
			maintainStock?: boolean | undefined;
			allowAlternateItem?: boolean | undefined;
			hasVariants?: boolean | undefined;
			openingStock?: number | undefined;
			valuationRate?: number | undefined;
			standardSellingRate?: number | undefined;
			isZeroRated?: boolean | undefined;
			isExempt?: boolean | undefined;
			isFixedAsset?: boolean | undefined;
			taxCode?: string | undefined;
			shelfLifeInDays?: number | undefined;
			warrantyPeriodInDays?: number | undefined;
			endOfLife?: unknown;
			weightPerUnit?: number | undefined;
			weightUom?: string | undefined;
			allowNegativeStock?: boolean | undefined;
			valuationMethod?: string | undefined;
			defaultMaterialRequestType?: string | undefined;
			hasBatchNo?: boolean | undefined;
			hasSerialNo?: boolean | undefined;
			barcodes?:
				| {
						barcode: string;
						id?: string | undefined;
						barcodeType?: string | null | undefined;
						uom?: string | null | undefined;
				  }[]
				| undefined;
			reorderSettings?:
				| {
						warehouse: string;
						id?: string | undefined;
						reorderLevel?: number | undefined;
						reorderQty?: number | undefined;
						materialRequestType?: string | null | undefined;
				  }[]
				| undefined;
			itemGroupId?: string | undefined;
			defaultUnitOfMeasureId?: string | undefined;
		};
		output: Inventory.Item;
		meta: object;
	}>;
	deleteItem: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	deleteItems: TRPCMutationProcedure<{
		input: {
			ids: string[];
		};
		output: {
			success: boolean;
			count: number;
			ids: string[];
			missingIds: string[];
		};
		meta: object;
	}>;
	createItemGroup: TRPCMutationProcedure<{
		input: {
			groupName: string;
			parentId?: string | null | undefined;
			isGroup?: boolean | undefined;
			defaults?:
				| {
						company: string;
						defaultWarehouse?: string | null | undefined;
						defaultPriceList?: string | null | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.ItemGroup;
		meta: object;
	}>;
	updateItemGroup: TRPCMutationProcedure<{
		input: {
			id: string;
			groupName?: string | undefined;
			parentId?: string | null | undefined;
			isGroup?: boolean | undefined;
			defaults?:
				| {
						company: string;
						id?: string | undefined;
						defaultWarehouse?: string | null | undefined;
						defaultPriceList?: string | null | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.ItemGroup;
		meta: object;
	}>;
	deleteItemGroup: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	onItemGroupsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: ItemGroupsChangedEvent;
		meta: object;
	}>;
	onItemCreated: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: Inventory.Item;
		meta: object;
	}>;
	onItemUpdated: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: Inventory.Item;
		meta: object;
	}>;
	onItemDeleted: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: {
			id: string;
		};
		meta: object;
	}>;
	onItemsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: ItemsChangedEvent;
		meta: object;
	}>;
	listBatches: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					itemId?: string | undefined;
					warehouseId?: string | undefined;
					deliveryNoteId?: string | undefined;
					company?: string | undefined;
					status?: "ACTIVE" | "EMPTY" | "EXPIRED" | "DISABLED" | undefined;
					includeDisabled?: boolean | undefined;
					sortBy?:
						| "updatedAt"
						| "createdAt"
						| "batchId"
						| "itemCode"
						| "warehouse"
						| "expiryDate"
						| "quantity"
						| "company"
						| undefined;
					sortDirection?: "asc" | "desc" | undefined;
			  }
			| undefined;
		output: Inventory.BatchListResult;
		meta: object;
	}>;
	getBatchById: TRPCQueryProcedure<{
		input: { id: string };
		output: Inventory.Batch | null;
		meta: object;
	}>;
	createBatch: TRPCMutationProcedure<{
		input: {
			batchId: string;
			itemId: string;
			company: string;
			currentWarehouseId?: string | null | undefined;
			purchaseReceiptId?: string | null | undefined;
			deliveryNoteId?: string | null | undefined;
			stockEntryId?: string | null | undefined;
			useBatchWiseValuation?: boolean | undefined;
			manufacturingDate?: unknown;
			expiryDate?: unknown;
			description?: string | null | undefined;
			quantity?: number | undefined;
			isDisabled?: boolean | undefined;
		};
		output: Inventory.Batch;
		meta: object;
	}>;
	updateBatch: TRPCMutationProcedure<{
		input: {
			id: string;
			batchId?: string | undefined;
			itemId?: string | undefined;
			company?: string | undefined;
			currentWarehouseId?: string | null | undefined;
			purchaseReceiptId?: string | null | undefined;
			deliveryNoteId?: string | null | undefined;
			stockEntryId?: string | null | undefined;
			useBatchWiseValuation?: boolean | undefined;
			manufacturingDate?: unknown;
			expiryDate?: unknown;
			description?: string | null | undefined;
			quantity?: number | undefined;
			isDisabled?: boolean | undefined;
		};
		output: Inventory.Batch;
		meta: object;
	}>;
	deleteBatch: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	onBatchesChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: BatchesChangedEvent;
		meta: object;
	}>;
	listSerialNos: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					itemId?: string | undefined;
					warehouseId?: string | undefined;
					company?: string | undefined;
					status?:
						| "DRAFT"
						| "AVAILABLE"
						| "DELIVERED"
						| "INSTALLED"
						| "RETURNED"
						| "SCRAPPED"
						| "DISPOSED"
						| undefined;
					includeDisabled?: boolean | undefined;
					sortBy?:
						| "updatedAt"
						| "createdAt"
						| "serialNo"
						| "itemCode"
						| "warehouse"
						| "status"
						| "company"
						| undefined;
					sortDirection?: "asc" | "desc" | undefined;
			  }
			| undefined;
		output: Inventory.SerialNoListResult;
		meta: object;
	}>;
	listSerialNoServiceContractExpiry: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					itemId?: string | undefined;
					warehouseId?: string | undefined;
					company?: string | undefined;
					status?:
						| "DRAFT"
						| "AVAILABLE"
						| "DELIVERED"
						| "INSTALLED"
						| "RETURNED"
						| "SCRAPPED"
						| "DISPOSED"
						| undefined;
					includeDisabled?: boolean | undefined;
					expiryState?: "EXPIRED" | "DUE_SOON" | "ACTIVE" | undefined;
					expiryDateFrom?: unknown;
					expiryDateTo?: unknown;
					expiringWithinDays?: number | undefined;
					sortBy?:
						| "serviceContractExpiryDate"
						| "updatedAt"
						| "serialNo"
						| "itemCode"
						| "warehouse"
						| "status"
						| "company"
						| undefined;
					sortDirection?: "asc" | "desc" | undefined;
			  }
			| undefined;
		output: Inventory.SerialNoServiceContractExpiryListResult;
		meta: object;
	}>;
	listSerialNoWarrantyExpiry: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					itemId?: string | undefined;
					warehouseId?: string | undefined;
					company?: string | undefined;
					status?:
						| "DRAFT"
						| "AVAILABLE"
						| "DELIVERED"
						| "INSTALLED"
						| "RETURNED"
						| "SCRAPPED"
						| "DISPOSED"
						| undefined;
					includeDisabled?: boolean | undefined;
					expiryState?: "EXPIRED" | "DUE_SOON" | "ACTIVE" | undefined;
					expiryDateFrom?: unknown;
					expiryDateTo?: unknown;
					expiringWithinDays?: number | undefined;
					sortBy?:
						| "warrantyExpiryDate"
						| "updatedAt"
						| "serialNo"
						| "itemCode"
						| "warehouse"
						| "status"
						| "company"
						| undefined;
					sortDirection?: "asc" | "desc" | undefined;
			  }
			| undefined;
		output: Inventory.SerialNoWarrantyExpiryListResult;
		meta: object;
	}>;
	listSerialNoStatus: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					itemId?: string | undefined;
					warehouseId?: string | undefined;
					company?: string | undefined;
					status?:
						| "DRAFT"
						| "AVAILABLE"
						| "DELIVERED"
						| "INSTALLED"
						| "RETURNED"
						| "SCRAPPED"
						| "DISPOSED"
						| undefined;
					includeDisabled?: boolean | undefined;
					sortBy?:
						| "updatedAt"
						| "createdAt"
						| "serialNo"
						| "itemCode"
						| "warehouse"
						| "status"
						| "company"
						| undefined;
					sortDirection?: "asc" | "desc" | undefined;
			  }
			| undefined;
		output: Inventory.SerialNoStatusListResult;
		meta: object;
	}>;
	getSerialNoById: TRPCQueryProcedure<{
		input: { id: string };
		output: Inventory.SerialNo | null;
		meta: object;
	}>;
	createSerialNo: TRPCMutationProcedure<{
		input: {
			serialNo: string;
			itemId: string;
			company: string;
			status?:
				| "DRAFT"
				| "AVAILABLE"
				| "DELIVERED"
				| "INSTALLED"
				| "RETURNED"
				| "SCRAPPED"
				| "DISPOSED"
				| undefined;
			currentWarehouseId?: string | null | undefined;
			purchaseReceiptId?: string | null | undefined;
			deliveryNoteId?: string | null | undefined;
			stockEntryId?: string | null | undefined;
			pickListId?: string | null | undefined;
			workOrder?: string | null | undefined;
			purchaseDate?: unknown;
			warrantyExpiryDate?: unknown;
			serviceContractExpiryDate?: unknown;
			maintenanceStatus?: string | null | undefined;
			notes?: string | null | undefined;
			isDisabled?: boolean | undefined;
		};
		output: Inventory.SerialNo;
		meta: object;
	}>;
	updateSerialNo: TRPCMutationProcedure<{
		input: {
			id: string;
			serialNo?: string | undefined;
			itemId?: string | undefined;
			company?: string | undefined;
			status?:
				| "DRAFT"
				| "AVAILABLE"
				| "DELIVERED"
				| "INSTALLED"
				| "RETURNED"
				| "SCRAPPED"
				| "DISPOSED"
				| undefined;
			currentWarehouseId?: string | null | undefined;
			purchaseReceiptId?: string | null | undefined;
			deliveryNoteId?: string | null | undefined;
			stockEntryId?: string | null | undefined;
			pickListId?: string | null | undefined;
			workOrder?: string | null | undefined;
			purchaseDate?: unknown;
			warrantyExpiryDate?: unknown;
			serviceContractExpiryDate?: unknown;
			maintenanceStatus?: string | null | undefined;
			notes?: string | null | undefined;
			isDisabled?: boolean | undefined;
		};
		output: Inventory.SerialNo;
		meta: object;
	}>;
	deleteSerialNo: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
		meta: object;
	}>;
	onSerialNosChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: SerialNosChangedEvent;
		meta: object;
	}>;
	listInstallationNotes: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					status?:
						| "DRAFT"
						| "IN_PROGRESS"
						| "COMPLETED"
						| "CANCELLED"
						| undefined;
					company?: string | undefined;
					deliveryNoteId?: string | undefined;
					sortBy?:
						| "updatedAt"
						| "createdAt"
						| "series"
						| "installationDate"
						| "customer"
						| "status"
						| "company"
						| undefined;
					sortDirection?: "asc" | "desc" | undefined;
			  }
			| undefined;
		output: Inventory.InstallationNoteListResult;
		meta: object;
	}>;
	getInstallationNoteById: TRPCQueryProcedure<{
		input: { id: string };
		output: Inventory.InstallationNote | null;
		meta: object;
	}>;
	createInstallationNote: TRPCMutationProcedure<{
		input: {
			seriesPattern?: string | undefined;
			installationDate?: unknown;
			installationTime?: string | null | undefined;
			customer: string;
			customerName?: string | null | undefined;
			customerAddress?: string | null | undefined;
			contactPerson?: string | null | undefined;
			territory?: string | undefined;
			customerGroup?: string | null | undefined;
			company: string;
			status?: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined;
			deliveryNoteId?: string | null | undefined;
			remarks?: string | null | undefined;
			items: {
				itemId: string;
				serialNoId?: string | null | undefined;
				description?: string | null | undefined;
				installedQty: number;
			}[];
		};
		output: Inventory.InstallationNote;
		meta: object;
	}>;
	updateInstallationNote: TRPCMutationProcedure<{
		input: {
			id: string;
			installationDate?: unknown;
			installationTime?: string | null | undefined;
			customer?: string | undefined;
			customerName?: string | null | undefined;
			customerAddress?: string | null | undefined;
			contactPerson?: string | null | undefined;
			territory?: string | undefined;
			customerGroup?: string | null | undefined;
			company?: string | undefined;
			status?: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | undefined;
			deliveryNoteId?: string | null | undefined;
			remarks?: string | null | undefined;
			items?:
				| {
						id?: string | undefined;
						itemId: string;
						serialNoId?: string | null | undefined;
						description?: string | null | undefined;
						installedQty: number;
				  }[]
				| undefined;
		};
		output: Inventory.InstallationNote;
		meta: object;
	}>;
	deleteInstallationNote: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
		meta: object;
	}>;
	onInstallationNotesChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: InstallationNotesChangedEvent;
		meta: object;
	}>;
	listMaterialRequests: TRPCQueryProcedure<{
		input: void;
		output: Inventory.MaterialRequest[];
		meta: object;
	}>;
	getMaterialRequestById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.MaterialRequest | null;
		meta: object;
	}>;
	createMaterialRequest: TRPCMutationProcedure<{
		input: {
			company: string;
			transactionDate?: unknown;
			purpose?:
				| "PURCHASE"
				| "MANUFACTURE"
				| "MATERIAL_TRANSFER"
				| "MATERIAL_ISSUE"
				| "CUSTOMER_PROVIDED"
				| undefined;
			requiredBy?: unknown;
			targetWarehouse?: string | undefined;
			terms?: string | undefined;
			termsContent?: string | undefined;
			letterHead?: string | undefined;
			printHeading?: string | undefined;
			items: {
				itemCode: string;
				itemName?: string | undefined;
				requiredBy?: unknown;
				quantity: number;
				targetWarehouse?: string | undefined;
				unitOfMeasure?: string | undefined;
			}[];
		};
		output: Inventory.MaterialRequest;
		meta: object;
	}>;
	updateMaterialRequest: TRPCMutationProcedure<{
		input: {
			id: string;
			transactionDate?: unknown;
			purpose?:
				| "PURCHASE"
				| "MANUFACTURE"
				| "MATERIAL_TRANSFER"
				| "MATERIAL_ISSUE"
				| "CUSTOMER_PROVIDED"
				| undefined;
			company?: string | undefined;
			requiredBy?: unknown;
			status?:
				| "DRAFT"
				| "PENDING"
				| "APPROVED"
				| "ORDERED"
				| "PARTIALLY_ORDERED"
				| "PARTIALLY_RECEIVED"
				| "RECEIVED"
				| "CANCELLED"
				| undefined;
			targetWarehouse?: string | null | undefined;
			terms?: string | null | undefined;
			termsContent?: string | null | undefined;
			letterHead?: string | null | undefined;
			printHeading?: string | null | undefined;
			items?:
				| {
						id?: string | undefined;
						itemCode: string;
						itemName?: string | undefined;
						requiredBy?: unknown;
						quantity: number;
						targetWarehouse?: string | undefined;
						unitOfMeasure?: string | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.MaterialRequest;
		meta: object;
	}>;
	deleteMaterialRequest: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	deleteManyMaterialRequests: TRPCMutationProcedure<{
		input: {
			ids: string[];
		};
		output: {
			success: boolean;
			count: number;
			ids: string[];
		};
		meta: object;
	}>;
	onMaterialRequestsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: MaterialRequestsChangedEvent;
		meta: object;
	}>;
	listStockEntries: TRPCQueryProcedure<{
		input: void;
		output: Inventory.StockEntry[];
		meta: object;
	}>;
	getStockEntryById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.StockEntry | null;
		meta: object;
	}>;
	createStockEntry: TRPCMutationProcedure<{
		input: {
			stockEntryType:
				| "MATERIAL_RECEIPT"
				| "MATERIAL_ISSUE"
				| "MATERIAL_TRANSFER"
				| "MATERIAL_TRANSFER_FOR_MANUFACTURE"
				| "MANUFACTURE"
				| "REPACK"
				| "SEND_TO_SUBCONTRACTOR";
			postingDate?: unknown;
			company: string;
			project?: string | undefined;
			defaultSourceWarehouse?: string | undefined;
			defaultTargetWarehouse?: string | undefined;
			isOpening?: boolean | undefined;
			remarks?: string | undefined;
			printHeading?: string | undefined;
			letterHead?: string | undefined;
			inspectionRequired?: boolean | undefined;
			items: {
				sourceWarehouse?: string | undefined;
				targetWarehouse?: string | undefined;
				itemCode: string;
				itemName?: string | undefined;
				description?: string | undefined;
				qty: number;
				basicRate?: number | undefined;
				unitOfMeasure?: string | undefined;
			}[];
		};
		output: Inventory.StockEntry;
		meta: object;
	}>;
	updateStockEntry: TRPCMutationProcedure<{
		input: {
			id: string;
			stockEntryType?:
				| "MATERIAL_RECEIPT"
				| "MATERIAL_ISSUE"
				| "MATERIAL_TRANSFER"
				| "MATERIAL_TRANSFER_FOR_MANUFACTURE"
				| "MANUFACTURE"
				| "REPACK"
				| "SEND_TO_SUBCONTRACTOR"
				| undefined;
			postingDate?: unknown;
			company?: string | undefined;
			status?: "DRAFT" | "SUBMITTED" | "CANCELLED" | undefined;
			project?: string | null | undefined;
			defaultSourceWarehouse?: string | null | undefined;
			defaultTargetWarehouse?: string | null | undefined;
			isOpening?: boolean | undefined;
			remarks?: string | null | undefined;
			printHeading?: string | null | undefined;
			letterHead?: string | null | undefined;
			inspectionRequired?: boolean | undefined;
			items?:
				| {
						id?: string | undefined;
						sourceWarehouse?: string | undefined;
						targetWarehouse?: string | undefined;
						itemCode: string;
						itemName?: string | undefined;
						description?: string | undefined;
						qty: number;
						basicRate?: number | undefined;
						unitOfMeasure?: string | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.StockEntry;
		meta: object;
	}>;
	deleteStockEntry: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	deleteManyStockEntries: TRPCMutationProcedure<{
		input: {
			ids: string[];
		};
		output: {
			success: boolean;
			count: number;
			ids: string[];
		};
		meta: object;
	}>;
	onStockEntriesChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: StockEntriesChangedEvent;
		meta: object;
	}>;
	listStockLedger: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					company?: string | undefined;
					warehouse?: string | undefined;
					itemCode?: string | undefined;
					itemGroup?: string | undefined;
					brand?: string | undefined;
					voucherNo?: string | undefined;
					stockEntryType?:
						| "MATERIAL_RECEIPT"
						| "MATERIAL_ISSUE"
						| "MATERIAL_TRANSFER"
						| "MATERIAL_TRANSFER_FOR_MANUFACTURE"
						| "MANUFACTURE"
						| "REPACK"
						| "SEND_TO_SUBCONTRACTOR"
						| undefined;
					status?: "DRAFT" | "SUBMITTED" | "CANCELLED" | undefined;
					project?: string | undefined;
					dateFrom?: unknown;
					dateTo?: unknown;
			  }
			| undefined;
		output: Inventory.StockLedgerRow[];
		meta: object;
	}>;
	listStockBalance: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					company?: string | undefined;
					warehouse?: string | undefined;
					itemCode?: string | undefined;
					itemGroup?: string | undefined;
					brand?: string | undefined;
					project?: string | undefined;
					status?: "DRAFT" | "SUBMITTED" | "CANCELLED" | undefined;
					dateFrom?: unknown;
					dateTo?: unknown;
					includeZeroStockItems?: boolean | undefined;
			  }
			| undefined;
		output: Inventory.StockBalanceRow[];
		meta: object;
	}>;
	listStockProjectedQty: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					company?: string | undefined;
					warehouse?: string | undefined;
					itemCode?: string | undefined;
					itemGroup?: string | undefined;
					brand?: string | undefined;
					includeZeroStockItems?: boolean | undefined;
			  }
			| undefined;
		output: Inventory.StockProjectedQtyRow[];
		meta: object;
	}>;
	listStockSummary: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					company?: string | undefined;
					warehouse?: string | undefined;
					itemCode?: string | undefined;
					itemGroup?: string | undefined;
					brand?: string | undefined;
					metric?:
						| "PROJECTED_QTY"
						| "ACTUAL_QTY"
						| "RESERVED_QTY"
						| "RESERVED_QTY_FOR_PRODUCTION"
						| "RESERVED_QTY_FOR_SUBCONTRACTING"
						| "SHORTAGE_QTY"
						| undefined;
					sortDirection?: "asc" | "desc" | undefined;
					includeZeroStockItems?: boolean | undefined;
			  }
			| undefined;
		output: Inventory.StockSummaryRow[];
		meta: object;
	}>;
	listStockAgeing: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					company?: string | undefined;
					warehouse?: string | undefined;
					itemCode?: string | undefined;
					brand?: string | undefined;
					asOfDate?: unknown;
					showWarehouseWiseStock?: boolean | undefined;
					ageingRanges?: string | undefined;
			  }
			| undefined;
		output: Inventory.StockAgeingRow[];
		meta: object;
	}>;
	listItemPriceStock: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					company?: string | undefined;
					warehouse?: string | undefined;
					itemCode?: string | undefined;
					itemGroup?: string | undefined;
					brand?: string | undefined;
					includeZeroStockItems?: boolean | undefined;
			  }
			| undefined;
		output: Inventory.ItemPriceStockRow[];
		meta: object;
	}>;
	listWarehouseWiseStockBalance: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					company?: string | undefined;
					warehouse?: string | undefined;
					itemCode?: string | undefined;
					voucherNo?: string | undefined;
					status?: "DRAFT" | "SUBMITTED" | "CANCELLED" | undefined;
					dateFrom?: unknown;
					dateTo?: unknown;
			  }
			| undefined;
		output: Inventory.WarehouseWiseStockBalanceRow[];
		meta: object;
	}>;
	listDeliveryNotes: TRPCQueryProcedure<{
		input: void;
		output: Inventory.DeliveryNote[];
		meta: object;
	}>;
	getDeliveryNoteById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.DeliveryNote | null;
		meta: object;
	}>;
	createDeliveryNote: TRPCMutationProcedure<{
		input: {
			customer: string;
			company: string;
			postingDate?: unknown;
			isReturn?: boolean | undefined;
			currency?: string | undefined;
			priceList?: string | undefined;
			sourceWarehouse?: string | undefined;
			additionalDiscountOn?: string | undefined;
			additionalDiscountPercent?: number | undefined;
			additionalDiscountAmount?: number | undefined;
			shippingAddress?: string | undefined;
			dispatchAddress?: string | undefined;
			companyAddress?: string | undefined;
			companyContact?: string | undefined;
			companyTRN?: string | undefined;
			terms?: string | undefined;
			termsContent?: string | undefined;
			transporter?: string | undefined;
			driverName?: string | undefined;
			driver?: string | undefined;
			transportReceiptDate?: unknown;
			transportReceiptNo?: string | undefined;
			vehicleNo?: string | undefined;
			customerPoNo?: string | undefined;
			customerPoDate?: unknown;
			salesPartner?: string | undefined;
			commissionRate?: number | undefined;
			letterHead?: string | undefined;
			printHeading?: string | undefined;
			printWithoutAmount?: boolean | undefined;
			groupSameItems?: boolean | undefined;
			permitNumber?: string | undefined;
			vatEmirate?: string | undefined;
			project?: string | undefined;
			items: {
				itemCode: string;
				itemName?: string | undefined;
				description?: string | undefined;
				quantity: number;
				uom?: string | undefined;
				rate?: number | undefined;
				warehouse?: string | undefined;
			}[];
		};
		output: Inventory.DeliveryNote;
		meta: object;
	}>;
	updateDeliveryNote: TRPCMutationProcedure<{
		input: {
			id: string;
			postingDate?: unknown;
			customer?: string | undefined;
			company?: string | undefined;
			status?:
				| "DRAFT"
				| "TO_BILL"
				| "COMPLETED"
				| "RETURN_ISSUED"
				| "CANCELLED"
				| "CLOSED"
				| undefined;
			isReturn?: boolean | undefined;
			currency?: string | null | undefined;
			priceList?: string | null | undefined;
			sourceWarehouse?: string | null | undefined;
			additionalDiscountOn?: string | null | undefined;
			additionalDiscountPercent?: number | null | undefined;
			additionalDiscountAmount?: number | null | undefined;
			shippingAddress?: string | null | undefined;
			dispatchAddress?: string | null | undefined;
			companyAddress?: string | null | undefined;
			companyContact?: string | null | undefined;
			companyTRN?: string | null | undefined;
			terms?: string | null | undefined;
			termsContent?: string | null | undefined;
			transporter?: string | null | undefined;
			driverName?: string | null | undefined;
			driver?: string | null | undefined;
			transportReceiptDate?: unknown;
			transportReceiptNo?: string | null | undefined;
			vehicleNo?: string | null | undefined;
			customerPoNo?: string | null | undefined;
			customerPoDate?: unknown;
			salesPartner?: string | null | undefined;
			commissionRate?: number | null | undefined;
			letterHead?: string | null | undefined;
			printHeading?: string | null | undefined;
			printWithoutAmount?: boolean | undefined;
			groupSameItems?: boolean | undefined;
			permitNumber?: string | null | undefined;
			vatEmirate?: string | null | undefined;
			project?: string | null | undefined;
			items?:
				| {
						id?: string | undefined;
						itemCode: string;
						itemName?: string | undefined;
						description?: string | undefined;
						quantity: number;
						uom?: string | undefined;
						rate?: number | undefined;
						warehouse?: string | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.DeliveryNote;
		meta: object;
	}>;
	deleteDeliveryNote: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	deleteManyDeliveryNotes: TRPCMutationProcedure<{
		input: {
			ids: string[];
		};
		output: {
			success: boolean;
			count: number;
			ids: string[];
		};
		meta: object;
	}>;
	onDeliveryNotesChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: DeliveryNotesChangedEvent;
		meta: object;
	}>;
	listPurchaseReceipts: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					status?:
						| "DRAFT"
						| "PARTLY_BILLED"
						| "TO_BILL"
						| "COMPLETED"
						| "RETURN_ISSUED"
						| "CANCELLED"
						| "CLOSED"
						| undefined;
			  }
			| undefined;
		output: Inventory.PurchaseReceipt[];
		meta: object;
	}>;
	getPurchaseReceiptById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.PurchaseReceipt | null;
		meta: object;
	}>;
	createPurchaseReceipt: TRPCMutationProcedure<{
		input: {
			supplier: string;
			company: string;
			items: {
				itemCode: string;
				acceptedQuantity: number;
				itemName?: string | undefined;
				description?: string | undefined;
				rejectedQuantity?: number | undefined;
				rate?: number | undefined;
				uom?: string | undefined;
				acceptedWarehouse?: string | undefined;
				rejectedWarehouse?: string | undefined;
			}[];
			seriesPattern?: string | undefined;
			postingDate?: unknown;
			postingTime?: string | undefined;
			editPostingDateTime?: boolean | undefined;
			status?:
				| "DRAFT"
				| "PARTLY_BILLED"
				| "TO_BILL"
				| "COMPLETED"
				| "RETURN_ISSUED"
				| "CANCELLED"
				| "CLOSED"
				| undefined;
			isReturn?: boolean | undefined;
			applyPutawayRule?: boolean | undefined;
			supplierDeliveryNote?: string | undefined;
			acceptedWarehouse?: string | undefined;
			rejectedWarehouse?: string | undefined;
			isSubcontracted?: boolean | undefined;
			currency?: string | undefined;
			priceList?: string | undefined;
			disableRoundedTotal?: boolean | undefined;
			supplierAddress?: string | undefined;
			contactPerson?: string | undefined;
			shippingAddressTemplate?: string | undefined;
			companyTRN?: string | undefined;
			billingAddress?: string | undefined;
			terms?: string | undefined;
			termsContent?: string | undefined;
			letterHead?: string | undefined;
			printHeading?: string | undefined;
			groupSameItems?: boolean | undefined;
			permitNumber?: string | undefined;
			recoverableStandardRatedExpenses?: number | undefined;
			reverseChargeApplicable?: "Y" | "N" | undefined;
			transporterName?: string | undefined;
			vehicleNumber?: string | undefined;
			vehicleDate?: unknown;
			instructions?: string | undefined;
			remarks?: string | undefined;
			isInternalSupplier?: boolean | undefined;
			taxes?:
				| {
						type: string;
						accountHead: string;
						taxRate?: number | undefined;
						amount?: number | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.PurchaseReceipt;
		meta: object;
	}>;
	updatePurchaseReceipt: TRPCMutationProcedure<{
		input: {
			id: string;
			seriesPattern?: string | null | undefined;
			postingDate?: unknown;
			postingTime?: string | null | undefined;
			editPostingDateTime?: boolean | undefined;
			supplier?: string | undefined;
			company?: string | undefined;
			status?:
				| "DRAFT"
				| "PARTLY_BILLED"
				| "TO_BILL"
				| "COMPLETED"
				| "RETURN_ISSUED"
				| "CANCELLED"
				| "CLOSED"
				| undefined;
			isReturn?: boolean | undefined;
			applyPutawayRule?: boolean | undefined;
			supplierDeliveryNote?: string | null | undefined;
			acceptedWarehouse?: string | null | undefined;
			rejectedWarehouse?: string | null | undefined;
			isSubcontracted?: boolean | undefined;
			currency?: string | null | undefined;
			priceList?: string | null | undefined;
			disableRoundedTotal?: boolean | undefined;
			supplierAddress?: string | null | undefined;
			contactPerson?: string | null | undefined;
			shippingAddressTemplate?: string | null | undefined;
			companyTRN?: string | null | undefined;
			billingAddress?: string | null | undefined;
			terms?: string | null | undefined;
			termsContent?: string | null | undefined;
			letterHead?: string | null | undefined;
			printHeading?: string | null | undefined;
			groupSameItems?: boolean | undefined;
			permitNumber?: string | null | undefined;
			recoverableStandardRatedExpenses?: number | undefined;
			reverseChargeApplicable?: "Y" | "N" | undefined;
			transporterName?: string | null | undefined;
			vehicleNumber?: string | null | undefined;
			vehicleDate?: unknown;
			instructions?: string | null | undefined;
			remarks?: string | null | undefined;
			isInternalSupplier?: boolean | undefined;
			items?:
				| {
						id?: string | undefined;
						itemCode: string;
						acceptedQuantity: number;
						itemName?: string | undefined;
						description?: string | undefined;
						rejectedQuantity?: number | undefined;
						rate?: number | undefined;
						uom?: string | undefined;
						acceptedWarehouse?: string | undefined;
						rejectedWarehouse?: string | undefined;
				  }[]
				| undefined;
			taxes?:
				| {
						id?: string | undefined;
						type: string;
						accountHead: string;
						taxRate?: number | undefined;
						amount?: number | undefined;
				  }[]
				| undefined;
		};
		output: Inventory.PurchaseReceipt;
		meta: object;
	}>;
	deletePurchaseReceipt: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	deleteManyPurchaseReceipts: TRPCMutationProcedure<{
		input: {
			ids: string[];
		};
		output: {
			success: boolean;
			count: number;
			ids: string[];
		};
		meta: object;
	}>;
	listPickLists: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					status?: "DRAFT" | "OPEN" | "COMPLETED" | "CANCELLED" | undefined;
			  }
			| undefined;
		output: Inventory.PickList[];
		meta: object;
	}>;
	getPickListById: TRPCQueryProcedure<{
		input: {
			id: string;
		};
		output: Inventory.PickList | null;
		meta: object;
	}>;
	createPickList: TRPCMutationProcedure<{
		input: {
			company: string;
			customer?: string | undefined;
			status?: "DRAFT" | "OPEN" | "COMPLETED" | "CANCELLED" | undefined;
			purpose?:
				| "MATERIAL_TRANSFER_FOR_MANUFACTURE"
				| "DELIVERY"
				| "MATERIAL_TRANSFER"
				| undefined;
			workOrder?: string | undefined;
			warehouse?: string | undefined;
			considerRejectedWarehouses?: boolean | undefined;
			pickManually?: boolean | undefined;
			ignorePricingRule?: boolean | undefined;
			scanMode?: boolean | undefined;
			promptQty?: boolean | undefined;
			scanBarcode?: string | undefined;
			groupSameItems?: boolean | undefined;
			items?: Array<{
				item: string;
				qty: number;
				warehouse?: string | undefined;
				stockQty?: number | undefined;
				pickedQty?: number | undefined;
			}>;
		};
		output: Inventory.PickList;
		meta: object;
	}>;
	updatePickList: TRPCMutationProcedure<{
		input: {
			id: string;
			company?: string | undefined;
			customer?: string | null | undefined;
			status?: "DRAFT" | "OPEN" | "COMPLETED" | "CANCELLED" | undefined;
			purpose?:
				| "MATERIAL_TRANSFER_FOR_MANUFACTURE"
				| "DELIVERY"
				| "MATERIAL_TRANSFER"
				| undefined;
			workOrder?: string | null | undefined;
			warehouse?: string | null | undefined;
			considerRejectedWarehouses?: boolean | undefined;
			pickManually?: boolean | undefined;
			ignorePricingRule?: boolean | undefined;
			scanMode?: boolean | undefined;
			promptQty?: boolean | undefined;
			scanBarcode?: string | null | undefined;
			groupSameItems?: boolean | undefined;
			items?: Array<{
				id?: string | undefined;
				item: string;
				qty: number;
				warehouse?: string | null | undefined;
				stockQty?: number | null | undefined;
				pickedQty?: number | null | undefined;
			}>;
		};
		output: Inventory.PickList;
		meta: object;
	}>;
	deletePickList: TRPCMutationProcedure<{
		input: {
			id: string;
		};
		output: {
			success: boolean;
			id: string;
		};
		meta: object;
	}>;
	deleteManyPickLists: TRPCMutationProcedure<{
		input: {
			ids: string[];
		};
		output: {
			success: boolean;
			count: number;
			ids: string[];
		};
		meta: object;
	}>;
	onPickListsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: PickListsChangedEvent;
		meta: object;
	}>;
	listDeliveryTrips: TRPCQueryProcedure<{
		input:
			| {
					skip?: number | undefined;
					take?: number | undefined;
					search?: string | undefined;
					status?: Inventory.DeliveryTripStatus | undefined;
			  }
			| undefined;
		output: Inventory.DeliveryTrip[];
		meta: object;
	}>;
	getDeliveryTripById: TRPCQueryProcedure<{
		input: { id: string };
		output: Inventory.DeliveryTrip | null;
		meta: object;
	}>;
	createDeliveryTrip: TRPCMutationProcedure<{
		input: {
			company: string;
			driver?: string | undefined;
			driverAddress?: string | undefined;
			vehicle?: string | undefined;
			departureTime?: unknown;
			status?: Inventory.DeliveryTripStatus | undefined;
			initialEmailNotificationSent?: boolean | undefined;
			stops?: Array<{
				stopNumber: number;
				customer?: string | undefined;
				addressName: string;
				locked?: boolean | undefined;
				deliveryNote?: string | undefined;
				estimatedArrival?: unknown;
			}>;
		};
		output: Inventory.DeliveryTrip;
		meta: object;
	}>;
	updateDeliveryTrip: TRPCMutationProcedure<{
		input: {
			id: string;
			company?: string | undefined;
			driver?: string | null | undefined;
			driverAddress?: string | null | undefined;
			vehicle?: string | null | undefined;
			departureTime?: unknown;
			status?: Inventory.DeliveryTripStatus | undefined;
			initialEmailNotificationSent?: boolean | undefined;
			stops?: Array<{
				id?: string | undefined;
				stopNumber: number;
				customer?: string | null | undefined;
				addressName: string;
				locked?: boolean | undefined;
				deliveryNote?: string | null | undefined;
				estimatedArrival?: unknown;
			}>;
		};
		output: Inventory.DeliveryTrip;
		meta: object;
	}>;
	deleteDeliveryTrip: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
		meta: object;
	}>;
	deleteManyDeliveryTrips: TRPCMutationProcedure<{
		input: { ids: string[] };
		output: { success: boolean; count: number; ids: string[] };
		meta: object;
	}>;
	onDeliveryTripsChanged: LegacyObservableSubscriptionProcedure<{
		input: void;
		output: DeliveryTripsChangedEvent;
		meta: object;
	}>;
	listPackingSlips: TRPCQueryProcedure<{
		input:
			| {
					deliveryNoteId?: string | undefined;
					status?: Inventory.PackingSlipStatus | undefined;
					skip?: number | undefined;
					take?: number | undefined;
			  }
			| undefined;
		output: Inventory.PackingSlip[];
		meta: object;
	}>;
	getPackingSlipById: TRPCQueryProcedure<{
		input: { id: string };
		output: Inventory.PackingSlip | null;
		meta: object;
	}>;
	getRecommendedCaseNo: TRPCQueryProcedure<{
		input: { deliveryNoteId: string };
		output: number;
		meta: object;
	}>;
	createPackingSlip: TRPCMutationProcedure<{
		input: {
			deliveryNoteId: string;
			fromCaseNo: number;
			toCaseNo?: number | undefined;
			grossWeightPkg?: number | undefined;
			grossWeightUom?: string | null | undefined;
			letterHead?: string | null | undefined;
			items: Array<{
				deliveryNoteItemId: string;
				itemCode: string;
				itemName?: string | null | undefined;
				description?: string | null | undefined;
				qty: number;
				netWeight?: number | undefined;
				weightUom?: string | null | undefined;
				batchNo?: string | null | undefined;
			}>;
		};
		output: Inventory.PackingSlip;
		meta: object;
	}>;
	updatePackingSlip: TRPCMutationProcedure<{
		input: {
			id: string;
			fromCaseNo?: number | undefined;
			toCaseNo?: number | undefined;
			grossWeightPkg?: number | undefined;
			grossWeightUom?: string | null | undefined;
			letterHead?: string | null | undefined;
			items?: Array<{
				id?: string | undefined;
				deliveryNoteItemId: string;
				itemCode: string;
				itemName?: string | null | undefined;
				description?: string | null | undefined;
				qty: number;
				netWeight?: number | undefined;
				weightUom?: string | null | undefined;
				batchNo?: string | null | undefined;
			}>;
		};
		output: Inventory.PackingSlip;
		meta: object;
	}>;
	submitPackingSlip: TRPCMutationProcedure<{
		input: { id: string };
		output: Inventory.PackingSlip;
		meta: object;
	}>;
	cancelPackingSlip: TRPCMutationProcedure<{
		input: { id: string };
		output: Inventory.PackingSlip;
		meta: object;
	}>;
	deletePackingSlip: TRPCMutationProcedure<{
		input: { id: string };
		output: { success: boolean; id: string };
		meta: object;
	}>;
	deleteManyPackingSlips: TRPCMutationProcedure<{
		input: { ids: string[] };
		output: { success: boolean; count: number; ids: string[] };
		meta: object;
	}>;
};

type InventoryRouterRoot = (typeof accountRouter)["_def"]["_config"]["$types"];
type InventoryRouterRecord =
	TRPCDecorateCreateRouterOptions<InventoryRouterInput>;

export declare const inventoryRouter: TRPCBuiltRouter<
	InventoryRouterRoot,
	InventoryRouterRecord
>;
