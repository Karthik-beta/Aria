/**
 * Shared constants, helpers, and Prisma select objects used across
 * inventory sub-services.
 *
 * @module inventory-shared
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock | ERPNext Stock Module}
 */
import type { Inventory } from "@aria/types";
import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import type { StockAgeingBucketRange } from "../reports/stock/stock-ageing-report";

// ─── Generic helpers ────────────────────────────────────────────────────────

export const formatItemGroupDefaults = (
	defaults?: Inventory.ItemGroupDefault[],
) =>
	defaults?.map(({ company, defaultWarehouse, defaultPriceList }) => ({
		company,
		defaultWarehouse,
		defaultPriceList,
	}));

export const formatBarcodes = (barcodes?: Inventory.ItemBarcode[] | null) =>
	barcodes?.map(({ barcode, barcodeType, uom }) => ({
		barcode,
		barcodeType,
		uom,
	}));

export type InventoryItemReorderInput = {
	id?: string | null;
	warehouse: string;
	reorderLevel?: number | null;
	reorderQty?: number | null;
	materialRequestType?: string | null;
};

export const formatReorderSettings = (
	items?: InventoryItemReorderInput[] | null,
) =>
	items?.map(({ warehouse, reorderLevel, reorderQty, materialRequestType }) => {
		const entry: {
			warehouse: string;
			reorderLevel?: number;
			reorderQty?: number;
			materialRequestType?: string | null;
		} = { warehouse };

		if (reorderLevel != null && typeof reorderLevel === "number") {
			entry.reorderLevel = reorderLevel;
		}

		if (reorderQty != null && typeof reorderQty === "number") {
			entry.reorderQty = reorderQty;
		}

		if (materialRequestType !== undefined) {
			entry.materialRequestType = materialRequestType;
		}

		return entry;
	});

export const removeUndefined = <T extends Record<string, unknown>>(obj: T) =>
	Object.fromEntries(
		Object.entries(obj).filter(([, value]) => value !== undefined),
	) as Partial<T>;

export const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

export const startOfUtcDay = (value: Date) =>
	new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
	);

export const addUtcDays = (value: Date, days: number) =>
	new Date(value.getTime() + days * MILLISECONDS_PER_DAY);

export const diffUtcDays = (from: Date, to: Date) =>
	Math.round(
		(startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) /
			MILLISECONDS_PER_DAY,
	);

export const brandSelect = {
	id: true,
	name: true,
	description: true,
	createdAt: true,
	updatedAt: true,
} as const;

