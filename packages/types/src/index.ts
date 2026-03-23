import { z } from "zod";

// ============================================================================
// API Response Contracts
// ============================================================================

/**
 * Pagination parameters for API requests
 * @example { page: 1, pageSize: 10 }
 */
export interface Pagination {
	/** Current page number (1-based) */
	page: number;
	/** Number of items per page */
	pageSize: number;
}

/**
 * Standard API response wrapper
 * @template T - The type of data being returned
 * @example ApiResponse<Product[]> for a list of products
 */
export interface ApiResponse<T> {
	/** The actual data payload */
	data: T;
	/** Optional pagination info for list responses */
	pagination?: Pagination;
}

// ============================================================================
// Inventory Domain Types & Schemas
// ============================================================================

/**
 * Inventory namespace - groups all inventory-related types
 * Use: import { Inventory } from '@aria/types'; then Inventory.Item, etc.
 */
export namespace Inventory {
	/**
	 * Item Group entity - for categorizing items
	 */
	export interface ItemGroup {
		/** Unique identifier (CUID) */
		id: string;
		/** Group name */
		groupName: string;
		/** Parent item group ID for hierarchy */
		parentId?: string | null;
		/** Parent item group name */
		parentGroupName?: string | null;
		/** Whether this is a group (can contain children) */
		isGroup: boolean;
		/** Default settings for this item group */
		defaults?: ItemGroupDefault[];
		/** When this group was created */
		createdAt: Date;
		/** When this group was last updated */
		updatedAt: Date;
	}

	/**
	 * Default settings for an Item Group per company
	 */
	export interface ItemGroupDefault {
		/** Unique identifier (CUID) */
		id?: string;
		/** Company name/reference */
		company: string;
		/** Default warehouse for items in this group */
		defaultWarehouse?: string | null;
		/** Default price list for items in this group */
		defaultPriceList?: string | null;
	}

	/**
	 * Unit of Measurement entity
	 */
	export interface UnitOfMeasure {
		/** Unique identifier (CUID) */
		id: string;
		/** Unit name (e.g., "Nos", "Kg", "Pcs") */
		name: string;
		/** Whether this unit is disabled in selection lists */
		disabled: boolean;
		/** Whether the unit represents whole numbers only */
		isWholeNumber: boolean;
		/** When this unit was created */
		createdAt: Date;
		/** When this unit was last updated */
		updatedAt: Date;
	}

	/**
	 * Input for creating a unit of measure
	 */
	export interface CreateUnitOfMeasureInput {
		name: string;
		disabled?: boolean;
		isWholeNumber?: boolean;
	}

	/**
	 * Input for updating a unit of measure
	 */
	export interface UpdateUnitOfMeasureInput {
		id: string;
		name?: string;
		disabled?: boolean;
		isWholeNumber?: boolean;
	}

	export interface ItemBarcode {
		id?: string;
		barcode: string;
		barcodeType?: string | null;
		uom?: string | null;
	}

	export interface ItemReorder {
		id?: string;
		warehouse: string;
		reorderLevel?: number;
		reorderQty?: number;
		materialRequestType?: string | null;
	}

	/**
	 * Inventory item entity - matches the database schema
	 * All fields are required in the database
	 */
	export interface Item {
		/** Unique identifier (CUID) */
		id: string;
		/** Item name/title */
		name: string;
		/** Unique product code (formerly SKU) */
		code: string;
		/** Current quantity in stock */
		quantity: number;
		/** Item description */
		description?: string | null;
		/** Whether the item is disabled */
		disabled: boolean;
		/** Whether to maintain stock levels for this item */
		maintainStock: boolean;
		/** Whether alternate items are allowed */
		allowAlternateItem: boolean;
		/** Whether this item has variants */
		hasVariants: boolean;
		/** Opening stock quantity */
		openingStock: number;
		/** Valuation rate for inventory costing */
		valuationRate?: number | null;
		/** Standard selling rate */
		standardSellingRate?: number | null;
		/** Whether item is zero-rated for tax */
		isZeroRated: boolean;
		/** Whether item is tax exempt */
		isExempt: boolean;
		/** Whether item is a fixed asset */
		isFixedAsset: boolean;
		/** Tax code reference */
		taxCode?: string | null;
		/** Shelf life in days */
		shelfLifeInDays?: number | null;
		/** Warranty period in days */
		warrantyPeriodInDays?: number | null;
		/** End-of-life date */
		endOfLife?: Date | null;
		/** Weight per unit */
		weightPerUnit?: number | null;
		/** Weight UOM label */
		weightUom?: string | null;
		/** Whether negative stock is allowed */
		allowNegativeStock: boolean;
		/** Valuation method reference */
		valuationMethod?: string | null;
		/** Default material request type */
		defaultMaterialRequestType?: string | null;
		/** Whether batches are tracked */
		hasBatchNo: boolean;
		/** Whether serial numbers are tracked */
		hasSerialNo: boolean;
		/** Item barcode list */
		barcodes: ItemBarcode[];
		/** Item reorder settings */
		reorderSettings: ItemReorder[];
		/** Reference to item group */
		itemGroupId?: string | null;
		/** Item group name (populated from relation) */
		itemGroupName?: string | null;
		/** Reference to default unit of measure */
		defaultUnitOfMeasureId?: string | null;
		/** When this item was created */
		createdAt: Date;
		/** When this item was last updated */
		updatedAt: Date;
	}

	/**
	 * Input for creating a new inventory item
	 */
	export interface CreateInput {
		name: string;
		code: string;
		quantity?: number;
		description?: string;
		disabled?: boolean;
		maintainStock?: boolean;
		allowAlternateItem?: boolean;
		hasVariants?: boolean;
		openingStock?: number;
		valuationRate?: number;
		standardSellingRate?: number;
		isZeroRated?: boolean;
		isExempt?: boolean;
		isFixedAsset?: boolean;
		taxCode?: string;
		shelfLifeInDays?: number;
		warrantyPeriodInDays?: number;
		endOfLife?: Date;
		weightPerUnit?: number;
		weightUom?: string;
		allowNegativeStock?: boolean;
		valuationMethod?: string;
		defaultMaterialRequestType?: string;
		hasBatchNo?: boolean;
		hasSerialNo?: boolean;
		barcodes?: ItemBarcode[];
		reorderSettings?: ItemReorder[];
		itemGroupId?: string;
		defaultUnitOfMeasureId?: string;
	}

	/**
	 * Input for updating an existing inventory item
	 */
	export interface UpdateInput {
		id: string;
		name?: string;
		code?: string;
		quantity?: number;
		description?: string;
		disabled?: boolean;
		maintainStock?: boolean;
		allowAlternateItem?: boolean;
		hasVariants?: boolean;
		openingStock?: number;
		valuationRate?: number;
		standardSellingRate?: number;
		isZeroRated?: boolean;
		isExempt?: boolean;
		isFixedAsset?: boolean;
		taxCode?: string;
		shelfLifeInDays?: number;
		warrantyPeriodInDays?: number;
		endOfLife?: Date;
		weightPerUnit?: number;
		weightUom?: string;
		allowNegativeStock?: boolean;
		valuationMethod?: string;
		defaultMaterialRequestType?: string;
		hasBatchNo?: boolean;
		hasSerialNo?: boolean;
		barcodes?: ItemBarcode[];
		reorderSettings?: ItemReorder[];
		itemGroupId?: string;
		defaultUnitOfMeasureId?: string;
	}

	/**
	 * Input for creating a new item group
	 */
	export interface CreateGroupInput {
		groupName: string;
		parentId?: string | null;
		isGroup: boolean;
		defaults?: ItemGroupDefault[];
	}

