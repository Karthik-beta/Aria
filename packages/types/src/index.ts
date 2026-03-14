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
		/** Whether the unit represents whole numbers only */
		isWholeNumber: boolean;
		/** When this unit was created */
		createdAt: Date;
		/** When this unit was last updated */
		updatedAt: Date;
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
	 * Item option used in Product Bundle pickers.
	 */
	export interface BundleSelectableItem {
		id: string;
		name: string;
		code: string;
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