export const itemAttributeSelect = {
	id: true,
	name: true,
	disabled: true,
	numericValues: true,
	fromRange: true,
	toRange: true,
	increment: true,
	createdAt: true,
	updatedAt: true,
	attributeValues: {
		select: {
			id: true,
			attributeId: true,
			attributeValue: true,
			abbreviation: true,
			position: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy: { position: "asc" as const },
	},
} as const;

export const unitOfMeasureSelect = {
	id: true,
	name: true,
	disabled: true,
	isWholeNumber: true,
	createdAt: true,
	updatedAt: true,
} as const;

export const warehouseSelect = {
	id: true,
	name: true,
	disabled: true,
	isGroupWarehouse: true,
	parentWarehouseId: true,
	company: true,
	isRejectedWarehouse: true,
	phoneNo: true,
	mobileNo: true,
	addressLine1: true,
	addressLine2: true,
	city: true,
	state: true,
	pin: true,
	warehouseType: true,
	defaultInTransitWarehouseId: true,
	createdAt: true,
	updatedAt: true,
	parentWarehouse: {
		select: {
			id: true,
			name: true,
		},
	},
	defaultInTransitWarehouse: {
		select: {
			id: true,
			name: true,
		},
	},
} as const;

export const stockSettingsSelect = {
	id: true,
	itemNamingBy: true,
	defaultWarehouse: true,
	defaultValuationMethod: true,
	defaultStockUom: true,
	autoInsertItemPriceIfMissing: true,
	updateExistingPriceListRate: true,
	allowToEditStockUomQtyForSalesDocuments: true,
	allowToEditStockUomQtyForPurchaseDocuments: true,
	overDeliveryReceiptAllowancePercent: true,
	allowNegativeStock: true,
	showBarcodeFieldInStockTransactions: true,
	convertItemDescriptionToCleanHtmlInTransactions: true,
	overTransferAllowancePercent: true,
	allowInternalTransfersAtArmsLengthPrice: true,
	overPickingAllowancePercent: true,
	actionIfQualityInspectionIsNotSubmitted: true,
	actionIfQualityInspectionIsRejected: true,
	enableStockReservation: true,
	allowPartialReservation: true,
	autoReserveStockForSalesOrderOnPurchase: true,
	autoReserveSerialAndBatchNos: true,
	autoCreateSerialAndBatchBundleForOutward: true,
	disableSerialNoAndBatchSelector: true,
	haveDefaultNamingSeriesForBatchId: true,
	pickSerialBatchBasedOn: true,
	useSerialBatchFields: true,
	doNotUpdateSerialBatchOnCreationOfAutoBundle: true,
	allowExistingSerialNoToBeManufacturedReceivedAgain: true,
	setSerialAndBatchBundleNamingBasedOnNamingSeries: true,
	raiseMaterialRequestWhenStockReachesReorderLevel: true,
	notifyByEmailOnCreationOfAutomaticMaterialRequest: true,
	allowMaterialTransferFromDeliveryNoteToSalesInvoice: true,
	allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: true,
	freezeStocksOlderThanDays: true,
	createdAt: true,
	updatedAt: true,
} as const;

export const itemVariantSettingsSelect = {
	id: true,
	doNotUpdateVariantsOnSave: true,
	allowRenameAttributeValue: true,
	createdAt: true,
	updatedAt: true,
	copyFields: {
		select: {
			id: true,
			fieldKey: true,
			position: true,
		},
		orderBy: {
			position: "asc",
		},
	},
} as const;

export const DEFAULT_STOCK_AGEING_BREAKS = [30, 60, 90] as const;

export const serialNoInclude = {
	item: {
		select: {
			id: true,
			code: true,
			name: true,
		},
	},
	currentWarehouse: {
		select: {
			id: true,
			name: true,
		},
	},
	purchaseReceipt: {
		select: {
			id: true,
			series: true,
		},
	},
	deliveryNote: {
		select: {
			id: true,
			series: true,
		},
	},
	stockEntry: {
		select: {
			id: true,
			series: true,
		},
	},
	pickList: {
		select: {
			id: true,
			series: true,
		},
	},
	history: {
		include: {
			warehouse: {
				select: {
					id: true,
					name: true,
				},
			},
		},
		orderBy: {
			createdAt: "desc" as const,
		},
	},
} as const satisfies Prisma.SerialNoInclude;

export const batchInclude = {
	item: {
		select: {
			id: true,
			code: true,
			name: true,
		},
	},
	currentWarehouse: {
		select: {
			id: true,
			name: true,
		},
	},
	purchaseReceipt: {
		select: {
			id: true,
			series: true,
		},
	},
	deliveryNote: {
		select: {
			id: true,
			series: true,
		},
	},
	stockEntry: {
		select: {
			id: true,
			series: true,
		},
	},
} as const;

export const installationNoteInclude = {
	deliveryNote: {
		select: {
			id: true,
			series: true,
		},
	},
	items: {
		include: {
			item: {
				select: {
					id: true,
					code: true,
					name: true,
				},
			},
			serialNo: {
				select: {
					id: true,
					serialNo: true,
				},
			},
		},
		orderBy: {
			id: "asc" as const,
		},
	},
} as const satisfies Prisma.InstallationNoteInclude;

export type BatchDelegate = {
	findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
	findUnique: (args: Record<string, unknown>) => Promise<unknown | null>;
	create: (args: Record<string, unknown>) => Promise<unknown>;
	update: (args: Record<string, unknown>) => Promise<unknown>;
	delete: (args: Record<string, unknown>) => Promise<unknown>;
	count: (args?: Record<string, unknown>) => Promise<number>;
};

export type BatchCapablePrisma = PrismaService & {
	batch: BatchDelegate;
};

export type BatchCapableTransactionClient = Prisma.TransactionClient & {
	batch: BatchDelegate;
};

export const SERIAL_NO_ALLOWED_STATUS_TRANSITIONS: Record<
	Inventory.SerialNoStatus,
	readonly Inventory.SerialNoStatus[]
> = {
	DRAFT: ["AVAILABLE", "SCRAPPED", "DISPOSED"],
	AVAILABLE: ["DELIVERED", "INSTALLED", "RETURNED", "SCRAPPED", "DISPOSED"],
	DELIVERED: ["INSTALLED", "RETURNED", "SCRAPPED", "DISPOSED"],
	INSTALLED: ["RETURNED", "SCRAPPED", "DISPOSED"],
	RETURNED: ["AVAILABLE", "SCRAPPED", "DISPOSED"],
	SCRAPPED: [],
	DISPOSED: [],
};

export const INSTALLATION_NOTE_ALLOWED_STATUS_TRANSITIONS: Record<
	Inventory.InstallationNoteStatus,
	readonly Inventory.InstallationNoteStatus[]
> = {
	DRAFT: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
	IN_PROGRESS: ["COMPLETED", "CANCELLED"],
	COMPLETED: [],
	CANCELLED: [],
};

export function parseStockAgeingBucketRanges(
	rawRanges?: string,
): StockAgeingBucketRange[] {
	const normalizedInput = rawRanges?.trim();
	const numericBreaks = (
		normalizedInput && normalizedInput.length > 0
			? normalizedInput.split(",")
			: [...DEFAULT_STOCK_AGEING_BREAKS].map(String)
	)
		.map((segment) => segment.trim())
		.filter((segment) => segment.length > 0)
		.map((segment) => Number.parseInt(segment, 10));

	if (
		numericBreaks.length === 0 ||
		numericBreaks.some((value) => !Number.isFinite(value) || value < 0)
	) {
		throw new BadRequestException(
			"Ageing ranges must be a comma-separated list of positive day values",
		);
	}

	const uniqueSortedBreaks = [...new Set(numericBreaks)].sort(
		(left, right) => left - right,
	);

	const ranges = uniqueSortedBreaks.map<StockAgeingBucketRange>(
		(value, index) => ({
			minAge: index === 0 ? 0 : uniqueSortedBreaks[index - 1] + 1,
			maxAge: value,
		}),
	);

	return [
		...ranges,
		{
			minAge: uniqueSortedBreaks[uniqueSortedBreaks.length - 1] + 1,
			maxAge: null,
		},
	];
}

export function normalizeOptionalText(
	value?: string | null,
): string | null | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (value === null) {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export type ProductBundleItemInput = {
	itemId: string;
	quantity: number;
	description?: string;
	unitOfMeasurementId?: string;
};

export const formatProductBundleItems = (items: ProductBundleItemInput[]) =>
	items.map(({ itemId, quantity, description, unitOfMeasurementId }) => ({
		itemId,
		quantity,
		description,
		UnitOfMeasurementId: unitOfMeasurementId,
	}));

export const itemManufacturerInclude = {
	item: {
		select: {
			id: true,
			code: true,
			name: true,
			description: true,
		},
	},
} as const;

export const ITEM_MANUFACTURERS_DEFAULT_PER_ITEM_INDEX =
	"item_manufacturers_itemId_default_unique";

export const isDefaultItemManufacturerConstraintViolation = (
	error: Prisma.PrismaClientKnownRequestError,
): boolean => {
	if (error.code !== "P2002") return false;

	const target = error.meta?.target;
	if (Array.isArray(target) && target.length === 1 && target[0] === "itemId") {
		return true;
	}

	if (typeof target === "string" && target === "itemId") {
		return true;
	}

	return error.message.includes(ITEM_MANUFACTURERS_DEFAULT_PER_ITEM_INDEX);
};

/** Maximum number of rows returned by any paginated list query. */
export const LIST_QUERY_TAKE_MAX = 250;

export type StockAvailabilityParams =
	| Inventory.ListStockProjectedQtyInput
	| Inventory.ListStockSummaryInput
	| Inventory.ListItemPriceStockInput;

/**
 * Simple inventory service with type-safe CRUD operations

// ─── Retry helpers ──────────────────────────────────────────────────────────

/**
 * Compute exponential backoff delay for series-conflict retries.
 * Adds ±50 ms jitter to reduce thundering-herd contention.
 *
 * @param attempt - Zero-based attempt index (0 = first retry).
 * @returns Delay in milliseconds.
 */
export function computeBackoffMs(attempt: number): number {
	return 50 * 2 ** attempt + Math.floor(Math.random() * 50);
}

/**
 * Access the Batch delegate from a PrismaService instance.
 * The Batch model may be added dynamically or via extension.
 */
export function getBatchModel(prisma: PrismaService): BatchDelegate {
	return (prisma as BatchCapablePrisma).batch;
}

export function getBatchModelFromTx(
	tx: Prisma.TransactionClient,
): BatchDelegate {
	return (tx as unknown as BatchCapableTransactionClient).batch;
}

// ─── Serial / installation note transition helpers ──────────────────────────

/**
 * Assert a serial-number status transition is allowed.
 *
 * @param fromStatus - Current status.
 * @param toStatus - Desired target status.
 * @throws BadRequestException when the transition is not permitted.
 */
export function assertSerialNoStatusTransition(
	fromStatus: Inventory.SerialNoStatus,
	toStatus: Inventory.SerialNoStatus,
): void {
	if (fromStatus === toStatus) return;
	const allowed = SERIAL_NO_ALLOWED_STATUS_TRANSITIONS[fromStatus];
	if (!allowed.includes(toStatus)) {
		throw new BadRequestException(
			`Cannot change serial number status from ${fromStatus} to ${toStatus}`,
		);
	}
}

/**
 * Build a human-readable transaction-origin label for a serial number.
 *
 * @returns A descriptive string like "Purchase Receipt MAT-PR-2024-00001", or null.
 */
export function buildSerialNoTransactionLabel(input: {
	purchaseReceiptSeries?: string | null;
	deliveryNoteSeries?: string | null;
	stockEntrySeries?: string | null;
	pickListSeries?: string | null;
	installationNoteSeries?: string | null;
}): string | null {
	if (input.purchaseReceiptSeries)
		return `Purchase Receipt ${input.purchaseReceiptSeries}`;
	if (input.deliveryNoteSeries)
		return `Delivery Note ${input.deliveryNoteSeries}`;
	if (input.stockEntrySeries) return `Stock Entry ${input.stockEntrySeries}`;
	if (input.pickListSeries) return `Pick List ${input.pickListSeries}`;
	if (input.installationNoteSeries)
		return `Installation Note ${input.installationNoteSeries}`;
	return null;
}

/**
 * Normalise a posting time string to HH:MM:SS format.
 * Falls back to the time portion of postingDate when no value is given.
 */
export function normalizePostingTime(
	postingTime: string | undefined | null,
	postingDate: Date,
): string {
	if (!postingTime) {
		return postingDate.toTimeString().slice(0, 8);
	}
	const trimmed = postingTime.trim();
	if (/^\d{2}:\d{2}$/.test(trimmed)) {
		return `${trimmed}:00`;
	}
	return trimmed;
}