	/**
	 * Input for updating an existing item group
	 */
	export interface UpdateGroupInput {
		id: string;
		groupName?: string;
		parentId?: string | null;
		isGroup?: boolean;
		defaults?: ItemGroupDefault[];
	}

	/**
	 * Product bundle item row
	 */
	export interface ProductBundleItem {
		id: string;
		bundleId: string;
		itemId: string;
		itemName?: string | null;
		quantity: number;
		description?: string | null;
		unitOfMeasurementId?: string | null;
		unitOfMeasurementName?: string | null;
		createdAt: Date;
		updatedAt: Date;
	}

	/**
	 * Product bundle aggregate
	 */
	export interface ProductBundle {
		id: string;
		parentItemId: string;
		parentItemName?: string | null;
		description?: string | null;
		disabled: boolean;
		bundleItems: ProductBundleItem[];
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreateProductBundleItemInput {
		itemId: string;
		quantity: number;
		description?: string;
		unitOfMeasurementId?: string;
	}

	export interface CreateProductBundleInput {
		parentItemId: string;
		description?: string;
		disabled?: boolean;
		bundleItems: CreateProductBundleItemInput[];
	}

	export interface UpdateProductBundleItemInput {
		id?: string;
		itemId: string;
		quantity: number;
		description?: string;
		unitOfMeasurementId?: string;
	}

	export interface UpdateProductBundleInput {
		id: string;
		parentItemId?: string;
		description?: string;
		disabled?: boolean;
		bundleItems?: UpdateProductBundleItemInput[];
	}

	/**
	 * Item alternative mapping between two inventory items.
	 */
	export interface ItemAlternative {
		id: string;
		itemId: string;
		itemCode: string;
		itemName?: string | null;
		alternativeItemId: string;
		alternativeItemCode: string;
		alternativeItemName?: string | null;
		twoWay?: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreateItemAlternativeInput {
		itemId: string;
		alternativeItemId: string;
		twoWay?: boolean;
	}

	export interface UpdateItemAlternativeInput {
		id: string;
		itemId?: string;
		alternativeItemId?: string;
		twoWay?: boolean;
	}

	/**
	 * Item manufacturer mapping for an inventory item.
	 */
	export interface ItemManufacturer {
		id: string;
		itemId: string;
		itemCode: string;
		itemName?: string | null;
		itemDescription?: string | null;
		manufacturer: string;
		manufacturerPartNumber: string;
		isDefault: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreateItemManufacturerInput {
		itemId: string;
		manufacturer: string;
		manufacturerPartNumber: string;
		isDefault?: boolean;
	}

	export interface UpdateItemManufacturerInput {
		id: string;
		itemId?: string;
		manufacturer?: string;
		manufacturerPartNumber?: string;
		isDefault?: boolean;
	}

	export type ShippingRuleType = "SELLING" | "BUYING";
	export type ShippingRuleCalculationType =
		| "FIXED"
		| "NET_TOTAL"
		| "NET_WEIGHT";

	/**
	 * Shipping rule entity
	 */
	export interface ShippingRule {
		id: string;
		shippingRuleLabel: string;
		shippingRuleType: ShippingRuleType;
		disabled: boolean;
		calculateBasedOn: ShippingRuleCalculationType;
		shippingAmount: number;
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreateShippingRuleInput {
		shippingRuleLabel: string;
		shippingRuleType: ShippingRuleType;
		disabled?: boolean;
		calculateBasedOn: ShippingRuleCalculationType;
		shippingAmount?: number;
	}

	export interface UpdateShippingRuleInput {
		id: string;
		shippingRuleLabel?: string;
		shippingRuleType?: ShippingRuleType;
		disabled?: boolean;
		calculateBasedOn?: ShippingRuleCalculationType;
		shippingAmount?: number;
	}

	/**
	 * Item option used in Product Bundle pickers.
	 */
	export interface BundleSelectableItem {
		id: string;
		name: string;
		code: string;
		description?: string | null;
		defaultUnitOfMeasureId?: string | null;
	}

	export interface BulkDeleteInput {
		ids: string[];
	}

	// ============================================================================
	// Zod Schemas - Runtime Validation
	// ============================================================================

	/**
	 * Validation schema for creating inventory items
	 */
	export const createSchema = z.object({
		name: z.string().min(1, "Name is required").max(255).trim(),
		code: z.string().min(1, "Code is required").max(100).trim().toUpperCase(),
		quantity: z.number().int().min(0).default(0),
		description: z.string().max(1000).optional(),
		disabled: z.boolean().default(false),
		maintainStock: z.boolean().default(true),
		allowAlternateItem: z.boolean().default(false),
		hasVariants: z.boolean().default(false),
		openingStock: z.number().int().min(0).default(0),
		valuationRate: z.number().min(0).optional(),
		standardSellingRate: z.number().min(0).optional(),
		isZeroRated: z.boolean().default(false),
		isExempt: z.boolean().default(false),
		isFixedAsset: z.boolean().default(false),
		taxCode: z.string().max(50).optional(),
		shelfLifeInDays: z.number().int().min(0).optional(),
		warrantyPeriodInDays: z.number().int().min(0).optional(),
		endOfLife: z.coerce.date().optional(),
		weightPerUnit: z.number().min(0).optional(),
		weightUom: z.string().max(50).optional(),
		allowNegativeStock: z.boolean().default(false),
		valuationMethod: z.string().max(50).optional(),
		defaultMaterialRequestType: z.string().max(50).optional(),
		hasBatchNo: z.boolean().default(false),
		hasSerialNo: z.boolean().default(false),
		barcodes: z
			.array(
				z.object({
					barcode: z.string().min(1).max(255).trim(),
					barcodeType: z.string().max(100).optional().nullable(),
					uom: z.string().max(50).optional().nullable(),
				}),
			)
			.optional(),
		reorderSettings: z
			.array(
				z.object({
					warehouse: z.string().min(1).max(255).trim(),
					reorderLevel: z.number().min(0).optional(),
					reorderQty: z.number().min(0).optional(),
					materialRequestType: z.string().max(100).optional().nullable(),
				}),
			)
			.optional(),
		itemGroupId: z.string().cuid().optional(),
		defaultUnitOfMeasureId: z.string().cuid().optional(),
	});

	/**
	 * Validation schema for updating inventory items
	 */
	export const updateSchema = z.object({
		id: z.cuid(),
		name: z.string().min(1).max(255).trim().optional(),
		code: z.string().min(1).max(100).trim().toUpperCase().optional(),
		quantity: z.number().int().min(0).optional(),
		description: z.string().max(1000).optional(),
		disabled: z.boolean().optional(),
		maintainStock: z.boolean().optional(),
		allowAlternateItem: z.boolean().optional(),
		hasVariants: z.boolean().optional(),
		openingStock: z.number().int().min(0).optional(),
		valuationRate: z.number().min(0).optional(),
		standardSellingRate: z.number().min(0).optional(),
		isZeroRated: z.boolean().optional(),
		isExempt: z.boolean().optional(),
		isFixedAsset: z.boolean().optional(),
		taxCode: z.string().max(50).optional(),
		shelfLifeInDays: z.number().int().min(0).optional(),
		warrantyPeriodInDays: z.number().int().min(0).optional(),
		endOfLife: z.coerce.date().optional(),
		weightPerUnit: z.number().min(0).optional(),
		weightUom: z.string().max(50).optional(),
		allowNegativeStock: z.boolean().optional(),
		valuationMethod: z.string().max(50).optional(),
		defaultMaterialRequestType: z.string().max(50).optional(),
		hasBatchNo: z.boolean().optional(),
		hasSerialNo: z.boolean().optional(),
		barcodes: z
			.array(
				z.object({
					id: z.string().optional(),
					barcode: z.string().min(1).max(255).trim(),
					barcodeType: z.string().max(100).optional().nullable(),
					uom: z.string().max(50).optional().nullable(),
				}),
			)
			.optional(),
		reorderSettings: z
			.array(
				z.object({
					id: z.string().optional(),
					warehouse: z.string().min(1).max(255).trim(),
					reorderLevel: z.number().min(0).optional(),
					reorderQty: z.number().min(0).optional(),
					materialRequestType: z.string().max(100).optional().nullable(),
				}),
			)
			.optional(),
		itemGroupId: z.string().cuid().optional(),
		defaultUnitOfMeasureId: z.string().cuid().optional(),
	});

