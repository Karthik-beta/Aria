import * as z from "zod";

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
	 * Brand master entity used to classify items by manufacturer or label.
	 */
	export interface Brand {
		/** Unique identifier (CUID) */
		id: string;
		/** Brand name */
		name: string;
		/** Optional description of the brand */
		description?: string | null;
		/** When this brand was created */
		createdAt: Date;
		/** When this brand was last updated */
		updatedAt: Date;
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
	 * Warehouse master entity used by inventory documents and defaults.
	 */
	export interface Warehouse {
		/** Unique identifier (CUID) */
		id: string;
		/** Warehouse name/identifier visible across the ERP */
		name: string;
		/** Whether the warehouse is disabled for operational use */
		disabled: boolean;
		/** Whether this warehouse acts as a grouping node in the hierarchy */
		isGroupWarehouse: boolean;
		/** Parent warehouse relation for nested structures */
		parentWarehouseId?: string | null;
		/** Parent warehouse display name */
		parentWarehouseName?: string | null;
		/** Owning company */
		company: string;
		/** Whether this warehouse is used for rejected materials */
		isRejectedWarehouse: boolean;
		phoneNo?: string | null;
		mobileNo?: string | null;
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		pin?: string | null;
		warehouseType?: string | null;
		defaultInTransitWarehouseId?: string | null;
		defaultInTransitWarehouseName?: string | null;
		createdAt: Date;
		updatedAt: Date;
	}

	export interface WarehouseListResult {
		items: Warehouse[];
		totalCount: number;
	}

	export interface ListWarehousesInput {
		skip?: number;
		take?: number;
		search?: string;
		company?: string;
		disabled?: boolean;
		isGroupWarehouse?: boolean;
	}

	export interface CreateWarehouseInput {
		name: string;
		disabled?: boolean;
		isGroupWarehouse?: boolean;
		parentWarehouseId?: string | null;
		company: string;
		isRejectedWarehouse?: boolean;
		phoneNo?: string | null;
		mobileNo?: string | null;
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		pin?: string | null;
		warehouseType?: string | null;
		defaultInTransitWarehouseId?: string | null;
	}

	export interface UpdateWarehouseInput {
		id: string;
		name?: string;
		disabled?: boolean;
		isGroupWarehouse?: boolean;
		parentWarehouseId?: string | null;
		company?: string;
		isRejectedWarehouse?: boolean;
		phoneNo?: string | null;
		mobileNo?: string | null;
		addressLine1?: string | null;
		addressLine2?: string | null;
		city?: string | null;
		state?: string | null;
		pin?: string | null;
		warehouseType?: string | null;
		defaultInTransitWarehouseId?: string | null;
	}

	export const batchStatusSchema = z.enum([
		"ACTIVE",
		"EMPTY",
		"EXPIRED",
		"DISABLED",
	]);

	export type BatchStatus = z.infer<typeof batchStatusSchema>;

	export const batchSortBySchema = z.enum([
		"updatedAt",
		"createdAt",
		"batchId",
		"itemCode",
		"warehouse",
		"expiryDate",
		"quantity",
		"company",
	]);

	export type BatchSortBy = z.infer<typeof batchSortBySchema>;

	export interface BatchLinkSummary {
		purchaseReceiptId?: string | null;
		purchaseReceiptSeries?: string | null;
		deliveryNoteId?: string | null;
		deliveryNoteSeries?: string | null;
		stockEntryId?: string | null;
		stockEntrySeries?: string | null;
	}

	export interface Batch extends BatchLinkSummary {
		id: string;
		batchId: string;
		itemId: string;
		itemCode: string;
		itemName: string;
		company: string;
		currentWarehouseId?: string | null;
		currentWarehouseName?: string | null;
		useBatchWiseValuation: boolean;
		manufacturingDate?: Date | null;
		expiryDate?: Date | null;
		description?: string | null;
		quantity: number;
		status: BatchStatus;
		isDisabled: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	export interface BatchListResult {
		items: Batch[];
		totalCount: number;
	}

	export interface ListBatchesInput {
		skip?: number;
		take?: number;
		search?: string;
		itemId?: string;
		warehouseId?: string;
		company?: string;
		status?: BatchStatus;
		includeDisabled?: boolean;
		sortBy?: BatchSortBy;
		sortDirection?: "asc" | "desc";
	}

	export interface CreateBatchInput {
		batchId: string;
		itemId: string;
		company: string;
		currentWarehouseId?: string | null;
		purchaseReceiptId?: string | null;
		deliveryNoteId?: string | null;
		stockEntryId?: string | null;
		useBatchWiseValuation?: boolean;
		manufacturingDate?: Date | null;
		expiryDate?: Date | null;
		description?: string | null;
		quantity?: number;
		isDisabled?: boolean;
	}

	export interface UpdateBatchInput {
		id: string;
		batchId?: string;
		itemId?: string;
		company?: string;
		currentWarehouseId?: string | null;
		purchaseReceiptId?: string | null;
		deliveryNoteId?: string | null;
		stockEntryId?: string | null;
		useBatchWiseValuation?: boolean;
		manufacturingDate?: Date | null;
		expiryDate?: Date | null;
		description?: string | null;
		quantity?: number;
		isDisabled?: boolean;
	}

	export const listBatchesSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).trim().optional(),
			itemId: z.string().cuid().optional(),
			warehouseId: z.string().cuid().optional(),
			company: z.string().max(255).trim().optional(),
			status: batchStatusSchema.optional(),
			includeDisabled: z.boolean().optional(),
			sortBy: batchSortBySchema.optional(),
			sortDirection: z.enum(["asc", "desc"]).optional(),
		})
		.optional();

	const batchInputFields = {
		batchId: z.string().min(1, "Batch ID is required").max(120).trim(),
		itemId: z.string().cuid("Item is required"),
		company: z.string().min(1, "Company is required").max(255).trim(),
		currentWarehouseId: z.string().cuid().optional().nullable(),
		purchaseReceiptId: z.string().min(1).optional().nullable(),
		deliveryNoteId: z.string().min(1).optional().nullable(),
		stockEntryId: z.string().min(1).optional().nullable(),
		useBatchWiseValuation: z.boolean().default(false),
		manufacturingDate: z.coerce.date().optional().nullable(),
		expiryDate: z.coerce.date().optional().nullable(),
		description: z
			.string()
			.max(65_535, "Description must be 65,535 characters or fewer")
			.optional()
			.nullable(),
		quantity: z.number().min(0, "Quantity cannot be negative").default(0),
		isDisabled: z.boolean().default(false),
	} satisfies z.ZodRawShape;

	const validateBatchDates = (
		value: {
			manufacturingDate?: Date | null;
			expiryDate?: Date | null;
			quantity?: number;
			currentWarehouseId?: string | null;
		},
		ctx: z.RefinementCtx,
	) => {
		if (
			value.manufacturingDate &&
			value.expiryDate &&
			value.expiryDate < value.manufacturingDate
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Expiry date must be on or after the manufacturing date",
				path: ["expiryDate"],
			});
		}

		if ((value.quantity ?? 0) > 0 && !value.currentWarehouseId) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"A warehouse is required when batch quantity is greater than zero",
				path: ["currentWarehouseId"],
			});
		}
	};

	export const createBatchSchema = z
		.object(batchInputFields)
		.superRefine((value, ctx) => {
			validateBatchDates(value, ctx);
		});

	export const updateBatchSchema = z
		.object({
			id: z.string().cuid(),
			batchId: batchInputFields.batchId.optional(),
			itemId: batchInputFields.itemId.optional(),
			company: batchInputFields.company.optional(),
			currentWarehouseId: batchInputFields.currentWarehouseId,
			purchaseReceiptId: batchInputFields.purchaseReceiptId,
			deliveryNoteId: batchInputFields.deliveryNoteId,
			stockEntryId: batchInputFields.stockEntryId,
			useBatchWiseValuation: z.boolean().optional(),
			manufacturingDate: batchInputFields.manufacturingDate,
			expiryDate: batchInputFields.expiryDate,
			description: batchInputFields.description,
			quantity: z.number().min(0, "Quantity cannot be negative").optional(),
			isDisabled: z.boolean().optional(),
		})
		.superRefine((value, ctx) => {
			validateBatchDates(value, ctx);
		});

	export const serialNoStatusSchema = z.enum([
		"DRAFT",
		"AVAILABLE",
		"DELIVERED",
		"INSTALLED",
		"RETURNED",
		"SCRAPPED",
		"DISPOSED",
	]);

	export type SerialNoStatus = z.infer<typeof serialNoStatusSchema>;

	export const serialNoSortBySchema = z.enum([
		"updatedAt",
		"createdAt",
		"serialNo",
		"itemCode",
		"warehouse",
		"status",
		"company",
	]);

	export type SerialNoSortBy = z.infer<typeof serialNoSortBySchema>;

	export interface SerialNoLinkSummary {
		purchaseReceiptId?: string | null;
		purchaseReceiptSeries?: string | null;
		deliveryNoteId?: string | null;
		deliveryNoteSeries?: string | null;
		stockEntryId?: string | null;
		stockEntrySeries?: string | null;
		pickListId?: string | null;
		pickListSeries?: string | null;
	}

	export interface SerialNoHistoryEntry {
		id: string;
		serialNoId: string;
		eventType:
			| "CREATED"
			| "UPDATED"
			| "STATUS_CHANGED"
			| "WAREHOUSE_CHANGED"
			| "LINKS_CHANGED";
		fromStatus?: SerialNoStatus | null;
		toStatus?: SerialNoStatus | null;
		warehouseId?: string | null;
		warehouseName?: string | null;
		transactionLabel?: string | null;
		notes?: string | null;
		createdAt: Date;
	}

	export interface SerialNo extends SerialNoLinkSummary {
		id: string;
		serialNo: string;
		itemId: string;
		itemCode: string;
		itemName: string;
		company: string;
		status: SerialNoStatus;
		currentWarehouseId?: string | null;
		currentWarehouseName?: string | null;
		workOrder?: string | null;
		purchaseDate?: Date | null;
		warrantyExpiryDate?: Date | null;
		serviceContractExpiryDate?: Date | null;
		maintenanceStatus?: string | null;
		notes?: string | null;
		isDisabled: boolean;
		createdAt: Date;
		updatedAt: Date;
		history: SerialNoHistoryEntry[];
	}

	export interface SerialNoListResult {
		items: SerialNo[];
		totalCount: number;
	}

	export const serialNoServiceContractExpiryStateSchema = z.enum([
		"EXPIRED",
		"DUE_SOON",
		"ACTIVE",
	]);

	export type SerialNoServiceContractExpiryState = z.infer<
		typeof serialNoServiceContractExpiryStateSchema
	>;

	export const serialNoServiceContractExpirySortBySchema = z.enum([
		"serviceContractExpiryDate",
		"updatedAt",
		"serialNo",
		"itemCode",
		"warehouse",
		"status",
		"company",
	]);

	export type SerialNoServiceContractExpirySortBy = z.infer<
		typeof serialNoServiceContractExpirySortBySchema
	>;

	export interface SerialNoServiceContractExpiryRow
		extends SerialNoLinkSummary {
		id: string;
		serialNo: string;
		itemId: string;
		itemCode: string;
		itemName: string;
		company: string;
		status: SerialNoStatus;
		currentWarehouseId?: string | null;
		currentWarehouseName?: string | null;
		workOrder?: string | null;
		purchaseDate?: Date | null;
		serviceContractExpiryDate: Date;
		daysUntilExpiry: number;
		expiryState: SerialNoServiceContractExpiryState;
		maintenanceStatus?: string | null;
		notes?: string | null;
		isDisabled: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	export interface SerialNoServiceContractExpiryListResult {
		items: SerialNoServiceContractExpiryRow[];
		totalCount: number;
	}

	export const serialNoWarrantyExpiryStateSchema = z.enum([
		"EXPIRED",
		"DUE_SOON",
		"ACTIVE",
	]);

	export type SerialNoWarrantyExpiryState = z.infer<
		typeof serialNoWarrantyExpiryStateSchema
	>;

	export const serialNoWarrantyExpirySortBySchema = z.enum([
		"warrantyExpiryDate",
		"updatedAt",
		"serialNo",
		"itemCode",
		"warehouse",
		"status",
		"company",
	]);

	export type SerialNoWarrantyExpirySortBy = z.infer<
		typeof serialNoWarrantyExpirySortBySchema
	>;

	export interface SerialNoWarrantyExpiryRow extends SerialNoLinkSummary {
		id: string;
		serialNo: string;
		itemId: string;
		itemCode: string;
		itemName: string;
		company: string;
		status: SerialNoStatus;
		currentWarehouseId?: string | null;
		currentWarehouseName?: string | null;
		workOrder?: string | null;
		purchaseDate?: Date | null;
		warrantyExpiryDate: Date;
		daysUntilExpiry: number;
		expiryState: SerialNoWarrantyExpiryState;
		maintenanceStatus?: string | null;
		notes?: string | null;
		isDisabled: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	export interface SerialNoWarrantyExpiryListResult {
		items: SerialNoWarrantyExpiryRow[];
		totalCount: number;
	}

	export interface ListSerialNoWarrantyExpiryInput {
		skip?: number;
		take?: number;
		search?: string;
		itemId?: string;
		warehouseId?: string;
		company?: string;
		status?: SerialNoStatus;
		includeDisabled?: boolean;
		expiryState?: SerialNoWarrantyExpiryState;
		expiryDateFrom?: Date;
		expiryDateTo?: Date;
		expiringWithinDays?: number;
		sortBy?: SerialNoWarrantyExpirySortBy;
		sortDirection?: "asc" | "desc";
	}

	export const serialNoStatusSortBySchema = z.enum([
		"updatedAt",
		"createdAt",
		"serialNo",
		"itemCode",
		"warehouse",
		"status",
		"company",
	]);

	export type SerialNoStatusSortBy = z.infer<typeof serialNoStatusSortBySchema>;

	export interface SerialNoStatusRow extends SerialNoLinkSummary {
		id: string;
		serialNo: string;
		itemId: string;
		itemCode: string;
		itemName: string;
		company: string;
		status: SerialNoStatus;
		currentWarehouseId?: string | null;
		currentWarehouseName?: string | null;
		workOrder?: string | null;
		purchaseDate?: Date | null;
		warrantyExpiryDate?: Date | null;
		serviceContractExpiryDate?: Date | null;
		lastStatusChangedAt: Date;
		daysInCurrentStatus: number;
		maintenanceStatus?: string | null;
		notes?: string | null;
		isDisabled: boolean;
		createdAt: Date;
		updatedAt: Date;
	}

	export interface SerialNoStatusListResult {
		items: SerialNoStatusRow[];
		totalCount: number;
	}

	export interface ListSerialNoStatusInput {
		skip?: number;
		take?: number;
		search?: string;
		itemId?: string;
		warehouseId?: string;
		company?: string;
		status?: SerialNoStatus;
		includeDisabled?: boolean;
		sortBy?: SerialNoStatusSortBy;
		sortDirection?: "asc" | "desc";
	}

	export interface ListSerialNoServiceContractExpiryInput {
		skip?: number;
		take?: number;
		search?: string;
		itemId?: string;
		warehouseId?: string;
		company?: string;
		status?: SerialNoStatus;
		includeDisabled?: boolean;
		expiryState?: SerialNoServiceContractExpiryState;
		expiryDateFrom?: Date;
		expiryDateTo?: Date;
		expiringWithinDays?: number;
		sortBy?: SerialNoServiceContractExpirySortBy;
		sortDirection?: "asc" | "desc";
	}

	export interface ListSerialNosInput {
		skip?: number;
		take?: number;
		search?: string;
		itemId?: string;
		warehouseId?: string;
		deliveryNoteId?: string;
		company?: string;
		status?: SerialNoStatus;
		includeDisabled?: boolean;
		sortBy?: SerialNoSortBy;
		sortDirection?: "asc" | "desc";
	}

	export interface CreateSerialNoInput {
		serialNo: string;
		itemId: string;
		company: string;
		status?: SerialNoStatus;
		currentWarehouseId?: string | null;
		purchaseReceiptId?: string | null;
		deliveryNoteId?: string | null;
		stockEntryId?: string | null;
		pickListId?: string | null;
		workOrder?: string | null;
		purchaseDate?: Date | null;
		warrantyExpiryDate?: Date | null;
		serviceContractExpiryDate?: Date | null;
		maintenanceStatus?: string | null;
		notes?: string | null;
		isDisabled?: boolean;
	}

	export interface UpdateSerialNoInput {
		id: string;
		serialNo?: string;
		itemId?: string;
		company?: string;
		status?: SerialNoStatus;
		currentWarehouseId?: string | null;
		purchaseReceiptId?: string | null;
		deliveryNoteId?: string | null;
		stockEntryId?: string | null;
		pickListId?: string | null;
		workOrder?: string | null;
		purchaseDate?: Date | null;
		warrantyExpiryDate?: Date | null;
		serviceContractExpiryDate?: Date | null;
		maintenanceStatus?: string | null;
		notes?: string | null;
		isDisabled?: boolean;
	}

	export const listSerialNoServiceContractExpirySchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).trim().optional(),
			itemId: z.string().cuid().optional(),
			warehouseId: z.string().cuid().optional(),
			company: z.string().max(255).trim().optional(),
			status: serialNoStatusSchema.optional(),
			includeDisabled: z.boolean().optional(),
			expiryState: serialNoServiceContractExpiryStateSchema.optional(),
			expiryDateFrom: z.coerce.date().optional(),
			expiryDateTo: z.coerce.date().optional(),
			expiringWithinDays: z.number().int().min(0).max(3650).optional(),
			sortBy: serialNoServiceContractExpirySortBySchema.optional(),
			sortDirection: z.enum(["asc", "desc"]).optional(),
		})
		.superRefine((value, ctx) => {
			if (
				value.expiryDateFrom &&
				value.expiryDateTo &&
				value.expiryDateTo < value.expiryDateFrom
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Expiry end date must be on or after the start date",
					path: ["expiryDateTo"],
				});
			}
		})
		.optional();

	export const listSerialNoWarrantyExpirySchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).trim().optional(),
			itemId: z.string().cuid().optional(),
			warehouseId: z.string().cuid().optional(),
			company: z.string().max(255).trim().optional(),
			status: serialNoStatusSchema.optional(),
			includeDisabled: z.boolean().optional(),
			expiryState: serialNoWarrantyExpiryStateSchema.optional(),
			expiryDateFrom: z.coerce.date().optional(),
			expiryDateTo: z.coerce.date().optional(),
			expiringWithinDays: z.number().int().min(0).max(3650).optional(),
			sortBy: serialNoWarrantyExpirySortBySchema.optional(),
			sortDirection: z.enum(["asc", "desc"]).optional(),
		})
		.superRefine((value, ctx) => {
			if (
				value.expiryDateFrom &&
				value.expiryDateTo &&
				value.expiryDateTo < value.expiryDateFrom
			) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Expiry end date must be on or after the start date",
					path: ["expiryDateTo"],
				});
			}
		})
		.optional();

	export const listSerialNoStatusSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).trim().optional(),
			itemId: z.string().cuid().optional(),
			warehouseId: z.string().cuid().optional(),
			company: z.string().max(255).trim().optional(),
			status: serialNoStatusSchema.optional(),
			includeDisabled: z.boolean().optional(),
			sortBy: serialNoStatusSortBySchema.optional(),
			sortDirection: z.enum(["asc", "desc"]).optional(),
		})
		.optional();

	export const listSerialNosSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).trim().optional(),
			itemId: z.string().cuid().optional(),
			warehouseId: z.string().cuid().optional(),
			deliveryNoteId: z.string().cuid().optional(),
			company: z.string().max(255).trim().optional(),
			status: serialNoStatusSchema.optional(),
			includeDisabled: z.boolean().optional(),
			sortBy: serialNoSortBySchema.optional(),
			sortDirection: z.enum(["asc", "desc"]).optional(),
		})
		.optional();

	const serialNoInputFields = {
		serialNo: z
			.string()
			.min(1, "Serial number is required")
			.max(120)
			.trim()
			.toUpperCase(),
		itemId: z.string().cuid("Item is required"),
		company: z.string().min(1, "Company is required").max(255).trim(),
		status: serialNoStatusSchema.default("DRAFT"),
		currentWarehouseId: z.string().cuid().optional().nullable(),
		purchaseReceiptId: z.string().min(1).optional().nullable(),
		deliveryNoteId: z.string().min(1).optional().nullable(),
		stockEntryId: z.string().min(1).optional().nullable(),
		pickListId: z.string().min(1).optional().nullable(),
		workOrder: z.string().max(255).trim().optional().nullable(),
		purchaseDate: z.coerce.date().optional().nullable(),
		warrantyExpiryDate: z.coerce.date().optional().nullable(),
		serviceContractExpiryDate: z.coerce.date().optional().nullable(),
		maintenanceStatus: z.string().max(255).trim().optional().nullable(),
		notes: z
			.string()
			.max(65_535, "Notes must be 65,535 characters or fewer")
			.optional()
			.nullable(),
		isDisabled: z.boolean().default(false),
	} satisfies z.ZodRawShape;

	const validateSerialNoDateOrder = (
		value: {
			purchaseDate?: Date | null;
			warrantyExpiryDate?: Date | null;
			serviceContractExpiryDate?: Date | null;
		},
		ctx: z.RefinementCtx,
	) => {
		if (
			value.purchaseDate &&
			value.warrantyExpiryDate &&
			value.warrantyExpiryDate < value.purchaseDate
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Warranty expiry must be on or after the purchase date",
				path: ["warrantyExpiryDate"],
			});
		}

		if (
			value.purchaseDate &&
			value.serviceContractExpiryDate &&
			value.serviceContractExpiryDate < value.purchaseDate
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"Service contract expiry must be on or after the purchase date",
				path: ["serviceContractExpiryDate"],
			});
		}
	};

	export const createSerialNoSchema = z
		.object(serialNoInputFields)
		.superRefine((value, ctx) => {
			validateSerialNoDateOrder(value, ctx);
		});

	export const updateSerialNoSchema = z
		.object({
			id: z.string().cuid(),
			serialNo: serialNoInputFields.serialNo.optional(),
			itemId: serialNoInputFields.itemId.optional(),
			company: serialNoInputFields.company.optional(),
			status: serialNoStatusSchema.optional(),
			currentWarehouseId: serialNoInputFields.currentWarehouseId,
			purchaseReceiptId: serialNoInputFields.purchaseReceiptId,
			deliveryNoteId: serialNoInputFields.deliveryNoteId,
			stockEntryId: serialNoInputFields.stockEntryId,
			pickListId: serialNoInputFields.pickListId,
			workOrder: serialNoInputFields.workOrder,
			purchaseDate: serialNoInputFields.purchaseDate,
			warrantyExpiryDate: serialNoInputFields.warrantyExpiryDate,
			serviceContractExpiryDate: serialNoInputFields.serviceContractExpiryDate,
			maintenanceStatus: serialNoInputFields.maintenanceStatus,
			notes: serialNoInputFields.notes,
			isDisabled: z.boolean().optional(),
		})
		.superRefine((value, ctx) => {
			validateSerialNoDateOrder(value, ctx);
		});

	export const installationNoteStatusSchema = z.enum([
		"DRAFT",
		"IN_PROGRESS",
		"COMPLETED",
		"CANCELLED",
	]);

	export type InstallationNoteStatus = z.infer<
		typeof installationNoteStatusSchema
	>;

	export const installationNoteSortBySchema = z.enum([
		"updatedAt",
		"createdAt",
		"series",
		"installationDate",
		"customer",
		"status",
		"company",
	]);

	export type InstallationNoteSortBy = z.infer<
		typeof installationNoteSortBySchema
	>;

	export interface InstallationNoteItem {
		id: string;
		installationNoteId: string;
		itemId: string;
		itemCode: string;
		itemName: string;
		serialNoId?: string | null;
		serialNo?: string | null;
		description?: string | null;
		installedQty: number;
	}

	export interface InstallationNote {
		id: string;
		series: string;
		seriesPattern: string;
		installationDate: Date;
		installationTime?: string | null;
		customer: string;
		customerName?: string | null;
		customerAddress?: string | null;
		contactPerson?: string | null;
		territory: string;
		customerGroup?: string | null;
		company: string;
		status: InstallationNoteStatus;
		deliveryNoteId?: string | null;
		deliveryNoteSeries?: string | null;
		remarks?: string | null;
		items: InstallationNoteItem[];
		createdAt: Date;
		updatedAt: Date;
	}

	export interface InstallationNoteListResult {
		items: InstallationNote[];
		totalCount: number;
	}

	export interface ListInstallationNotesInput {
		skip?: number;
		take?: number;
		search?: string;
		status?: InstallationNoteStatus;
		company?: string;
		deliveryNoteId?: string;
		sortBy?: InstallationNoteSortBy;
		sortDirection?: "asc" | "desc";
	}

	export interface CreateInstallationNoteItemInput {
		itemId: string;
		serialNoId?: string | null;
		description?: string | null;
		installedQty: number;
	}

	export interface CreateInstallationNoteInput {
		seriesPattern?: string;
		installationDate?: Date;
		installationTime?: string | null;
		customer: string;
		customerName?: string | null;
		customerAddress?: string | null;
		contactPerson?: string | null;
		territory?: string;
		customerGroup?: string | null;
		company: string;
		status?: InstallationNoteStatus;
		deliveryNoteId?: string | null;
		remarks?: string | null;
		items: CreateInstallationNoteItemInput[];
	}

	export interface UpdateInstallationNoteItemInput {
		id?: string;
		itemId: string;
		serialNoId?: string | null;
		description?: string | null;
		installedQty: number;
	}

	export interface UpdateInstallationNoteInput {
		id: string;
		installationDate?: Date;
		installationTime?: string | null;
		customer?: string;
		customerName?: string | null;
		customerAddress?: string | null;
		contactPerson?: string | null;
		territory?: string;
		customerGroup?: string | null;
		company?: string;
		status?: InstallationNoteStatus;
		deliveryNoteId?: string | null;
		remarks?: string | null;
		items?: UpdateInstallationNoteItemInput[];
	}

	export const listInstallationNotesSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).trim().optional(),
			status: installationNoteStatusSchema.optional(),
			company: z.string().max(255).trim().optional(),
			deliveryNoteId: z.string().min(1).optional(),
			sortBy: installationNoteSortBySchema.optional(),
			sortDirection: z.enum(["asc", "desc"]).optional(),
		})
		.optional();

	const installationNoteItemFields = {
		itemId: z.string().cuid("Item is required"),
		serialNoId: z.string().cuid().optional().nullable(),
		description: z
			.string()
			.max(65_535, "Description must be 65,535 characters or fewer")
			.optional()
			.nullable(),
		installedQty: z
			.number()
			.positive("Installed quantity must be greater than zero"),
	} satisfies z.ZodRawShape;

	export const createInstallationNoteItemSchema = z.object(
		installationNoteItemFields,
	);

	export const updateInstallationNoteItemSchema = z.object({
		id: z.string().cuid().optional(),
		...installationNoteItemFields,
	});

	const installationNoteFields = {
		seriesPattern: z.string().max(50).trim().optional(),
		installationDate: z.coerce.date().optional(),
		installationTime: z.string().max(8).trim().optional().nullable(),
		customer: z.string().min(1, "Customer is required").max(255).trim(),
		customerName: z.string().max(255).trim().optional().nullable(),
		customerAddress: z.string().max(255).trim().optional().nullable(),
		contactPerson: z.string().max(255).trim().optional().nullable(),
		territory: z
			.string()
			.min(1, "Territory is required")
			.max(255)
			.trim()
			.default("All Territories"),
		customerGroup: z.string().max(255).trim().optional().nullable(),
		company: z.string().min(1, "Company is required").max(255).trim(),
		status: installationNoteStatusSchema.default("DRAFT"),
		deliveryNoteId: z.string().min(1).optional().nullable(),
		remarks: z
			.string()
			.max(65_535, "Remarks must be 65,535 characters or fewer")
			.optional()
			.nullable(),
	} satisfies z.ZodRawShape;

	export const createInstallationNoteSchema = z.object({
		...installationNoteFields,
		items: z
			.array(createInstallationNoteItemSchema)
			.min(1, "At least one installation item is required"),
	});

	export const updateInstallationNoteSchema = z.object({
		id: z.string().cuid(),
		installationDate: installationNoteFields.installationDate,
		installationTime: installationNoteFields.installationTime,
		customer: installationNoteFields.customer.optional(),
		customerName: installationNoteFields.customerName,
		customerAddress: installationNoteFields.customerAddress,
		contactPerson: installationNoteFields.contactPerson,
		territory: installationNoteFields.territory.optional(),
		customerGroup: installationNoteFields.customerGroup,
		company: installationNoteFields.company.optional(),
		status: installationNoteStatusSchema.optional(),
		deliveryNoteId: installationNoteFields.deliveryNoteId,
		remarks: installationNoteFields.remarks,
		items: z.array(updateInstallationNoteItemSchema).min(1).optional(),
	});

	export const ITEM_VARIANT_COPY_FIELD_KEYS = [
		"description",
		"item_group",
		"stock_uom",
		"disabled",
		"allow_alternate_item",
		"maintain_stock",
		"is_fixed_asset",
		"opening_stock",
		"valuation_rate",
		"standard_selling_rate",
		"shelf_life_in_days",
		"end_of_life",
		"default_material_request_type",
		"valuation_method",
		"warranty_period_in_days",
		"weight_per_unit",
		"weight_uom",
		"allow_negative_stock",
		"has_batch_no",
		"has_serial_no",
	] as const;

	export type ItemVariantCopyFieldKey =
		(typeof ITEM_VARIANT_COPY_FIELD_KEYS)[number];

	export interface ItemVariantCopyFieldOption {
		value: ItemVariantCopyFieldKey;
		label: string;
		category: string;
		itemProperty: string;
		description?: string;
	}

	export const ITEM_VARIANT_COPY_FIELD_OPTIONS: readonly ItemVariantCopyFieldOption[] =
		[
			{
				value: "description",
				label: "Details",
				category: "Basics",
				itemProperty: "description",
				description: "Copies the item description into generated variants.",
			},
			{
				value: "item_group",
				label: "Item Group",
				category: "Basics",
				itemProperty: "itemGroupId",
				description: "Keeps variants aligned to the same item group.",
			},
			{
				value: "stock_uom",
				label: "Stock UOM",
				category: "Basics",
				itemProperty: "defaultUnitOfMeasureId",
				description: "Copies the default stock unit of measure.",
			},
			{
				value: "disabled",
				label: "Disabled",
				category: "Basics",
				itemProperty: "disabled",
			},
			{
				value: "allow_alternate_item",
				label: "Allow Alternative Item",
				category: "Basics",
				itemProperty: "allowAlternateItem",
			},
			{
				value: "maintain_stock",
				label: "Maintain Stock",
				category: "Basics",
				itemProperty: "maintainStock",
			},
			{
				value: "is_fixed_asset",
				label: "Is Fixed Asset",
				category: "Financial",
				itemProperty: "isFixedAsset",
			},
			{
				value: "opening_stock",
				label: "Opening Stock",
				category: "Inventory",
				itemProperty: "openingStock",
			},
			{
				value: "valuation_rate",
				label: "Valuation Rate",
				category: "Financial",
				itemProperty: "valuationRate",
			},
			{
				value: "standard_selling_rate",
				label: "Standard Selling Rate",
				category: "Financial",
				itemProperty: "standardSellingRate",
			},
			{
				value: "shelf_life_in_days",
				label: "Shelf Life in Days",
				category: "Inventory",
				itemProperty: "shelfLifeInDays",
			},
			{
				value: "end_of_life",
				label: "End of Life",
				category: "Inventory",
				itemProperty: "endOfLife",
			},
			{
				value: "default_material_request_type",
				label: "Default Material Request Type",
				category: "Inventory",
				itemProperty: "defaultMaterialRequestType",
			},
			{
				value: "valuation_method",
				label: "Valuation Method",
				category: "Inventory",
				itemProperty: "valuationMethod",
			},
			{
				value: "warranty_period_in_days",
				label: "Warranty Period in Days",
				category: "Inventory",
				itemProperty: "warrantyPeriodInDays",
			},
			{
				value: "weight_per_unit",
				label: "Weight per Unit",
				category: "Logistics",
				itemProperty: "weightPerUnit",
			},
			{
				value: "weight_uom",
				label: "Weight UOM",
				category: "Logistics",
				itemProperty: "weightUom",
			},
			{
				value: "allow_negative_stock",
				label: "Allow Negative Stock",
				category: "Inventory",
				itemProperty: "allowNegativeStock",
			},
			{
				value: "has_batch_no",
				label: "Has Batch No",
				category: "Tracking",
				itemProperty: "hasBatchNo",
			},
			{
				value: "has_serial_no",
				label: "Has Serial No",
				category: "Tracking",
				itemProperty: "hasSerialNo",
			},
		] as const;

	export interface ItemVariantSettingsCopyField {
		id: string;
		fieldKey: ItemVariantCopyFieldKey;
		label: string;
		category: string;
		itemProperty: string;
		position: number;
	}

	export interface ItemVariantSettings {
		id: string;
		doNotUpdateVariantsOnSave: boolean;
		allowRenameAttributeValue: boolean;
		copyFields: ItemVariantSettingsCopyField[];
		createdAt: Date;
		updatedAt: Date;
	}

	export interface UpdateItemVariantSettingsFieldInput {
		id?: string;
		fieldKey: ItemVariantCopyFieldKey;
	}

	export interface UpdateItemVariantSettingsInput {
		doNotUpdateVariantsOnSave: boolean;
		allowRenameAttributeValue: boolean;
		copyFields: UpdateItemVariantSettingsFieldInput[];
	}

	export type StockItemNamingBy = "ITEM_CODE" | "NAMING_SERIES";
	export type StockValuationMethod = "FIFO" | "MOVING_AVERAGE";
	export type StockQualityInspectionAction = "STOP" | "WARN";
	export type StockSerialBatchPickStrategy = "FIFO" | "LIFO" | "EXPIRY";

	/**
	 * Singleton inventory-wide stock settings.
	 */
	export interface StockSettings {
		/** Unique identifier (CUID) */
		id: string;
		/** Strategy used when deriving item naming defaults */
		itemNamingBy: StockItemNamingBy;
		/** Default warehouse label used across stock transactions */
		defaultWarehouse: string | null;
		/** Default valuation method applied to new stock items */
		defaultValuationMethod: StockValuationMethod;
		/** Default stock UOM label */
		defaultStockUom: string | null;
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
		actionIfQualityInspectionIsNotSubmitted: StockQualityInspectionAction;
		actionIfQualityInspectionIsRejected: StockQualityInspectionAction;
		enableStockReservation: boolean;
		allowPartialReservation: boolean;
		autoReserveStockForSalesOrderOnPurchase: boolean;
		autoReserveSerialAndBatchNos: boolean;
		autoCreateSerialAndBatchBundleForOutward: boolean;
		disableSerialNoAndBatchSelector: boolean;
		haveDefaultNamingSeriesForBatchId: boolean;
		pickSerialBatchBasedOn: StockSerialBatchPickStrategy;
		useSerialBatchFields: boolean;
		doNotUpdateSerialBatchOnCreationOfAutoBundle: boolean;
		allowExistingSerialNoToBeManufacturedReceivedAgain: boolean;
		setSerialAndBatchBundleNamingBasedOnNamingSeries: boolean;
		raiseMaterialRequestWhenStockReachesReorderLevel: boolean;
		notifyByEmailOnCreationOfAutomaticMaterialRequest: boolean;
		allowMaterialTransferFromDeliveryNoteToSalesInvoice: boolean;
		allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: boolean;
		freezeStocksOlderThanDays: number;
		/** When this settings record was created */
		createdAt: Date;
		/** When this settings record was last updated */
		updatedAt: Date;
	}

	/**
	 * Input for updating stock settings.
	 */
	export interface UpdateStockSettingsInput {
		itemNamingBy: StockItemNamingBy;
		defaultWarehouse?: string | null;
		defaultValuationMethod: StockValuationMethod;
		defaultStockUom?: string | null;
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
		actionIfQualityInspectionIsNotSubmitted: StockQualityInspectionAction;
		actionIfQualityInspectionIsRejected: StockQualityInspectionAction;
		enableStockReservation: boolean;
		allowPartialReservation: boolean;
		autoReserveStockForSalesOrderOnPurchase: boolean;
		autoReserveSerialAndBatchNos: boolean;
		autoCreateSerialAndBatchBundleForOutward: boolean;
		disableSerialNoAndBatchSelector: boolean;
		haveDefaultNamingSeriesForBatchId: boolean;
		pickSerialBatchBasedOn: StockSerialBatchPickStrategy;
		useSerialBatchFields: boolean;
		doNotUpdateSerialBatchOnCreationOfAutoBundle: boolean;
		allowExistingSerialNoToBeManufacturedReceivedAgain: boolean;
		setSerialAndBatchBundleNamingBasedOnNamingSeries: boolean;
		raiseMaterialRequestWhenStockReachesReorderLevel: boolean;
		notifyByEmailOnCreationOfAutomaticMaterialRequest: boolean;
		allowMaterialTransferFromDeliveryNoteToSalesInvoice: boolean;
		allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: boolean;
		freezeStocksOlderThanDays: number;
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
		/** Safety stock level */
		safetyStock: number;
		/** Procurement lead time in days */
		leadTimeDays: number;
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
		safetyStock?: number;
		leadTimeDays?: number;
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
		safetyStock?: number;
		leadTimeDays?: number;
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
		safetyStock: z.number().min(0).default(0),
		leadTimeDays: z.number().int().min(0).default(0),
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
		safetyStock: z.number().min(0).optional(),
		leadTimeDays: z.number().int().min(0).optional(),
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

	export const listWarehousesSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).optional(),
			company: z.string().max(255).optional(),
			disabled: z.boolean().optional(),
			isGroupWarehouse: z.boolean().optional(),
		})
		.optional();

	export const createWarehouseSchema = z.object({
		name: z.string().min(1, "Warehouse name is required").max(255).trim(),
		disabled: z.boolean().default(false),
		isGroupWarehouse: z.boolean().default(false),
		parentWarehouseId: z.string().cuid().optional().nullable(),
		company: z.string().min(1, "Company is required").max(255).trim(),
		isRejectedWarehouse: z.boolean().default(false),
		phoneNo: z.string().max(50).trim().optional().nullable(),
		mobileNo: z.string().max(50).trim().optional().nullable(),
		addressLine1: z.string().max(255).trim().optional().nullable(),
		addressLine2: z.string().max(255).trim().optional().nullable(),
		city: z.string().max(255).trim().optional().nullable(),
		state: z.string().max(255).trim().optional().nullable(),
		pin: z.string().max(20).trim().optional().nullable(),
		warehouseType: z.string().max(100).trim().optional().nullable(),
		defaultInTransitWarehouseId: z.string().cuid().optional().nullable(),
	});

	export const updateWarehouseSchema = z.object({
		id: z.string().cuid(),
		name: z.string().min(1).max(255).trim().optional(),
		disabled: z.boolean().optional(),
		isGroupWarehouse: z.boolean().optional(),
		parentWarehouseId: z.string().cuid().optional().nullable(),
		company: z.string().min(1).max(255).trim().optional(),
		isRejectedWarehouse: z.boolean().optional(),
		phoneNo: z.string().max(50).trim().optional().nullable(),
		mobileNo: z.string().max(50).trim().optional().nullable(),
		addressLine1: z.string().max(255).trim().optional().nullable(),
		addressLine2: z.string().max(255).trim().optional().nullable(),
		city: z.string().max(255).trim().optional().nullable(),
		state: z.string().max(255).trim().optional().nullable(),
		pin: z.string().max(20).trim().optional().nullable(),
		warehouseType: z.string().max(100).trim().optional().nullable(),
		defaultInTransitWarehouseId: z.string().cuid().optional().nullable(),
	});

	export const updateItemVariantSettingsSchema = z
		.object({
			doNotUpdateVariantsOnSave: z.boolean(),
			allowRenameAttributeValue: z.boolean(),
			copyFields: z
				.array(
					z.object({
						id: z.string().cuid().optional(),
						fieldKey: z.enum(ITEM_VARIANT_COPY_FIELD_KEYS),
					}),
				)
				.max(100),
		})
		.superRefine((settings, ctx) => {
			const seenFieldKeys = new Set<ItemVariantCopyFieldKey>();

			for (const [index, field] of settings.copyFields.entries()) {
				if (seenFieldKeys.has(field.fieldKey)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Copy fields to variant must be unique",
						path: ["copyFields", index, "fieldKey"],
					});
					continue;
				}

				seenFieldKeys.add(field.fieldKey);
			}
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
	 * Validation schema for creating a brand
	 */
	export const createBrandSchema = z.object({
		name: z.string().min(1, "Brand name is required").max(255).trim(),
		description: z.string().max(1000).trim().optional().nullable(),
	});

	/**
	 * Validation schema for updating a brand
	 */
	export const updateBrandSchema = z.object({
		id: z.string().cuid(),
		name: z.string().min(1).max(255).trim().optional(),
		description: z.string().max(1000).trim().optional().nullable(),
	});

	// ============================================================================
	// Item Attribute
	// ============================================================================

	/**
	 * A single attribute value row nested inside an ItemAttribute (e.g. "Red" / "R").
	 */
	export interface ItemAttributeValue {
		/** Unique identifier (CUID) */
		id: string;
		/** Parent attribute ID */
		attributeId: string;
		/** The display value (e.g. "Red", "Large") */
		attributeValue: string;
		/** Short abbreviation used in variant codes (e.g. "R", "L") */
		abbreviation: string;
		/** Zero-based display order position */
		position: number;
		/** When this value was created */
		createdAt: Date;
		/** When this value was last updated */
		updatedAt: Date;
	}

	/**
	 * Item Attribute master entity — defines product variant dimensions
	 * (e.g. Colour, Size) together with their allowed values.
	 */
	export interface ItemAttribute {
		/** Unique identifier (CUID) */
		id: string;
		/** Attribute name (e.g. "Colour", "Size") */
		name: string;
		/** Whether the attribute is disabled for selection */
		disabled: boolean;
		/**
		 * When true the attribute values represent numeric ranges
		 * rather than discrete text values.
		 */
		numericValues: boolean;
		/** Ordered list of allowed values for this attribute */
		attributeValues: ItemAttributeValue[];
		/** When this attribute was created */
		createdAt: Date;
		/** When this attribute was last updated */
		updatedAt: Date;
	}

	/**
	 * Schema for a single attribute value input row (used in create/update payloads).
	 */
	export const itemAttributeValueInputSchema = z.object({
		/** Existing row ID — present only when updating an existing value */
		id: z.string().cuid().optional(),
		attributeValue: z
			.string()
			.min(1, "Attribute value is required")
			.max(255)
			.trim(),
		abbreviation: z.string().min(1, "Abbreviation is required").max(50).trim(),
	});

	/**
	 * Validation schema for creating an item attribute.
	 */
	export const createItemAttributeSchema = z.object({
		name: z.string().min(1, "Attribute name is required").max(255).trim(),
		disabled: z.boolean().default(false),
		numericValues: z.boolean().default(false),
		attributeValues: z.array(itemAttributeValueInputSchema).default([]),
	});

	/**
	 * Validation schema for updating an item attribute.
	 */
	export const updateItemAttributeSchema = z.object({
		id: z.string().cuid(),
		name: z.string().min(1).max(255).trim().optional(),
		disabled: z.boolean().optional(),
		numericValues: z.boolean().optional(),
		/** When provided, fully replaces the attribute values list using a safe upsert strategy */
		attributeValues: z.array(itemAttributeValueInputSchema).optional(),
	});

	const stockItemNamingBySchema = z.enum(["ITEM_CODE", "NAMING_SERIES"]);
	const stockValuationMethodSchema = z.enum(["FIFO", "MOVING_AVERAGE"]);
	const stockQualityInspectionActionSchema = z.enum(["STOP", "WARN"]);
	const stockSerialBatchPickStrategySchema = z.enum(["FIFO", "LIFO", "EXPIRY"]);

	/**
	 * Validation schema for updating singleton stock settings.
	 */
	export const updateStockSettingsSchema = z.object({
		itemNamingBy: stockItemNamingBySchema,
		defaultWarehouse: z.string().max(255).trim().nullable().optional(),
		defaultValuationMethod: stockValuationMethodSchema,
		defaultStockUom: z.string().max(50).trim().nullable().optional(),
		autoInsertItemPriceIfMissing: z.boolean(),
		updateExistingPriceListRate: z.boolean(),
		allowToEditStockUomQtyForSalesDocuments: z.boolean(),
		allowToEditStockUomQtyForPurchaseDocuments: z.boolean(),
		overDeliveryReceiptAllowancePercent: z.number().min(0).max(100),
		allowNegativeStock: z.boolean(),
		showBarcodeFieldInStockTransactions: z.boolean(),
		convertItemDescriptionToCleanHtmlInTransactions: z.boolean(),
		overTransferAllowancePercent: z.number().min(0).max(100),
		allowInternalTransfersAtArmsLengthPrice: z.boolean(),
		overPickingAllowancePercent: z.number().min(0).max(100),
		actionIfQualityInspectionIsNotSubmitted: stockQualityInspectionActionSchema,
		actionIfQualityInspectionIsRejected: stockQualityInspectionActionSchema,
		enableStockReservation: z.boolean(),
		allowPartialReservation: z.boolean(),
		autoReserveStockForSalesOrderOnPurchase: z.boolean(),
		autoReserveSerialAndBatchNos: z.boolean(),
		autoCreateSerialAndBatchBundleForOutward: z.boolean(),
		disableSerialNoAndBatchSelector: z.boolean(),
		haveDefaultNamingSeriesForBatchId: z.boolean(),
		pickSerialBatchBasedOn: stockSerialBatchPickStrategySchema,
		useSerialBatchFields: z.boolean(),
		doNotUpdateSerialBatchOnCreationOfAutoBundle: z.boolean(),
		allowExistingSerialNoToBeManufacturedReceivedAgain: z.boolean(),
		setSerialAndBatchBundleNamingBasedOnNamingSeries: z.boolean(),
		raiseMaterialRequestWhenStockReachesReorderLevel: z.boolean(),
		notifyByEmailOnCreationOfAutomaticMaterialRequest: z.boolean(),
		allowMaterialTransferFromDeliveryNoteToSalesInvoice: z.boolean(),
		allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: z.boolean(),
		freezeStocksOlderThanDays: z.number().int().min(0).max(3650),
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
	// Stock Ledger Report Types & Schemas
	// ============================================================================

	export interface StockLedgerRow {
		id: string;
		stockEntryId: string;
		stockEntryItemId: string;
		series: string;
		voucherNo: string;
		postingDate: Date;
		company: string;
		status: StockEntryStatus;
		stockEntryType: StockEntryType;
		project?: string | null;
		itemCode: string;
		itemName?: string | null;
		itemGroupName?: string | null;
		brandName?: string | null;
		description?: string | null;
		warehouse: string;
		sourceWarehouse?: string | null;
		targetWarehouse?: string | null;
		batchNo?: string | null;
		serialNo?: string | null;
		movementType: "IN" | "OUT";
		qtyIn: number;
		qtyOut: number;
		balanceQty: number;
		basicRate: number;
		basicAmount: number;
		valuationRate?: number | null;
		balanceValue?: number | null;
		unitOfMeasure?: string | null;
		remarks?: string | null;
		createdAt: Date;
		updatedAt: Date;
	}

	export interface ListStockLedgerInput {
		skip?: number;
		take?: number;
		search?: string;
		company?: string;
		warehouse?: string;
		itemCode?: string;
		itemGroup?: string;
		brand?: string;
		voucherNo?: string;
		stockEntryType?: StockEntryType;
		status?: StockEntryStatus;
		project?: string;
		dateFrom?: Date;
		dateTo?: Date;
	}

	export const listStockLedgerSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).optional(),
			company: z.string().max(255).optional(),
			warehouse: z.string().max(255).optional(),
			itemCode: z.string().max(100).optional(),
			itemGroup: z.string().max(255).optional(),
			brand: z.string().max(255).optional(),
			voucherNo: z.string().max(50).optional(),
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
			status: z.enum(["DRAFT", "SUBMITTED", "CANCELLED"]).optional(),
			project: z.string().max(255).optional(),
			dateFrom: z.coerce.date().optional(),
			dateTo: z.coerce.date().optional(),
		})
		.optional();

	export interface StockBalanceRow {
		id: string;
		company: string;
		itemCode: string;
		itemName?: string | null;
		itemGroupName?: string | null;
		brandName?: string | null;
		warehouse: string;
		unitOfMeasure?: string | null;
		openingQty: number;
		openingValue: number;
		inQty: number;
		inValue: number;
		outQty: number;
		outValue: number;
		balanceQty: number;
		valuationRate?: number | null;
		balanceValue?: number | null;
		lastPostingDate?: Date | null;
	}

	export interface ListStockBalanceInput {
		skip?: number;
		take?: number;
		search?: string;
		company?: string;
		warehouse?: string;
		itemCode?: string;
		itemGroup?: string;
		brand?: string;
		project?: string;
		status?: StockEntryStatus;
		dateFrom?: Date;
		dateTo?: Date;
		includeZeroStockItems?: boolean;
	}

	export const listStockBalanceSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).optional(),
			company: z.string().max(255).optional(),
			warehouse: z.string().max(255).optional(),
			itemCode: z.string().max(100).optional(),
			itemGroup: z.string().max(255).optional(),
			brand: z.string().max(255).optional(),
			project: z.string().max(255).optional(),
			status: z.enum(["DRAFT", "SUBMITTED", "CANCELLED"]).optional(),
			dateFrom: z.coerce.date().optional(),
			dateTo: z.coerce.date().optional(),
			includeZeroStockItems: z.boolean().optional(),
		})
		.optional();

	export interface StockProjectedQtyRow {
		id: string;
		company: string;
		itemCode: string;
		itemName?: string | null;
		description?: string | null;
		itemGroupName?: string | null;
		brandName?: string | null;
		warehouse: string;
		unitOfMeasure?: string | null;
		actualQty: number;
		plannedQty: number;
		requestedQty: number;
		orderedQty: number;
		reservedQty: number;
		reservedQtyForProduction: number;
		reservedQtyForSubcontracting: number;
		reservedQtyForProductionPlan: number;
		projectedQty: number;
		reorderLevel: number;
		reorderQty: number;
		shortageQty: number;
		lastActivityDate?: Date | null;
	}

	export interface ListStockProjectedQtyInput {
		skip?: number;
		take?: number;
		search?: string;
		company?: string;
		warehouse?: string;
		itemCode?: string;
		itemGroup?: string;
		brand?: string;
		includeZeroStockItems?: boolean;
	}

	export const listStockProjectedQtySchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).optional(),
			company: z.string().max(255).optional(),
			warehouse: z.string().max(255).optional(),
			itemCode: z.string().max(100).optional(),
			itemGroup: z.string().max(255).optional(),
			brand: z.string().max(255).optional(),
			includeZeroStockItems: z.boolean().optional(),
		})
		.optional();

	export type StockSummaryMetric =
		| "PROJECTED_QTY"
		| "ACTUAL_QTY"
		| "RESERVED_QTY"
		| "RESERVED_QTY_FOR_PRODUCTION"
		| "RESERVED_QTY_FOR_SUBCONTRACTING"
		| "SHORTAGE_QTY";

	export type StockSummarySortDirection = "asc" | "desc";

	export type StockSummaryHealth = "CRITICAL" | "LOW" | "HEALTHY" | "SURPLUS";

	export type StockSummaryAction = "ADD" | "MOVE_AND_ADD";

	export interface StockSummaryRow {
		id: string;
		company: string;
		itemCode: string;
		itemName?: string | null;
		description?: string | null;
		itemGroupName?: string | null;
		brandName?: string | null;
		warehouse: string;
		unitOfMeasure?: string | null;
		actualQty: number;
		plannedQty: number;
		requestedQty: number;
		orderedQty: number;
		reservedQty: number;
		reservedQtyForProduction: number;
		reservedQtyForSubcontracting: number;
		reservedQtyForProductionPlan: number;
		projectedQty: number;
		reorderLevel: number;
		reorderQty: number;
		shortageQty: number;
		primaryMetric: StockSummaryMetric;
		primaryMetricValue: number;
		stockHealth: StockSummaryHealth;
		recommendedAction: StockSummaryAction;
		lastActivityDate?: Date | null;
	}

	export interface ListStockSummaryInput {
		skip?: number;
		take?: number;
		search?: string;
		company?: string;
		warehouse?: string;
		itemCode?: string;
		itemGroup?: string;
		brand?: string;
		metric?: StockSummaryMetric;
		sortDirection?: StockSummarySortDirection;
		includeZeroStockItems?: boolean;
	}

	export const stockSummaryMetricSchema = z.enum([
		"PROJECTED_QTY",
		"ACTUAL_QTY",
		"RESERVED_QTY",
		"RESERVED_QTY_FOR_PRODUCTION",
		"RESERVED_QTY_FOR_SUBCONTRACTING",
		"SHORTAGE_QTY",
	]);

	export const listStockSummarySchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).optional(),
			company: z.string().max(255).optional(),
			warehouse: z.string().max(255).optional(),
			itemCode: z.string().max(100).optional(),
			itemGroup: z.string().max(255).optional(),
			brand: z.string().max(255).optional(),
			metric: stockSummaryMetricSchema.optional(),
			sortDirection: z.enum(["asc", "desc"]).optional(),
			includeZeroStockItems: z.boolean().optional(),
		})
		.optional();

	export interface StockAgeingBucket {
		index: number;
		minAge: number;
		maxAge?: number | null;
		quantity: number;
		value: number;
	}

	export interface StockAgeingRow {
		id: string;
		company: string;
		itemCode: string;
		itemName?: string | null;
		description?: string | null;
		itemGroupName?: string | null;
		brandName?: string | null;
		warehouse?: string | null;
		unitOfMeasure?: string | null;
		availableQty: number;
		averageAge: number;
		averageRate: number;
		asOfDate: Date;
		buckets: StockAgeingBucket[];
	}

	export interface ListStockAgeingInput {
		skip?: number;
		take?: number;
		company?: string;
		warehouse?: string;
		itemCode?: string;
		brand?: string;
		asOfDate?: Date;
		showWarehouseWiseStock?: boolean;
		ageingRanges?: string;
	}

	export const listStockAgeingSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			company: z.string().max(255).optional(),
			warehouse: z.string().max(255).optional(),
			itemCode: z.string().max(100).optional(),
			brand: z.string().max(255).optional(),
			asOfDate: z.coerce.date().optional(),
			showWarehouseWiseStock: z.boolean().optional(),
			ageingRanges: z.string().max(64).optional(),
		})
		.optional();

	export interface ItemPriceStockRow {
		id: string;
		company: string;
		itemCode: string;
		itemName?: string | null;
		itemGroupName?: string | null;
		brandName?: string | null;
		warehouse: string;
		availableQty: number;
		buyingPriceList: string;
		buyingRate: number;
		sellingPriceList: string;
		sellingRate: number;
		lastActivityDate?: Date | null;
	}

	export interface ListItemPriceStockInput {
		skip?: number;
		take?: number;
		search?: string;
		company?: string;
		warehouse?: string;
		itemCode?: string;
		itemGroup?: string;
		brand?: string;
		includeZeroStockItems?: boolean;
	}

	export const listItemPriceStockSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).optional(),
			company: z.string().max(255).optional(),
			warehouse: z.string().max(255).optional(),
			itemCode: z.string().max(100).optional(),
			itemGroup: z.string().max(255).optional(),
			brand: z.string().max(255).optional(),
			includeZeroStockItems: z.boolean().optional(),
		})
		.optional();

	export interface WarehouseWiseStockBalanceRow {
		id: string;
		stockEntryId: string;
		stockEntryItemId: string;
		company: string;
		itemCode: string;
		itemName?: string | null;
		warehouse: string;
		postingDate: Date;
		voucherNo: string;
		qtyChange: number;
		incomingRate: number;
		movementType: "IN" | "OUT";
		createdAt: Date;
		updatedAt: Date;
	}

	export interface ListWarehouseWiseStockBalanceInput {
		skip?: number;
		take?: number;
		search?: string;
		company?: string;
		warehouse?: string;
		itemCode?: string;
		voucherNo?: string;
		status?: StockEntryStatus;
		dateFrom?: Date;
		dateTo?: Date;
	}

	export const listWarehouseWiseStockBalanceSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).optional(),
			company: z.string().max(255).optional(),
			warehouse: z.string().max(255).optional(),
			itemCode: z.string().max(100).optional(),
			voucherNo: z.string().max(50).optional(),
			status: z.enum(["DRAFT", "SUBMITTED", "CANCELLED"]).optional(),
			dateFrom: z.coerce.date().optional(),
			dateTo: z.coerce.date().optional(),
		})
		.optional();

	// ============================================================================
	// Quick Stock Balance Types & Schemas
	// ============================================================================

	/**
	 * Input for the Quick Stock Balance lookup.
	 * Caller must provide a warehouse and a date, plus either an itemCode or
	 * a barcode (not both are required – exactly one must be non-empty).
	 */
	export interface QuickStockBalanceInput {
		/** Warehouse name (exact match) */
		warehouse: string;
		/** Lookup date – balance is computed up to and including this date */
		date: Date;
		/** Item code – mutually exclusive with `barcode` */
		itemCode?: string;
		/** Item barcode – mutually exclusive with `itemCode` */
		barcode?: string;
	}

	export const quickStockBalanceSchema = z.object({
		warehouse: z.string().min(1).max(255).trim(),
		date: z.coerce.date(),
		itemCode: z.string().min(1).max(100).trim().optional(),
		barcode: z.string().min(1).max(255).trim().optional(),
	});

	/**
	 * Result returned by the Quick Stock Balance lookup.
	 */
	export interface QuickStockBalanceResult {
		/** Resolved item code */
		itemCode: string;
		/** Human-readable item name */
		itemName: string | null;
		/** Item description */
		description: string | null;
		/** All barcodes registered for this item */
		barcodes: string[];
		/** Stock quantity available up to (and including) the given date */
		availableQty: number;
		/** Stock value (qty × valuation rate) up to the given date */
		stockValue: number;
	}

	// ============================================================================
	// Stock Analytics Report Types & Schemas
	// ============================================================================

	/** Temporal grouping granularity for the Stock Analytics report. */
	export type StockAnalyticsRangeFrequency =
		| "Weekly"
		| "Monthly"
		| "Quarterly"
		| "Yearly";

	/** Whether the chart/table should show stock quantity or stock value. */
	export type StockAnalyticsValueQuantity = "Quantity" | "Value";

	/** One time bucket produced by the Stock Analytics report. */
	export interface StockAnalyticsPeriod {
		/** ISO date string for the first day of the bucket (inclusive). */
		from: Date;
		/** ISO date string for the last day of the bucket (inclusive). */
		to: Date;
		/** Human-readable label, e.g. "Jan 2024", "Q1 2024", "Week 5 2024". */
		label: string;
		/** Snake-cased key used as the column accessor (e.g. "jan_2024"). */
		key: string;
	}

	/**
	 * One row in the Stock Analytics report.
	 * `periodValues` maps a period key (from `StockAnalyticsPeriod.key`) to the
	 * cumulative running balance (qty or value) at the end of that period.
	 * A `null` value means the period is in the future relative to today and no
	 * data should be displayed.
	 */
	export interface StockAnalyticsRow {
		/** Item code — unique row identifier. */
		id: string;
		itemCode: string;
		itemName?: string | null;
		itemGroup?: string | null;
		brand?: string | null;
		unitOfMeasure?: string | null;
		/** period key → running balance (null = future period, no data). */
		periodValues: Record<string, number | null>;
	}

	/** Full response from the Stock Analytics report endpoint. */
	export interface StockAnalyticsResult {
		periods: StockAnalyticsPeriod[];
		rows: StockAnalyticsRow[];
	}

	export interface ListStockAnalyticsInput {
		fromDate: Date;
		toDate: Date;
		frequency: StockAnalyticsRangeFrequency;
		valueQuantity: StockAnalyticsValueQuantity;
		company?: string;
		warehouse?: string;
		itemCode?: string;
		itemGroup?: string;
		brand?: string;
	}

	export const listStockAnalyticsSchema = z.object({
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
		frequency: z.enum(["Weekly", "Monthly", "Quarterly", "Yearly"]),
		valueQuantity: z.enum(["Quantity", "Value"]),
		company: z.string().max(255).optional(),
		warehouse: z.string().max(255).optional(),
		itemCode: z.string().max(100).optional(),
		itemGroup: z.string().max(255).optional(),
		brand: z.string().max(255).optional(),
	});

	// ============================================================================
	// Sales Order Analysis Report Types & Schemas
	// ============================================================================

	/** Valid statuses for a Sales Order in the analysis report. */
	export type SalesOrderAnalysisStatus =
		| "TO_DELIVER_AND_BILL"
		| "TO_DELIVER"
		| "TO_BILL"
		| "COMPLETED"
		| "CLOSED";

	/** One row in the Sales Order Analysis report (item-level or SO-level when grouped). */
	export interface SalesOrderAnalysisRow {
		/** Sales Order series identifier, e.g. "SAL-ORD-2024-0001". */
		salesOrder: string;
		/** Sales Order internal id. */
		salesOrderId: string;
		/** Transaction (order) date as ISO string. */
		date: string;
		/** Expected delivery date for this item line as ISO string. */
		deliveryDate: string;
		/** Current Sales Order status. */
		status: SalesOrderAnalysisStatus;
		/** Customer name. */
		customer: string;
		/** Item code (null when grouped by SO). */
		itemCode: string | null;
		/** Item short description (null when grouped by SO). */
		description: string | null;
		/** Ordered quantity. */
		qty: number;
		/** Quantity delivered so far. */
		deliveredQty: number;
		/** Quantity still to be delivered (qty − deliveredQty). */
		pendingQty: number;
		/** Quantity invoiced. */
		billedQty: number;
		/** Quantity still to be invoiced (qty − billedQty). */
		qtyToBill: number;
		/** Order line amount in base currency. */
		amount: number;
		/** Amount that has been invoiced (base currency). */
		billedAmount: number;
		/** Amount not yet invoiced (amount − billedAmount). */
		pendingAmount: number;
		/** Value of quantity already delivered (deliveredQty × baseRate). */
		deliveredQtyAmount: number;
		/**
		 * Delay in calendar days beyond the expected delivery date.
		 * Zero for completed / fully-billed orders; negative values clamped to 0.
		 */
		delayDays: number;
		/**
		 * Elapsed time in seconds from SO date to latest delivery.
		 * Zero if no delivery has been made yet.
		 */
		timeTakenToDeliverSeconds: number;
		/** Warehouse (null when grouped by SO). */
		warehouse: string | null;
		/** Company name. */
		company: string;
	}

	/** Summary totals for the chart on the Sales Order Analysis page. */
	export interface SalesOrderAnalysisSummary {
		/** Total pending (un-billed) amount across all rows. */
		totalPendingAmount: number;
		/** Total billed amount across all rows. */
		totalBilledAmount: number;
	}

	/** Full response from the Sales Order Analysis endpoint. */
	export interface SalesOrderAnalysisResult {
		rows: SalesOrderAnalysisRow[];
		summary: SalesOrderAnalysisSummary;
	}

	export const listSalesOrderAnalysisSchema = z.object({
		company: z.string().min(1).max(255),
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
		/** Optional list of specific SO series IDs to filter by. */
		salesOrders: z.array(z.string().min(1)).optional(),
		/** Subset of statuses to include (all non-Stopped/On-Hold if omitted). */
		status: z
			.array(
				z.enum([
					"TO_DELIVER_AND_BILL",
					"TO_DELIVER",
					"TO_BILL",
					"COMPLETED",
					"CLOSED",
				]),
			)
			.optional(),
		warehouse: z.string().max(255).optional(),
		groupBySalesOrder: z.boolean().optional(),
	});

	export interface ListSalesOrderAnalysisInput {
		company: string;
		fromDate: Date;
		toDate: Date;
		salesOrders?: string[];
		status?: SalesOrderAnalysisStatus[];
		warehouse?: string;
		groupBySalesOrder?: boolean;
	}

	// ============================================================================
	// Purchase Order Analysis Report Types & Schemas
	// ============================================================================

	/** Valid statuses for a Purchase Order in the analysis report. */
	export type PurchaseOrderAnalysisStatus =
		| "TO_PAY"
		| "TO_BILL"
		| "TO_RECEIVE"
		| "TO_RECEIVE_AND_BILL"
		| "COMPLETED"
		| "CLOSED";

	/** One row in the Purchase Order Analysis report (item-level or PO-level when grouped). */
	export interface PurchaseOrderAnalysisRow {
		/** Purchase Order series identifier, e.g. "PUR-ORD-2024-0001". */
		purchaseOrder: string;
		/** Purchase Order internal id. */
		purchaseOrderId: string;
		/** Transaction (order) date as ISO string. */
		date: string;
		/** Required / schedule date for this item line as ISO string. */
		requiredDate: string;
		/** Current Purchase Order status. */
		status: PurchaseOrderAnalysisStatus;
		/** Supplier name. */
		supplier: string;
		/** Project associated with this line (null when grouped by PO). */
		project: string | null;
		/** Item code (null when grouped by PO). */
		itemCode: string | null;
		/** Ordered quantity. */
		qty: number;
		/** Quantity received so far. */
		receivedQty: number;
		/** Quantity still to be received (qty − receivedQty). */
		pendingQty: number;
		/** Quantity invoiced. */
		billedQty: number;
		/** Quantity still to be invoiced (qty − billedQty). */
		qtyToBill: number;
		/** Order line amount in base currency. */
		amount: number;
		/** Amount that has been invoiced (base currency). */
		billedAmount: number;
		/** Amount not yet invoiced (amount − billedAmount). */
		pendingAmount: number;
		/** Value of quantity already received (denormalised from purchase receipts). */
		receivedQtyAmount: number;
		/** Warehouse (null when grouped by PO). */
		warehouse: string | null;
		/** Company name. */
		company: string;
	}

	/** Summary totals for the chart on the Purchase Order Analysis page. */
	export interface PurchaseOrderAnalysisSummary {
		/** Total pending (un-billed) amount across all rows. */
		totalPendingAmount: number;
		/** Total billed amount across all rows. */
		totalBilledAmount: number;
	}

	/** Full response from the Purchase Order Analysis endpoint. */
	export interface PurchaseOrderAnalysisResult {
		rows: PurchaseOrderAnalysisRow[];
		summary: PurchaseOrderAnalysisSummary;
	}

	export const listPurchaseOrderAnalysisSchema = z.object({
		company: z.string().min(1).max(255),
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
		/** Optional list of specific PO series IDs to filter by. */
		purchaseOrders: z.array(z.string().min(1)).optional(),
		/** Subset of statuses to include (all non-Stopped/On-Hold/Draft if omitted). */
		status: z
			.array(
				z.enum([
					"TO_PAY",
					"TO_BILL",
					"TO_RECEIVE",
					"TO_RECEIVE_AND_BILL",
					"COMPLETED",
					"CLOSED",
				]),
			)
			.optional(),
		project: z.string().max(255).optional(),
		groupByPurchaseOrder: z.boolean().optional(),
	});

	export interface ListPurchaseOrderAnalysisInput {
		company: string;
		fromDate: Date;
		toDate: Date;
		purchaseOrders?: string[];
		status?: PurchaseOrderAnalysisStatus[];
		project?: string;
		groupByPurchaseOrder?: boolean;
	}

	// ============================================================================
	// Item Shortage Report Types & Schemas
	// ============================================================================

	/**
	 * One row in the Item Shortage Report.
	 *
	 * Only items whose projectedQty is strictly negative are included in results.
	 */
	export interface ItemShortageRow {
		id: string;
		company: string;
		warehouse: string;
		itemCode: string;
		itemName?: string | null;
		description?: string | null;
		actualQty: number;
		orderedQty: number;
		plannedQty: number;
		requestedQty: number;
		reservedQty: number;
		reservedQtyForProduction: number;
		projectedQty: number;
	}

	export const listItemShortageSchema = z
		.object({
			company: z.string().max(255).optional(),
			warehouses: z.array(z.string().max(255)).optional(),
		})
		.optional();

	export interface ListItemShortageInput {
		company?: string;
		warehouses?: string[];
	}

	// ============================================================================
	// Requested Items To Be Transferred Report Types & Schemas
	// ============================================================================

	export type RequestedItemsToBeTransferredPurpose =
		| "MATERIAL_TRANSFER"
		| "MATERIAL_ISSUE";

	/** One row in the Requested Items To Be Transferred report. */
	export interface RequestedItemsToBeTransferredRow {
		id: string;
		materialRequestId: string;
		materialRequest: string;
		date: Date;
		purpose: RequestedItemsToBeTransferredPurpose;
		status: MaterialRequestStatus;
		itemCode: string;
		itemName?: string | null;
		description?: string | null;
		company: string;
		targetWarehouse?: string | null;
		requiredBy?: Date | null;
		unitOfMeasure?: string | null;
		qty: number;
		transferredQty: number;
		qtyToTransfer: number;
	}

	/** Aggregate totals used by the Requested Items To Be Transferred page. */
	export interface RequestedItemsToBeTransferredSummary {
		requestCount: number;
		rowCount: number;
		totalQty: number;
		totalTransferredQty: number;
		totalQtyToTransfer: number;
		transferRowCount: number;
		issueRowCount: number;
	}

	export interface RequestedItemsToBeTransferredResult {
		rows: RequestedItemsToBeTransferredRow[];
		summary: RequestedItemsToBeTransferredSummary;
	}

	export const listRequestedItemsToBeTransferredSchema = z
		.object({
			company: z.string().max(255).optional(),
			materialRequest: z.string().max(50).optional(),
			itemCode: z.string().max(100).optional(),
			targetWarehouse: z.string().max(255).optional(),
			purpose: z.enum(["MATERIAL_TRANSFER", "MATERIAL_ISSUE"]).optional(),
		})
		.optional();

	export interface ListRequestedItemsToBeTransferredInput {
		company?: string;
		materialRequest?: string;
		itemCode?: string;
		targetWarehouse?: string;
		purpose?: RequestedItemsToBeTransferredPurpose;
	}

	// ============================================================================
	export type PurchaseReceiptTrendsPeriodFrequency =
		| "Monthly"
		| "Quarterly"
		| "Half-Yearly"
		| "Yearly";

	export type PurchaseReceiptTrendsBasedOn = "Item" | "Item Group" | "Supplier";

	/** One time bucket in the Purchase Receipt Trends report. */
	export interface PurchaseReceiptTrendsPeriod {
		/** Inclusive start date of the bucket. */
		from: Date;
		/** Inclusive end date of the bucket. */
		to: Date;
		/** Human-readable label, e.g. "Jan 2024", "Jan–Mar 2024". */
		label: string;
		/** Snake-cased key used as the column accessor, e.g. "jan_2024". */
		key: string;
	}

	/**
	 * One row in the Purchase Receipt Trends report.
	 * Represents a single grouping-dimension value (item, supplier, etc.)
	 * with aggregated accepted qty and amount per period.
	 */
	export interface PurchaseReceiptTrendsRow {
		/** Unique row identifier (slugified dimension key). */
		id: string;
		/** Primary group key (item code, supplier, item group name). */
		dimensionKey: string;
		/** Optional secondary label (e.g. item name for Item dimension). */
		dimensionLabel?: string | null;
		/** Aggregated accepted quantity per period key. */
		periodQty: Record<string, number>;
		/** Aggregated received amount per period key. */
		periodAmount: Record<string, number>;
		/** Sum of accepted qty across all periods. */
		totalQty: number;
		/** Sum of amount across all periods. */
		totalAmount: number;
	}

	/** Full response from the Purchase Receipt Trends endpoint. */
	export interface PurchaseReceiptTrendsResult {
		periods: PurchaseReceiptTrendsPeriod[];
		rows: PurchaseReceiptTrendsRow[];
		/** Grand total accepted qty across all rows and periods. */
		totalQty: number;
		/** Grand total amount across all rows and periods. */
		totalAmount: number;
	}

	export interface ListPurchaseReceiptTrendsInput {
		fromDate: Date;
		toDate: Date;
		period: PurchaseReceiptTrendsPeriodFrequency;
		basedOn: PurchaseReceiptTrendsBasedOn;
		company: string;
		supplier?: string;
		itemCode?: string;
		warehouse?: string;
	}

	export const listPurchaseReceiptTrendsSchema = z.object({
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
		period: z.enum(["Monthly", "Quarterly", "Half-Yearly", "Yearly"]),
		basedOn: z.enum(["Item", "Item Group", "Supplier"]),
		company: z.string().min(1).max(255),
		supplier: z.string().max(255).optional(),
		itemCode: z.string().max(100).optional(),
		warehouse: z.string().max(255).optional(),
	});

	// ============================================================================
	// Delivery Note Trends Report Types & Schemas
	// ============================================================================

	/** Temporal grouping granularity for the Delivery Note Trends report. */
	export type DeliveryNoteTrendsPeriodFrequency =
		| "Monthly"
		| "Quarterly"
		| "Half-Yearly"
		| "Yearly";

	/** The dimension used to group delivery note items in the trends report. */
	export type DeliveryNoteTrendsBasedOn =
		| "Item"
		| "Item Group"
		| "Customer"
		| "Project";

	/** One time bucket in the Delivery Note Trends report. */
	export interface DeliveryNoteTrendsPeriod {
		/** Inclusive start date of the bucket. */
		from: Date;
		/** Inclusive end date of the bucket. */
		to: Date;
		/** Human-readable label, e.g. "Jan 2024", "Jan–Mar 2024". */
		label: string;
		/** Snake-cased key used as the column accessor, e.g. "jan_2024". */
		key: string;
	}

	/**
	 * One row in the Delivery Note Trends report.
	 * Represents a single grouping-dimension value (item, customer, etc.)
	 * with aggregated qty and amount per period.
	 */
	export interface DeliveryNoteTrendsRow {
		/** Unique row identifier (slugified dimension key). */
		id: string;
		/** Primary group key (item code, customer, project, item group name). */
		dimensionKey: string;
		/** Optional secondary label (e.g. item name for Item dimension). */
		dimensionLabel?: string | null;
		/** Aggregated delivered quantity per period key. */
		periodQty: Record<string, number>;
		/** Aggregated delivered amount per period key. */
		periodAmount: Record<string, number>;
		/** Sum of qty across all periods. */
		totalQty: number;
		/** Sum of amount across all periods. */
		totalAmount: number;
	}

	/** Full response from the Delivery Note Trends endpoint. */
	export interface DeliveryNoteTrendsResult {
		periods: DeliveryNoteTrendsPeriod[];
		rows: DeliveryNoteTrendsRow[];
		/** Grand total qty across all rows and periods. */
		totalQty: number;
		/** Grand total amount across all rows and periods. */
		totalAmount: number;
	}

	export interface ListDeliveryNoteTrendsInput {
		fromDate: Date;
		toDate: Date;
		period: DeliveryNoteTrendsPeriodFrequency;
		basedOn: DeliveryNoteTrendsBasedOn;
		company: string;
		customer?: string;
		itemCode?: string;
		warehouse?: string;
	}

	export const listDeliveryNoteTrendsSchema = z.object({
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
		period: z.enum(["Monthly", "Quarterly", "Half-Yearly", "Yearly"]),
		basedOn: z.enum(["Item", "Item Group", "Customer", "Project"]),
		company: z.string().min(1).max(255),
		customer: z.string().max(255).optional(),
		itemCode: z.string().max(100).optional(),
		warehouse: z.string().max(255).optional(),
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
		packedQty: number;
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
	// Packing Slip Types & Schemas
	// ============================================================================

	export type PackingSlipStatus = "DRAFT" | "SUBMITTED" | "CANCELLED";

	export interface PackingSlipItem {
		id: string;
		packingSlipId: string;
		deliveryNoteItemId: string;
		itemCode: string;
		itemName: string | null;
		description: string | null;
		qty: number;
		netWeight: number;
		weightUom: string | null;
		batchNo: string | null;
	}

	export interface PackingSlip {
		id: string;
		series: string;
		status: PackingSlipStatus;
		deliveryNoteId: string;
		fromCaseNo: number;
		toCaseNo: number;
		netWeightPkg: number;
		netWeightUom: string | null;
		grossWeightPkg: number;
		grossWeightUom: string | null;
		letterHead: string | null;
		items: PackingSlipItem[];
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreatePackingSlipItemInput {
		deliveryNoteItemId: string;
		itemCode: string;
		itemName?: string | null;
		description?: string | null;
		qty: number;
		netWeight?: number;
		weightUom?: string | null;
		batchNo?: string | null;
	}

	export interface CreatePackingSlipInput {
		deliveryNoteId: string;
		fromCaseNo: number;
		toCaseNo?: number;
		grossWeightPkg?: number;
		grossWeightUom?: string | null;
		letterHead?: string | null;
		items: CreatePackingSlipItemInput[];
	}

	export interface UpdatePackingSlipItemInput {
		id?: string;
		deliveryNoteItemId: string;
		itemCode: string;
		itemName?: string | null;
		description?: string | null;
		qty: number;
		netWeight?: number;
		weightUom?: string | null;
		batchNo?: string | null;
	}

	export interface UpdatePackingSlipInput {
		id: string;
		fromCaseNo?: number;
		toCaseNo?: number;
		grossWeightPkg?: number;
		grossWeightUom?: string | null;
		letterHead?: string | null;
		items?: UpdatePackingSlipItemInput[];
	}

	export const packingSlipStatusSchema = z.enum([
		"DRAFT",
		"SUBMITTED",
		"CANCELLED",
	]);

	export const createPackingSlipItemSchema = z.object({
		deliveryNoteItemId: z.string().min(1, "Delivery note item is required"),
		itemCode: z.string().min(1, "Item code is required").max(100),
		itemName: z.string().max(255).optional().nullable(),
		description: z.string().optional().nullable(),
		qty: z.number().positive("Quantity must be greater than 0"),
		netWeight: z.number().min(0).optional().default(0),
		weightUom: z.string().max(50).optional().nullable(),
		batchNo: z.string().max(255).optional().nullable(),
	});

	export const createPackingSlipSchema = z.object({
		deliveryNoteId: z.string().min(1, "Delivery Note is required"),
		fromCaseNo: z.number().int().min(1, "From Package No. must be at least 1"),
		toCaseNo: z.number().int().min(1).optional(),
		grossWeightPkg: z.number().min(0).optional(),
		grossWeightUom: z.string().max(50).optional().nullable(),
		letterHead: z.string().max(255).optional().nullable(),
		items: z
			.array(createPackingSlipItemSchema)
			.min(1, "At least one item is required"),
	});

	export const updatePackingSlipItemSchema = z.object({
		id: z.string().optional(),
		deliveryNoteItemId: z.string().min(1),
		itemCode: z.string().min(1).max(100),
		itemName: z.string().max(255).optional().nullable(),
		description: z.string().optional().nullable(),
		qty: z.number().positive("Quantity must be greater than 0"),
		netWeight: z.number().min(0).optional().default(0),
		weightUom: z.string().max(50).optional().nullable(),
		batchNo: z.string().max(255).optional().nullable(),
	});

	export const updatePackingSlipSchema = z.object({
		id: z.string().min(1),
		fromCaseNo: z.number().int().min(1).optional(),
		toCaseNo: z.number().int().min(1).optional(),
		grossWeightPkg: z.number().min(0).optional(),
		grossWeightUom: z.string().max(50).optional().nullable(),
		letterHead: z.string().max(255).optional().nullable(),
		items: z.array(updatePackingSlipItemSchema).min(1).optional(),
	});

	export const bulkDeletePackingSlipsSchema = z.object({
		ids: z.array(z.string().min(1)).min(1),
	});

	export const listPackingSlipsSchema = z
		.object({
			deliveryNoteId: z.string().optional(),
			status: packingSlipStatusSchema.optional(),
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
		})
		.optional();

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

	// ============================================================================
	// Pick List
	// ============================================================================

	export type PickListStatus = "DRAFT" | "OPEN" | "COMPLETED" | "CANCELLED";

	export type PickListPurpose =
		| "MATERIAL_TRANSFER_FOR_MANUFACTURE"
		| "DELIVERY"
		| "MATERIAL_TRANSFER";

	export interface PickListItem {
		id: string;
		pickListId: string;
		item: string;
		warehouse?: string | null;
		qty: number;
		stockQty?: number | null;
		pickedQty?: number | null;
	}

	export interface PickList {
		id: string;
		series: string;
		seriesPattern: string;
		status: PickListStatus;
		company: string;
		customer?: string | null;
		purpose: PickListPurpose;
		workOrder?: string | null;
		warehouse?: string | null;
		considerRejectedWarehouses: boolean;
		pickManually: boolean;
		ignorePricingRule: boolean;
		scanMode: boolean;
		promptQty: boolean;
		scanBarcode?: string | null;
		groupSameItems: boolean;
		items: PickListItem[];
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreatePickListItemInput {
		item: string;
		warehouse?: string;
		qty: number;
		stockQty?: number;
		pickedQty?: number;
	}

	export interface CreatePickListInput {
		company: string;
		customer?: string;
		status?: PickListStatus;
		purpose?: PickListPurpose;
		workOrder?: string;
		warehouse?: string;
		considerRejectedWarehouses?: boolean;
		pickManually?: boolean;
		ignorePricingRule?: boolean;
		scanMode?: boolean;
		promptQty?: boolean;
		scanBarcode?: string;
		groupSameItems?: boolean;
		items?: CreatePickListItemInput[];
	}

	export interface UpdatePickListItemInput {
		id?: string;
		item: string;
		warehouse?: string | null;
		qty: number;
		stockQty?: number | null;
		pickedQty?: number | null;
	}

	export interface UpdatePickListInput {
		id: string;
		company?: string;
		customer?: string | null;
		purpose?: PickListPurpose;
		workOrder?: string | null;
		warehouse?: string | null;
		considerRejectedWarehouses?: boolean;
		pickManually?: boolean;
		ignorePricingRule?: boolean;
		scanMode?: boolean;
		promptQty?: boolean;
		scanBarcode?: string | null;
		groupSameItems?: boolean;
		status?: PickListStatus;
		items?: UpdatePickListItemInput[];
	}

	export const pickListStatusSchema = z.enum([
		"DRAFT",
		"OPEN",
		"COMPLETED",
		"CANCELLED",
	]);

	export const pickListPurposeSchema = z.enum([
		"MATERIAL_TRANSFER_FOR_MANUFACTURE",
		"DELIVERY",
		"MATERIAL_TRANSFER",
	]);

	export const createPickListItemSchema = z.object({
		item: z.string().min(1, "Item is required").max(255).trim(),
		warehouse: z.string().max(255).optional(),
		qty: z.number().min(0, "Quantity cannot be negative"),
		stockQty: z.number().min(0).optional(),
		pickedQty: z.number().min(0).optional(),
	});

	export const createPickListSchema = z.object({
		company: z.string().min(1, "Company is required").max(255).trim(),
		customer: z.string().max(255).optional(),
		status: pickListStatusSchema.optional(),
		purpose: pickListPurposeSchema.default("MATERIAL_TRANSFER_FOR_MANUFACTURE"),
		workOrder: z.string().max(255).optional(),
		warehouse: z.string().max(255).optional(),
		considerRejectedWarehouses: z.boolean().default(false),
		pickManually: z.boolean().default(false),
		ignorePricingRule: z.boolean().default(false),
		scanMode: z.boolean().default(false),
		promptQty: z.boolean().default(false),
		scanBarcode: z.string().max(255).optional(),
		groupSameItems: z.boolean().default(false),
		items: z.array(createPickListItemSchema),
	});

	export const updatePickListItemSchema = z.object({
		id: z.string().optional(),
		item: z.string().min(1, "Item is required").max(255).trim(),
		warehouse: z.string().max(255).optional().nullable(),
		qty: z.number().min(0, "Quantity cannot be negative"),
		stockQty: z.number().min(0).optional().nullable(),
		pickedQty: z.number().min(0).optional().nullable(),
	});

	export const updatePickListSchema = z.object({
		id: z.string().min(1),
		company: z.string().min(1).max(255).trim().optional(),
		customer: z.string().max(255).optional().nullable(),
		purpose: pickListPurposeSchema.optional(),
		workOrder: z.string().max(255).optional().nullable(),
		warehouse: z.string().max(255).optional().nullable(),
		considerRejectedWarehouses: z.boolean().optional(),
		pickManually: z.boolean().optional(),
		ignorePricingRule: z.boolean().optional(),
		scanMode: z.boolean().optional(),
		promptQty: z.boolean().optional(),
		scanBarcode: z.string().max(255).optional().nullable(),
		groupSameItems: z.boolean().optional(),
		status: pickListStatusSchema.optional(),
		items: z.array(updatePickListItemSchema).optional(),
	});

	export const listPickListsSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).optional(),
			status: pickListStatusSchema.optional(),
		})
		.optional();

	export const bulkDeletePickListsSchema = z.object({
		ids: z.array(z.string().min(1)).min(1),
	});

	// ─────────────────────────────────────────────────────────────────────────
	// Delivery Trip
	// ─────────────────────────────────────────────────────────────────────────

	export type DeliveryTripStatus =
		| "DRAFT"
		| "SCHEDULED"
		| "IN_TRANSIT"
		| "COMPLETED"
		| "CANCELLED";

	export interface DeliveryTripStop {
		id: string;
		deliveryTripId: string;
		stopNumber: number;
		customer?: string | null;
		addressName: string;
		locked: boolean;
		deliveryNote?: string | null;
		estimatedArrival?: Date | null;
	}

	export interface DeliveryTrip {
		id: string;
		series: string;
		seriesPattern: string;
		status: DeliveryTripStatus;
		company: string;
		driver?: string | null;
		driverAddress?: string | null;
		vehicle?: string | null;
		departureTime?: Date | null;
		initialEmailNotificationSent: boolean;
		stops: DeliveryTripStop[];
		createdAt: Date;
		updatedAt: Date;
	}

	export interface CreateDeliveryTripStopInput {
		stopNumber: number;
		customer?: string;
		addressName: string;
		locked?: boolean;
		deliveryNote?: string;
		estimatedArrival?: Date;
	}

	export interface UpdateDeliveryTripStopInput {
		id?: string;
		stopNumber: number;
		customer?: string | null;
		addressName: string;
		locked?: boolean;
		deliveryNote?: string | null;
		estimatedArrival?: Date | null;
	}

	export interface CreateDeliveryTripInput {
		company: string;
		driver?: string;
		driverAddress?: string;
		vehicle?: string;
		departureTime?: Date;
		status?: DeliveryTripStatus;
		initialEmailNotificationSent?: boolean;
		stops?: CreateDeliveryTripStopInput[];
	}

	export interface UpdateDeliveryTripInput {
		id: string;
		company?: string;
		driver?: string | null;
		driverAddress?: string | null;
		vehicle?: string | null;
		departureTime?: Date | null;
		status?: DeliveryTripStatus;
		initialEmailNotificationSent?: boolean;
		stops?: UpdateDeliveryTripStopInput[];
	}

	export const deliveryTripStatusSchema = z.enum([
		"DRAFT",
		"SCHEDULED",
		"IN_TRANSIT",
		"COMPLETED",
		"CANCELLED",
	]);

	export const createDeliveryTripStopSchema = z.object({
		stopNumber: z.number().int().min(1),
		customer: z.string().max(255).optional(),
		addressName: z.string().min(1, "Address Name is required").max(500).trim(),
		locked: z.boolean().default(false),
		deliveryNote: z.string().max(50).optional(),
		estimatedArrival: z.coerce.date().optional(),
	});

	export const updateDeliveryTripStopSchema = z.object({
		id: z.string().optional(),
		stopNumber: z.number().int().min(1),
		customer: z.string().max(255).optional().nullable(),
		addressName: z.string().min(1, "Address Name is required").max(500).trim(),
		locked: z.boolean().default(false),
		deliveryNote: z.string().max(50).optional().nullable(),
		estimatedArrival: z.coerce.date().optional().nullable(),
	});

	export const createDeliveryTripSchema = z.object({
		company: z.string().min(1, "Company is required").max(255).trim(),
		driver: z.string().max(255).optional(),
		driverAddress: z.string().max(500).optional(),
		vehicle: z.string().max(255).optional(),
		departureTime: z.coerce.date().optional(),
		status: deliveryTripStatusSchema.optional(),
		initialEmailNotificationSent: z.boolean().default(false),
		stops: z.array(createDeliveryTripStopSchema).default([]),
	});

	export const updateDeliveryTripSchema = z.object({
		id: z.string().min(1),
		company: z.string().min(1).max(255).trim().optional(),
		driver: z.string().max(255).optional().nullable(),
		driverAddress: z.string().max(500).optional().nullable(),
		vehicle: z.string().max(255).optional().nullable(),
		departureTime: z.coerce.date().optional().nullable(),
		status: deliveryTripStatusSchema.optional(),
		initialEmailNotificationSent: z.boolean().optional(),
		stops: z.array(updateDeliveryTripStopSchema).optional(),
	});

	export const listDeliveryTripsSchema = z
		.object({
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
			search: z.string().max(255).optional(),
			status: deliveryTripStatusSchema.optional(),
		})
		.optional();

	export const bulkDeleteDeliveryTripsSchema = z.object({
		ids: z.array(z.string().min(1)).min(1),
	});

	// ============================================================================
	// Quality Inspection Types & Schemas
	// ============================================================================

	export interface QiParameterGroup {
		id: string;
		name: string;
		createdAt: Date;
		updatedAt: Date;
	}

	export interface QiParameter {
		id: string;
		parameter: string;
		description: string | null;
		groupId: string | null;
		groupName: string | null;
		createdAt: Date;
		updatedAt: Date;
	}

	/** Acceptance criteria mode for a template item. */
	export type QiAcceptanceMode = "NUMERIC" | "VALUE" | "FORMULA";

	export interface QiTemplateItem {
		id: string;
		templateId: string;
		parameterId: string;
		parameterName: string;
		parameterGroupId: string | null;
		parameterGroupName: string | null;
		sortOrder: number;
		numeric: boolean;
		formulaBased: boolean;
		value: string | null;
		minValue: number | null;
		maxValue: number | null;
		acceptanceFormula: string | null;
	}

	export interface QiTemplate {
		id: string;
		name: string;
		items: QiTemplateItem[];
		createdAt: Date;
		updatedAt: Date;
	}

	// ── Parameter Group schemas ──────────────────────────────────────────────────

	export const createQiParameterGroupSchema = z.object({
		name: z
			.string()
			.min(1, "Group name is required")
			.max(255, "Group name must be at most 255 characters"),
	});

	export const updateQiParameterGroupSchema = z.object({
		id: z.string().min(1),
		name: z
			.string()
			.min(1, "Group name is required")
			.max(255, "Group name must be at most 255 characters"),
	});

	// ── Parameter schemas ────────────────────────────────────────────────────────

	export const createQiParameterSchema = z.object({
		parameter: z
			.string()
			.min(1, "Parameter name is required")
			.max(255, "Parameter name must be at most 255 characters"),
		description: z.string().optional().nullable(),
		groupId: z.string().optional().nullable(),
	});

	export const updateQiParameterSchema = z.object({
		id: z.string().min(1),
		parameter: z.string().min(1).max(255).optional(),
		description: z.string().optional().nullable(),
		groupId: z.string().optional().nullable(),
	});

	export const listQiParametersSchema = z
		.object({
			search: z.string().max(255).optional(),
			groupId: z.string().optional(),
		})
		.optional();

	// ── Template item schema ─────────────────────────────────────────────────────

	export const createQiTemplateItemSchema = z
		.object({
			parameterId: z.string().min(1, "Parameter is required"),
			sortOrder: z.number().int().min(0).optional().default(0),
			numeric: z.boolean().default(true),
			formulaBased: z.boolean().default(false),
			value: z.string().max(500).optional().nullable(),
			minValue: z.number().optional().nullable(),
			maxValue: z.number().optional().nullable(),
			acceptanceFormula: z.string().optional().nullable(),
		})
		.superRefine((data, ctx) => {
			if (data.formulaBased) return; // formula mode — no further checks
			if (data.numeric) {
				if (data.minValue == null && data.maxValue == null) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Numeric parameters require at least a min or max value",
						path: ["minValue"],
					});
				}
			}
		});

	export const updateQiTemplateItemSchema = z
		.object({
			id: z.string().optional(), // present when updating an existing item
			parameterId: z.string().min(1, "Parameter is required"),
			sortOrder: z.number().int().min(0).optional().default(0),
			numeric: z.boolean().default(true),
			formulaBased: z.boolean().default(false),
			value: z.string().max(500).optional().nullable(),
			minValue: z.number().optional().nullable(),
			maxValue: z.number().optional().nullable(),
			acceptanceFormula: z.string().optional().nullable(),
		})
		.superRefine((data, ctx) => {
			if (data.formulaBased) return;
			if (data.numeric) {
				if (data.minValue == null && data.maxValue == null) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Numeric parameters require at least a min or max value",
						path: ["minValue"],
					});
				}
			}
		});

	// ── Template schemas ─────────────────────────────────────────────────────────

	export const createQiTemplateSchema = z.object({
		name: z
			.string()
			.min(1, "Template name is required")
			.max(255, "Template name must be at most 255 characters"),
		items: z
			.array(createQiTemplateItemSchema)
			.min(1, "At least one parameter is required"),
	});

	export const updateQiTemplateSchema = z.object({
		id: z.string().min(1),
		name: z.string().min(1).max(255).optional(),
		items: z.array(updateQiTemplateItemSchema).min(1).optional(),
	});

	export const listQiTemplatesSchema = z
		.object({
			search: z.string().max(255).optional(),
			skip: z.number().int().min(0).optional(),
			take: z.number().int().min(1).max(250).optional(),
		})
		.optional();

	export const bulkDeleteQiTemplatesSchema = z.object({
		ids: z.array(z.string().min(1)).min(1),
	});

	// ============================================================================
	// Batch-Wise Balance History Report Types & Schemas
	// ============================================================================

	/**
	 * One row in the Batch-Wise Balance History report.
	 *
	 * Represents the inventory position of a single batch for a given item
	 * and warehouse. `openingQty` reflects the batch balance carried into the
	 * period (received before `fromDate`); `inQty` reflects batches received
	 * during the period. `outQty` is always 0 in Aria (per-period issue
	 * tracking requires an SLE-style ledger that is not yet part of the data
	 * model). `balanceQty` is the authoritative current on-hand quantity.
	 */
	export interface BatchWiseBalanceRow {
		id: string;
		company: string;
		itemCode: string;
		itemName: string | null;
		description: string | null;
		warehouse: string | null;
		batchNo: string;
		openingQty: number;
		inQty: number;
		outQty: number;
		balanceQty: number;
		valuationRate: number;
		balanceValue: number;
		unitOfMeasure: string | null;
		manufacturingDate: string | null;
		expiryDate: string | null;
	}

	export const listBatchWiseBalanceSchema = z.object({
		company: z.string().min(1, "Company is required").max(255).trim(),
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
		itemCode: z.string().max(100).trim().optional(),
		warehouse: z.string().max(255).trim().optional(),
		batchNo: z.string().max(120).trim().optional(),
	});

	export interface ListBatchWiseBalanceInput {
		company: string;
		fromDate: Date;
		toDate: Date;
		itemCode?: string;
		warehouse?: string;
		batchNo?: string;
	}

	// ---------------------------------------------------------------------------
	// Batch Item Expiry Status report
	// ---------------------------------------------------------------------------

	/**
	 * A single row in the Batch Item Expiry Status report.
	 *
	 * Reports active batches (non-disabled, qty > 0) created within a date
	 * range, showing their expiry dates and days-to-expiry relative to the
	 * query execution date.
	 */
	export interface BatchItemExpiryRow {
		/** Internal batch record id. */
		id: string;
		/** Item code. */
		itemCode: string;
		/** Human-readable item name. */
		itemName: string | null;
		/** Batch identifier / lot number. */
		batchNo: string;
		/** Default stock unit of measure for the item. */
		stockUom: string | null;
		/** Current on-hand quantity for this batch. */
		quantity: number;
		/** Expiry date as ISO-8601 date string (YYYY-MM-DD), or null if not set. */
		expiresOn: string | null;
		/**
		 * Days remaining until expiry at the time the report was run.
		 * 0 means the batch has already expired.  null means no expiry date.
		 */
		expiryInDays: number | null;
	}

	export const listBatchItemExpirySchema = z.object({
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
		itemCode: z.string().max(100).trim().optional(),
	});

	export interface ListBatchItemExpiryInput {
		fromDate: Date;
		toDate: Date;
		itemCode?: string;
	}

	// ---------------------------------------------------------------------------
	// Item Prices report
	// ---------------------------------------------------------------------------

	/**
	 * A single row in the Item Prices report.
	 *
	 * Shows each item's current pricing information including valuation rate,
	 * standard selling rate, and last purchase rate derived from purchase receipts.
	 */
	export interface ItemPricesRow {
		/** Unique row identifier (item code). */
		id: string;
		/** Item code. */
		itemCode: string;
		/** Human-readable item name. */
		itemName: string | null;
		/** Item group name. */
		itemGroupName: string | null;
		/** Brand name. */
		brandName: string | null;
		/** Item description. */
		description: string | null;
		/** Default stock unit of measure. */
		stockUom: string | null;
		/** Last purchase rate (base rate from most recent purchase receipt). Null if no purchase history. */
		lastPurchaseRate: number | null;
		/** Current valuation rate from the inventory item. 0 if not set. */
		valuationRate: number;
		/** Standard selling rate from the inventory item. 0 if not set. */
		standardSellingRate: number;
	}

	/**
	 * Controls which items are included based on their enabled/disabled status.
	 */
	export type ItemPricesItemsFilter = "enabled" | "disabled" | "all";

	export const listItemPricesSchema = z.object({
		itemsFilter: z
			.enum(["enabled", "disabled", "all"])
			.optional()
			.default("enabled"),
		itemCode: z.string().max(100).trim().optional(),
		itemGroup: z.string().max(255).trim().optional(),
		brand: z.string().max(255).trim().optional(),
	});

	export interface ListItemPricesInput {
		itemsFilter?: ItemPricesItemsFilter;
		itemCode?: string;
		itemGroup?: string;
		brand?: string;
	}

	// ============================================================================
	// Itemwise Recommended Reorder Level Report Types & Schemas
	// ============================================================================

	/** One row in the Itemwise Recommended Reorder Level report. */
	export interface ItemwiseRecommendedReorderLevelRow {
		id: string;
		itemCode: string;
		itemName: string;
		itemGroup?: string | null;
		brand?: string | null;
		description?: string | null;
		safetyStock: number;
		leadTimeDays: number;
		consumed: number;
		delivered: number;
		totalOutgoing: number;
		avgDailyOutgoing: number;
		reorderLevel: number;
	}

	export const listItemwiseRecommendedReorderLevelSchema = z.object({
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
		itemGroup: z.string().max(255).trim().optional(),
		brand: z.string().max(255).trim().optional(),
	});

	export interface ListItemwiseRecommendedReorderLevelInput {
		fromDate: Date;
		toDate: Date;
		itemGroup?: string;
		brand?: string;
	}

	// ============================================================================
	// Item Variant Details Report Types & Schemas
	// ============================================================================

	/** One row in the Item Variant Details report. Each variant is one row. */
	export interface ItemVariantDetailsRow {
		/** Variant item ID (CUID) */
		id: string;
		/** Variant item code */
		variantCode: string;
		/** Variant item name */
		variantName: string;
		/**
		 * Dynamic attribute values keyed by attribute name.
		 * E.g. { "Color": "Red", "Size": "Large" }
		 */
		attributes: Record<string, string>;
		/** Average buying price from purchase receipts */
		avgBuyingPriceListRate: number;
		/** Average selling price (standardSellingRate) */
		avgSellingPriceListRate: number;
		/** Current stock quantity */
		currentStock: number;
		/** Open (non-completed, non-cancelled) sales order item qty */
		openOrders: number;
	}

	/** Result of the item variant details query, including attribute names for column headers. */
	export interface ItemVariantDetailsResult {
		/** Ordered list of attribute names used as dynamic columns */
		attributeNames: string[];
		/** Report rows */
		rows: ItemVariantDetailsRow[];
	}

	export const listItemVariantDetailsSchema = z.object({
		/** The template item code (must have hasVariants=true) */
		itemCode: z.string().min(1).max(100).trim(),
	});

	export interface ListItemVariantDetailsInput {
		itemCode: string;
	}

	// ============================================================================
	// Subcontracted Raw Materials To Be Transferred Report Types & Schemas
	// ============================================================================

	export type SubcontractingOrderStatus =
		| "DRAFT"
		| "OPEN"
		| "PARTIALLY_RECEIVED"
		| "COMPLETED"
		| "CLOSED"
		| "CANCELLED";

	/** One row in the Subcontracted Raw Materials To Be Transferred report. */
	export interface SubcontractedRawMaterialsRow {
		id: string;
		subcontractingOrderId: string;
		subcontractOrder: string;
		date: Date;
		supplier: string;
		rmItemCode: string;
		rmItemName?: string | null;
		requiredQty: number;
		transferredQty: number;
		returnedQty: number;
		pendingQty: number;
	}

	/** Aggregate totals for the Subcontracted Raw Materials To Be Transferred page. */
	export interface SubcontractedRawMaterialsSummary {
		orderCount: number;
		rowCount: number;
		totalRequiredQty: number;
		totalTransferredQty: number;
		totalReturnedQty: number;
		totalPendingQty: number;
	}

	export interface SubcontractedRawMaterialsResult {
		rows: SubcontractedRawMaterialsRow[];
		summary: SubcontractedRawMaterialsSummary;
	}

	export const listSubcontractedRawMaterialsSchema = z.object({
		supplier: z.string().min(1).max(255).trim(),
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
		company: z.string().max(255).optional(),
		rmItemCode: z.string().max(100).optional(),
	});

	export interface ListSubcontractedRawMaterialsInput {
		supplier: string;
		fromDate: Date;
		toDate: Date;
		company?: string;
		rmItemCode?: string;
	}
}

// ============================================================================
// Product Domain Types
// ============================================================================

/**
 * Product entity - represents a product in the system
 * Simple, flat structure for easy understanding
 */
export interface Product {
	/** Unique numeric identifier */
	id: number;
	/** Product name */
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