	/**
	 * Validation schema for creating units of measure
	 */
	export const createUnitOfMeasureSchema = z.object({
		name: z.string().min(1, "UOM name is required").max(255).trim(),
		disabled: z.boolean().default(false),
		isWholeNumber: z.boolean().default(true),
	});

	/**
	 * Validation schema for updating units of measure
	 */
	export const updateUnitOfMeasureSchema = z.object({
		id: z.string().cuid(),
		name: z.string().min(1).max(255).trim().optional(),
		disabled: z.boolean().optional(),
		isWholeNumber: z.boolean().optional(),
	});

	/**
	 * Validation schema for deleting multiple inventory items
	 */
	export const bulkDeleteSchema = z.object({
		ids: z.array(z.string().cuid()).min(1),
	});

	/**
	 * Validation schema for creating item groups
	 */
	export const createGroupSchema = z.object({
		groupName: z.string().min(1, "Group name is required").max(255).trim(),
		parentId: z.string().cuid().optional().nullable(),
		isGroup: z.boolean().default(false),
		defaults: z
			.array(
				z.object({
					company: z.string().min(1, "Company is required"),
					defaultWarehouse: z.string().optional().nullable(),
					defaultPriceList: z.string().optional().nullable(),
				}),
			)
			.optional(),
	});

	/**
	 * Validation schema for updating item groups
	 */
	export const updateGroupSchema = z.object({
		id: z.string().cuid(),
		groupName: z.string().min(1).max(255).trim().optional(),
		parentId: z.string().cuid().optional().nullable(),
		isGroup: z.boolean().optional(),
		defaults: z
			.array(
				z.object({
					id: z.string().optional(),
					company: z.string().min(1, "Company is required"),
					defaultWarehouse: z.string().optional().nullable(),
					defaultPriceList: z.string().optional().nullable(),
				}),
			)
			.optional(),
	});

	export const createProductBundleSchema = z.object({
		parentItemId: z.string().cuid(),
		description: z.string().max(1000).optional(),
		disabled: z.boolean().default(false),
		bundleItems: z
			.array(
				z.object({
					itemId: z.string().cuid(),
					quantity: z.number().int().min(1),
					description: z.string().max(1000).optional(),
					unitOfMeasurementId: z.string().cuid().optional(),
				}),
			)
			.min(1),
	});

	export const updateProductBundleSchema = z.object({
		id: z.string().cuid(),
		parentItemId: z.string().cuid().optional(),
		description: z.string().max(1000).optional(),
		disabled: z.boolean().optional(),
		bundleItems: z
			.array(
				z.object({
					id: z.string().cuid().optional(),
					itemId: z.string().cuid(),
					quantity: z.number().int().min(1),
					description: z.string().max(1000).optional(),
					unitOfMeasurementId: z.string().cuid().optional(),
				}),
			)
			.min(1)
			.optional(),
	});

	export const createItemAlternativeSchema = z
		.object({
			itemId: z.string().cuid(),
			alternativeItemId: z.string().cuid(),
			twoWay: z.boolean().default(false),
		})
		.refine((value) => value.itemId !== value.alternativeItemId, {
			message: "Item and alternative item must be different",
			path: ["alternativeItemId"],
		});

	export const updateItemAlternativeSchema = z
		.object({
			id: z.string().cuid(),
			itemId: z.string().cuid().optional(),
			alternativeItemId: z.string().cuid().optional(),
			twoWay: z.boolean().optional(),
		})
		.refine(
			(value) =>
				!(
					value.itemId &&
					value.alternativeItemId &&
					value.itemId === value.alternativeItemId
				),
			{
				message: "Item and alternative item must be different",
				path: ["alternativeItemId"],
			},
		);

	export const createItemManufacturerSchema = z.object({
		itemId: z.string().cuid(),
		manufacturer: z.string().min(1, "Manufacturer is required").max(255).trim(),
		manufacturerPartNumber: z
			.string()
			.min(1, "Manufacturer part number is required")
			.max(255)
			.trim(),
		isDefault: z.boolean().default(false),
	});

	export const updateItemManufacturerSchema = z.object({
		id: z.string().cuid(),
		itemId: z.string().cuid().optional(),
		manufacturer: z.string().min(1).max(255).trim().optional(),
		manufacturerPartNumber: z.string().min(1).max(255).trim().optional(),
		isDefault: z.boolean().optional(),
	});

	export const createShippingRuleSchema = z.object({
		shippingRuleLabel: z
			.string()
			.min(1, "Shipping rule label is required")
			.max(255)
			.trim(),
		shippingRuleType: z.enum(["SELLING", "BUYING"]),
		disabled: z.boolean().default(false),
		calculateBasedOn: z.enum(["FIXED", "NET_TOTAL", "NET_WEIGHT"]),
		shippingAmount: z.number().min(0).default(0),
	});

	export const updateShippingRuleSchema = z.object({
		id: z.string().cuid(),
		shippingRuleLabel: z.string().min(1).max(255).trim().optional(),
		shippingRuleType: z.enum(["SELLING", "BUYING"]).optional(),
		disabled: z.boolean().optional(),
		calculateBasedOn: z.enum(["FIXED", "NET_TOTAL", "NET_WEIGHT"]).optional(),
		shippingAmount: z.number().min(0).optional(),
	});

	// ============================================================================
	// Material Request Types & Schemas
	// ============================================================================

	export type MaterialRequestPurpose =
		| "PURCHASE"
		| "MANUFACTURE"
		| "MATERIAL_TRANSFER"
		| "MATERIAL_ISSUE"
		| "CUSTOMER_PROVIDED";

	export type MaterialRequestStatus =
		| "DRAFT"
		| "PENDING"
		| "APPROVED"
		| "ORDERED"
		| "PARTIALLY_ORDERED"
		| "PARTIALLY_RECEIVED"
		| "RECEIVED"
		| "CANCELLED";

	export interface MaterialRequestItem {
		id: string;
		materialRequestId: string;
		itemCode: string;
		itemName?: string | null;
		requiredBy?: Date | null;
		quantity: number;
		orderedQty: number;
		receivedQty: number;
		targetWarehouse?: string | null;
		unitOfMeasure?: string | null;
	}

	export interface MaterialRequest {
		id: string;
		series: string;
		transactionDate: Date;
		purpose: MaterialRequestPurpose;
		company: string;
		requiredBy?: Date | null;
		status: MaterialRequestStatus;
		targetWarehouse?: string | null;
		terms?: string | null;
		termsContent?: string | null;
		letterHead?: string | null;
		printHeading?: string | null;
		items: MaterialRequestItem[];
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreateMaterialRequestItemInput {
		itemCode: string;
		itemName?: string;
		requiredBy?: Date;
		quantity: number;
		targetWarehouse?: string;
		unitOfMeasure?: string;
	}

	export interface CreateMaterialRequestInput {
		transactionDate?: Date;
		purpose?: MaterialRequestPurpose;
		company: string;
		requiredBy?: Date;
		targetWarehouse?: string;
		terms?: string;
		termsContent?: string;
		letterHead?: string;
		printHeading?: string;
		items: CreateMaterialRequestItemInput[];
	}

	export interface UpdateMaterialRequestItemInput {
		id?: string;
		itemCode: string;
		itemName?: string;
		requiredBy?: Date;
		quantity: number;
		targetWarehouse?: string;
		unitOfMeasure?: string;
	}

	export interface UpdateMaterialRequestInput {
		id: string;
		transactionDate?: Date;
		purpose?: MaterialRequestPurpose;
		company?: string;
		requiredBy?: Date | null;
		status?: MaterialRequestStatus;
		targetWarehouse?: string | null;
		terms?: string | null;
		termsContent?: string | null;
		letterHead?: string | null;
		printHeading?: string | null;
		items?: UpdateMaterialRequestItemInput[];
	}

	export const createMaterialRequestItemSchema = z.object({
		itemCode: z.string().min(1, "Item code is required").max(100).trim(),
		itemName: z.string().max(255).optional(),
		requiredBy: z.coerce.date().optional(),
		quantity: z.number().min(0.001, "Quantity must be greater than 0"),
		targetWarehouse: z.string().max(255).optional(),
		unitOfMeasure: z.string().max(50).optional(),
	});

	export const createMaterialRequestSchema = z.object({
		transactionDate: z.coerce.date().optional(),
		purpose: z
			.enum([
				"PURCHASE",
				"MANUFACTURE",
				"MATERIAL_TRANSFER",
				"MATERIAL_ISSUE",
				"CUSTOMER_PROVIDED",
			])
			.default("PURCHASE"),
		company: z.string().min(1, "Company is required").max(255).trim(),
		requiredBy: z.coerce.date().optional(),
		targetWarehouse: z.string().max(255).optional(),
		terms: z.string().max(255).optional(),
		termsContent: z
			.string()
			.max(65_535, "Terms content must be 65,535 characters or fewer")
			.optional(),
		letterHead: z.string().max(255).optional(),
		printHeading: z.string().max(255).optional(),
		items: z
			.array(createMaterialRequestItemSchema)
			.min(1, "At least one item is required"),
	});

	export const updateMaterialRequestItemSchema = z.object({
		id: z.string().optional(),
		itemCode: z.string().min(1, "Item code is required").max(100).trim(),
		itemName: z.string().max(255).optional(),
		requiredBy: z.coerce.date().optional(),
		quantity: z.number().min(0.001, "Quantity must be greater than 0"),
		targetWarehouse: z.string().max(255).optional(),
		unitOfMeasure: z.string().max(50).optional(),
	});

	export const updateMaterialRequestSchema = z.object({
		id: z.string().min(1),
		transactionDate: z.coerce.date().optional(),
		purpose: z
			.enum([
				"PURCHASE",
				"MANUFACTURE",
				"MATERIAL_TRANSFER",
				"MATERIAL_ISSUE",
				"CUSTOMER_PROVIDED",
			])
			.optional(),
		company: z.string().min(1).max(255).trim().optional(),
		requiredBy: z.coerce.date().optional().nullable(),
		status: z
			.enum([
				"DRAFT",
				"PENDING",
				"APPROVED",
				"ORDERED",
				"PARTIALLY_ORDERED",
				"PARTIALLY_RECEIVED",
				"RECEIVED",
				"CANCELLED",
			])
			.optional(),
		targetWarehouse: z.string().max(255).optional().nullable(),
		terms: z.string().max(255).optional().nullable(),
		termsContent: z
			.string()
			.max(65_535, "Terms content must be 65,535 characters or fewer")
			.optional()
			.nullable(),
		letterHead: z.string().max(255).optional().nullable(),
		printHeading: z.string().max(255).optional().nullable(),
		items: z.array(updateMaterialRequestItemSchema).min(1).optional(),
	});

	export const bulkDeleteMaterialRequestsSchema = z.object({
		ids: z.array(z.string().min(1)).min(1),
	});

	// ============================================================================
	// Stock Entry Types & Schemas
	// ============================================================================

	export type StockEntryType =
		| "MATERIAL_RECEIPT"
		| "MATERIAL_ISSUE"
		| "MATERIAL_TRANSFER"
		| "MATERIAL_TRANSFER_FOR_MANUFACTURE"
		| "MANUFACTURE"
		| "REPACK"
		| "SEND_TO_SUBCONTRACTOR";

	export type StockEntryStatus = "DRAFT" | "SUBMITTED" | "CANCELLED";

	export interface StockEntryItem {
		id: string;
		stockEntryId: string;
		sourceWarehouse?: string | null;
		targetWarehouse?: string | null;
		itemCode: string;
		itemName?: string | null;
		description?: string | null;
		qty: number;
		basicRate: number;
		basicAmount: number;
		unitOfMeasure?: string | null;
	}

	export interface StockEntry {
		id: string;
		series: string;
		stockEntryType: StockEntryType;
		postingDate: Date;
		company: string;
		status: StockEntryStatus;
		project?: string | null;
		defaultSourceWarehouse?: string | null;
		defaultTargetWarehouse?: string | null;
		isOpening: boolean;
		remarks?: string | null;
		printHeading?: string | null;
		letterHead?: string | null;
		inspectionRequired: boolean;
		items: StockEntryItem[];
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreateStockEntryItemInput {
		sourceWarehouse?: string;
		targetWarehouse?: string;
		itemCode: string;
		itemName?: string;
		description?: string;
		qty: number;
		basicRate?: number;
		unitOfMeasure?: string;
	}

	export interface CreateStockEntryInput {
		stockEntryType: StockEntryType;
		postingDate?: Date;
		company: string;
		project?: string;
		defaultSourceWarehouse?: string;
		defaultTargetWarehouse?: string;
		isOpening?: boolean;
		remarks?: string;
		printHeading?: string;
		letterHead?: string;
		inspectionRequired?: boolean;
		items: CreateStockEntryItemInput[];
	}

	export interface UpdateStockEntryItemInput {
		id?: string;
		sourceWarehouse?: string;
		targetWarehouse?: string;
		itemCode: string;
		itemName?: string;
		description?: string;
		qty: number;
		basicRate?: number;
		unitOfMeasure?: string;
	}

	export interface UpdateStockEntryInput {
		id: string;
		stockEntryType?: StockEntryType;
		postingDate?: Date;
		company?: string;
		status?: StockEntryStatus;
		project?: string | null;
		defaultSourceWarehouse?: string | null;
		defaultTargetWarehouse?: string | null;
		isOpening?: boolean;
		remarks?: string | null;
		printHeading?: string | null;
		letterHead?: string | null;
		inspectionRequired?: boolean;
		items?: UpdateStockEntryItemInput[];
	}

	export const createStockEntryItemSchema = z.object({
		sourceWarehouse: z.string().max(255).optional(),
		targetWarehouse: z.string().max(255).optional(),
		itemCode: z.string().min(1, "Item code is required").max(100).trim(),
		itemName: z.string().max(255).optional(),
		description: z.string().max(1000).optional(),
		qty: z.number().min(0.001, "Quantity must be greater than 0"),
		basicRate: z.number().min(0).default(0),
		unitOfMeasure: z.string().max(50).optional(),
	});

	export const createStockEntrySchema = z.object({
		stockEntryType: z.enum([
			"MATERIAL_RECEIPT",
			"MATERIAL_ISSUE",
			"MATERIAL_TRANSFER",
			"MATERIAL_TRANSFER_FOR_MANUFACTURE",
			"MANUFACTURE",
			"REPACK",
			"SEND_TO_SUBCONTRACTOR",
		]),
		postingDate: z.coerce.date().optional(),
		company: z.string().min(1, "Company is required").max(255).trim(),
		project: z.string().max(255).optional(),
		defaultSourceWarehouse: z.string().max(255).optional(),
		defaultTargetWarehouse: z.string().max(255).optional(),
		isOpening: z.boolean().default(false),
		remarks: z
			.string()
			.max(65_535, "Remarks must be 65,535 characters or fewer")
			.optional(),
		printHeading: z.string().max(255).optional(),
		letterHead: z.string().max(255).optional(),
		inspectionRequired: z.boolean().default(false),
		items: z
			.array(createStockEntryItemSchema)
			.min(1, "At least one item is required"),
	});

	export const updateStockEntryItemSchema = z.object({
		id: z.string().optional(),
		sourceWarehouse: z.string().max(255).optional(),
		targetWarehouse: z.string().max(255).optional(),
		itemCode: z.string().min(1, "Item code is required").max(100).trim(),
		itemName: z.string().max(255).optional(),
		description: z.string().max(1000).optional(),
		qty: z.number().min(0.001, "Quantity must be greater than 0"),
		basicRate: z.number().min(0).optional(),
		unitOfMeasure: z.string().max(50).optional(),
	});

	export const updateStockEntrySchema = z.object({
		id: z.string().min(1),
		stockEntryType: z
			.enum([
				"MATERIAL_RECEIPT",
				"MATERIAL_ISSUE",
				"MATERIAL_TRANSFER",
				"MATERIAL_TRANSFER_FOR_MANUFACTURE",
				"MANUFACTURE",
				"REPACK",
				"SEND_TO_SUBCONTRACTOR",
			])
			.optional(),
		postingDate: z.coerce.date().optional(),
		company: z.string().min(1).max(255).trim().optional(),
		status: z.enum(["DRAFT", "SUBMITTED", "CANCELLED"]).optional(),
		project: z.string().max(255).optional().nullable(),
		defaultSourceWarehouse: z.string().max(255).optional().nullable(),
		defaultTargetWarehouse: z.string().max(255).optional().nullable(),
		isOpening: z.boolean().optional(),
		remarks: z
			.string()
			.max(65_535, "Remarks must be 65,535 characters or fewer")
			.optional()
			.nullable(),
		printHeading: z.string().max(255).optional().nullable(),
		letterHead: z.string().max(255).optional().nullable(),
		inspectionRequired: z.boolean().optional(),
		items: z.array(updateStockEntryItemSchema).min(1).optional(),
	});

	export const bulkDeleteStockEntriesSchema = z.object({
		ids: z.array(z.string().min(1)).min(1),
	});

	// ============================================================================
	// Delivery Note Types & Schemas
	// ============================================================================

	export type DeliveryNoteStatus =
		| "DRAFT"
		| "TO_BILL"
		| "COMPLETED"
		| "RETURN_ISSUED"
		| "CANCELLED"
		| "CLOSED";

	export interface DeliveryNoteItem {
		id: string;
		deliveryNoteId: string;
		itemCode: string;
		itemName?: string | null;
		description?: string | null;
		quantity: number;
		uom?: string | null;
		rate: number;
		amount: number;
		warehouse?: string | null;
	}

	export interface DeliveryNote {
		id: string;
		series: string;
		postingDate: Date;
		customer: string;
		company: string;
		status: DeliveryNoteStatus;
		isReturn: boolean;
		currency?: string | null;
		priceList?: string | null;
		sourceWarehouse?: string | null;
		totalQuantity: number;
		totalAmount: number;
		grandTotal: number;
		roundingAdjustment: number;
		roundedTotal: number;
		additionalDiscountOn?: string | null;
		additionalDiscountPercent?: number | null;
		additionalDiscountAmount?: number | null;
		shippingAddress?: string | null;
		dispatchAddress?: string | null;
		companyAddress?: string | null;
		companyContact?: string | null;
		companyTRN?: string | null;
		terms?: string | null;
		termsContent?: string | null;
		transporter?: string | null;
		driverName?: string | null;
		driver?: string | null;
		transportReceiptDate?: Date | null;
		transportReceiptNo?: string | null;
		vehicleNo?: string | null;
		customerPoNo?: string | null;
		customerPoDate?: Date | null;
		salesPartner?: string | null;
		commissionRate?: number | null;
		letterHead?: string | null;
		printHeading?: string | null;
		printWithoutAmount: boolean;
		groupSameItems: boolean;
		permitNumber?: string | null;
		vatEmirate?: string | null;
		project?: string | null;
		items: DeliveryNoteItem[];
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreateDeliveryNoteItemInput {
		itemCode: string;
		itemName?: string;
		description?: string;
		quantity: number;
		uom?: string;
		rate?: number;
		warehouse?: string;
	}

	/**
	 * Input payload for creating a Delivery Note document.
	 *
	 * This type is shared across frontends and backend and is used as the
	 * contract for Delivery Note creation APIs.
	 */
	export interface CreateDeliveryNoteInput {
		/**
		 * Posting date of the delivery note.
		 * If omitted, the server may default this to the current date.
		 */
		postingDate?: Date;
		/** Linked customer identifier (e.g., customer name or code). */
		customer: string;
		/** Company for which this delivery note is being created. */
		company: string;
		/** Whether this delivery note represents a return. */
		isReturn?: boolean;
		/** Currency code for amounts on this delivery note (e.g., "AED"). */
		currency?: string;
		/** Price list to use for pricing items on this delivery note. */
		priceList?: string;
		/** Default source warehouse for all items, when applicable. */
		sourceWarehouse?: string;
		/**
		 * Base on which the additional discount is calculated.
		 *
		 * Common values include things like "Net Total" or "Grand Total".
		 * Consumers should treat this as an enum-like string and only pass
		 * values supported by the backend.
		 */
		additionalDiscountOn?: string;
		/**
		 * Percentage of additional discount to apply on `additionalDiscountOn`.
		 *
		 * Expected to be in the range 0–100. Typically only one of
		 * `additionalDiscountPercent` or `additionalDiscountAmount` is used
		 * for a given delivery note; if both are provided, server-side logic
		 * determines precedence.
		 */
		additionalDiscountPercent?: number;
		/**
		 * Fixed additional discount amount.
		 *
		 * This is an absolute discount value, as opposed to
		 * `additionalDiscountPercent` which is rate-based. Usually only one
		 * of `additionalDiscountPercent` or `additionalDiscountAmount` should
		 * be provided.
		 */
		additionalDiscountAmount?: number;
		/** Customer shipping/delivery address. */
		shippingAddress?: string;
		/** Dispatch address (from where goods are sent). */
		dispatchAddress?: string;
		/** Company address printed on the delivery note. */
		companyAddress?: string;
		/** Company contact person or contact ID. */
		companyContact?: string;
		/** Company Tax Registration Number (TRN). */
		companyTRN?: string;
		/** Payment or delivery terms reference. */
		terms?: string;
		/** Human-readable terms and conditions content. */
		termsContent?: string;
		/** Transporter or logistics provider name. */
		transporter?: string;
		/** Driver's name for the delivery. */
		driverName?: string;
		/** Driver identifier (e.g., employee ID). */
		driver?: string;
		/** Date on the transport receipt, if applicable. */
		transportReceiptDate?: Date;
		/** Reference number of the transport receipt. */
		transportReceiptNo?: string;
		/** Vehicle number used for delivery. */
		vehicleNo?: string;
		/** Customer purchase order number linked to this delivery. */
		customerPoNo?: string;
		/** Customer purchase order date. */
		customerPoDate?: Date;
		/** Sales partner or agent associated with this delivery. */
		salesPartner?: string;
		/** Commission rate for the sales partner, expressed as a percentage. */
		commissionRate?: number;
		/** Letterhead to use when printing the delivery note. */
		letterHead?: string;
		/** Custom print heading/title for the delivery note. */
		printHeading?: string;
		/** Whether to print the delivery note without showing amounts. */
		printWithoutAmount?: boolean;
		/** Whether to group identical items together when printing. */
		groupSameItems?: boolean;
		/** Permit number associated with this delivery, if required. */
		permitNumber?: string;
		/** VAT emirate or tax jurisdiction for this delivery. */
		vatEmirate?: string;
		/** Project reference linked to this delivery. */
		project?: string;
		/** Line items included in the delivery note. */
		items: CreateDeliveryNoteItemInput[];
	}

	export interface UpdateDeliveryNoteItemInput {
		id?: string;
		itemCode: string;
		itemName?: string;
		description?: string;
		quantity: number;
		uom?: string;
		rate?: number;
		warehouse?: string;
	}

	export interface UpdateDeliveryNoteInput {
		id: string;
		postingDate?: Date;
		customer?: string;
		company?: string;
		status?: DeliveryNoteStatus;
		isReturn?: boolean;
		currency?: string | null;
		priceList?: string | null;
		sourceWarehouse?: string | null;
		additionalDiscountOn?: string | null;
		additionalDiscountPercent?: number | null;
		additionalDiscountAmount?: number | null;
		shippingAddress?: string | null;
		dispatchAddress?: string | null;
		companyAddress?: string | null;
		companyContact?: string | null;
		companyTRN?: string | null;
		terms?: string | null;
		termsContent?: string | null;
		transporter?: string | null;
		driverName?: string | null;
		driver?: string | null;
		transportReceiptDate?: Date | null;
		transportReceiptNo?: string | null;
		vehicleNo?: string | null;
		customerPoNo?: string | null;
		customerPoDate?: Date | null;
		salesPartner?: string | null;
		commissionRate?: number | null;
		letterHead?: string | null;
		printHeading?: string | null;
		printWithoutAmount?: boolean;
		groupSameItems?: boolean;
		permitNumber?: string | null;
		vatEmirate?: string | null;
		project?: string | null;
		items?: UpdateDeliveryNoteItemInput[];
	}

	export const createDeliveryNoteItemSchema = z.object({
		itemCode: z.string().min(1, "Item code is required").max(100).trim(),
		itemName: z.string().max(255).optional(),
		description: z.string().max(1000).optional(),
		quantity: z.number().min(0.001, "Quantity must be greater than 0"),
		uom: z.string().max(50).optional(),
		rate: z.number().min(0).default(0),
		warehouse: z.string().max(255).optional(),
	});

	export const createDeliveryNoteSchema = z.object({
		postingDate: z.coerce.date().optional(),
		customer: z.string().min(1, "Customer is required").max(255).trim(),
		company: z.string().min(1, "Company is required").max(255).trim(),
		isReturn: z.boolean().default(false),
		currency: z.string().max(10).optional(),
		priceList: z.string().max(255).optional(),
		sourceWarehouse: z.string().max(255).optional(),
		additionalDiscountOn: z.string().max(100).optional(),
		additionalDiscountPercent: z.number().min(0).max(100).optional(),
		additionalDiscountAmount: z.number().min(0).optional(),
		shippingAddress: z.string().max(255).optional(),
		dispatchAddress: z.string().max(255).optional(),
		companyAddress: z.string().max(255).optional(),
		companyContact: z.string().max(255).optional(),
		companyTRN: z.string().max(100).optional(),
		terms: z.string().max(255).optional(),
		termsContent: z
			.string()
			.max(65_535, "Terms content must be 65,535 characters or fewer")
			.optional(),
		transporter: z.string().max(255).optional(),
		driverName: z.string().max(255).optional(),
		driver: z.string().max(255).optional(),
		transportReceiptDate: z.coerce.date().optional(),
		transportReceiptNo: z.string().max(255).optional(),
		vehicleNo: z.string().max(100).optional(),
		customerPoNo: z.string().optional(),
		customerPoDate: z.coerce.date().optional(),
		salesPartner: z.string().max(255).optional(),
		commissionRate: z.number().min(0).max(100).optional(),
		letterHead: z.string().max(255).optional(),
		printHeading: z.string().max(255).optional(),
		printWithoutAmount: z.boolean().default(false),
		groupSameItems: z.boolean().default(false),
		permitNumber: z.string().max(255).optional(),
		vatEmirate: z.string().max(100).optional(),
		project: z.string().max(255).optional(),
		items: z
			.array(createDeliveryNoteItemSchema)
			.min(1, "At least one item is required"),
	});

	export const updateDeliveryNoteItemSchema = z.object({
		id: z.string().optional(),
		itemCode: z.string().min(1, "Item code is required").max(100).trim(),
		itemName: z.string().max(255).optional(),
		description: z.string().max(1000).optional(),
		quantity: z.number().min(0.001, "Quantity must be greater than 0"),
		uom: z.string().max(50).optional(),
		rate: z.number().min(0).optional(),
		warehouse: z.string().max(255).optional(),
	});

	export const updateDeliveryNoteSchema = z.object({
		id: z.string().min(1),
		postingDate: z.coerce.date().optional(),
		customer: z.string().min(1).max(255).trim().optional(),
		company: z.string().min(1).max(255).trim().optional(),
		status: z
			.enum([
				"DRAFT",
				"TO_BILL",
				"COMPLETED",
				"RETURN_ISSUED",
				"CANCELLED",
				"CLOSED",
			])
			.optional(),
		isReturn: z.boolean().optional(),
		currency: z.string().max(10).optional().nullable(),
		priceList: z.string().max(255).optional().nullable(),
		sourceWarehouse: z.string().max(255).optional().nullable(),
		additionalDiscountOn: z.string().max(100).optional().nullable(),
		additionalDiscountPercent: z.number().min(0).max(100).optional().nullable(),
		additionalDiscountAmount: z.number().min(0).optional().nullable(),
		shippingAddress: z.string().max(255).optional().nullable(),
		dispatchAddress: z.string().max(255).optional().nullable(),
		companyAddress: z.string().max(255).optional().nullable(),
		companyContact: z.string().max(255).optional().nullable(),
		companyTRN: z.string().max(100).optional().nullable(),
		terms: z.string().max(255).optional().nullable(),
		termsContent: z
			.string()
			.max(65_535, "Terms content must be 65,535 characters or fewer")
			.optional()
			.nullable(),
		transporter: z.string().max(255).optional().nullable(),
		driverName: z.string().max(255).optional().nullable(),
		driver: z.string().max(255).optional().nullable(),
		transportReceiptDate: z.coerce.date().optional().nullable(),
		transportReceiptNo: z.string().max(255).optional().nullable(),
		vehicleNo: z.string().max(100).optional().nullable(),
		customerPoNo: z.string().optional().nullable(),
		customerPoDate: z.coerce.date().optional().nullable(),
		salesPartner: z.string().max(255).optional().nullable(),
		commissionRate: z.number().min(0).max(100).optional().nullable(),
		letterHead: z.string().max(255).optional().nullable(),
		printHeading: z.string().max(255).optional().nullable(),
		printWithoutAmount: z.boolean().optional(),
		groupSameItems: z.boolean().optional(),
		permitNumber: z.string().max(255).optional().nullable(),
		vatEmirate: z.string().max(100).optional().nullable(),
		project: z.string().max(255).optional().nullable(),
		items: z.array(updateDeliveryNoteItemSchema).min(1).optional(),
	});

	export const bulkDeleteDeliveryNotesSchema = z.object({
		ids: z.array(z.string().min(1)).min(1),
	});

	// ============================================================================
	// Purchase Receipt Types & Schemas
	// ============================================================================

	export type PurchaseReceiptStatus =
		| "DRAFT"
		| "PARTLY_BILLED"
		| "TO_BILL"
		| "COMPLETED"
		| "RETURN_ISSUED"
		| "CANCELLED"
		| "CLOSED";

	export interface PurchaseReceiptItem {
		id: string;
		purchaseReceiptId: string;
		itemCode: string;
		itemName?: string | null;
		description?: string | null;
		acceptedQuantity: number;
		rejectedQuantity: number;
		rate: number;
		amount: number;
		uom?: string | null;
		acceptedWarehouse?: string | null;
		rejectedWarehouse?: string | null;
	}

	export interface PurchaseReceiptTax {
		id: string;
		purchaseReceiptId: string;
		type: string;
		accountHead: string;
		taxRate: number;
		amount: number;
		total: number;
	}

	export interface PurchaseReceipt {
		id: string;
		series: string;
		seriesPattern: string;
		postingDate: Date;
		postingTime: string;
		editPostingDateTime: boolean;
		supplier: string;
		company: string;
		status: PurchaseReceiptStatus;
		isReturn: boolean;
		applyPutawayRule: boolean;
		supplierDeliveryNote?: string | null;
		acceptedWarehouse?: string | null;
		rejectedWarehouse?: string | null;
		isSubcontracted: boolean;
		currency?: string | null;
		priceList?: string | null;
		totalQuantity: number;
		totalAcceptedQuantity: number;
		totalRejectedQuantity: number;
		totalAmount: number;
		taxesAndChargesAdded: number;
		taxesAndChargesDeducted: number;
		totalTaxesAndCharges: number;
		grandTotal: number;
		roundingAdjustment: number;
		roundedTotal: number;
		disableRoundedTotal: boolean;
		supplierAddress?: string | null;
		contactPerson?: string | null;
		shippingAddressTemplate?: string | null;
		companyTRN?: string | null;
		billingAddress?: string | null;
		terms?: string | null;
		termsContent?: string | null;
		letterHead?: string | null;
		printHeading?: string | null;
		groupSameItems: boolean;
		permitNumber?: string | null;
		recoverableStandardRatedExpenses: number;
		reverseChargeApplicable: "Y" | "N";
		transporterName?: string | null;
		vehicleNumber?: string | null;
		vehicleDate?: Date | null;
		instructions?: string | null;
		remarks?: string | null;
		isInternalSupplier: boolean;
		items: PurchaseReceiptItem[];
		taxes: PurchaseReceiptTax[];
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreatePurchaseReceiptItemInput {
		itemCode: string;
		itemName?: string;
		description?: string;
		acceptedQuantity: number;
		rejectedQuantity?: number;
		rate?: number;
		uom?: string;
		acceptedWarehouse?: string;
		rejectedWarehouse?: string;
	}

	export interface CreatePurchaseReceiptTaxInput {
		type: string;
		accountHead: string;
		taxRate?: number;
		amount?: number;
	}

	export interface CreatePurchaseReceiptInput {
		seriesPattern?: string;
		postingDate?: Date;
		postingTime?: string;
		editPostingDateTime?: boolean;
		supplier: string;
		company: string;
		status?: PurchaseReceiptStatus;
		isReturn?: boolean;
		applyPutawayRule?: boolean;
		supplierDeliveryNote?: string;
		acceptedWarehouse?: string;
		rejectedWarehouse?: string;
		isSubcontracted?: boolean;
		currency?: string;
		priceList?: string;
		disableRoundedTotal?: boolean;
		supplierAddress?: string;
		contactPerson?: string;
		shippingAddressTemplate?: string;
		companyTRN?: string;
		billingAddress?: string;
		terms?: string;
		termsContent?: string;
		letterHead?: string;
		printHeading?: string;
		groupSameItems?: boolean;
		permitNumber?: string;
		recoverableStandardRatedExpenses?: number;
		reverseChargeApplicable?: "Y" | "N";
		transporterName?: string;
		vehicleNumber?: string;
		vehicleDate?: Date;
		instructions?: string;
		remarks?: string;
		isInternalSupplier?: boolean;
		items: CreatePurchaseReceiptItemInput[];
		taxes?: CreatePurchaseReceiptTaxInput[];
	}

	export interface UpdatePurchaseReceiptItemInput {
		id?: string;
		itemCode: string;
		itemName?: string;
		description?: string;
		acceptedQuantity: number;
		rejectedQuantity?: number;
		rate?: number;
		uom?: string;
		acceptedWarehouse?: string;
		rejectedWarehouse?: string;
	}

	export interface UpdatePurchaseReceiptTaxInput {
		id?: string;
		type: string;
		accountHead: string;
		taxRate?: number;
		amount?: number;
	}

	export interface UpdatePurchaseReceiptInput {
		id: string;
		seriesPattern?: string | null;
		postingDate?: Date;
		postingTime?: string | null;
		editPostingDateTime?: boolean;
		supplier?: string;
		company?: string;
		status?: PurchaseReceiptStatus;
		isReturn?: boolean;
		applyPutawayRule?: boolean;
		supplierDeliveryNote?: string | null;
		acceptedWarehouse?: string | null;
		rejectedWarehouse?: string | null;
		isSubcontracted?: boolean;
		currency?: string | null;
		priceList?: string | null;
		disableRoundedTotal?: boolean;
		supplierAddress?: string | null;
		contactPerson?: string | null;
		shippingAddressTemplate?: string | null;
		companyTRN?: string | null;
		billingAddress?: string | null;
		terms?: string | null;
		termsContent?: string | null;
		letterHead?: string | null;
		printHeading?: string | null;
		groupSameItems?: boolean;
		permitNumber?: string | null;
		recoverableStandardRatedExpenses?: number;
		reverseChargeApplicable?: "Y" | "N";
		transporterName?: string | null;
		vehicleNumber?: string | null;
		vehicleDate?: Date | null;
		instructions?: string | null;
		remarks?: string | null;
		isInternalSupplier?: boolean;
		items?: UpdatePurchaseReceiptItemInput[];
		taxes?: UpdatePurchaseReceiptTaxInput[];
	}

	export const purchaseReceiptStatusSchema = z.enum([
		"DRAFT",
		"PARTLY_BILLED",
		"TO_BILL",
		"COMPLETED",
		"RETURN_ISSUED",
		"CANCELLED",
		"CLOSED",
	]);

	const postingTimeSchema = z
		.string()
		.regex(
			/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/,
			"Posting time must be in HH:mm or HH:mm:ss format",
		);

	export const createPurchaseReceiptItemSchema = z
		.object({
			itemCode: z.string().min(1, "Item code is required").max(100).trim(),
			itemName: z.string().max(255).optional(),
			description: z.string().max(1000).optional(),
			acceptedQuantity: z
				.number()
				.min(0, "Accepted quantity cannot be negative"),
			rejectedQuantity: z.number().min(0).default(0),
			rate: z.number().min(0).default(0),
			uom: z.string().max(50).optional(),
			acceptedWarehouse: z.string().max(255).optional(),
			rejectedWarehouse: z.string().max(255).optional(),
		})
		.refine(
			(item) => item.acceptedQuantity + item.rejectedQuantity > 0,
			"Accepted quantity or rejected quantity must be greater than 0",
		);

	export const createPurchaseReceiptTaxSchema = z.object({
		type: z.string().min(1, "Tax type is required").max(255).trim(),
		accountHead: z.string().min(1, "Account head is required").max(255).trim(),
		taxRate: z.number().min(-100).max(100).default(0),
		amount: z.number().optional(),
	});

	export const createPurchaseReceiptSchema = z.object({
		seriesPattern: z.string().max(50).optional(),
		postingDate: z.coerce.date().optional(),
		postingTime: postingTimeSchema.optional(),
		editPostingDateTime: z.boolean().default(false),
		supplier: z.string().min(1, "Supplier is required").max(255).trim(),
		company: z.string().min(1, "Company is required").max(255).trim(),
		status: purchaseReceiptStatusSchema.default("DRAFT"),
		isReturn: z.boolean().default(false),
		applyPutawayRule: z.boolean().default(false),
		supplierDeliveryNote: z.string().max(255).optional(),
		acceptedWarehouse: z.string().max(255).optional(),
		rejectedWarehouse: z.string().max(255).optional(),
		isSubcontracted: z.boolean().default(false),
		currency: z.string().max(10).optional(),
		priceList: z.string().max(255).optional(),
		disableRoundedTotal: z.boolean().default(false),
		supplierAddress: z.string().max(255).optional(),
		contactPerson: z.string().max(255).optional(),
		shippingAddressTemplate: z.string().max(255).optional(),
		companyTRN: z.string().max(100).optional(),
		billingAddress: z.string().max(255).optional(),
		terms: z.string().max(255).optional(),
		termsContent: z
			.string()
			.max(65_535, "Terms content must be 65,535 characters or fewer")
			.optional(),
		letterHead: z.string().max(255).optional(),
		printHeading: z.string().max(255).optional(),
		groupSameItems: z.boolean().default(false),
		permitNumber: z.string().max(255).optional(),
		recoverableStandardRatedExpenses: z.number().min(0).default(0),
		reverseChargeApplicable: z.enum(["Y", "N"]).default("N"),
		transporterName: z.string().max(255).optional(),
		vehicleNumber: z.string().max(100).optional(),
		vehicleDate: z.coerce.date().optional(),
		instructions: z
			.string()
			.max(65_535, "Instructions must be 65,535 characters or fewer")
			.optional(),
		remarks: z
			.string()
			.max(65_535, "Remarks must be 65,535 characters or fewer")
			.optional(),
		isInternalSupplier: z.boolean().default(false),
		items: z
			.array(createPurchaseReceiptItemSchema)
			.min(1, "At least one item is required"),
		taxes: z.array(createPurchaseReceiptTaxSchema).optional(),
	});

	export const updatePurchaseReceiptItemSchema = z
		.object({
			id: z.string().optional(),
			itemCode: z.string().min(1, "Item code is required").max(100).trim(),
			itemName: z.string().max(255).optional(),
			description: z.string().max(1000).optional(),
			acceptedQuantity: z
				.number()
				.min(0, "Accepted quantity cannot be negative"),
			rejectedQuantity: z.number().min(0).default(0),
			rate: z.number().min(0).optional(),
			uom: z.string().max(50).optional(),
			acceptedWarehouse: z.string().max(255).optional(),
			rejectedWarehouse: z.string().max(255).optional(),
		})
		.refine(
			(item) => item.acceptedQuantity + item.rejectedQuantity > 0,
			"Accepted quantity or rejected quantity must be greater than 0",
		);

	export const updatePurchaseReceiptTaxSchema = z.object({
		id: z.string().optional(),
		type: z.string().min(1, "Tax type is required").max(255).trim(),
		accountHead: z.string().min(1, "Account head is required").max(255).trim(),
		taxRate: z.number().min(-100).max(100).optional(),
		amount: z.number().optional(),
	});

	export const updatePurchaseReceiptSchema = z.object({
		id: z.string().min(1),
		seriesPattern: z.string().max(50).optional().nullable(),
		postingDate: z.coerce.date().optional(),
		postingTime: postingTimeSchema.optional().nullable(),
		editPostingDateTime: z.boolean().optional(),
		supplier: z.string().min(1).max(255).trim().optional(),
		company: z.string().min(1).max(255).trim().optional(),
		status: purchaseReceiptStatusSchema.optional(),
		isReturn: z.boolean().optional(),
		applyPutawayRule: z.boolean().optional(),
		supplierDeliveryNote: z.string().max(255).optional().nullable(),
		acceptedWarehouse: z.string().max(255).optional().nullable(),
		rejectedWarehouse: z.string().max(255).optional().nullable(),
		isSubcontracted: z.boolean().optional(),
		currency: z.string().max(10).optional().nullable(),
		priceList: z.string().max(255).optional().nullable(),
		disableRoundedTotal: z.boolean().optional(),
		supplierAddress: z.string().max(255).optional().nullable(),
		contactPerson: z.string().max(255).optional().nullable(),
		shippingAddressTemplate: z.string().max(255).optional().nullable(),
		companyTRN: z.string().max(100).optional().nullable(),
		billingAddress: z.string().max(255).optional().nullable(),
		terms: z.string().max(255).optional().nullable(),
		termsContent: z
			.string()
			.max(65_535, "Terms content must be 65,535 characters or fewer")
			.optional()
			.nullable(),
		letterHead: z.string().max(255).optional().nullable(),
		printHeading: z.string().max(255).optional().nullable(),
		groupSameItems: z.boolean().optional(),
		permitNumber: z.string().max(255).optional().nullable(),
		recoverableStandardRatedExpenses: z.number().min(0).optional(),
		reverseChargeApplicable: z.enum(["Y", "N"]).optional(),
		transporterName: z.string().max(255).optional().nullable(),
		vehicleNumber: z.string().max(100).optional().nullable(),
		vehicleDate: z.coerce.date().optional().nullable(),
		instructions: z
			.string()
			.max(65_535, "Instructions must be 65,535 characters or fewer")
			.optional()
			.nullable(),
		remarks: z
			.string()
			.max(65_535, "Remarks must be 65,535 characters or fewer")
			.optional()
			.nullable(),
		isInternalSupplier: z.boolean().optional(),
		items: z.array(updatePurchaseReceiptItemSchema).min(1).optional(),
		taxes: z.array(updatePurchaseReceiptTaxSchema).optional(),
	});

	export const listPurchaseReceiptsSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).optional(),
			status: purchaseReceiptStatusSchema.optional(),
		})
		.optional();

	export const bulkDeletePurchaseReceiptsSchema = z.object({
		ids: z.array(z.string().min(1)).min(1),
	});
}

// ============================================================================
// Product Domain Types
// ============================================================================

/**
 * Product entity - represents a product in the system
 * Simple, flat structure for easy understanding
 */
export interface Product {
	/** Unique product identifier */
	id: number;
	/** Product name/title */
	name: string;
	/** Product description */
	description: string;
	/** Product category */
	category: string;
	/** Price in currency units */
	price: number;
	/** URL to product photo */
	photo_url: string;
	/** ISO 8601 timestamp when created */
	created_at: string;
	/** ISO 8601 timestamp when last updated */
	updated_at: string;
}
