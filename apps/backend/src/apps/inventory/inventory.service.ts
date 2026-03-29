import type { Inventory } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { Prisma } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import {
	type BatchItemExpirySourceBatch,
	buildBatchItemExpiryRows,
} from "./batch-item-expiry-report";
import {
	type BatchWiseBalanceSourceBatch,
	buildBatchWiseBalanceRows,
} from "./batch-wise-balance-report";
import {
	buildDeliveryNoteTrendsPeriods,
	buildDeliveryNoteTrendsRows,
	type DeliveryNoteTrendsSourceEntry,
} from "./delivery-note-trends-report";
import {
	type InventoryBatch,
	itemAlternativeInclude,
	toInventoryBatch,
	toInventoryBrand,
	toInventoryDeliveryNote,
	toInventoryDeliveryTrip,
	toInventoryInstallationNote,
	toInventoryItem,
	toInventoryItemAlternative,
	toInventoryItemAttribute,
	toInventoryItemGroup,
	toInventoryItemManufacturer,
	toInventoryItemVariantSettings,
	toInventoryMaterialRequest,
	toInventoryPackingSlip,
	toInventoryPickList,
	toInventoryProductBundle,
	toInventoryPurchaseReceipt,
	toInventoryQiParameter,
	toInventoryQiParameterGroup,
	toInventoryQiTemplate,
	toInventorySerialNo,
	toInventoryShippingRule,
	toInventoryStockEntry,
	toInventoryStockSettings,
	toInventoryUnitOfMeasure,
	toInventoryWarehouse,
} from "./inventory.types";
import { buildItemPriceStockRows } from "./item-price-stock-report";
import {
	buildItemPricesRows,
	type ItemPricesSourceItem,
} from "./item-prices-report";
import { buildItemShortageRows } from "./item-shortage-report";
import { buildItemVariantDetailsResult } from "./item-variant-details-report";
import { buildItemwiseRecommendedReorderLevelRows } from "./itemwise-recommended-reorder-level-report";
import {
	buildPurchaseOrderAnalysisRows,
	computePurchaseOrderAnalysisSummary,
} from "./purchase-order-analysis-report";
import {
	buildPurchaseReceiptTrendsPeriods,
	buildPurchaseReceiptTrendsRows,
	type PurchaseReceiptTrendsSourceEntry,
} from "./purchase-receipt-trends-report";
import {
	buildRequestedItemsToBeTransferredRows,
	summarizeRequestedItemsToBeTransferredRows,
} from "./requested-items-to-be-transferred-report";
import {
	buildSalesOrderAnalysisRows,
	computeSalesOrderAnalysisSummary,
} from "./sales-order-analysis-report";
import {
	buildStockAgeingRows,
	type StockAgeingBucketRange,
} from "./stock-ageing-report";
import {
	buildStockAnalyticsRows,
	getPeriodDateRanges as getPeriodDateRangesForService,
	type StockAnalyticsSourceEntry,
} from "./stock-analytics-report";
import { buildStockBalanceRows } from "./stock-balance-report";
import { buildStockLedgerRows } from "./stock-ledger-report";
import {
	buildStockProjectedQtyRows,
	type StockProjectedQtySourceRow,
} from "./stock-projected-qty-report";
import { buildStockSummaryRows } from "./stock-summary-report";
import {
	loadUomSeedEntriesFromCsv,
	normalizeUomName,
	type UomSeedEntry,
} from "./uom-seed";
import { buildWarehouseWiseStockBalanceRows } from "./warehouse-wise-stock-balance-report";

const formatItemGroupDefaults = (defaults?: Inventory.ItemGroupDefault[]) =>
	defaults?.map(({ company, defaultWarehouse, defaultPriceList }) => ({
		company,
		defaultWarehouse,
		defaultPriceList,
	}));

const formatBarcodes = (barcodes?: Inventory.ItemBarcode[] | null) =>
	barcodes?.map(({ barcode, barcodeType, uom }) => ({
		barcode,
		barcodeType,
		uom,
	}));

type InventoryItemReorderInput = {
	id?: string | null;
	warehouse: string;
	reorderLevel?: number | null;
	reorderQty?: number | null;
	materialRequestType?: string | null;
};

const formatReorderSettings = (items?: InventoryItemReorderInput[] | null) =>
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

const removeUndefined = <T extends Record<string, unknown>>(obj: T) =>
	Object.fromEntries(
		Object.entries(obj).filter(([, value]) => value !== undefined),
	) as Partial<T>;

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

const startOfUtcDay = (value: Date) =>
	new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
	);

const addUtcDays = (value: Date, days: number) =>
	new Date(value.getTime() + days * MILLISECONDS_PER_DAY);

const diffUtcDays = (from: Date, to: Date) =>
	Math.round(
		(startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) /
			MILLISECONDS_PER_DAY,
	);

const brandSelect = {
	id: true,
	name: true,
	description: true,
	createdAt: true,
	updatedAt: true,
} as const;

const itemAttributeSelect = {
	id: true,
	name: true,
	disabled: true,
	numericValues: true,
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

const unitOfMeasureSelect = {
	id: true,
	name: true,
	disabled: true,
	isWholeNumber: true,
	createdAt: true,
	updatedAt: true,
} as const;

const warehouseSelect = {
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

const stockSettingsSelect = {
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

const itemVariantSettingsSelect = {
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

const DEFAULT_STOCK_AGEING_BREAKS = [30, 60, 90] as const;

const serialNoInclude = {
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

const batchInclude = {
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

const installationNoteInclude = {
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

type BatchDelegate = {
	findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
	findUnique: (args: Record<string, unknown>) => Promise<unknown | null>;
	create: (args: Record<string, unknown>) => Promise<unknown>;
	update: (args: Record<string, unknown>) => Promise<unknown>;
	delete: (args: Record<string, unknown>) => Promise<unknown>;
	count: (args?: Record<string, unknown>) => Promise<number>;
};

type BatchCapablePrisma = PrismaService & {
	batch: BatchDelegate;
};

type BatchCapableTransactionClient = Prisma.TransactionClient & {
	batch: BatchDelegate;
};

const SERIAL_NO_ALLOWED_STATUS_TRANSITIONS: Record<
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

const INSTALLATION_NOTE_ALLOWED_STATUS_TRANSITIONS: Record<
	Inventory.InstallationNoteStatus,
	readonly Inventory.InstallationNoteStatus[]
> = {
	DRAFT: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
	IN_PROGRESS: ["COMPLETED", "CANCELLED"],
	COMPLETED: [],
	CANCELLED: [],
};

function parseStockAgeingBucketRanges(
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

function normalizeOptionalText(
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

type ProductBundleItemInput = {
	itemId: string;
	quantity: number;
	description?: string;
	unitOfMeasurementId?: string;
};

const formatProductBundleItems = (items: ProductBundleItemInput[]) =>
	items.map(({ itemId, quantity, description, unitOfMeasurementId }) => ({
		itemId,
		quantity,
		description,
		UnitOfMeasurementId: unitOfMeasurementId,
	}));

const itemManufacturerInclude = {
	item: {
		select: {
			id: true,
			code: true,
			name: true,
			description: true,
		},
	},
} as const;

const ITEM_MANUFACTURERS_DEFAULT_PER_ITEM_INDEX =
	"item_manufacturers_itemId_default_unique";

const isDefaultItemManufacturerConstraintViolation = (
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
const LIST_QUERY_TAKE_MAX = 250;

type StockAvailabilityParams =
	| Inventory.ListStockProjectedQtyInput
	| Inventory.ListStockSummaryInput
	| Inventory.ListItemPriceStockInput;

/**
 * Simple inventory service with type-safe CRUD operations
 */
@Injectable()
export class InventoryService {
	private readonly logger = new Logger(InventoryService.name);

	constructor(private readonly prisma: PrismaService) {}

	private get batchModel(): BatchDelegate {
		return (this.prisma as BatchCapablePrisma).batch;
	}

	/**
	 * Get all inventory items
	 */
	async findAll(): Promise<Inventory.Item[]> {
		const items = await this.prisma.inventoryItem.findMany({
			orderBy: { createdAt: "desc" },
			include: {
				itemGroup: true,
				barcodes: true,
				reorderSettings: true,
			},
		});

		return items.map(toInventoryItem);
	}

	/**
	 * Get all item groups with optional search
	 */
	async findAllItemGroups(search?: string): Promise<Inventory.ItemGroup[]> {
		const groups = await this.prisma.itemGroup.findMany({
			where: search
				? {
						groupName: {
							contains: search,
							mode: "insensitive",
						},
					}
				: undefined,
			include: {
				parentItemGroup: {
					select: { groupName: true },
				},
				defaults: true,
			},
			orderBy: { groupName: "asc" },
		});

		return groups.map(toInventoryItemGroup);
	}

	/**
	 * Get all units of measure
	 */
	async findAllUnitsOfMeasure(
		search?: string,
	): Promise<Inventory.UnitOfMeasure[]> {
		const units = await this.prisma.unitOfMeasurement.findMany({
			where: search
				? {
						name: {
							contains: search,
							mode: "insensitive",
						},
					}
				: undefined,
			select: unitOfMeasureSelect,
			orderBy: { name: "asc" },
		});

		return units.map(toInventoryUnitOfMeasure);
	}

	private normalizeWarehouseText(value?: string | null): string | null {
		const normalized = value?.trim();
		return normalized ? normalized : null;
	}

	private hasWarehouseNameChanged(
		existingName: string,
		nextName: string,
	): boolean {
		return (
			existingName.localeCompare(nextName, undefined, {
				sensitivity: "accent",
			}) !== 0
		);
	}

	private async ensureWarehouseNameAvailable(
		name: string,
		excludeId?: string,
	): Promise<void> {
		const duplicate = await this.prisma.warehouse.findFirst({
			where: {
				name: {
					equals: name,
					mode: "insensitive",
				},
				...(excludeId ? { id: { not: excludeId } } : {}),
			},
			select: { id: true },
		});

		if (duplicate) {
			throw new ConflictException(
				`Warehouse with name "${name}" already exists`,
			);
		}
	}

	private async validateWarehouseHierarchy(params: {
		warehouseId?: string;
		parentWarehouseId?: string | null;
		defaultInTransitWarehouseId?: string | null;
		isGroupWarehouse: boolean;
	}): Promise<void> {
		const {
			warehouseId,
			parentWarehouseId,
			defaultInTransitWarehouseId,
			isGroupWarehouse,
		} = params;

		if (warehouseId && parentWarehouseId === warehouseId) {
			throw new BadRequestException(
				"A warehouse cannot be its own parent warehouse",
			);
		}

		if (warehouseId && defaultInTransitWarehouseId === warehouseId) {
			throw new BadRequestException(
				"A warehouse cannot reference itself as the default in-transit warehouse",
			);
		}

		if (parentWarehouseId) {
			const parentWarehouse = await this.prisma.warehouse.findUnique({
				where: { id: parentWarehouseId },
				select: {
					id: true,
					name: true,
					isGroupWarehouse: true,
					parentWarehouseId: true,
				},
			});

			if (!parentWarehouse) {
				throw new NotFoundException("Parent warehouse not found");
			}

			if (!parentWarehouse.isGroupWarehouse) {
				throw new BadRequestException(
					"Parent warehouse must be marked as a group warehouse",
				);
			}

			if (warehouseId) {
				let ancestorId = parentWarehouse.parentWarehouseId;
				while (ancestorId) {
					if (ancestorId === warehouseId) {
						throw new BadRequestException(
							"Warehouse hierarchy cannot contain cycles",
						);
					}

					const ancestor = await this.prisma.warehouse.findUnique({
						where: { id: ancestorId },
						select: { parentWarehouseId: true },
					});

					ancestorId = ancestor?.parentWarehouseId ?? null;
				}
			}
		}

		if (defaultInTransitWarehouseId) {
			const transitWarehouse = await this.prisma.warehouse.findUnique({
				where: { id: defaultInTransitWarehouseId },
				select: { id: true },
			});

			if (!transitWarehouse) {
				throw new NotFoundException("Default in-transit warehouse not found");
			}
		}

		if (!isGroupWarehouse && warehouseId) {
			const childCount = await this.prisma.warehouse.count({
				where: { parentWarehouseId: warehouseId },
			});

			if (childCount > 0) {
				throw new BadRequestException(
					"A warehouse with child warehouses must remain a group warehouse",
				);
			}
		}
	}

	private async assertWarehouseNameIsNotReferenced(
		name: string,
	): Promise<void> {
		const [
			stockSettingsCount,
			itemGroupDefaultCount,
			itemReorderCount,
			materialRequestCount,
			materialRequestItemCount,
			stockEntryCount,
			stockEntryItemCount,
			deliveryNoteCount,
			deliveryNoteItemCount,
			purchaseReceiptCount,
			purchaseReceiptItemCount,
			pickListCount,
			pickListItemCount,
		] = await this.prisma.$transaction([
			this.prisma.stockSettings.count({
				where: {
					defaultWarehouse: {
						equals: name,
						mode: "insensitive",
					},
				},
			}),
			this.prisma.itemGroupDefault.count({
				where: {
					defaultWarehouse: {
						equals: name,
						mode: "insensitive",
					},
				},
			}),
			this.prisma.itemReorder.count({
				where: {
					warehouse: {
						equals: name,
						mode: "insensitive",
					},
				},
			}),
			this.prisma.materialRequest.count({
				where: {
					targetWarehouse: {
						equals: name,
						mode: "insensitive",
					},
				},
			}),
			this.prisma.materialRequestItem.count({
				where: {
					targetWarehouse: {
						equals: name,
						mode: "insensitive",
					},
				},
			}),
			this.prisma.stockEntry.count({
				where: {
					OR: [
						{
							defaultSourceWarehouse: {
								equals: name,
								mode: "insensitive",
							},
						},
						{
							defaultTargetWarehouse: {
								equals: name,
								mode: "insensitive",
							},
						},
					],
				},
			}),
			this.prisma.stockEntryItem.count({
				where: {
					OR: [
						{
							sourceWarehouse: {
								equals: name,
								mode: "insensitive",
							},
						},
						{
							targetWarehouse: {
								equals: name,
								mode: "insensitive",
							},
						},
					],
				},
			}),
			this.prisma.deliveryNote.count({
				where: {
					sourceWarehouse: {
						equals: name,
						mode: "insensitive",
					},
				},
			}),
			this.prisma.deliveryNoteItem.count({
				where: {
					warehouse: {
						equals: name,
						mode: "insensitive",
					},
				},
			}),
			this.prisma.purchaseReceipt.count({
				where: {
					OR: [
						{
							acceptedWarehouse: {
								equals: name,
								mode: "insensitive",
							},
						},
						{
							rejectedWarehouse: {
								equals: name,
								mode: "insensitive",
							},
						},
					],
				},
			}),
			this.prisma.purchaseReceiptItem.count({
				where: {
					OR: [
						{
							acceptedWarehouse: {
								equals: name,
								mode: "insensitive",
							},
						},
						{
							rejectedWarehouse: {
								equals: name,
								mode: "insensitive",
							},
						},
					],
				},
			}),
			this.prisma.pickList.count({
				where: {
					warehouse: {
						equals: name,
						mode: "insensitive",
					},
				},
			}),
			this.prisma.pickListItem.count({
				where: {
					warehouse: {
						equals: name,
						mode: "insensitive",
					},
				},
			}),
		]);

		const totalReferences =
			stockSettingsCount +
			itemGroupDefaultCount +
			itemReorderCount +
			materialRequestCount +
			materialRequestItemCount +
			stockEntryCount +
			stockEntryItemCount +
			deliveryNoteCount +
			deliveryNoteItemCount +
			purchaseReceiptCount +
			purchaseReceiptItemCount +
			pickListCount +
			pickListItemCount;

		if (totalReferences > 0) {
			throw new BadRequestException(
				`Warehouse "${name}" cannot be changed or deleted because it is already referenced by inventory records`,
			);
		}
	}

	private async assertWarehouseCanBeDeleted(params: {
		id: string;
		name: string;
	}): Promise<void> {
		const [childCount, transitDependentCount] = await this.prisma.$transaction([
			this.prisma.warehouse.count({
				where: { parentWarehouseId: params.id },
			}),
			this.prisma.warehouse.count({
				where: { defaultInTransitWarehouseId: params.id },
			}),
		]);

		if (childCount > 0) {
			throw new BadRequestException(
				"Warehouse cannot be deleted while child warehouses still reference it",
			);
		}

		if (transitDependentCount > 0) {
			throw new BadRequestException(
				"Warehouse cannot be deleted while it is configured as a default in-transit warehouse",
			);
		}

		await this.assertWarehouseNameIsNotReferenced(params.name);
	}

	/**
	 * Get warehouses with bounded filters for inventory settings.
	 */
	async findWarehouses(
		params?: Inventory.ListWarehousesInput,
	): Promise<Inventory.WarehouseListResult> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;
		const search = params?.search?.trim();
		const company = params?.company?.trim();

		const whereClauses: Prisma.WarehouseWhereInput[] = [];

		if (search) {
			whereClauses.push({
				OR: [
					{ name: { contains: search, mode: "insensitive" } },
					{ company: { contains: search, mode: "insensitive" } },
					{ city: { contains: search, mode: "insensitive" } },
					{ state: { contains: search, mode: "insensitive" } },
					{ warehouseType: { contains: search, mode: "insensitive" } },
					{
						parentWarehouse: {
							name: { contains: search, mode: "insensitive" },
						},
					},
				],
			});
		}

		if (company) {
			whereClauses.push({
				company: {
					contains: company,
					mode: "insensitive",
				},
			});
		}

		if (typeof params?.disabled === "boolean") {
			whereClauses.push({ disabled: params.disabled });
		}

		if (typeof params?.isGroupWarehouse === "boolean") {
			whereClauses.push({ isGroupWarehouse: params.isGroupWarehouse });
		}

		const where: Prisma.WarehouseWhereInput | undefined =
			whereClauses.length === 0
				? undefined
				: whereClauses.length === 1
					? whereClauses[0]
					: { AND: whereClauses };

		const [items, totalCount] = await this.prisma.$transaction([
			this.prisma.warehouse.findMany({
				where,
				select: warehouseSelect,
				orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
				skip,
				take,
			}),
			this.prisma.warehouse.count({ where }),
		]);

		return {
			items: items.map(toInventoryWarehouse),
			totalCount,
		};
	}

	/**
	 * Get a single warehouse by id.
	 */
	async findWarehouseById(id: string): Promise<Inventory.Warehouse | null> {
		const warehouse = await this.prisma.warehouse.findUnique({
			where: { id },
			select: warehouseSelect,
		});

		return warehouse ? toInventoryWarehouse(warehouse) : null;
	}

	private getBatchOrderBy(
		sortBy: Inventory.BatchSortBy = "updatedAt",
		sortDirection: Prisma.SortOrder = "desc",
	): Record<string, unknown>[] {
		switch (sortBy) {
			case "createdAt":
				return [{ createdAt: sortDirection }, { batchId: "asc" }];
			case "batchId":
				return [{ batchId: sortDirection }, { updatedAt: "desc" }];
			case "itemCode":
				return [{ item: { code: sortDirection } }, { batchId: "asc" }];
			case "warehouse":
				return [
					{ currentWarehouse: { name: sortDirection } },
					{ batchId: "asc" },
				];
			case "expiryDate":
				return [{ expiryDate: sortDirection }, { batchId: "asc" }];
			case "quantity":
				return [{ quantity: sortDirection }, { batchId: "asc" }];
			case "company":
				return [{ company: sortDirection }, { batchId: "asc" }];
			default:
				return [{ updatedAt: sortDirection }, { batchId: "asc" }];
		}
	}

	private getSerialNoOrderBy(
		sortBy: Inventory.SerialNoSortBy = "updatedAt",
		sortDirection: Prisma.SortOrder = "desc",
	): Prisma.SerialNoOrderByWithRelationInput[] {
		switch (sortBy) {
			case "createdAt":
				return [{ createdAt: sortDirection }, { serialNo: "asc" }];
			case "serialNo":
				return [{ serialNo: sortDirection }, { updatedAt: "desc" }];
			case "itemCode":
				return [{ item: { code: sortDirection } }, { serialNo: "asc" }];
			case "warehouse":
				return [
					{ currentWarehouse: { name: sortDirection } },
					{ serialNo: "asc" },
				];
			case "status":
				return [{ status: sortDirection }, { serialNo: "asc" }];
			case "company":
				return [{ company: sortDirection }, { serialNo: "asc" }];
			default:
				return [{ updatedAt: sortDirection }, { serialNo: "asc" }];
		}
	}

	private getSerialNoServiceContractExpiryOrderBy(
		sortBy: Inventory.SerialNoServiceContractExpirySortBy = "serviceContractExpiryDate",
		sortDirection: Prisma.SortOrder = "asc",
	): Prisma.SerialNoOrderByWithRelationInput[] {
		switch (sortBy) {
			case "updatedAt":
				return [{ updatedAt: sortDirection }, { serialNo: "asc" }];
			case "serialNo":
				return [{ serialNo: sortDirection }, { updatedAt: "desc" }];
			case "itemCode":
				return [{ item: { code: sortDirection } }, { serialNo: "asc" }];
			case "warehouse":
				return [
					{ currentWarehouse: { name: sortDirection } },
					{ serialNo: "asc" },
				];
			case "status":
				return [{ status: sortDirection }, { serialNo: "asc" }];
			case "company":
				return [{ company: sortDirection }, { serialNo: "asc" }];
			default:
				return [
					{ serviceContractExpiryDate: sortDirection },
					{ serialNo: "asc" },
				];
		}
	}

	private getSerialNoWarrantyExpiryOrderBy(
		sortBy: Inventory.SerialNoWarrantyExpirySortBy = "warrantyExpiryDate",
		sortDirection: Prisma.SortOrder = "asc",
	): Prisma.SerialNoOrderByWithRelationInput[] {
		switch (sortBy) {
			case "updatedAt":
				return [{ updatedAt: sortDirection }, { serialNo: "asc" }];
			case "serialNo":
				return [{ serialNo: sortDirection }, { updatedAt: "desc" }];
			case "itemCode":
				return [{ item: { code: sortDirection } }, { serialNo: "asc" }];
			case "warehouse":
				return [
					{ currentWarehouse: { name: sortDirection } },
					{ serialNo: "asc" },
				];
			case "status":
				return [{ status: sortDirection }, { serialNo: "asc" }];
			case "company":
				return [{ company: sortDirection }, { serialNo: "asc" }];
			default:
				return [{ warrantyExpiryDate: sortDirection }, { serialNo: "asc" }];
		}
	}

	private getSerialNoStatusOrderBy(
		sortBy: Inventory.SerialNoStatusSortBy = "updatedAt",
		sortDirection: Prisma.SortOrder = "desc",
	): Prisma.SerialNoOrderByWithRelationInput[] {
		switch (sortBy) {
			case "createdAt":
				return [{ createdAt: sortDirection }, { serialNo: "asc" }];
			case "serialNo":
				return [{ serialNo: sortDirection }, { updatedAt: "desc" }];
			case "itemCode":
				return [{ item: { code: sortDirection } }, { serialNo: "asc" }];
			case "warehouse":
				return [
					{ currentWarehouse: { name: sortDirection } },
					{ serialNo: "asc" },
				];
			case "status":
				return [{ status: sortDirection }, { serialNo: "asc" }];
			case "company":
				return [{ company: sortDirection }, { serialNo: "asc" }];
			default:
				return [{ updatedAt: sortDirection }, { serialNo: "asc" }];
		}
	}

	private getSerialNoCurrentStatusChangedAt(
		serialNo: Inventory.SerialNo,
	): Date {
		const matchingHistoryEntry =
			serialNo.history.find((entry) => entry.toStatus === serialNo.status) ??
			serialNo.history.find((entry) => entry.eventType === "CREATED");

		return matchingHistoryEntry?.createdAt ?? serialNo.updatedAt;
	}

	private assertSerialNoStatusTransition(
		fromStatus: Inventory.SerialNoStatus,
		toStatus: Inventory.SerialNoStatus,
	): void {
		if (fromStatus === toStatus) {
			return;
		}

		const allowedTransitions = SERIAL_NO_ALLOWED_STATUS_TRANSITIONS[fromStatus];
		if (!allowedTransitions.includes(toStatus)) {
			throw new BadRequestException(
				`Cannot change serial number status from ${fromStatus} to ${toStatus}`,
			);
		}
	}

	private getInstallationNoteOrderBy(
		sortBy: Inventory.InstallationNoteSortBy = "updatedAt",
		sortDirection: Prisma.SortOrder = "desc",
	): Prisma.InstallationNoteOrderByWithRelationInput[] {
		switch (sortBy) {
			case "createdAt":
				return [{ createdAt: sortDirection }, { series: "asc" }];
			case "series":
				return [{ series: sortDirection }, { updatedAt: "desc" }];
			case "installationDate":
				return [{ installationDate: sortDirection }, { series: "asc" }];
			case "customer":
				return [{ customer: sortDirection }, { series: "asc" }];
			case "status":
				return [{ status: sortDirection }, { series: "asc" }];
			case "company":
				return [{ company: sortDirection }, { series: "asc" }];
			default:
				return [{ updatedAt: sortDirection }, { series: "asc" }];
		}
	}

	private assertInstallationNoteStatusTransition(
		fromStatus: Inventory.InstallationNoteStatus,
		toStatus: Inventory.InstallationNoteStatus,
	): void {
		if (fromStatus === toStatus) {
			return;
		}

		const allowedTransitions =
			INSTALLATION_NOTE_ALLOWED_STATUS_TRANSITIONS[fromStatus];
		if (!allowedTransitions.includes(toStatus)) {
			throw new BadRequestException(
				`Cannot change installation note status from ${fromStatus} to ${toStatus}`,
			);
		}
	}

	private buildSerialNoTransactionLabel(input: {
		purchaseReceiptSeries?: string | null;
		deliveryNoteSeries?: string | null;
		stockEntrySeries?: string | null;
		pickListSeries?: string | null;
		installationNoteSeries?: string | null;
	}): string | null {
		if (input.purchaseReceiptSeries) {
			return `Purchase Receipt ${input.purchaseReceiptSeries}`;
		}
		if (input.deliveryNoteSeries) {
			return `Delivery Note ${input.deliveryNoteSeries}`;
		}
		if (input.stockEntrySeries) {
			return `Stock Entry ${input.stockEntrySeries}`;
		}
		if (input.pickListSeries) {
			return `Pick List ${input.pickListSeries}`;
		}
		if (input.installationNoteSeries) {
			return `Installation Note ${input.installationNoteSeries}`;
		}

		return null;
	}

	private async validateBatchRelationships(
		tx: BatchCapableTransactionClient,
		input: Pick<
			Inventory.CreateBatchInput,
			| "itemId"
			| "company"
			| "currentWarehouseId"
			| "purchaseReceiptId"
			| "deliveryNoteId"
			| "stockEntryId"
			| "quantity"
		>,
	): Promise<{
		item: { id: string; code: string; name: string };
		currentWarehouse?: {
			id: string;
			name: string;
			company: string;
			disabled: boolean;
		} | null;
		purchaseReceipt?: { id: string; series: string; company: string } | null;
		deliveryNote?: { id: string; series: string; company: string } | null;
		stockEntry?: { id: string; series: string; company: string } | null;
	}> {
		const item = await tx.inventoryItem.findUnique({
			where: { id: input.itemId },
			select: {
				id: true,
				code: true,
				name: true,
				hasBatchNo: true,
				disabled: true,
			},
		});

		if (!item) {
			throw new NotFoundException(`Item with ID ${input.itemId} not found`);
		}

		if (!item.hasBatchNo) {
			throw new BadRequestException(
				`Item ${item.code} is not configured to track batches`,
			);
		}

		if (item.disabled) {
			throw new BadRequestException(
				`Item ${item.code} cannot be used because it is disabled`,
			);
		}

		let currentWarehouse:
			| { id: string; name: string; company: string; disabled: boolean }
			| null
			| undefined;
		if (input.currentWarehouseId) {
			currentWarehouse = await tx.warehouse.findUnique({
				where: { id: input.currentWarehouseId },
				select: {
					id: true,
					name: true,
					company: true,
					disabled: true,
				},
			});

			if (!currentWarehouse) {
				throw new NotFoundException(
					`Warehouse with ID ${input.currentWarehouseId} not found`,
				);
			}

			if (currentWarehouse.disabled) {
				throw new BadRequestException(
					`Warehouse ${currentWarehouse.name} cannot be used because it is disabled`,
				);
			}

			if (currentWarehouse.company !== input.company) {
				throw new BadRequestException(
					"Warehouse company must match the batch company",
				);
			}
		}

		let purchaseReceipt:
			| { id: string; series: string; company: string }
			| null
			| undefined;
		if (input.purchaseReceiptId) {
			const receipt = await tx.purchaseReceipt.findUnique({
				where: { id: input.purchaseReceiptId },
				select: {
					id: true,
					series: true,
					company: true,
					items: {
						where: { itemCode: item.code },
						select: { id: true },
						take: 1,
					},
				},
			});

			if (!receipt) {
				throw new NotFoundException(
					`Purchase receipt with ID ${input.purchaseReceiptId} not found`,
				);
			}

			if (receipt.company !== input.company) {
				throw new BadRequestException(
					"Purchase receipt company must match the batch company",
				);
			}

			if (receipt.items.length === 0) {
				throw new BadRequestException(
					`Purchase receipt ${receipt.series} does not contain item ${item.code}`,
				);
			}

			purchaseReceipt = {
				id: receipt.id,
				series: receipt.series,
				company: receipt.company,
			};
		}

		let deliveryNote:
			| { id: string; series: string; company: string }
			| null
			| undefined;
		if (input.deliveryNoteId) {
			const note = await tx.deliveryNote.findUnique({
				where: { id: input.deliveryNoteId },
				select: {
					id: true,
					series: true,
					company: true,
					items: {
						where: { itemCode: item.code },
						select: { id: true },
						take: 1,
					},
				},
			});

			if (!note) {
				throw new NotFoundException(
					`Delivery note with ID ${input.deliveryNoteId} not found`,
				);
			}

			if (note.company !== input.company) {
				throw new BadRequestException(
					"Delivery note company must match the batch company",
				);
			}

			if (note.items.length === 0) {
				throw new BadRequestException(
					`Delivery note ${note.series} does not contain item ${item.code}`,
				);
			}

			deliveryNote = {
				id: note.id,
				series: note.series,
				company: note.company,
			};
		}

		let stockEntry:
			| { id: string; series: string; company: string }
			| null
			| undefined;
		if (input.stockEntryId) {
			const entry = await tx.stockEntry.findUnique({
				where: { id: input.stockEntryId },
				select: {
					id: true,
					series: true,
					company: true,
					items: {
						where: { itemCode: item.code },
						select: { id: true },
						take: 1,
					},
				},
			});

			if (!entry) {
				throw new NotFoundException(
					`Stock entry with ID ${input.stockEntryId} not found`,
				);
			}

			if (entry.company !== input.company) {
				throw new BadRequestException(
					"Stock entry company must match the batch company",
				);
			}

			if (entry.items.length === 0) {
				throw new BadRequestException(
					`Stock entry ${entry.series} does not contain item ${item.code}`,
				);
			}

			stockEntry = {
				id: entry.id,
				series: entry.series,
				company: entry.company,
			};
		}

		if ((input.quantity ?? 0) > 0 && !currentWarehouse) {
			throw new BadRequestException(
				"A current warehouse is required when the batch quantity is greater than zero",
			);
		}

		return {
			item: { id: item.id, code: item.code, name: item.name },
			currentWarehouse: currentWarehouse
				? {
						id: currentWarehouse.id,
						name: currentWarehouse.name,
						company: currentWarehouse.company,
						disabled: currentWarehouse.disabled,
					}
				: null,
			purchaseReceipt,
			deliveryNote,
			stockEntry,
		};
	}

	private async validateSerialNoRelationships(
		tx: Prisma.TransactionClient,
		input: Pick<
			Inventory.CreateSerialNoInput,
			| "itemId"
			| "company"
			| "currentWarehouseId"
			| "purchaseReceiptId"
			| "deliveryNoteId"
			| "stockEntryId"
			| "pickListId"
			| "status"
		>,
	): Promise<{
		item: { id: string; code: string; name: string };
		currentWarehouse?: {
			id: string;
			name: string;
			company: string;
			disabled: boolean;
		} | null;
		purchaseReceipt?: { id: string; series: string; company: string } | null;
		deliveryNote?: { id: string; series: string; company: string } | null;
		stockEntry?: { id: string; series: string; company: string } | null;
		pickList?: { id: string; series: string; company: string } | null;
	}> {
		const item = await tx.inventoryItem.findUnique({
			where: { id: input.itemId },
			select: {
				id: true,
				code: true,
				name: true,
				hasSerialNo: true,
				disabled: true,
			},
		});

		if (!item) {
			throw new NotFoundException(`Item with ID ${input.itemId} not found`);
		}

		if (!item.hasSerialNo) {
			throw new BadRequestException(
				`Item ${item.code} is not configured to track serial numbers`,
			);
		}

		if (item.disabled) {
			throw new BadRequestException(
				`Item ${item.code} cannot be used because it is disabled`,
			);
		}

		let currentWarehouse:
			| { id: string; name: string; company: string; disabled: boolean }
			| null
			| undefined;
		if (input.currentWarehouseId) {
			currentWarehouse = await tx.warehouse.findUnique({
				where: { id: input.currentWarehouseId },
				select: {
					id: true,
					name: true,
					company: true,
					disabled: true,
				},
			});

			if (!currentWarehouse) {
				throw new NotFoundException(
					`Warehouse with ID ${input.currentWarehouseId} not found`,
				);
			}

			if (currentWarehouse.disabled) {
				throw new BadRequestException(
					`Warehouse ${currentWarehouse.name} cannot be used because it is disabled`,
				);
			}

			if (currentWarehouse.company !== input.company) {
				throw new BadRequestException(
					"Warehouse company must match the serial number company",
				);
			}
		}

		let purchaseReceipt:
			| { id: string; series: string; company: string }
			| null
			| undefined;
		if (input.purchaseReceiptId) {
			const receipt = await tx.purchaseReceipt.findUnique({
				where: { id: input.purchaseReceiptId },
				select: {
					id: true,
					series: true,
					company: true,
					items: {
						where: {
							itemCode: item.code,
						},
						select: {
							id: true,
						},
						take: 1,
					},
				},
			});

			if (!receipt) {
				throw new NotFoundException(
					`Purchase receipt with ID ${input.purchaseReceiptId} not found`,
				);
			}

			if (receipt.company !== input.company) {
				throw new BadRequestException(
					"Purchase receipt company must match the serial number company",
				);
			}

			if (receipt.items.length === 0) {
				throw new BadRequestException(
					`Purchase receipt ${receipt.series} does not contain item ${item.code}`,
				);
			}

			purchaseReceipt = {
				id: receipt.id,
				series: receipt.series,
				company: receipt.company,
			};
		}

		let deliveryNote:
			| { id: string; series: string; company: string }
			| null
			| undefined;
		if (input.deliveryNoteId) {
			const note = await tx.deliveryNote.findUnique({
				where: { id: input.deliveryNoteId },
				select: {
					id: true,
					series: true,
					company: true,
					items: {
						where: {
							itemCode: item.code,
						},
						select: {
							id: true,
						},
						take: 1,
					},
				},
			});

			if (!note) {
				throw new NotFoundException(
					`Delivery note with ID ${input.deliveryNoteId} not found`,
				);
			}

			if (note.company !== input.company) {
				throw new BadRequestException(
					"Delivery note company must match the serial number company",
				);
			}

			if (note.items.length === 0) {
				throw new BadRequestException(
					`Delivery note ${note.series} does not contain item ${item.code}`,
				);
			}

			deliveryNote = {
				id: note.id,
				series: note.series,
				company: note.company,
			};
		}

		let stockEntry:
			| { id: string; series: string; company: string }
			| null
			| undefined;
		if (input.stockEntryId) {
			const entry = await tx.stockEntry.findUnique({
				where: { id: input.stockEntryId },
				select: {
					id: true,
					series: true,
					company: true,
					items: {
						where: {
							itemCode: item.code,
						},
						select: {
							id: true,
						},
						take: 1,
					},
				},
			});

			if (!entry) {
				throw new NotFoundException(
					`Stock entry with ID ${input.stockEntryId} not found`,
				);
			}

			if (entry.company !== input.company) {
				throw new BadRequestException(
					"Stock entry company must match the serial number company",
				);
			}

			if (entry.items.length === 0) {
				throw new BadRequestException(
					`Stock entry ${entry.series} does not contain item ${item.code}`,
				);
			}

			stockEntry = {
				id: entry.id,
				series: entry.series,
				company: entry.company,
			};
		}

		let pickList:
			| { id: string; series: string; company: string }
			| null
			| undefined;
		if (input.pickListId) {
			const list = await tx.pickList.findUnique({
				where: { id: input.pickListId },
				select: {
					id: true,
					series: true,
					company: true,
					items: {
						where: {
							item: item.code,
						},
						select: {
							id: true,
						},
						take: 1,
					},
				},
			});

			if (!list) {
				throw new NotFoundException(
					`Pick list with ID ${input.pickListId} not found`,
				);
			}

			if (list.company !== input.company) {
				throw new BadRequestException(
					"Pick list company must match the serial number company",
				);
			}

			if (list.items.length === 0) {
				throw new BadRequestException(
					`Pick list ${list.series} does not contain item ${item.code}`,
				);
			}

			pickList = {
				id: list.id,
				series: list.series,
				company: list.company,
			};
		}

		const effectiveStatus = input.status ?? "DRAFT";
		if (
			(effectiveStatus === "AVAILABLE" || effectiveStatus === "RETURNED") &&
			!currentWarehouse
		) {
			throw new BadRequestException(
				"Available or returned serial numbers must have a current warehouse",
			);
		}

		return {
			item: { id: item.id, code: item.code, name: item.name },
			currentWarehouse: currentWarehouse
				? {
						id: currentWarehouse.id,
						name: currentWarehouse.name,
						company: currentWarehouse.company,
						disabled: currentWarehouse.disabled,
					}
				: null,
			purchaseReceipt,
			deliveryNote,
			stockEntry,
			pickList,
		};
	}

	/**
	 * Get batches with bounded filters and pagination.
	 */
	async findBatches(
		params?: Inventory.ListBatchesInput,
	): Promise<Inventory.BatchListResult> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;
		const search = params?.search?.trim();
		const company = params?.company?.trim();
		const includeDisabled = params?.includeDisabled ?? false;
		const sortDirection: Prisma.SortOrder =
			params?.sortDirection === "asc" ? "asc" : "desc";

		const now = new Date();
		const whereClauses: Record<string, unknown>[] = [];

		if (search) {
			whereClauses.push({
				OR: [
					{ batchId: { contains: search, mode: "insensitive" } },
					{ company: { contains: search, mode: "insensitive" } },
					{ description: { contains: search, mode: "insensitive" } },
					{ item: { code: { contains: search, mode: "insensitive" } } },
					{ item: { name: { contains: search, mode: "insensitive" } } },
					{
						currentWarehouse: {
							name: { contains: search, mode: "insensitive" },
						},
					},
				],
			});
		}

		if (params?.itemId) {
			whereClauses.push({ itemId: params.itemId });
		}

		if (params?.warehouseId) {
			whereClauses.push({ currentWarehouseId: params.warehouseId });
		}

		if (company) {
			whereClauses.push({
				company: {
					contains: company,
					mode: "insensitive",
				},
			});
		}

		if (!includeDisabled) {
			whereClauses.push({ isDisabled: false });
		}

		switch (params?.status) {
			case "ACTIVE":
				whereClauses.push({
					isDisabled: false,
					quantity: { gt: 0 },
					OR: [{ expiryDate: null }, { expiryDate: { gte: now } }],
				});
				break;
			case "EMPTY":
				whereClauses.push({ isDisabled: false, quantity: { lte: 0 } });
				break;
			case "EXPIRED":
				whereClauses.push({
					isDisabled: false,
					expiryDate: { lt: now },
				});
				break;
			case "DISABLED":
				whereClauses.push({ isDisabled: true });
				break;
			default:
				break;
		}

		const where: Record<string, unknown> | undefined =
			whereClauses.length === 0
				? undefined
				: whereClauses.length === 1
					? whereClauses[0]
					: { AND: whereClauses };

		const [items, totalCount] = await Promise.all([
			this.batchModel.findMany({
				where,
				include: batchInclude,
				orderBy: this.getBatchOrderBy(params?.sortBy, sortDirection),
				skip,
				take,
			}),
			this.batchModel.count({ where }),
		]);

		return {
			items: (items as InventoryBatch[]).map(toInventoryBatch),
			totalCount,
		};
	}

	async findBatchById(id: string): Promise<Inventory.Batch | null> {
		const batch = await this.batchModel.findUnique({
			where: { id },
			include: batchInclude,
		});

		return batch ? toInventoryBatch(batch as InventoryBatch) : null;
	}

	async createBatch(
		data: z.infer<typeof Inventory.createBatchSchema>,
	): Promise<Inventory.Batch> {
		try {
			const created = await this.prisma.$transaction(async (rawTx) => {
				const tx = rawTx as BatchCapableTransactionClient;

				await this.validateBatchRelationships(tx, {
					itemId: data.itemId,
					company: data.company,
					currentWarehouseId: data.currentWarehouseId ?? null,
					purchaseReceiptId: data.purchaseReceiptId ?? null,
					deliveryNoteId: data.deliveryNoteId ?? null,
					stockEntryId: data.stockEntryId ?? null,
					quantity: data.quantity ?? 0,
				});

				return tx.batch.create({
					data: {
						batchId: data.batchId,
						itemId: data.itemId,
						company: data.company,
						currentWarehouseId: data.currentWarehouseId ?? null,
						purchaseReceiptId: data.purchaseReceiptId ?? null,
						deliveryNoteId: data.deliveryNoteId ?? null,
						stockEntryId: data.stockEntryId ?? null,
						useBatchWiseValuation: data.useBatchWiseValuation ?? false,
						manufacturingDate: data.manufacturingDate ?? null,
						expiryDate: data.expiryDate ?? null,
						description: normalizeOptionalText(data.description),
						quantity: data.quantity ?? 0,
						isDisabled: data.isDisabled ?? false,
					},
					include: batchInclude,
				});
			});

			return toInventoryBatch(created as InventoryBatch);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(`Batch ${data.batchId} already exists`);
			}

			throw error;
		}
	}

	async updateBatch(
		data: z.infer<typeof Inventory.updateBatchSchema>,
	): Promise<Inventory.Batch> {
		const existing = (await this.batchModel.findUnique({
			where: { id: data.id },
			select: {
				id: true,
				batchId: true,
				itemId: true,
				company: true,
				currentWarehouseId: true,
				purchaseReceiptId: true,
				deliveryNoteId: true,
				stockEntryId: true,
				useBatchWiseValuation: true,
				manufacturingDate: true,
				expiryDate: true,
				description: true,
				quantity: true,
				isDisabled: true,
			},
		})) as {
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
		} | null;

		if (!existing) {
			throw new NotFoundException(`Batch with ID ${data.id} not found`);
		}

		const nextQuantity = data.quantity ?? existing.quantity;
		const nextWarehouseId =
			data.currentWarehouseId !== undefined
				? data.currentWarehouseId
				: existing.currentWarehouseId;
		const itemChanged =
			data.itemId !== undefined && data.itemId !== existing.itemId;
		const warehouseChanged =
			data.currentWarehouseId !== undefined &&
			data.currentWarehouseId !== existing.currentWarehouseId;

		if (existing.quantity > 0 && (itemChanged || warehouseChanged)) {
			throw new BadRequestException(
				"Item and warehouse cannot be changed while the batch still has quantity on hand",
			);
		}

		try {
			const updated = await this.prisma.$transaction(async (rawTx) => {
				const tx = rawTx as BatchCapableTransactionClient;

				await this.validateBatchRelationships(tx, {
					itemId: data.itemId ?? existing.itemId,
					company: data.company ?? existing.company,
					currentWarehouseId: nextWarehouseId,
					purchaseReceiptId:
						data.purchaseReceiptId !== undefined
							? data.purchaseReceiptId
							: existing.purchaseReceiptId,
					deliveryNoteId:
						data.deliveryNoteId !== undefined
							? data.deliveryNoteId
							: existing.deliveryNoteId,
					stockEntryId:
						data.stockEntryId !== undefined
							? data.stockEntryId
							: existing.stockEntryId,
					quantity: nextQuantity,
				});

				return tx.batch.update({
					where: { id: data.id },
					data: {
						...(data.batchId !== undefined && { batchId: data.batchId }),
						...(data.itemId !== undefined && { itemId: data.itemId }),
						...(data.company !== undefined && { company: data.company }),
						...(data.currentWarehouseId !== undefined && {
							currentWarehouseId: data.currentWarehouseId,
						}),
						...(data.purchaseReceiptId !== undefined && {
							purchaseReceiptId: data.purchaseReceiptId,
						}),
						...(data.deliveryNoteId !== undefined && {
							deliveryNoteId: data.deliveryNoteId,
						}),
						...(data.stockEntryId !== undefined && {
							stockEntryId: data.stockEntryId,
						}),
						...(data.useBatchWiseValuation !== undefined && {
							useBatchWiseValuation: data.useBatchWiseValuation,
						}),
						...(data.manufacturingDate !== undefined && {
							manufacturingDate: data.manufacturingDate,
						}),
						...(data.expiryDate !== undefined && {
							expiryDate: data.expiryDate,
						}),
						...(data.description !== undefined && {
							description: normalizeOptionalText(data.description),
						}),
						...(data.quantity !== undefined && { quantity: data.quantity }),
						...(data.isDisabled !== undefined && {
							isDisabled: data.isDisabled,
						}),
					},
					include: batchInclude,
				});
			});

			return toInventoryBatch(updated as InventoryBatch);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					`Batch ${data.batchId ?? existing.batchId} already exists`,
				);
			}

			throw error;
		}
	}

	async deleteBatch(id: string): Promise<{ success: boolean; id: string }> {
		const existing = (await this.batchModel.findUnique({
			where: { id },
			select: {
				id: true,
				quantity: true,
				purchaseReceiptId: true,
				deliveryNoteId: true,
				stockEntryId: true,
			},
		})) as {
			id: string;
			quantity: number;
			purchaseReceiptId: string | null;
			deliveryNoteId: string | null;
			stockEntryId: string | null;
		} | null;

		if (!existing) {
			throw new NotFoundException(`Batch with ID ${id} not found`);
		}

		if (existing.quantity > 0) {
			throw new BadRequestException(
				"Batch cannot be deleted because stock still exists for it",
			);
		}

		if (
			existing.purchaseReceiptId ||
			existing.deliveryNoteId ||
			existing.stockEntryId
		) {
			throw new BadRequestException(
				"Batch cannot be deleted because it is linked to inventory transactions",
			);
		}

		await this.batchModel.delete({
			where: { id },
		});

		return { success: true, id };
	}

	/**
	 * Get serial numbers with bounded filters and pagination.
	 */
	async findSerialNos(
		params?: Inventory.ListSerialNosInput,
	): Promise<Inventory.SerialNoListResult> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;
		const search = params?.search?.trim();
		const company = params?.company?.trim();
		const includeDisabled = params?.includeDisabled ?? false;
		const sortDirection: Prisma.SortOrder =
			params?.sortDirection === "asc" ? "asc" : "desc";

		const whereClauses: Prisma.SerialNoWhereInput[] = [];

		if (search) {
			whereClauses.push({
				OR: [
					{ serialNo: { contains: search, mode: "insensitive" } },
					{ company: { contains: search, mode: "insensitive" } },
					{ notes: { contains: search, mode: "insensitive" } },
					{ maintenanceStatus: { contains: search, mode: "insensitive" } },
					{ workOrder: { contains: search, mode: "insensitive" } },
					{ item: { code: { contains: search, mode: "insensitive" } } },
					{ item: { name: { contains: search, mode: "insensitive" } } },
					{
						currentWarehouse: {
							name: { contains: search, mode: "insensitive" },
						},
					},
				],
			});
		}

		if (params?.itemId) {
			whereClauses.push({ itemId: params.itemId });
		}

		if (params?.warehouseId) {
			whereClauses.push({ currentWarehouseId: params.warehouseId });
		}

		if (params?.deliveryNoteId) {
			whereClauses.push({ deliveryNoteId: params.deliveryNoteId });
		}

		if (company) {
			whereClauses.push({
				company: {
					contains: company,
					mode: "insensitive",
				},
			});
		}

		if (params?.status) {
			whereClauses.push({ status: params.status });
		}

		if (!includeDisabled) {
			whereClauses.push({ isDisabled: false });
		}

		const where: Prisma.SerialNoWhereInput | undefined =
			whereClauses.length === 0
				? undefined
				: whereClauses.length === 1
					? whereClauses[0]
					: { AND: whereClauses };

		const [items, totalCount] = await this.prisma.$transaction([
			this.prisma.serialNo.findMany({
				where,
				include: serialNoInclude,
				orderBy: this.getSerialNoOrderBy(params?.sortBy, sortDirection),
				skip,
				take,
			}),
			this.prisma.serialNo.count({ where }),
		]);

		return {
			items: items.map(toInventorySerialNo),
			totalCount,
		};
	}

	async findSerialNoStatus(
		params?: Inventory.ListSerialNoStatusInput,
	): Promise<Inventory.SerialNoStatusListResult> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;
		const search = params?.search?.trim();
		const company = params?.company?.trim();
		const includeDisabled = params?.includeDisabled ?? false;
		const sortDirection: Prisma.SortOrder =
			params?.sortDirection === "asc" ? "asc" : "desc";
		const today = startOfUtcDay(new Date());

		const whereClauses: Prisma.SerialNoWhereInput[] = [];

		if (search) {
			whereClauses.push({
				OR: [
					{ serialNo: { contains: search, mode: "insensitive" } },
					{ company: { contains: search, mode: "insensitive" } },
					{ notes: { contains: search, mode: "insensitive" } },
					{ maintenanceStatus: { contains: search, mode: "insensitive" } },
					{ workOrder: { contains: search, mode: "insensitive" } },
					{ item: { code: { contains: search, mode: "insensitive" } } },
					{ item: { name: { contains: search, mode: "insensitive" } } },
					{
						currentWarehouse: {
							name: { contains: search, mode: "insensitive" },
						},
					},
				],
			});
		}

		if (params?.itemId) {
			whereClauses.push({ itemId: params.itemId });
		}

		if (params?.warehouseId) {
			whereClauses.push({ currentWarehouseId: params.warehouseId });
		}

		if (company) {
			whereClauses.push({
				company: {
					contains: company,
					mode: "insensitive",
				},
			});
		}

		if (params?.status) {
			whereClauses.push({ status: params.status });
		}

		if (!includeDisabled) {
			whereClauses.push({ isDisabled: false });
		}

		const where: Prisma.SerialNoWhereInput | undefined =
			whereClauses.length === 0
				? undefined
				: whereClauses.length === 1
					? whereClauses[0]
					: { AND: whereClauses };

		const [items, totalCount] = await this.prisma.$transaction([
			this.prisma.serialNo.findMany({
				where,
				include: serialNoInclude,
				orderBy: this.getSerialNoStatusOrderBy(params?.sortBy, sortDirection),
				skip,
				take,
			}),
			this.prisma.serialNo.count({ where }),
		]);

		return {
			items: items.map((serialNo) => {
				const base = toInventorySerialNo(serialNo);
				const lastStatusChangedAt =
					this.getSerialNoCurrentStatusChangedAt(base);

				return {
					...base,
					lastStatusChangedAt,
					daysInCurrentStatus: diffUtcDays(lastStatusChangedAt, today),
				};
			}),
			totalCount,
		};
	}

	async findSerialNoServiceContractExpiry(
		params?: Inventory.ListSerialNoServiceContractExpiryInput,
	): Promise<Inventory.SerialNoServiceContractExpiryListResult> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;
		const search = params?.search?.trim();
		const company = params?.company?.trim();
		const includeDisabled = params?.includeDisabled ?? false;
		const sortDirection: Prisma.SortOrder =
			params?.sortDirection === "desc" ? "desc" : "asc";
		const today = startOfUtcDay(new Date());
		const expiringWithinDays = params?.expiringWithinDays ?? 30;
		const dueSoonThreshold = addUtcDays(today, expiringWithinDays);

		const whereClauses: Prisma.SerialNoWhereInput[] = [
			{ serviceContractExpiryDate: { not: null } },
		];

		if (search) {
			whereClauses.push({
				OR: [
					{ serialNo: { contains: search, mode: "insensitive" } },
					{ company: { contains: search, mode: "insensitive" } },
					{ notes: { contains: search, mode: "insensitive" } },
					{ maintenanceStatus: { contains: search, mode: "insensitive" } },
					{ workOrder: { contains: search, mode: "insensitive" } },
					{ item: { code: { contains: search, mode: "insensitive" } } },
					{ item: { name: { contains: search, mode: "insensitive" } } },
					{
						currentWarehouse: {
							name: { contains: search, mode: "insensitive" },
						},
					},
				],
			});
		}

		if (params?.itemId) {
			whereClauses.push({ itemId: params.itemId });
		}

		if (params?.warehouseId) {
			whereClauses.push({ currentWarehouseId: params.warehouseId });
		}

		if (company) {
			whereClauses.push({
				company: {
					contains: company,
					mode: "insensitive",
				},
			});
		}

		if (params?.status) {
			whereClauses.push({ status: params.status });
		}

		if (!includeDisabled) {
			whereClauses.push({ isDisabled: false });
		}

		if (params?.expiryDateFrom || params?.expiryDateTo) {
			whereClauses.push({
				serviceContractExpiryDate: {
					...(params.expiryDateFrom
						? { gte: startOfUtcDay(params.expiryDateFrom) }
						: {}),
					...(params.expiryDateTo
						? { lte: addUtcDays(startOfUtcDay(params.expiryDateTo), 1) }
						: {}),
				},
			});
		}

		if (params?.expiryState) {
			switch (params.expiryState) {
				case "EXPIRED":
					whereClauses.push({
						serviceContractExpiryDate: { lt: today },
					});
					break;
				case "DUE_SOON":
					whereClauses.push({
						serviceContractExpiryDate: {
							gte: today,
							lte: dueSoonThreshold,
						},
					});
					break;
				case "ACTIVE":
					whereClauses.push({
						serviceContractExpiryDate: { gt: dueSoonThreshold },
					});
					break;
			}
		}

		const where: Prisma.SerialNoWhereInput =
			whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses };

		const [items, totalCount] = await this.prisma.$transaction([
			this.prisma.serialNo.findMany({
				where,
				include: serialNoInclude,
				orderBy: this.getSerialNoServiceContractExpiryOrderBy(
					params?.sortBy,
					sortDirection,
				),
				skip,
				take,
			}),
			this.prisma.serialNo.count({ where }),
		]);

		const reportItems: Inventory.SerialNoServiceContractExpiryRow[] = [];

		for (const serialNo of items) {
			if (!serialNo.serviceContractExpiryDate) {
				continue;
			}

			const expiryDate = startOfUtcDay(serialNo.serviceContractExpiryDate);
			const expiryState: Inventory.SerialNoServiceContractExpiryState =
				expiryDate < today
					? "EXPIRED"
					: expiryDate <= dueSoonThreshold
						? "DUE_SOON"
						: "ACTIVE";

			const base = toInventorySerialNo(serialNo);

			reportItems.push({
				id: base.id,
				serialNo: base.serialNo,
				itemId: base.itemId,
				itemCode: base.itemCode,
				itemName: base.itemName,
				company: base.company,
				status: base.status,
				currentWarehouseId: base.currentWarehouseId,
				currentWarehouseName: base.currentWarehouseName,
				purchaseReceiptId: base.purchaseReceiptId,
				purchaseReceiptSeries: base.purchaseReceiptSeries,
				deliveryNoteId: base.deliveryNoteId,
				deliveryNoteSeries: base.deliveryNoteSeries,
				stockEntryId: base.stockEntryId,
				stockEntrySeries: base.stockEntrySeries,
				pickListId: base.pickListId,
				pickListSeries: base.pickListSeries,
				workOrder: base.workOrder,
				purchaseDate: base.purchaseDate,
				serviceContractExpiryDate: serialNo.serviceContractExpiryDate,
				daysUntilExpiry: diffUtcDays(today, expiryDate),
				expiryState,
				maintenanceStatus: base.maintenanceStatus,
				notes: base.notes,
				isDisabled: base.isDisabled,
				createdAt: base.createdAt,
				updatedAt: base.updatedAt,
			});
		}

		return {
			items: reportItems,
			totalCount,
		};
	}

	async findSerialNoWarrantyExpiry(
		params?: Inventory.ListSerialNoWarrantyExpiryInput,
	): Promise<Inventory.SerialNoWarrantyExpiryListResult> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;
		const search = params?.search?.trim();
		const company = params?.company?.trim();
		const includeDisabled = params?.includeDisabled ?? false;
		const sortDirection: Prisma.SortOrder =
			params?.sortDirection === "desc" ? "desc" : "asc";
		const today = startOfUtcDay(new Date());
		const expiringWithinDays = params?.expiringWithinDays ?? 30;
		const dueSoonThreshold = addUtcDays(today, expiringWithinDays);

		const whereClauses: Prisma.SerialNoWhereInput[] = [
			{ warrantyExpiryDate: { not: null } },
		];

		if (search) {
			whereClauses.push({
				OR: [
					{ serialNo: { contains: search, mode: "insensitive" } },
					{ company: { contains: search, mode: "insensitive" } },
					{ notes: { contains: search, mode: "insensitive" } },
					{ maintenanceStatus: { contains: search, mode: "insensitive" } },
					{ workOrder: { contains: search, mode: "insensitive" } },
					{ item: { code: { contains: search, mode: "insensitive" } } },
					{ item: { name: { contains: search, mode: "insensitive" } } },
					{
						currentWarehouse: {
							name: { contains: search, mode: "insensitive" },
						},
					},
				],
			});
		}

		if (params?.itemId) {
			whereClauses.push({ itemId: params.itemId });
		}

		if (params?.warehouseId) {
			whereClauses.push({ currentWarehouseId: params.warehouseId });
		}

		if (company) {
			whereClauses.push({
				company: {
					contains: company,
					mode: "insensitive",
				},
			});
		}

		if (params?.status) {
			whereClauses.push({ status: params.status });
		}

		if (!includeDisabled) {
			whereClauses.push({ isDisabled: false });
		}

		if (params?.expiryDateFrom || params?.expiryDateTo) {
			whereClauses.push({
				warrantyExpiryDate: {
					...(params.expiryDateFrom
						? { gte: startOfUtcDay(params.expiryDateFrom) }
						: {}),
					...(params.expiryDateTo
						? { lte: addUtcDays(startOfUtcDay(params.expiryDateTo), 1) }
						: {}),
				},
			});
		}

		if (params?.expiryState) {
			switch (params.expiryState) {
				case "EXPIRED":
					whereClauses.push({
						warrantyExpiryDate: { lt: today },
					});
					break;
				case "DUE_SOON":
					whereClauses.push({
						warrantyExpiryDate: {
							gte: today,
							lte: dueSoonThreshold,
						},
					});
					break;
				case "ACTIVE":
					whereClauses.push({
						warrantyExpiryDate: { gt: dueSoonThreshold },
					});
					break;
			}
		}

		const where: Prisma.SerialNoWhereInput =
			whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses };

		const [items, totalCount] = await this.prisma.$transaction([
			this.prisma.serialNo.findMany({
				where,
				include: serialNoInclude,
				orderBy: this.getSerialNoWarrantyExpiryOrderBy(
					params?.sortBy,
					sortDirection,
				),
				skip,
				take,
			}),
			this.prisma.serialNo.count({ where }),
		]);

		const reportItems: Inventory.SerialNoWarrantyExpiryRow[] = [];

		for (const serialNo of items) {
			if (!serialNo.warrantyExpiryDate) {
				continue;
			}

			const expiryDate = startOfUtcDay(serialNo.warrantyExpiryDate);
			const expiryState: Inventory.SerialNoWarrantyExpiryState =
				expiryDate < today
					? "EXPIRED"
					: expiryDate <= dueSoonThreshold
						? "DUE_SOON"
						: "ACTIVE";

			const base = toInventorySerialNo(serialNo);

			reportItems.push({
				id: base.id,
				serialNo: base.serialNo,
				itemId: base.itemId,
				itemCode: base.itemCode,
				itemName: base.itemName,
				company: base.company,
				status: base.status,
				currentWarehouseId: base.currentWarehouseId,
				currentWarehouseName: base.currentWarehouseName,
				purchaseReceiptId: base.purchaseReceiptId,
				purchaseReceiptSeries: base.purchaseReceiptSeries,
				deliveryNoteId: base.deliveryNoteId,
				deliveryNoteSeries: base.deliveryNoteSeries,
				stockEntryId: base.stockEntryId,
				stockEntrySeries: base.stockEntrySeries,
				pickListId: base.pickListId,
				pickListSeries: base.pickListSeries,
				workOrder: base.workOrder,
				purchaseDate: base.purchaseDate,
				warrantyExpiryDate: serialNo.warrantyExpiryDate,
				daysUntilExpiry: diffUtcDays(today, expiryDate),
				expiryState,
				maintenanceStatus: base.maintenanceStatus,
				notes: base.notes,
				isDisabled: base.isDisabled,
				createdAt: base.createdAt,
				updatedAt: base.updatedAt,
			});
		}

		return {
			items: reportItems,
			totalCount,
		};
	}

	async findSerialNoById(id: string): Promise<Inventory.SerialNo | null> {
		const serialNo = await this.prisma.serialNo.findUnique({
			where: { id },
			include: serialNoInclude,
		});

		return serialNo ? toInventorySerialNo(serialNo) : null;
	}

	async createSerialNo(
		data: z.infer<typeof Inventory.createSerialNoSchema>,
	): Promise<Inventory.SerialNo> {
		try {
			const created = await this.prisma.$transaction(async (tx) => {
				const relations = await this.validateSerialNoRelationships(tx, {
					itemId: data.itemId,
					company: data.company,
					status: data.status ?? "DRAFT",
					currentWarehouseId: data.currentWarehouseId ?? null,
					purchaseReceiptId: data.purchaseReceiptId ?? null,
					deliveryNoteId: data.deliveryNoteId ?? null,
					stockEntryId: data.stockEntryId ?? null,
					pickListId: data.pickListId ?? null,
				});

				const createdSerialNo = await tx.serialNo.create({
					data: {
						serialNo: data.serialNo,
						itemId: data.itemId,
						company: data.company,
						status: data.status ?? "DRAFT",
						currentWarehouseId: data.currentWarehouseId ?? null,
						purchaseReceiptId: data.purchaseReceiptId ?? null,
						deliveryNoteId: data.deliveryNoteId ?? null,
						stockEntryId: data.stockEntryId ?? null,
						pickListId: data.pickListId ?? null,
						workOrder: normalizeOptionalText(data.workOrder),
						purchaseDate: data.purchaseDate ?? null,
						warrantyExpiryDate: data.warrantyExpiryDate ?? null,
						serviceContractExpiryDate: data.serviceContractExpiryDate ?? null,
						maintenanceStatus: normalizeOptionalText(data.maintenanceStatus),
						notes: normalizeOptionalText(data.notes),
						isDisabled: data.isDisabled ?? false,
						history: {
							create: {
								eventType: "CREATED",
								toStatus: data.status ?? "DRAFT",
								warehouseId: data.currentWarehouseId ?? null,
								transactionLabel: this.buildSerialNoTransactionLabel({
									purchaseReceiptSeries: relations.purchaseReceipt?.series,
									deliveryNoteSeries: relations.deliveryNote?.series,
									stockEntrySeries: relations.stockEntry?.series,
									pickListSeries: relations.pickList?.series,
								}),
								notes: normalizeOptionalText(data.notes) ?? null,
							},
						},
					},
					include: serialNoInclude,
				});

				return createdSerialNo;
			});

			return toInventorySerialNo(created);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					`Serial number ${data.serialNo} already exists`,
				);
			}

			throw error;
		}
	}

	async updateSerialNo(
		data: z.infer<typeof Inventory.updateSerialNoSchema>,
	): Promise<Inventory.SerialNo> {
		const existing = await this.prisma.serialNo.findUnique({
			where: { id: data.id },
			select: {
				id: true,
				serialNo: true,
				itemId: true,
				company: true,
				status: true,
				currentWarehouseId: true,
				purchaseReceiptId: true,
				deliveryNoteId: true,
				stockEntryId: true,
				pickListId: true,
				workOrder: true,
				purchaseDate: true,
				warrantyExpiryDate: true,
				serviceContractExpiryDate: true,
				maintenanceStatus: true,
				notes: true,
				isDisabled: true,
			},
		});

		if (!existing) {
			throw new NotFoundException(`Serial number with ID ${data.id} not found`);
		}

		const nextStatus =
			data.status ?? (existing.status as Inventory.SerialNoStatus);
		this.assertSerialNoStatusTransition(
			existing.status as Inventory.SerialNoStatus,
			nextStatus,
		);

		try {
			const updated = await this.prisma.$transaction(async (tx) => {
				const nextCompany = data.company ?? existing.company;
				const relations = await this.validateSerialNoRelationships(tx, {
					itemId: data.itemId ?? existing.itemId,
					company: nextCompany,
					status: nextStatus,
					currentWarehouseId:
						data.currentWarehouseId !== undefined
							? data.currentWarehouseId
							: existing.currentWarehouseId,
					purchaseReceiptId:
						data.purchaseReceiptId !== undefined
							? data.purchaseReceiptId
							: existing.purchaseReceiptId,
					deliveryNoteId:
						data.deliveryNoteId !== undefined
							? data.deliveryNoteId
							: existing.deliveryNoteId,
					stockEntryId:
						data.stockEntryId !== undefined
							? data.stockEntryId
							: existing.stockEntryId,
					pickListId:
						data.pickListId !== undefined
							? data.pickListId
							: existing.pickListId,
				});

				const linksChanged =
					(data.purchaseReceiptId !== undefined &&
						data.purchaseReceiptId !== existing.purchaseReceiptId) ||
					(data.deliveryNoteId !== undefined &&
						data.deliveryNoteId !== existing.deliveryNoteId) ||
					(data.stockEntryId !== undefined &&
						data.stockEntryId !== existing.stockEntryId) ||
					(data.pickListId !== undefined &&
						data.pickListId !== existing.pickListId);
				const warehouseChanged =
					data.currentWarehouseId !== undefined &&
					data.currentWarehouseId !== existing.currentWarehouseId;
				const statusChanged =
					data.status !== undefined && data.status !== existing.status;

				const eventType:
					| "UPDATED"
					| "STATUS_CHANGED"
					| "WAREHOUSE_CHANGED"
					| "LINKS_CHANGED" = statusChanged
					? "STATUS_CHANGED"
					: warehouseChanged
						? "WAREHOUSE_CHANGED"
						: linksChanged
							? "LINKS_CHANGED"
							: "UPDATED";

				const nextSerialNo = await tx.serialNo.update({
					where: { id: data.id },
					data: {
						...(data.serialNo !== undefined && { serialNo: data.serialNo }),
						...(data.itemId !== undefined && { itemId: data.itemId }),
						...(data.company !== undefined && { company: data.company }),
						...(data.status !== undefined && { status: data.status }),
						...(data.currentWarehouseId !== undefined && {
							currentWarehouseId: data.currentWarehouseId,
						}),
						...(data.purchaseReceiptId !== undefined && {
							purchaseReceiptId: data.purchaseReceiptId,
						}),
						...(data.deliveryNoteId !== undefined && {
							deliveryNoteId: data.deliveryNoteId,
						}),
						...(data.stockEntryId !== undefined && {
							stockEntryId: data.stockEntryId,
						}),
						...(data.pickListId !== undefined && {
							pickListId: data.pickListId,
						}),
						...(data.workOrder !== undefined && {
							workOrder: normalizeOptionalText(data.workOrder),
						}),
						...(data.purchaseDate !== undefined && {
							purchaseDate: data.purchaseDate,
						}),
						...(data.warrantyExpiryDate !== undefined && {
							warrantyExpiryDate: data.warrantyExpiryDate,
						}),
						...(data.serviceContractExpiryDate !== undefined && {
							serviceContractExpiryDate: data.serviceContractExpiryDate,
						}),
						...(data.maintenanceStatus !== undefined && {
							maintenanceStatus: normalizeOptionalText(data.maintenanceStatus),
						}),
						...(data.notes !== undefined && {
							notes: normalizeOptionalText(data.notes),
						}),
						...(data.isDisabled !== undefined && {
							isDisabled: data.isDisabled,
						}),
						history: {
							create: {
								eventType,
								fromStatus: existing.status,
								toStatus: nextStatus,
								warehouseId:
									data.currentWarehouseId !== undefined
										? data.currentWarehouseId
										: existing.currentWarehouseId,
								transactionLabel: this.buildSerialNoTransactionLabel({
									purchaseReceiptSeries:
										relations.purchaseReceipt?.series ?? null,
									deliveryNoteSeries: relations.deliveryNote?.series ?? null,
									stockEntrySeries: relations.stockEntry?.series ?? null,
									pickListSeries: relations.pickList?.series ?? null,
								}),
								notes:
									normalizeOptionalText(
										data.notes !== undefined ? data.notes : existing.notes,
									) ?? null,
							},
						},
					},
					include: serialNoInclude,
				});

				return nextSerialNo;
			});

			return toInventorySerialNo(updated);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					`Serial number ${data.serialNo ?? existing.serialNo} already exists`,
				);
			}

			throw error;
		}
	}

	async deleteSerialNo(id: string): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.serialNo.findUnique({
			where: { id },
			select: {
				id: true,
				status: true,
				purchaseReceiptId: true,
				deliveryNoteId: true,
				stockEntryId: true,
				pickListId: true,
			},
		});

		if (!existing) {
			throw new NotFoundException(`Serial number with ID ${id} not found`);
		}

		if (
			existing.purchaseReceiptId ||
			existing.deliveryNoteId ||
			existing.stockEntryId ||
			existing.pickListId
		) {
			throw new BadRequestException(
				"Serial number cannot be deleted because it is linked to inventory transactions",
			);
		}

		if (!["DRAFT", "AVAILABLE"].includes(existing.status)) {
			throw new BadRequestException(
				"Only draft or available serial numbers can be deleted",
			);
		}

		await this.prisma.serialNo.delete({
			where: { id },
		});

		return { success: true, id };
	}

	/**
	 * Create a warehouse master record.
	 */
	async createWarehouse(
		data: z.infer<typeof Inventory.createWarehouseSchema>,
	): Promise<Inventory.Warehouse> {
		const normalizedName = data.name.trim();
		await this.ensureWarehouseNameAvailable(normalizedName);
		await this.validateWarehouseHierarchy({
			parentWarehouseId: data.parentWarehouseId ?? null,
			defaultInTransitWarehouseId: data.defaultInTransitWarehouseId ?? null,
			isGroupWarehouse: data.isGroupWarehouse ?? false,
		});

		const created = await this.prisma.warehouse.create({
			data: {
				name: normalizedName,
				disabled: data.disabled ?? false,
				isGroupWarehouse: data.isGroupWarehouse ?? false,
				parentWarehouseId: data.parentWarehouseId ?? null,
				company: data.company.trim(),
				isRejectedWarehouse: data.isRejectedWarehouse ?? false,
				phoneNo: this.normalizeWarehouseText(data.phoneNo),
				mobileNo: this.normalizeWarehouseText(data.mobileNo),
				addressLine1: this.normalizeWarehouseText(data.addressLine1),
				addressLine2: this.normalizeWarehouseText(data.addressLine2),
				city: this.normalizeWarehouseText(data.city),
				state: this.normalizeWarehouseText(data.state),
				pin: this.normalizeWarehouseText(data.pin),
				warehouseType: this.normalizeWarehouseText(data.warehouseType),
				defaultInTransitWarehouseId: data.defaultInTransitWarehouseId ?? null,
			},
			select: warehouseSelect,
		});

		return toInventoryWarehouse(created);
	}

	/**
	 * Update a warehouse master record.
	 */
	async updateWarehouse(
		data: z.infer<typeof Inventory.updateWarehouseSchema>,
	): Promise<Inventory.Warehouse> {
		const existing = await this.prisma.warehouse.findUnique({
			where: { id: data.id },
			select: warehouseSelect,
		});

		if (!existing) {
			throw new NotFoundException(`Warehouse with id "${data.id}" not found`);
		}

		const normalizedName = data.name?.trim() ?? existing.name;
		const warehouseNameChanged = this.hasWarehouseNameChanged(
			existing.name,
			normalizedName,
		);

		if (warehouseNameChanged) {
			await this.ensureWarehouseNameAvailable(normalizedName, data.id);
			await this.assertWarehouseNameIsNotReferenced(existing.name);
		}

		await this.validateWarehouseHierarchy({
			warehouseId: existing.id,
			parentWarehouseId:
				data.parentWarehouseId !== undefined
					? data.parentWarehouseId
					: existing.parentWarehouseId,
			defaultInTransitWarehouseId:
				data.defaultInTransitWarehouseId !== undefined
					? data.defaultInTransitWarehouseId
					: existing.defaultInTransitWarehouseId,
			isGroupWarehouse: data.isGroupWarehouse ?? existing.isGroupWarehouse,
		});

		const updated = await this.prisma.warehouse.update({
			where: { id: data.id },
			data: removeUndefined({
				name: data.name !== undefined ? normalizedName : undefined,
				disabled: data.disabled,
				isGroupWarehouse: data.isGroupWarehouse,
				parentWarehouseId: data.parentWarehouseId,
				company: data.company !== undefined ? data.company.trim() : undefined,
				isRejectedWarehouse: data.isRejectedWarehouse,
				phoneNo:
					data.phoneNo !== undefined
						? this.normalizeWarehouseText(data.phoneNo)
						: undefined,
				mobileNo:
					data.mobileNo !== undefined
						? this.normalizeWarehouseText(data.mobileNo)
						: undefined,
				addressLine1:
					data.addressLine1 !== undefined
						? this.normalizeWarehouseText(data.addressLine1)
						: undefined,
				addressLine2:
					data.addressLine2 !== undefined
						? this.normalizeWarehouseText(data.addressLine2)
						: undefined,
				city:
					data.city !== undefined
						? this.normalizeWarehouseText(data.city)
						: undefined,
				state:
					data.state !== undefined
						? this.normalizeWarehouseText(data.state)
						: undefined,
				pin:
					data.pin !== undefined
						? this.normalizeWarehouseText(data.pin)
						: undefined,
				warehouseType:
					data.warehouseType !== undefined
						? this.normalizeWarehouseText(data.warehouseType)
						: undefined,
				defaultInTransitWarehouseId: data.defaultInTransitWarehouseId,
			}),
			select: warehouseSelect,
		});

		return toInventoryWarehouse(updated);
	}

	/**
	 * Delete a warehouse when it is no longer referenced.
	 */
	async deleteWarehouse(id: string): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.warehouse.findUnique({
			where: { id },
			select: { id: true, name: true },
		});

		if (!existing) {
			throw new NotFoundException(`Warehouse with id "${id}" not found`);
		}

		await this.assertWarehouseCanBeDeleted(existing);

		await this.prisma.warehouse.delete({ where: { id } });

		return { success: true, id };
	}

	private normalizeStockSettingsText(value?: string | null): string | null {
		const normalized = value?.trim();
		return normalized ? normalized : null;
	}

	private assertUniqueItemVariantCopyFields(
		copyFields: z.infer<
			typeof Inventory.updateItemVariantSettingsSchema
		>["copyFields"],
	): void {
		const seenFieldKeys = new Set<Inventory.ItemVariantCopyFieldKey>();

		for (const field of copyFields) {
			if (seenFieldKeys.has(field.fieldKey)) {
				throw new BadRequestException(
					`Copy field "${field.fieldKey}" can only be added once`,
				);
			}

			seenFieldKeys.add(field.fieldKey);
		}
	}

	private async resolveCanonicalUnitOfMeasureName(
		name: string | null,
	): Promise<string | null> {
		if (!name) {
			return null;
		}

		const unit = await this.prisma.unitOfMeasurement.findFirst({
			where: {
				name: {
					equals: name,
					mode: "insensitive",
				},
				disabled: false,
			},
			select: { name: true },
		});

		if (!unit) {
			throw new BadRequestException(
				`Default stock UOM "${name}" does not exist or is disabled`,
			);
		}

		return unit.name;
	}

	/**
	 * Get the singleton item variant settings record, creating it when missing.
	 */
	async findItemVariantSettings(): Promise<Inventory.ItemVariantSettings> {
		const existing = await this.prisma.itemVariantSettings.findUnique({
			where: { singletonKey: "default" },
			select: itemVariantSettingsSelect,
		});

		if (existing) {
			return toInventoryItemVariantSettings(existing);
		}

		const created = await this.prisma.itemVariantSettings.upsert({
			where: { singletonKey: "default" },
			update: {},
			create: {
				singletonKey: "default",
			},
			select: itemVariantSettingsSelect,
		});

		return toInventoryItemVariantSettings(created);
	}

	/**
	 * Update the singleton item variant settings record while preserving child row identity.
	 */
	async updateItemVariantSettings(
		data: z.infer<typeof Inventory.updateItemVariantSettingsSchema>,
	): Promise<Inventory.ItemVariantSettings> {
		this.assertUniqueItemVariantCopyFields(data.copyFields);

		const updated = await this.prisma.$transaction(async (tx) => {
			const settings = await tx.itemVariantSettings.upsert({
				where: { singletonKey: "default" },
				update: {
					doNotUpdateVariantsOnSave: data.doNotUpdateVariantsOnSave,
					allowRenameAttributeValue: data.allowRenameAttributeValue,
				},
				create: {
					singletonKey: "default",
					doNotUpdateVariantsOnSave: data.doNotUpdateVariantsOnSave,
					allowRenameAttributeValue: data.allowRenameAttributeValue,
				},
				select: { id: true },
			});

			const existingFields = await tx.itemVariantSettingsField.findMany({
				where: { settingsId: settings.id },
				orderBy: { position: "asc" },
			});

			const existingFieldsById = new Map(
				existingFields.map((field) => [field.id, field]),
			);
			const incomingIds = new Set(
				data.copyFields.flatMap((field) => (field.id ? [field.id] : [])),
			);

			for (const field of data.copyFields) {
				if (field.id && !existingFieldsById.has(field.id)) {
					throw new BadRequestException(
						"One or more item variant copy field rows no longer exist",
					);
				}
			}

			const fieldIdsToDelete = existingFields
				.filter((field) => !incomingIds.has(field.id))
				.map((field) => field.id);

			if (fieldIdsToDelete.length > 0) {
				await tx.itemVariantSettingsField.deleteMany({
					where: {
						settingsId: settings.id,
						id: { in: fieldIdsToDelete },
					},
				});
			}

			for (const [position, field] of data.copyFields.entries()) {
				if (field.id) {
					await tx.itemVariantSettingsField.update({
						where: { id: field.id },
						data: {
							fieldKey: field.fieldKey,
							position,
						},
					});
					continue;
				}

				await tx.itemVariantSettingsField.create({
					data: {
						settingsId: settings.id,
						fieldKey: field.fieldKey,
						position,
					},
				});
			}

			return tx.itemVariantSettings.findUniqueOrThrow({
				where: { id: settings.id },
				select: itemVariantSettingsSelect,
			});
		});

		return toInventoryItemVariantSettings(updated);
	}

	/**
	 * Get the singleton stock settings record, creating it when missing.
	 */
	async findStockSettings(): Promise<Inventory.StockSettings> {
		const existing = await this.prisma.stockSettings.findUnique({
			where: { singletonKey: "default" },
			select: stockSettingsSelect,
		});

		if (existing) {
			return toInventoryStockSettings(existing);
		}

		const created = await this.prisma.stockSettings.upsert({
			where: { singletonKey: "default" },
			update: {},
			create: {
				singletonKey: "default",
			},
			select: stockSettingsSelect,
		});

		return toInventoryStockSettings(created);
	}

	/**
	 * Update the singleton stock settings record.
	 */
	async updateStockSettings(
		data: z.infer<typeof Inventory.updateStockSettingsSchema>,
	): Promise<Inventory.StockSettings> {
		const normalizedDefaultWarehouse = this.normalizeStockSettingsText(
			data.defaultWarehouse,
		);
		const normalizedDefaultStockUom =
			await this.resolveCanonicalUnitOfMeasureName(
				this.normalizeStockSettingsText(data.defaultStockUom),
			);

		const updated = await this.prisma.stockSettings.upsert({
			where: { singletonKey: "default" },
			update: {
				...data,
				defaultWarehouse: normalizedDefaultWarehouse,
				defaultStockUom: normalizedDefaultStockUom,
			},
			create: {
				singletonKey: "default",
				...data,
				defaultWarehouse: normalizedDefaultWarehouse,
				defaultStockUom: normalizedDefaultStockUom,
			},
			select: stockSettingsSelect,
		});

		return toInventoryStockSettings(updated);
	}

	/**
	 * Preload standard UOM records from seed CSV.
	 *
	 * This operation is idempotent:
	 * - Existing rows are never updated/deleted.
	 * - Only missing names (case-insensitive) are inserted.
	 */
	async preloadStandardUnitsOfMeasure(
		seedEntries?: UomSeedEntry[],
	): Promise<{ total: number; inserted: number }> {
		const entries = seedEntries ?? (await loadUomSeedEntriesFromCsv());
		if (entries.length === 0) {
			this.logger.warn("No UOM seed entries found; skipping preload");
			return { total: 0, inserted: 0 };
		}

		const existingUnits = await this.prisma.unitOfMeasurement.findMany({
			select: { name: true },
		});
		const existingNames = new Set(
			existingUnits.map((unit) => normalizeUomName(unit.name)),
		);

		const missingEntries = entries.filter(
			(entry) => !existingNames.has(normalizeUomName(entry.name)),
		);

		if (missingEntries.length === 0) {
			this.logger.log(
				`UOM preload skipped: all ${entries.length} standard units already exist`,
			);
			return { total: entries.length, inserted: 0 };
		}

		const created = await this.prisma.unitOfMeasurement.createMany({
			data: missingEntries.map((entry) => ({
				name: entry.name,
				disabled: entry.disabled,
				isWholeNumber: entry.isWholeNumber,
			})),
		});

		this.logger.log(
			`UOM preload inserted ${created.count} missing records (source total: ${entries.length})`,
		);
		return { total: entries.length, inserted: created.count };
	}

	/**
	 * Get a single unit of measure by id
	 */
	async findUnitOfMeasureById(
		id: string,
	): Promise<Inventory.UnitOfMeasure | null> {
		const unit = await this.prisma.unitOfMeasurement.findUnique({
			where: { id },
			select: unitOfMeasureSelect,
		});

		return unit ? toInventoryUnitOfMeasure(unit) : null;
	}

	/**
	 * Create a unit of measure
	 */
	async createUnitOfMeasure(
		data: z.infer<typeof Inventory.createUnitOfMeasureSchema>,
	): Promise<Inventory.UnitOfMeasure> {
		const duplicate = await this.prisma.unitOfMeasurement.findFirst({
			where: {
				name: {
					equals: data.name,
					mode: "insensitive",
				},
			},
			select: { id: true },
		});

		if (duplicate) {
			throw new ConflictException(
				`Unit of measure with name "${data.name}" already exists`,
			);
		}

		try {
			const created = await this.prisma.unitOfMeasurement.create({
				data: {
					name: data.name,
					disabled: data.disabled ?? false,
					isWholeNumber: data.isWholeNumber ?? true,
				},
				select: unitOfMeasureSelect,
			});

			return toInventoryUnitOfMeasure(created);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					`Unit of measure with name "${data.name}" already exists`,
				);
			}
			throw error;
		}
	}

	/**
	 * Update a unit of measure
	 */
	async updateUnitOfMeasure(
		data: z.infer<typeof Inventory.updateUnitOfMeasureSchema>,
	): Promise<Inventory.UnitOfMeasure> {
		const { id, ...rest } = data;

		const existing = await this.prisma.unitOfMeasurement.findUnique({
			where: { id },
			select: { id: true, name: true },
		});

		if (!existing) {
			throw new NotFoundException(`Unit of measure with ID ${id} not found`);
		}

		if (rest.name !== undefined) {
			const duplicate = await this.prisma.unitOfMeasurement.findFirst({
				where: {
					id: { not: id },
					name: {
						equals: rest.name,
						mode: "insensitive",
					},
				},
				select: { id: true },
			});

			if (duplicate) {
				throw new ConflictException(
					`Unit of measure with name "${rest.name}" already exists`,
				);
			}
		}

		try {
			const updated = await this.prisma.unitOfMeasurement.update({
				where: { id },
				data: removeUndefined(rest),
				select: unitOfMeasureSelect,
			});

			return toInventoryUnitOfMeasure(updated);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Unit of measure with ID ${id} not found`);
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				const conflictName = rest.name ?? existing.name;
				throw new ConflictException(
					conflictName
						? `Unit of measure with name "${conflictName}" already exists`
						: "Unit of measure already exists",
				);
			}
			throw error;
		}
	}

	/**
	 * Delete a unit of measure
	 */
	async deleteUnitOfMeasure(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.unitOfMeasurement.delete({ where: { id } });
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Unit of measure with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Get all brands
	 */
	async findAllBrands(search?: string): Promise<Inventory.Brand[]> {
		const brands = await this.prisma.brand.findMany({
			where: search
				? {
						name: {
							contains: search,
							mode: "insensitive",
						},
					}
				: undefined,
			select: brandSelect,
			orderBy: { name: "asc" },
		});

		return brands.map(toInventoryBrand);
	}

	/**
	 * Get a single brand by id
	 */
	async findBrandById(id: string): Promise<Inventory.Brand | null> {
		const brand = await this.prisma.brand.findUnique({
			where: { id },
			select: brandSelect,
		});

		return brand ? toInventoryBrand(brand) : null;
	}

	/**
	 * Create a brand
	 */
	async createBrand(
		data: z.infer<typeof Inventory.createBrandSchema>,
	): Promise<Inventory.Brand> {
		const duplicate = await this.prisma.brand.findFirst({
			where: {
				name: {
					equals: data.name,
					mode: "insensitive",
				},
			},
			select: { id: true },
		});

		if (duplicate) {
			throw new ConflictException(
				`Brand with name "${data.name}" already exists`,
			);
		}

		try {
			const created = await this.prisma.brand.create({
				data: {
					name: data.name,
					description: data.description ?? null,
				},
				select: brandSelect,
			});

			return toInventoryBrand(created);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					`Brand with name "${data.name}" already exists`,
				);
			}
			throw error;
		}
	}

	/**
	 * Update a brand
	 */
	async updateBrand(
		data: z.infer<typeof Inventory.updateBrandSchema>,
	): Promise<Inventory.Brand> {
		const { id, ...rest } = data;

		const existing = await this.prisma.brand.findUnique({
			where: { id },
			select: { id: true, name: true },
		});

		if (!existing) {
			throw new NotFoundException(`Brand with ID ${id} not found`);
		}

		if (rest.name !== undefined) {
			const duplicate = await this.prisma.brand.findFirst({
				where: {
					id: { not: id },
					name: {
						equals: rest.name,
						mode: "insensitive",
					},
				},
				select: { id: true },
			});

			if (duplicate) {
				throw new ConflictException(
					`Brand with name "${rest.name}" already exists`,
				);
			}
		}

		try {
			const updated = await this.prisma.brand.update({
				where: { id },
				data: removeUndefined(rest),
				select: brandSelect,
			});

			return toInventoryBrand(updated);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Brand with ID ${id} not found`);
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				const conflictName = rest.name ?? existing.name;
				throw new ConflictException(
					conflictName
						? `Brand with name "${conflictName}" already exists`
						: "Brand already exists",
				);
			}
			throw error;
		}
	}

	/**
	 * Delete a brand
	 */
	async deleteBrand(id: string): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.brand.delete({ where: { id } });
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Brand with ID ${id} not found`);
			}
			throw error;
		}
	}

	// ============================================================================
	// Item Attribute
	// ============================================================================

	/**
	 * List all item attributes, optionally filtered by name.
	 */
	async findAllItemAttributes(
		search?: string,
	): Promise<Inventory.ItemAttribute[]> {
		const attributes = await this.prisma.itemAttribute.findMany({
			where: search
				? { name: { contains: search, mode: "insensitive" } }
				: undefined,
			select: itemAttributeSelect,
			orderBy: { name: "asc" },
		});
		return attributes.map(toInventoryItemAttribute);
	}

	/**
	 * Find a single item attribute by ID, including its nested values.
	 */
	async findItemAttributeById(id: string): Promise<Inventory.ItemAttribute> {
		const attribute = await this.prisma.itemAttribute.findUnique({
			where: { id },
			select: itemAttributeSelect,
		});
		if (!attribute) {
			throw new NotFoundException(`Item Attribute with ID ${id} not found`);
		}
		return toInventoryItemAttribute(attribute);
	}

	/**
	 * Create a new item attribute with its initial attribute values.
	 */
	async createItemAttribute(
		data: z.infer<typeof Inventory.createItemAttributeSchema>,
	): Promise<Inventory.ItemAttribute> {
		try {
			const attribute = await this.prisma.itemAttribute.create({
				data: {
					name: data.name,
					disabled: data.disabled,
					numericValues: data.numericValues,
					attributeValues: {
						create: data.attributeValues.map((v, index) => ({
							attributeValue: v.attributeValue,
							abbreviation: v.abbreviation,
							position: index,
						})),
					},
				},
				select: itemAttributeSelect,
			});
			return toInventoryItemAttribute(attribute);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					`Item Attribute with name "${data.name}" already exists`,
				);
			}
			throw error;
		}
	}

	/**
	 * Update an item attribute.
	 *
	 * @remarks
	 * When `attributeValues` is provided, uses a safe upsert strategy inside a
	 * transaction: existing rows (with an `id`) are updated in-place, new rows
	 * (without an `id`) are created, and rows no longer referenced are deleted.
	 * This avoids the data-loss risk of a full delete-then-recreate.
	 */
	async updateItemAttribute(
		data: z.infer<typeof Inventory.updateItemAttributeSchema>,
	): Promise<Inventory.ItemAttribute> {
		const { id, attributeValues, ...rest } = data;

		// Verify the record exists first so we get a clean 404 instead of a Prisma error.
		const existing = await this.prisma.itemAttribute.findUnique({
			where: { id },
			select: { id: true, name: true },
		});
		if (!existing) {
			throw new NotFoundException(`Item Attribute with ID ${id} not found`);
		}

		try {
			const updated = await this.prisma.$transaction(async (tx) => {
				// Scalar field updates
				await tx.itemAttribute.update({
					where: { id },
					data: removeUndefined(rest),
				});

				if (attributeValues !== undefined) {
					const incomingIds = attributeValues
						.filter((v) => v.id !== undefined)
						.map((v) => v.id as string);

					// Delete orphaned rows
					await tx.itemAttributeValue.deleteMany({
						where: { attributeId: id, id: { notIn: incomingIds } },
					});

					// Upsert each incoming row
					for (let i = 0; i < attributeValues.length; i++) {
						const v = attributeValues[i];
						if (v.id) {
							await tx.itemAttributeValue.update({
								where: { id: v.id },
								data: {
									attributeValue: v.attributeValue,
									abbreviation: v.abbreviation,
									position: i,
								},
							});
						} else {
							await tx.itemAttributeValue.create({
								data: {
									attributeId: id,
									attributeValue: v.attributeValue,
									abbreviation: v.abbreviation,
									position: i,
								},
							});
						}
					}
				}

				return tx.itemAttribute.findUniqueOrThrow({
					where: { id },
					select: itemAttributeSelect,
				});
			});

			return toInventoryItemAttribute(updated);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Item Attribute with ID ${id} not found`);
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				const conflictName = rest.name ?? existing.name;
				throw new ConflictException(
					conflictName
						? `Item Attribute with name "${conflictName}" already exists`
						: "Item Attribute already exists",
				);
			}
			throw error;
		}
	}

	/**
	 * Delete an item attribute (cascade deletes all attribute values).
	 */
	async deleteItemAttribute(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.itemAttribute.delete({ where: { id } });
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Item Attribute with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Item options used in Product Bundle selectors
	 */
	async findAllItemsForBundleSelection(
		search?: string,
	): Promise<Inventory.BundleSelectableItem[]> {
		return this.prisma.item.findMany({
			where: search
				? {
						OR: [
							{ name: { contains: search, mode: "insensitive" } },
							{ code: { contains: search, mode: "insensitive" } },
						],
					}
				: undefined,
			select: {
				id: true,
				name: true,
				code: true,
				description: true,
				defaultUnitOfMeasureId: true,
			},
			orderBy: { name: "asc" },
		});
	}

	/**
	 * Get all product bundles
	 */
	async findAllProductBundles(): Promise<Inventory.ProductBundle[]> {
		const bundles = await this.prisma.productBundle.findMany({
			orderBy: { createdAt: "desc" },
			include: {
				parentItem: {
					select: { id: true, name: true },
				},
				bundleItems: {
					include: {
						item: {
							select: { id: true, name: true },
						},
						unitOfMeasurement: {
							select: { id: true, name: true },
						},
					},
				},
			},
		});

		return bundles.map(toInventoryProductBundle);
	}

	/**
	 * Create a product bundle
	 */
	async createProductBundle(
		data: z.infer<typeof Inventory.createProductBundleSchema>,
	): Promise<Inventory.ProductBundle> {
		const existingParent = await this.prisma.item.findUnique({
			where: { id: data.parentItemId },
			select: { id: true },
		});
		if (!existingParent) {
			throw new NotFoundException(
				`Parent item with ID ${data.parentItemId} not found`,
			);
		}

		const requestedItemIds = [
			...new Set(data.bundleItems.map((i) => i.itemId)),
		];
		const existingItems = await this.prisma.item.findMany({
			where: { id: { in: requestedItemIds } },
			select: { id: true },
		});
		const existingItemSet = new Set(existingItems.map((item) => item.id));
		const missingItemId = requestedItemIds.find(
			(id) => !existingItemSet.has(id),
		);
		if (missingItemId) {
			throw new NotFoundException(
				`Bundle item with ID ${missingItemId} not found`,
			);
		}

		try {
			const created = await this.prisma.productBundle.create({
				data: {
					parentItemId: data.parentItemId,
					description: data.description,
					disabled: data.disabled ?? false,
					bundleItems: {
						create: formatProductBundleItems(data.bundleItems),
					},
				},
				include: {
					parentItem: {
						select: { id: true, name: true },
					},
					bundleItems: {
						include: {
							item: {
								select: { id: true, name: true },
							},
							unitOfMeasurement: {
								select: { id: true, name: true },
							},
						},
					},
				},
			});

			return toInventoryProductBundle(created);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					"Duplicate bundle item found in this product bundle",
				);
			}
			throw error;
		}
	}

	/**
	 * Update a product bundle
	 */
	async updateProductBundle(
		data: z.infer<typeof Inventory.updateProductBundleSchema>,
	): Promise<Inventory.ProductBundle> {
		const { id, bundleItems, ...rest } = data;

		const existing = await this.prisma.productBundle.findUnique({
			where: { id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Product bundle with ID ${id} not found`);
		}

		if (rest.parentItemId) {
			const parentExists = await this.prisma.item.findUnique({
				where: { id: rest.parentItemId },
				select: { id: true },
			});
			if (!parentExists) {
				throw new NotFoundException(
					`Parent item with ID ${rest.parentItemId} not found`,
				);
			}
		}

		if (bundleItems && bundleItems.length > 0) {
			const requestedItemIds = [
				...new Set(bundleItems.map((item) => item.itemId)),
			];
			const existingItems = await this.prisma.item.findMany({
				where: { id: { in: requestedItemIds } },
				select: { id: true },
			});
			const existingItemSet = new Set(existingItems.map((item) => item.id));
			const missingItemId = requestedItemIds.find(
				(itemId) => !existingItemSet.has(itemId),
			);
			if (missingItemId) {
				throw new NotFoundException(
					`Bundle item with ID ${missingItemId} not found`,
				);
			}
		}

		const updated = await this.prisma.productBundle.update({
			where: { id },
			data: {
				...removeUndefined(rest),
				bundleItems:
					bundleItems !== undefined
						? {
								deleteMany: {},
								create: formatProductBundleItems(bundleItems),
							}
						: undefined,
			},
			include: {
				parentItem: {
					select: { id: true, name: true },
				},
				bundleItems: {
					include: {
						item: {
							select: { id: true, name: true },
						},
						unitOfMeasurement: {
							select: { id: true, name: true },
						},
					},
				},
			},
		});

		return toInventoryProductBundle(updated);
	}

	/**
	 * Delete a product bundle
	 */
	async deleteProductBundle(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.productBundle.delete({ where: { id } });
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Product bundle with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Get all shipping rules
	 */
	async findAllShippingRules(): Promise<Inventory.ShippingRule[]> {
		const rules = await this.prisma.shippingRule.findMany({
			orderBy: { createdAt: "desc" },
		});

		return rules.map(toInventoryShippingRule);
	}

	/**
	 * Get a single shipping rule by id
	 */
	async findShippingRuleById(
		id: string,
	): Promise<Inventory.ShippingRule | null> {
		const rule = await this.prisma.shippingRule.findUnique({
			where: { id },
		});

		return rule ? toInventoryShippingRule(rule) : null;
	}

	/**
	 * Create a shipping rule
	 */
	async createShippingRule(
		data: z.infer<typeof Inventory.createShippingRuleSchema>,
	): Promise<Inventory.ShippingRule> {
		const duplicate = await this.prisma.shippingRule.findFirst({
			where: {
				shippingRuleLabel: {
					equals: data.shippingRuleLabel,
					mode: "insensitive",
				},
			},
			select: { id: true },
		});
		if (duplicate) {
			throw new ConflictException(
				`Shipping rule with label "${data.shippingRuleLabel}" already exists`,
			);
		}

		try {
			const created = await this.prisma.shippingRule.create({
				data: {
					shippingRuleLabel: data.shippingRuleLabel,
					shippingRuleType: data.shippingRuleType,
					disabled: data.disabled ?? false,
					calculateBasedOn: data.calculateBasedOn,
					shippingAmount: data.shippingAmount ?? 0,
				},
			});

			return toInventoryShippingRule(created);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					`Shipping rule with label "${data.shippingRuleLabel}" already exists`,
				);
			}
			throw error;
		}
	}

	/**
	 * Update a shipping rule
	 */
	async updateShippingRule(
		data: z.infer<typeof Inventory.updateShippingRuleSchema>,
	): Promise<Inventory.ShippingRule> {
		const { id, ...rest } = data;

		if (rest.shippingRuleLabel !== undefined) {
			const duplicate = await this.prisma.shippingRule.findFirst({
				where: {
					id: { not: id },
					shippingRuleLabel: {
						equals: rest.shippingRuleLabel,
						mode: "insensitive",
					},
				},
				select: { id: true },
			});

			if (duplicate) {
				throw new ConflictException(
					`Shipping rule with label "${rest.shippingRuleLabel}" already exists`,
				);
			}
		}

		try {
			const updated = await this.prisma.shippingRule.update({
				where: { id },
				data: removeUndefined(rest),
			});

			return toInventoryShippingRule(updated);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Shipping rule with ID ${id} not found`);
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					`Shipping rule with label "${rest.shippingRuleLabel}" already exists`,
				);
			}
			throw error;
		}
	}

	/**
	 * Delete a shipping rule
	 */
	async deleteShippingRule(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.shippingRule.delete({ where: { id } });
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Shipping rule with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Get all item manufacturers
	 */
	async findAllItemManufacturers(): Promise<Inventory.ItemManufacturer[]> {
		const manufacturers = await this.prisma.itemManufacturer.findMany({
			orderBy: { createdAt: "desc" },
			include: itemManufacturerInclude,
		});

		return manufacturers.map(toInventoryItemManufacturer);
	}

	/**
	 * Get a single item manufacturer by id
	 */
	async findItemManufacturerById(
		id: string,
	): Promise<Inventory.ItemManufacturer | null> {
		const manufacturer = await this.prisma.itemManufacturer.findUnique({
			where: { id },
			include: itemManufacturerInclude,
		});

		return manufacturer ? toInventoryItemManufacturer(manufacturer) : null;
	}

	/**
	 * Create an item manufacturer mapping
	 */
	async createItemManufacturer(
		data: z.infer<typeof Inventory.createItemManufacturerSchema>,
	): Promise<Inventory.ItemManufacturer> {
		await this.ensureItemsExist([data.itemId]);

		try {
			const created = await this.prisma.$transaction(async (tx) => {
				if (data.isDefault) {
					await tx.itemManufacturer.updateMany({
						where: {
							itemId: data.itemId,
							isDefault: true,
						},
						data: {
							isDefault: false,
						},
					});
				}

				return tx.itemManufacturer.create({
					data: {
						itemId: data.itemId,
						manufacturer: data.manufacturer,
						manufacturerPartNumber: data.manufacturerPartNumber,
						isDefault: data.isDefault ?? false,
					},
					include: itemManufacturerInclude,
				});
			});

			return toInventoryItemManufacturer(created);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				if (isDefaultItemManufacturerConstraintViolation(error)) {
					throw new ConflictException(
						"An item can only have one default manufacturer",
					);
				}
				throw new ConflictException("Item manufacturer already exists");
			}
			throw error;
		}
	}

	/**
	 * Update an item manufacturer mapping
	 */
	async updateItemManufacturer(
		data: z.infer<typeof Inventory.updateItemManufacturerSchema>,
	): Promise<Inventory.ItemManufacturer> {
		const { id, ...rest } = data;
		const existing = await this.prisma.itemManufacturer.findUnique({
			where: { id },
			select: { id: true, itemId: true, isDefault: true },
		});

		if (!existing) {
			throw new NotFoundException(`Item manufacturer with ID ${id} not found`);
		}

		if (rest.itemId) {
			await this.ensureItemsExist([rest.itemId]);
		}

		const nextItemId = rest.itemId ?? existing.itemId;
		const nextIsDefault = rest.isDefault ?? existing.isDefault;

		try {
			const updated = await this.prisma.$transaction(async (tx) => {
				if (nextIsDefault) {
					await tx.itemManufacturer.updateMany({
						where: {
							itemId: nextItemId,
							isDefault: true,
							id: { not: id },
						},
						data: {
							isDefault: false,
						},
					});
				}

				return tx.itemManufacturer.update({
					where: { id },
					data: removeUndefined(rest),
					include: itemManufacturerInclude,
				});
			});

			return toInventoryItemManufacturer(updated);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(
					`Item manufacturer with ID ${id} not found`,
				);
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				if (isDefaultItemManufacturerConstraintViolation(error)) {
					throw new ConflictException(
						"An item can only have one default manufacturer",
					);
				}
				throw new ConflictException("Item manufacturer already exists");
			}
			throw error;
		}
	}

	/**
	 * Delete an item manufacturer mapping
	 */
	async deleteItemManufacturer(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.itemManufacturer.delete({
				where: { id },
			});
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(
					`Item manufacturer with ID ${id} not found`,
				);
			}
			throw error;
		}
	}

	private async ensureItemsExist(itemIds: string[]): Promise<void> {
		const uniqueIds = [...new Set(itemIds)];
		const existingItems = await this.prisma.item.findMany({
			where: { id: { in: uniqueIds } },
			select: { id: true },
		});
		const existingIds = new Set(existingItems.map((item) => item.id));
		const missingItemId = uniqueIds.find((itemId) => !existingIds.has(itemId));

		if (missingItemId) {
			throw new NotFoundException(`Item with ID ${missingItemId} not found`);
		}
	}

	/**
	 * Get all item alternatives
	 */
	async findAllItemAlternatives(): Promise<Inventory.ItemAlternative[]> {
		const alternatives = await this.prisma.itemAlternate.findMany({
			orderBy: { createdAt: "desc" },
			include: itemAlternativeInclude,
		});

		const groupedAlternatives = new Map<
			string,
			{
				canonical?: (typeof alternatives)[number];
				reverse?: (typeof alternatives)[number];
			}
		>();

		for (const alternative of alternatives) {
			const [firstItemId, secondItemId] = [
				alternative.itemId,
				alternative.alternateItemId,
			].sort();
			const key = `${firstItemId}:${secondItemId}`;
			const existingGroup = groupedAlternatives.get(key) ?? {};
			const isCanonicalDirection =
				alternative.itemId === firstItemId &&
				alternative.alternateItemId === secondItemId;

			if (isCanonicalDirection) {
				existingGroup.canonical = alternative;
			} else {
				existingGroup.reverse = alternative;
			}

			groupedAlternatives.set(key, existingGroup);
		}

		const deduplicated: Inventory.ItemAlternative[] = [];
		for (const group of groupedAlternatives.values()) {
			const canonical = group.canonical ?? group.reverse;
			if (!canonical) {
				continue;
			}

			deduplicated.push({
				...toInventoryItemAlternative(canonical),
				twoWay: Boolean(group.canonical && group.reverse),
			});
		}

		return deduplicated;
	}

	/**
	 * Get a single item alternative by id
	 */
	async findItemAlternativeById(
		id: string,
	): Promise<Inventory.ItemAlternative | null> {
		const alternative = await this.prisma.itemAlternate.findUnique({
			where: { id },
			include: itemAlternativeInclude,
		});

		if (!alternative) {
			return null;
		}

		const reverseAlternative = await this.prisma.itemAlternate.findUnique({
			where: {
				itemId_alternateItemId: {
					itemId: alternative.alternateItemId,
					alternateItemId: alternative.itemId,
				},
			},
			select: { id: true },
		});

		return {
			...toInventoryItemAlternative(alternative),
			twoWay: Boolean(reverseAlternative),
		};
	}

	/**
	 * Create a new item alternative
	 */
	async createItemAlternative(
		data: z.infer<typeof Inventory.createItemAlternativeSchema>,
	): Promise<Inventory.ItemAlternative> {
		if (data.itemId === data.alternativeItemId) {
			throw new BadRequestException(
				"Item and alternative item must be different",
			);
		}

		await this.ensureItemsExist([data.itemId, data.alternativeItemId]);

		const existing = await this.prisma.itemAlternate.findUnique({
			where: {
				itemId_alternateItemId: {
					itemId: data.itemId,
					alternateItemId: data.alternativeItemId,
				},
			},
			select: { id: true },
		});

		if (existing) {
			throw new ConflictException("Item alternative already exists");
		}

		try {
			const created = await this.prisma.$transaction(async (tx) => {
				const createdAlternative = await tx.itemAlternate.create({
					data: {
						itemId: data.itemId,
						alternateItemId: data.alternativeItemId,
					},
					include: itemAlternativeInclude,
				});

				if (data.twoWay) {
					await tx.itemAlternate.upsert({
						where: {
							itemId_alternateItemId: {
								itemId: data.alternativeItemId,
								alternateItemId: data.itemId,
							},
						},
						update: {},
						create: {
							itemId: data.alternativeItemId,
							alternateItemId: data.itemId,
						},
					});
				}

				const reverseAlternative = await tx.itemAlternate.findUnique({
					where: {
						itemId_alternateItemId: {
							itemId: data.alternativeItemId,
							alternateItemId: data.itemId,
						},
					},
					select: { id: true },
				});

				return {
					createdAlternative,
					twoWay: Boolean(reverseAlternative),
				};
			});

			return {
				...toInventoryItemAlternative(created.createdAlternative),
				twoWay: created.twoWay,
			};
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException("Item alternative already exists");
			}
			throw error;
		}
	}

	/**
	 * Update an existing item alternative
	 */
	async updateItemAlternative(
		data: z.infer<typeof Inventory.updateItemAlternativeSchema>,
	): Promise<Inventory.ItemAlternative> {
		const { id, ...rest } = data;
		const existing = await this.prisma.itemAlternate.findUnique({
			where: { id },
			select: {
				id: true,
				itemId: true,
				alternateItemId: true,
			},
		});

		if (!existing) {
			throw new NotFoundException(`Item alternative with ID ${id} not found`);
		}

		const nextItemId = rest.itemId ?? existing.itemId;
		const nextAlternativeItemId =
			rest.alternativeItemId ?? existing.alternateItemId;

		if (nextItemId === nextAlternativeItemId) {
			throw new BadRequestException(
				"Item and alternative item must be different",
			);
		}

		await this.ensureItemsExist([nextItemId, nextAlternativeItemId]);

		const duplicate = await this.prisma.itemAlternate.findUnique({
			where: {
				itemId_alternateItemId: {
					itemId: nextItemId,
					alternateItemId: nextAlternativeItemId,
				},
			},
			select: { id: true },
		});

		if (duplicate && duplicate.id !== id) {
			throw new ConflictException("Item alternative already exists");
		}

		try {
			const updated = await this.prisma.$transaction(async (tx) => {
				const pairChanged =
					existing.itemId !== nextItemId ||
					existing.alternateItemId !== nextAlternativeItemId;

				if (pairChanged) {
					await tx.itemAlternate.deleteMany({
						where: {
							itemId: existing.alternateItemId,
							alternateItemId: existing.itemId,
						},
					});
				}

				const updatedAlternative = await tx.itemAlternate.update({
					where: { id },
					data: {
						itemId: nextItemId,
						alternateItemId: nextAlternativeItemId,
					},
					include: itemAlternativeInclude,
				});

				if (rest.twoWay === true) {
					await tx.itemAlternate.upsert({
						where: {
							itemId_alternateItemId: {
								itemId: nextAlternativeItemId,
								alternateItemId: nextItemId,
							},
						},
						update: {},
						create: {
							itemId: nextAlternativeItemId,
							alternateItemId: nextItemId,
						},
					});
				}

				if (rest.twoWay === false) {
					await tx.itemAlternate.deleteMany({
						where: {
							itemId: nextAlternativeItemId,
							alternateItemId: nextItemId,
						},
					});
				}

				return updatedAlternative;
			});

			const reverseAlternative = await this.prisma.itemAlternate.findUnique({
				where: {
					itemId_alternateItemId: {
						itemId: updated.alternateItemId,
						alternateItemId: updated.itemId,
					},
				},
				select: { id: true },
			});

			return {
				...toInventoryItemAlternative(updated),
				twoWay: Boolean(reverseAlternative),
			};
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Item alternative with ID ${id} not found`);
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException("Item alternative already exists");
			}
			throw error;
		}
	}

	/**
	 * Delete an item alternative
	 */
	async deleteItemAlternative(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.$transaction(async (tx) => {
				const existing = await tx.itemAlternate.findUnique({
					where: { id },
					select: { itemId: true, alternateItemId: true },
				});

				if (!existing) {
					throw new NotFoundException(
						`Item alternative with ID ${id} not found`,
					);
				}

				await tx.itemAlternate.deleteMany({
					where: {
						OR: [
							{
								itemId: existing.itemId,
								alternateItemId: existing.alternateItemId,
							},
							{
								itemId: existing.alternateItemId,
								alternateItemId: existing.itemId,
							},
						],
					},
				});
			});

			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Item alternative with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Create a new item group
	 */
	async createGroup(
		data: Inventory.CreateGroupInput,
	): Promise<Inventory.ItemGroup> {
		const defaultsPayload = formatItemGroupDefaults(data.defaults);

		const created = await this.prisma.itemGroup.create({
			data: {
				groupName: data.groupName,
				parentId: data.parentId,
				isGroup: data.isGroup,
				defaults: defaultsPayload ? { create: defaultsPayload } : undefined,
			},
			include: {
				parentItemGroup: {
					select: { groupName: true },
				},
				defaults: true,
			},
		});

		return toInventoryItemGroup(created);
	}

	/**
	 * Update an item group
	 */
	async updateGroup(
		data: Inventory.UpdateGroupInput,
	): Promise<Inventory.ItemGroup> {
		const { defaults, ...rest } = data;
		const defaultsPayload = formatItemGroupDefaults(defaults);

		const updated = await this.prisma.itemGroup.update({
			where: { id: data.id },
			data: {
				...(rest.groupName !== undefined && { groupName: rest.groupName }),
				...(rest.parentId !== undefined && { parentId: rest.parentId }),
				...(rest.isGroup !== undefined && { isGroup: rest.isGroup }),
				...(defaultsPayload !== undefined && {
					defaults: {
						deleteMany: {},
						create: defaultsPayload,
					},
				}),
			},
			include: {
				parentItemGroup: {
					select: { groupName: true },
				},
				defaults: true,
			},
		});

		return toInventoryItemGroup(updated);
	}

	/**
	 * Delete an item group
	 */
	async deleteGroup(id: string): Promise<{ success: boolean; id: string }> {
		await this.prisma.itemGroup.delete({
			where: { id },
		});
		return { success: true, id };
	}

	/**
	 * Create a new inventory item
	 */
	async create(
		data: z.infer<typeof Inventory.createSchema>,
	): Promise<Inventory.Item> {
		try {
			const { barcodes, reorderSettings, ...rest } = data;
			const sanitizedRest = removeUndefined(rest) as typeof rest;
			const { itemGroupId, defaultUnitOfMeasureId, ...prismaFields } =
				sanitizedRest;
			const createRelationPayload = {
				...(itemGroupId ? { itemGroup: { connect: { id: itemGroupId } } } : {}),
				...(defaultUnitOfMeasureId
					? {
							defaultUnitOfMeasure: {
								connect: { id: defaultUnitOfMeasureId },
							},
						}
					: {}),
			};

			const created = await this.prisma.inventoryItem.create({
				data: {
					...prismaFields,
					...createRelationPayload,
					barcodes: barcodes
						? {
								create: formatBarcodes(barcodes),
							}
						: undefined,
					reorderSettings: reorderSettings
						? {
								create: formatReorderSettings(reorderSettings),
							}
						: undefined,
				},
				include: {
					itemGroup: true,
					barcodes: true,
					reorderSettings: true,
				},
			});

			return toInventoryItem(created);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					`Item with code ${data.code} already exists`,
				);
			}
			throw error;
		}
	}

	/**
	 * Update an existing inventory item
	 */
	async update(
		data: z.infer<typeof Inventory.updateSchema>,
	): Promise<Inventory.Item> {
		const { id, barcodes, reorderSettings, ...rest } = data;
		const sanitizedRest = removeUndefined(rest) as typeof rest;
		const { itemGroupId, defaultUnitOfMeasureId, ...prismaFields } =
			sanitizedRest;
		const updateRelationPayload = {
			...(itemGroupId ? { itemGroup: { connect: { id: itemGroupId } } } : {}),
			...(defaultUnitOfMeasureId
				? {
						defaultUnitOfMeasure: {
							connect: { id: defaultUnitOfMeasureId },
						},
					}
				: {}),
		};

		// Check if item exists
		const existing = await this.prisma.inventoryItem.findUnique({
			where: { id },
		});

		if (!existing) {
			throw new NotFoundException(`Item with ID ${id} not found`);
		}

		// Update the item
		const updated = await this.prisma.inventoryItem.update({
			where: { id },
			data: {
				...prismaFields,
				...updateRelationPayload,
				barcodes:
					barcodes !== undefined
						? {
								deleteMany: {},
								create: formatBarcodes(barcodes),
							}
						: undefined,
				reorderSettings:
					reorderSettings !== undefined
						? {
								deleteMany: {},
								create: formatReorderSettings(reorderSettings),
							}
						: undefined,
			},
			include: {
				itemGroup: true,
				barcodes: true,
				reorderSettings: true,
			},
		});

		return toInventoryItem(updated);
	}

	/**
	 * Delete an inventory item
	 */
	async delete(id: string): Promise<Inventory.Item> {
		try {
			const deleted = await this.prisma.inventoryItem.delete({
				where: { id },
				include: {
					itemGroup: true,
					barcodes: true,
					reorderSettings: true,
				},
			});

			return toInventoryItem(deleted);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Item with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Delete multiple inventory items
	 */
	async deleteMany(ids: string[]): Promise<{
		success: boolean;
		count: number;
		ids: string[];
		missingIds: string[];
	}> {
		return this.prisma.$transaction(async (tx) => {
			const uniqueIds = [...new Set(ids)];
			const items = await tx.inventoryItem.findMany({
				where: {
					id: {
						in: uniqueIds,
					},
				},
				select: { id: true },
			});

			const deletedIds = items.map((item) => item.id);
			const deletedSet = new Set(deletedIds);
			const missingIds = uniqueIds.filter((id) => !deletedSet.has(id));

			if (deletedIds.length === 0) {
				return { success: true, count: 0, ids: [], missingIds };
			}

			await tx.inventoryItem.deleteMany({
				where: {
					id: {
						in: deletedIds,
					},
				},
			});

			return {
				success: true,
				count: deletedIds.length,
				ids: deletedIds,
				missingIds,
			};
		});
	}

	// ============================================================================
	// Material Request Methods
	// ============================================================================

	/**
	 * Generate a series number for a new Material Request
	 * Format: MAT-MR-YYYY-NNNNN
	 */
	private async generateMaterialRequestSeries(date: Date): Promise<string> {
		const year = date.getFullYear();
		const prefix = `MAT-MR-${year}-`;

		const lastRequest = await this.prisma.materialRequest.findFirst({
			where: {
				series: { startsWith: prefix },
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		let nextNumber = 1;
		if (lastRequest) {
			const numStr = lastRequest.series.slice(prefix.length);
			const num = parseInt(numStr, 10);
			if (!Number.isNaN(num)) {
				nextNumber = num + 1;
			}
		}

		return `${prefix}${String(nextNumber).padStart(5, "0")}`;
	}

	/**
	 * Get all material requests
	 */
	async findAllMaterialRequests(): Promise<Inventory.MaterialRequest[]> {
		const requests = await this.prisma.materialRequest.findMany({
			orderBy: { createdAt: "desc" },
			include: { items: true },
			take: 250,
		});
		return requests.map(toInventoryMaterialRequest);
	}

	/**
	 * Get a single material request by id
	 */
	async findMaterialRequestById(
		id: string,
	): Promise<Inventory.MaterialRequest | null> {
		const request = await this.prisma.materialRequest.findUnique({
			where: { id },
			include: { items: true },
		});
		return request ? toInventoryMaterialRequest(request) : null;
	}

	/**
	 * Create a new material request.
	 * Retries up to 3 times on a series uniqueness conflict (P2002) to handle
	 * concurrent requests that may generate the same series number.
	 */
	async createMaterialRequest(
		data: Inventory.CreateMaterialRequestInput,
	): Promise<Inventory.MaterialRequest> {
		const transactionDate = data.transactionDate ?? new Date();

		for (let attempt = 0; attempt < 3; attempt++) {
			const series = await this.generateMaterialRequestSeries(transactionDate);
			try {
				const created = await this.prisma.materialRequest.create({
					data: {
						series,
						transactionDate,
						purpose: data.purpose ?? "PURCHASE",
						company: data.company,
						requiredBy: data.requiredBy,
						status: "DRAFT",
						targetWarehouse: data.targetWarehouse,
						terms: data.terms,
						termsContent: data.termsContent,
						letterHead: data.letterHead,
						printHeading: data.printHeading,
						items: {
							create: data.items.map((item) => ({
								itemCode: item.itemCode,
								itemName: item.itemName,
								requiredBy: item.requiredBy,
								quantity: item.quantity,
								targetWarehouse: item.targetWarehouse,
								unitOfMeasure: item.unitOfMeasure,
							})),
						},
					},
					include: { items: true },
				});
				return toInventoryMaterialRequest(created);
			} catch (error) {
				const isSeriesConflict =
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002";
				if (isSeriesConflict && attempt < 2) {
					continue;
				}
				throw error;
			}
		}
		// Unreachable — the loop always returns or throws.
		throw new Error("Failed to allocate a unique series number");
	}

	/**
	 * Update an existing material request.
	 * Items are upserted: existing items (matched by id) are updated in-place,
	 * preserving orderedQty / receivedQty. New items (no id) are created.
	 * Items absent from the payload are deleted. All mutations run in a
	 * single transaction.
	 */
	async updateMaterialRequest(
		data: Inventory.UpdateMaterialRequestInput,
	): Promise<Inventory.MaterialRequest> {
		const { id, items, ...rest } = data;

		const existing = await this.prisma.materialRequest.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!existing) {
			throw new NotFoundException(`Material request with ID ${id} not found`);
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			await tx.materialRequest.update({
				where: { id },
				data: {
					...(rest.transactionDate !== undefined && {
						transactionDate: rest.transactionDate,
					}),
					...(rest.purpose !== undefined && { purpose: rest.purpose }),
					...(rest.company !== undefined && { company: rest.company }),
					...(rest.requiredBy !== undefined && {
						requiredBy: rest.requiredBy,
					}),
					...(rest.status !== undefined && { status: rest.status }),
					...(rest.targetWarehouse !== undefined && {
						targetWarehouse: rest.targetWarehouse,
					}),
					...(rest.terms !== undefined && { terms: rest.terms }),
					...(rest.termsContent !== undefined && {
						termsContent: rest.termsContent,
					}),
					...(rest.letterHead !== undefined && {
						letterHead: rest.letterHead,
					}),
					...(rest.printHeading !== undefined && {
						printHeading: rest.printHeading,
					}),
				},
			});

			if (items !== undefined) {
				const keptIds = items
					.filter((i): i is typeof i & { id: string } => Boolean(i.id))
					.map((i) => i.id);

				if (keptIds.length > 0) {
					const ownedItems = await tx.materialRequestItem.findMany({
						where: {
							id: { in: keptIds },
							materialRequestId: id,
						},
						select: { id: true },
					});
					const ownedIds = new Set(ownedItems.map((item) => item.id));
					const foreignItemId = keptIds.find((itemId) => !ownedIds.has(itemId));
					if (foreignItemId) {
						throw new BadRequestException(
							`Material request item with ID ${foreignItemId} does not belong to material request ${id}`,
						);
					}
				}

				// Delete items that are no longer present in the payload
				await tx.materialRequestItem.deleteMany({
					where: {
						materialRequestId: id,
						...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
					},
				});

				// Update existing items in-place (preserves orderedQty / receivedQty)
				// and create new items (no id supplied)
				for (const item of items) {
					if (item.id) {
						await tx.materialRequestItem.update({
							where: { id: item.id },
							data: {
								itemCode: item.itemCode,
								itemName: item.itemName,
								requiredBy: item.requiredBy,
								quantity: item.quantity,
								targetWarehouse: item.targetWarehouse,
								unitOfMeasure: item.unitOfMeasure,
							},
						});
					} else {
						await tx.materialRequestItem.create({
							data: {
								materialRequestId: id,
								itemCode: item.itemCode,
								itemName: item.itemName,
								requiredBy: item.requiredBy,
								quantity: item.quantity,
								targetWarehouse: item.targetWarehouse,
								unitOfMeasure: item.unitOfMeasure,
							},
						});
					}
				}
			}

			return tx.materialRequest.findUniqueOrThrow({
				where: { id },
				include: { items: true },
			});
		});

		return toInventoryMaterialRequest(updated);
	}

	/**
	 * Delete a material request
	 */
	async deleteMaterialRequest(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.materialRequest.delete({ where: { id } });
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Material request with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Delete multiple material requests.
	 * deleteMany silently returns count: 0 for non-existent IDs — this is
	 * intentional; callers do not need to verify each ID individually.
	 */
	async deleteManyMaterialRequests(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const uniqueIds = [...new Set(ids)];
		try {
			const result = await this.prisma.materialRequest.deleteMany({
				where: { id: { in: uniqueIds } },
			});
			return { success: true, count: result.count, ids: uniqueIds };
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				this.logger.error(
					`Bulk delete material requests failed [${error.code}]`,
					error.stack,
				);
			}
			throw error;
		}
	}

	// ============================================================================
	// Stock Entry Methods
	// ============================================================================

	/**
	 * Generate a unique series number for a new Stock Entry.
	 * Format: MAT-STE-YYYY-NNNNN.
	 * This is not atomic on its own — the caller retries on P2002 conflicts.
	 */
	private async generateStockEntrySeries(date: Date): Promise<string> {
		const year = date.getFullYear();
		const prefix = `MAT-STE-${year}-`;

		const lastEntry = await this.prisma.stockEntry.findFirst({
			where: {
				series: { startsWith: prefix },
			},
			orderBy: { createdAt: "desc" },
			select: { series: true },
		});

		let nextNumber = 1;
		if (lastEntry) {
			const numStr = lastEntry.series.slice(prefix.length);
			const num = parseInt(numStr, 10);
			if (!Number.isNaN(num)) {
				nextNumber = num + 1;
			}
		}

		return `${prefix}${String(nextNumber).padStart(5, "0")}`;
	}

	/**
	 * Get all stock entries (bounded to 250 most recent).
	 */
	async findAllStockEntries(): Promise<Inventory.StockEntry[]> {
		const entries = await this.prisma.stockEntry.findMany({
			orderBy: { createdAt: "desc" },
			include: { items: true },
			take: 250,
		});
		return entries.map(toInventoryStockEntry);
	}

	/**
	 * Get a single stock entry by id.
	 */
	async findStockEntryById(id: string): Promise<Inventory.StockEntry | null> {
		const entry = await this.prisma.stockEntry.findUnique({
			where: { id },
			include: { items: true },
		});
		return entry ? toInventoryStockEntry(entry) : null;
	}

	/**
	 * Create a new stock entry.
	 * Retries up to 3 times on a series uniqueness conflict (P2002).
	 * basicAmount is computed as qty × basicRate on creation.
	 */
	async createStockEntry(
		data: Inventory.CreateStockEntryInput,
	): Promise<Inventory.StockEntry> {
		const postingDate = data.postingDate ?? new Date();

		for (let attempt = 0; attempt < 3; attempt++) {
			const series = await this.generateStockEntrySeries(postingDate);
			try {
				const created = await this.prisma.stockEntry.create({
					data: {
						series,
						stockEntryType: data.stockEntryType,
						postingDate,
						company: data.company,
						status: "DRAFT",
						project: data.project,
						defaultSourceWarehouse: data.defaultSourceWarehouse,
						defaultTargetWarehouse: data.defaultTargetWarehouse,
						isOpening: data.isOpening ?? false,
						remarks: data.remarks,
						printHeading: data.printHeading,
						letterHead: data.letterHead,
						inspectionRequired: data.inspectionRequired ?? false,
						items: {
							create: data.items.map((item) => ({
								sourceWarehouse: item.sourceWarehouse,
								targetWarehouse: item.targetWarehouse,
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								qty: item.qty,
								basicRate: item.basicRate ?? 0,
								basicAmount: item.qty * (item.basicRate ?? 0),
								unitOfMeasure: item.unitOfMeasure,
							})),
						},
					},
					include: { items: true },
				});
				return toInventoryStockEntry(created);
			} catch (error) {
				const isSeriesConflict =
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002";
				if (isSeriesConflict && attempt < 2) {
					continue;
				}
				throw error;
			}
		}
		throw new Error("Failed to allocate a unique series number");
	}

	/**
	 * Update an existing stock entry.
	 * Items are upserted: existing items (matched by id) are updated in-place,
	 * new items (no id) are created, items absent from the payload are deleted.
	 * basicAmount is recomputed for every updated/created item.
	 * All mutations run in a single transaction.
	 */
	async updateStockEntry(
		data: Inventory.UpdateStockEntryInput,
	): Promise<Inventory.StockEntry> {
		const { id, items, ...rest } = data;

		const existing = await this.prisma.stockEntry.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!existing) {
			throw new NotFoundException(`Stock entry with ID ${id} not found`);
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			await tx.stockEntry.update({
				where: { id },
				data: {
					...(rest.stockEntryType !== undefined && {
						stockEntryType: rest.stockEntryType,
					}),
					...(rest.postingDate !== undefined && {
						postingDate: rest.postingDate,
					}),
					...(rest.company !== undefined && { company: rest.company }),
					...(rest.status !== undefined && { status: rest.status }),
					...(rest.project !== undefined && { project: rest.project }),
					...(rest.defaultSourceWarehouse !== undefined && {
						defaultSourceWarehouse: rest.defaultSourceWarehouse,
					}),
					...(rest.defaultTargetWarehouse !== undefined && {
						defaultTargetWarehouse: rest.defaultTargetWarehouse,
					}),
					...(rest.isOpening !== undefined && { isOpening: rest.isOpening }),
					...(rest.remarks !== undefined && { remarks: rest.remarks }),
					...(rest.printHeading !== undefined && {
						printHeading: rest.printHeading,
					}),
					...(rest.letterHead !== undefined && {
						letterHead: rest.letterHead,
					}),
					...(rest.inspectionRequired !== undefined && {
						inspectionRequired: rest.inspectionRequired,
					}),
				},
			});

			if (items !== undefined) {
				const keptIds = items
					.filter((i): i is typeof i & { id: string } => Boolean(i.id))
					.map((i) => i.id);

				if (keptIds.length > 0) {
					const ownedItems = await tx.stockEntryItem.findMany({
						where: {
							id: { in: keptIds },
							stockEntryId: id,
						},
						select: { id: true },
					});
					const ownedIds = new Set(ownedItems.map((item) => item.id));
					const foreignItemId = keptIds.find((itemId) => !ownedIds.has(itemId));
					if (foreignItemId) {
						throw new BadRequestException(
							`Stock entry item with ID ${foreignItemId} does not belong to stock entry ${id}`,
						);
					}
				}

				// Delete items no longer present in the payload
				if (keptIds.length === 0) {
					// No kept item IDs provided: intentionally remove all items for this stock entry
					await tx.stockEntryItem.deleteMany({
						where: {
							stockEntryId: id,
						},
					});
				} else {
					await tx.stockEntryItem.deleteMany({
						where: {
							stockEntryId: id,
							id: { notIn: keptIds },
						},
					});
				}

				// Update existing items in-place; create new items
				for (const item of items) {
					const basicRate = item.basicRate ?? 0;
					const basicAmount = item.qty * basicRate;

					if (item.id) {
						await tx.stockEntryItem.update({
							where: { id: item.id },
							data: {
								sourceWarehouse: item.sourceWarehouse,
								targetWarehouse: item.targetWarehouse,
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								qty: item.qty,
								basicRate,
								basicAmount,
								unitOfMeasure: item.unitOfMeasure,
							},
						});
					} else {
						await tx.stockEntryItem.create({
							data: {
								stockEntryId: id,
								sourceWarehouse: item.sourceWarehouse,
								targetWarehouse: item.targetWarehouse,
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								qty: item.qty,
								basicRate,
								basicAmount,
								unitOfMeasure: item.unitOfMeasure,
							},
						});
					}
				}
			}

			return tx.stockEntry.findUniqueOrThrow({
				where: { id },
				include: { items: true },
			});
		});

		return toInventoryStockEntry(updated);
	}

	/**
	 * Delete a single stock entry.
	 */
	async deleteStockEntry(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.stockEntry.delete({ where: { id } });
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Stock entry with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Delete multiple stock entries.
	 */
	async deleteManyStockEntries(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const uniqueIds = [...new Set(ids)];
		try {
			const result = await this.prisma.stockEntry.deleteMany({
				where: { id: { in: uniqueIds } },
			});
			return { success: true, count: result.count, ids: uniqueIds };
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				this.logger.error(
					`Bulk delete stock entries failed [${error.code}]`,
					error.stack,
				);
			}
			throw error;
		}
	}

	// ============================================================================
	// Installation Note Methods
	// ============================================================================

	private normalizeInstallationNoteSeriesPattern(
		seriesPattern?: string | null,
	): string {
		const raw = seriesPattern?.trim();
		if (!raw) {
			return "MAT-INS-.YYYY.-";
		}
		return raw;
	}

	private resolveInstallationNoteSeriesPrefix(
		seriesPattern: string,
		date: Date,
	): string {
		const year = String(date.getFullYear());
		let prefix = seriesPattern
			.replace(/\.YYYY\./g, year)
			.replace(/YYYY/g, year)
			.replace(/\./g, "")
			.replace(/--+/g, "-")
			.trim();

		if (!prefix.endsWith("-")) {
			prefix = `${prefix}-`;
		}

		return prefix;
	}

	private async generateInstallationNoteSeries(
		date: Date,
		seriesPattern?: string | null,
	): Promise<string> {
		const normalizedPattern =
			this.normalizeInstallationNoteSeriesPattern(seriesPattern);
		const prefix = this.resolveInstallationNoteSeriesPrefix(
			normalizedPattern,
			date,
		);

		const lastNote = await this.prisma.installationNote.findFirst({
			where: {
				series: { startsWith: prefix },
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		let nextNumber = 1;
		if (lastNote) {
			const numStr = lastNote.series.slice(prefix.length);
			const num = parseInt(numStr, 10);
			if (!Number.isNaN(num)) {
				nextNumber = num + 1;
			}
		}

		return `${prefix}${String(nextNumber).padStart(5, "0")}`;
	}

	private async validateInstallationNoteInput(
		tx: Prisma.TransactionClient,
		input: {
			company: string;
			customer: string;
			deliveryNoteId?: string | null;
			status: Inventory.InstallationNoteStatus;
			items: Array<{
				itemId: string;
				serialNoId?: string | null;
				installedQty: number;
			}>;
		},
	): Promise<{
		deliveryNote: { id: string; series: string } | null;
		serialsById: Map<
			string,
			{
				id: string;
				serialNo: string;
				itemId: string;
				company: string;
				status: Inventory.SerialNoStatus;
				deliveryNoteId: string | null;
				isDisabled: boolean;
			}
		>;
	}> {
		const itemIds = [...new Set(input.items.map((item) => item.itemId))];
		const serialIds = [
			...new Set(
				input.items
					.map((item) => item.serialNoId)
					.filter((value): value is string => Boolean(value)),
			),
		];
		const rawSerialIds = input.items
			.map((item) => item.serialNoId)
			.filter((value): value is string => Boolean(value));

		if (serialIds.length !== rawSerialIds.length) {
			throw new BadRequestException(
				"Each serial number can only appear once on an installation note",
			);
		}

		const [items, serials, deliveryNote] = await Promise.all([
			tx.inventoryItem.findMany({
				where: { id: { in: itemIds } },
				select: {
					id: true,
					code: true,
					name: true,
					hasSerialNo: true,
					disabled: true,
				},
			}),
			serialIds.length === 0
				? Promise.resolve([])
				: tx.serialNo.findMany({
						where: { id: { in: serialIds } },
						select: {
							id: true,
							serialNo: true,
							itemId: true,
							company: true,
							status: true,
							deliveryNoteId: true,
							isDisabled: true,
						},
					}),
			input.deliveryNoteId
				? tx.deliveryNote.findUnique({
						where: { id: input.deliveryNoteId },
						select: {
							id: true,
							series: true,
							customer: true,
							company: true,
						},
					})
				: Promise.resolve(null),
		]);

		const itemsById = new Map(items.map((item) => [item.id, item]));
		const serialsById = new Map(
			serials.map((serial) => [
				serial.id,
				{
					...serial,
					status: serial.status as Inventory.SerialNoStatus,
				},
			]),
		);

		if (itemsById.size !== itemIds.length) {
			const missingItemId = itemIds.find((itemId) => !itemsById.has(itemId));
			throw new BadRequestException(
				`Item with ID ${missingItemId ?? "unknown"} was not found`,
			);
		}

		if (serialsById.size !== serialIds.length) {
			const missingSerialId = serialIds.find(
				(serialId) => !serialsById.has(serialId),
			);
			throw new BadRequestException(
				`Serial number with ID ${missingSerialId ?? "unknown"} was not found`,
			);
		}

		if (input.deliveryNoteId && !deliveryNote) {
			throw new BadRequestException(
				`Delivery note with ID ${input.deliveryNoteId} was not found`,
			);
		}

		if (
			deliveryNote &&
			(deliveryNote.company !== input.company ||
				deliveryNote.customer !== input.customer)
		) {
			throw new BadRequestException(
				"Delivery note company and customer must match the installation note",
			);
		}

		for (const row of input.items) {
			const item = itemsById.get(row.itemId);
			if (!item) {
				continue;
			}

			if (item.disabled) {
				throw new BadRequestException(
					`Item ${item.code} is disabled and cannot be installed`,
				);
			}

			if (item.hasSerialNo) {
				if (!row.serialNoId) {
					throw new BadRequestException(
						`Item ${item.code} requires a serial number`,
					);
				}
				if (row.installedQty !== 1) {
					throw new BadRequestException(
						`Serialized item ${item.code} must have an installed quantity of 1`,
					);
				}
			}

			if (!row.serialNoId) {
				continue;
			}

			const serial = serialsById.get(row.serialNoId);
			if (!serial) {
				continue;
			}

			if (serial.isDisabled) {
				throw new BadRequestException(
					`Serial number ${serial.serialNo} is disabled and cannot be installed`,
				);
			}

			if (serial.itemId !== row.itemId) {
				throw new BadRequestException(
					`Serial number ${serial.serialNo} does not belong to item ${item.code}`,
				);
			}

			if (serial.company !== input.company) {
				throw new BadRequestException(
					`Serial number ${serial.serialNo} belongs to a different company`,
				);
			}

			if (
				input.deliveryNoteId &&
				serial.deliveryNoteId !== input.deliveryNoteId
			) {
				throw new BadRequestException(
					`Serial number ${serial.serialNo} is not linked to the selected delivery note`,
				);
			}

			if (input.status === "COMPLETED") {
				this.assertSerialNoStatusTransition(serial.status, "INSTALLED");
			}
		}

		return {
			deliveryNote: deliveryNote
				? { id: deliveryNote.id, series: deliveryNote.series }
				: null,
			serialsById,
		};
	}

	private async applyInstallationNoteSerialUpdates(
		tx: Prisma.TransactionClient,
		input: {
			series: string;
			remarks?: string | null;
			rows: Array<{ serialNoId?: string | null }>;
			serialsById: Map<
				string,
				{
					id: string;
					status: Inventory.SerialNoStatus;
				}
			>;
		},
	): Promise<void> {
		for (const row of input.rows) {
			if (!row.serialNoId) {
				continue;
			}

			const serial = input.serialsById.get(row.serialNoId);
			if (!serial) {
				continue;
			}

			await tx.serialNo.update({
				where: { id: row.serialNoId },
				data: {
					status: "INSTALLED",
					history: {
						create: {
							eventType: "STATUS_CHANGED",
							fromStatus: serial.status,
							toStatus: "INSTALLED",
							warehouseId: null,
							transactionLabel: this.buildSerialNoTransactionLabel({
								installationNoteSeries: input.series,
							}),
							notes: normalizeOptionalText(input.remarks) ?? null,
						},
					},
				},
			});
		}
	}

	async findInstallationNotes(
		params?: Inventory.ListInstallationNotesInput,
	): Promise<Inventory.InstallationNoteListResult> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const search = params?.search?.trim();
		const company = params?.company?.trim();
		const sortDirection = params?.sortDirection ?? "desc";

		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const whereClauses: Prisma.InstallationNoteWhereInput[] = [];

		if (search) {
			whereClauses.push({
				OR: [
					{ series: { contains: search, mode: "insensitive" } },
					{ customer: { contains: search, mode: "insensitive" } },
					{ customerName: { contains: search, mode: "insensitive" } },
					{ remarks: { contains: search, mode: "insensitive" } },
					{
						items: {
							some: {
								item: {
									is: { code: { contains: search, mode: "insensitive" } },
								},
							},
						},
					},
					{
						items: {
							some: {
								serialNo: {
									is: {
										serialNo: { contains: search, mode: "insensitive" },
									},
								},
							},
						},
					},
				],
			});
		}

		if (params?.status) {
			whereClauses.push({ status: params.status });
		}

		if (company) {
			whereClauses.push({
				company: { contains: company, mode: "insensitive" },
			});
		}

		if (params?.deliveryNoteId) {
			whereClauses.push({ deliveryNoteId: params.deliveryNoteId });
		}

		const where =
			whereClauses.length === 0
				? undefined
				: whereClauses.length === 1
					? whereClauses[0]
					: { AND: whereClauses };

		const [items, totalCount] = await this.prisma.$transaction([
			this.prisma.installationNote.findMany({
				where,
				include: installationNoteInclude,
				orderBy: this.getInstallationNoteOrderBy(params?.sortBy, sortDirection),
				skip,
				take,
			}),
			this.prisma.installationNote.count({ where }),
		]);

		return {
			items: items.map(toInventoryInstallationNote),
			totalCount,
		};
	}

	async findInstallationNoteById(
		id: string,
	): Promise<Inventory.InstallationNote | null> {
		const note = await this.prisma.installationNote.findUnique({
			where: { id },
			include: installationNoteInclude,
		});

		return note ? toInventoryInstallationNote(note) : null;
	}

	async createInstallationNote(
		data: Inventory.CreateInstallationNoteInput,
	): Promise<Inventory.InstallationNote> {
		const installationDate = data.installationDate ?? new Date();
		const seriesPattern = this.normalizeInstallationNoteSeriesPattern(
			data.seriesPattern,
		);
		const status = data.status ?? "DRAFT";

		for (let attempt = 0; attempt < 3; attempt++) {
			const series = await this.generateInstallationNoteSeries(
				installationDate,
				seriesPattern,
			);

			try {
				const created = await this.prisma.$transaction(async (tx) => {
					const validated = await this.validateInstallationNoteInput(tx, {
						company: data.company,
						customer: data.customer,
						deliveryNoteId: data.deliveryNoteId ?? null,
						status,
						items: data.items,
					});

					const createdNote = await tx.installationNote.create({
						data: {
							series,
							seriesPattern,
							installationDate,
							installationTime: data.installationTime
								? this.normalizePostingTime(
										data.installationTime,
										installationDate,
									)
								: null,
							customer: data.customer,
							customerName: normalizeOptionalText(data.customerName),
							customerAddress: normalizeOptionalText(data.customerAddress),
							contactPerson: normalizeOptionalText(data.contactPerson),
							territory: data.territory?.trim() || "All Territories",
							customerGroup: normalizeOptionalText(data.customerGroup),
							company: data.company,
							status,
							deliveryNoteId: data.deliveryNoteId ?? null,
							remarks: normalizeOptionalText(data.remarks),
							items: {
								create: data.items.map((item) => ({
									itemId: item.itemId,
									serialNoId: item.serialNoId ?? null,
									description: normalizeOptionalText(item.description),
									installedQty: item.installedQty,
								})),
							},
						},
						include: installationNoteInclude,
					});

					if (status === "COMPLETED") {
						await this.applyInstallationNoteSerialUpdates(tx, {
							series,
							remarks: data.remarks,
							rows: data.items,
							serialsById: validated.serialsById,
						});
					}

					return createdNote;
				});

				return toInventoryInstallationNote(created);
			} catch (error) {
				const isSeriesConflict =
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002";
				if (isSeriesConflict && attempt < 2) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.computeBackoffMs(attempt)),
					);
					continue;
				}
				throw error;
			}
		}

		throw new Error("Failed to allocate a unique installation note series");
	}

	async updateInstallationNote(
		data: Inventory.UpdateInstallationNoteInput,
	): Promise<Inventory.InstallationNote> {
		const existing = await this.prisma.installationNote.findUnique({
			where: { id: data.id },
			include: {
				items: true,
			},
		});

		if (!existing) {
			throw new NotFoundException(
				`Installation note with ID ${data.id} not found`,
			);
		}

		if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
			throw new BadRequestException(
				"Completed or cancelled installation notes cannot be modified",
			);
		}

		const nextStatus =
			data.status ?? (existing.status as Inventory.InstallationNoteStatus);
		this.assertInstallationNoteStatusTransition(
			existing.status as Inventory.InstallationNoteStatus,
			nextStatus,
		);

		const nextItems =
			data.items ??
			existing.items.map((item) => ({
				id: item.id,
				itemId: item.itemId,
				serialNoId: item.serialNoId,
				description: item.description,
				installedQty: item.installedQty,
			}));

		const updated = await this.prisma.$transaction(async (tx) => {
			const validated = await this.validateInstallationNoteInput(tx, {
				company: data.company ?? existing.company,
				customer: data.customer ?? existing.customer,
				deliveryNoteId:
					data.deliveryNoteId !== undefined
						? data.deliveryNoteId
						: existing.deliveryNoteId,
				status: nextStatus,
				items: nextItems.map((item) => ({
					itemId: item.itemId,
					serialNoId: item.serialNoId ?? null,
					installedQty: item.installedQty,
				})),
			});

			await tx.installationNote.update({
				where: { id: data.id },
				data: {
					...(data.installationDate !== undefined && {
						installationDate: data.installationDate,
					}),
					...(data.installationTime !== undefined && {
						installationTime: data.installationTime
							? this.normalizePostingTime(
									data.installationTime,
									data.installationDate ?? existing.installationDate,
								)
							: null,
					}),
					...(data.customer !== undefined && { customer: data.customer }),
					...(data.customerName !== undefined && {
						customerName: normalizeOptionalText(data.customerName),
					}),
					...(data.customerAddress !== undefined && {
						customerAddress: normalizeOptionalText(data.customerAddress),
					}),
					...(data.contactPerson !== undefined && {
						contactPerson: normalizeOptionalText(data.contactPerson),
					}),
					...(data.territory !== undefined && { territory: data.territory }),
					...(data.customerGroup !== undefined && {
						customerGroup: normalizeOptionalText(data.customerGroup),
					}),
					...(data.company !== undefined && { company: data.company }),
					...(data.status !== undefined && { status: data.status }),
					...(data.deliveryNoteId !== undefined && {
						deliveryNoteId: data.deliveryNoteId,
					}),
					...(data.remarks !== undefined && {
						remarks: normalizeOptionalText(data.remarks),
					}),
				},
			});

			if (data.items !== undefined) {
				const keptIds = data.items
					.filter((item): item is typeof item & { id: string } =>
						Boolean(item.id),
					)
					.map((item) => item.id);

				if (keptIds.length > 0) {
					const ownedItems = await tx.installationNoteItem.findMany({
						where: {
							id: { in: keptIds },
							installationNoteId: data.id,
						},
						select: { id: true },
					});
					const ownedIds = new Set(ownedItems.map((item) => item.id));
					const foreignItemId = keptIds.find((itemId) => !ownedIds.has(itemId));
					if (foreignItemId) {
						throw new BadRequestException(
							`Installation note item with ID ${foreignItemId} does not belong to installation note ${data.id}`,
						);
					}
				}

				if (keptIds.length === 0) {
					await tx.installationNoteItem.deleteMany({
						where: { installationNoteId: data.id },
					});
				} else {
					await tx.installationNoteItem.deleteMany({
						where: {
							installationNoteId: data.id,
							id: { notIn: keptIds },
						},
					});
				}

				for (const item of data.items) {
					if (item.id) {
						await tx.installationNoteItem.update({
							where: { id: item.id },
							data: {
								itemId: item.itemId,
								serialNoId: item.serialNoId ?? null,
								description: normalizeOptionalText(item.description),
								installedQty: item.installedQty,
							},
						});
						continue;
					}

					await tx.installationNoteItem.create({
						data: {
							installationNoteId: data.id,
							itemId: item.itemId,
							serialNoId: item.serialNoId ?? null,
							description: normalizeOptionalText(item.description),
							installedQty: item.installedQty,
						},
					});
				}
			}

			if (nextStatus === "COMPLETED") {
				await this.applyInstallationNoteSerialUpdates(tx, {
					series: existing.series,
					remarks: data.remarks !== undefined ? data.remarks : existing.remarks,
					rows: nextItems,
					serialsById: validated.serialsById,
				});
			}

			const note = await tx.installationNote.findUnique({
				where: { id: data.id },
				include: installationNoteInclude,
			});

			if (!note) {
				throw new NotFoundException(
					`Installation note with ID ${data.id} not found`,
				);
			}

			return note;
		});

		return toInventoryInstallationNote(updated);
	}

	async deleteInstallationNote(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.installationNote.findUnique({
			where: { id },
			select: {
				id: true,
				status: true,
			},
		});

		if (!existing) {
			throw new NotFoundException(`Installation note with ID ${id} not found`);
		}

		if (existing.status !== "DRAFT") {
			throw new BadRequestException(
				"Only draft installation notes can be deleted",
			);
		}

		await this.prisma.installationNote.delete({
			where: { id },
		});

		return { success: true, id };
	}

	// ============================================================================
	// Delivery Note Methods
	// ============================================================================

	/**
	 * Generate a unique series number for a new Delivery Note.
	 * Format: MAT-DN-YYYY-NNNNN.
	 * Not atomic on its own — the caller retries on P2002 conflicts.
	 */
	private async generateDeliveryNoteSeries(date: Date): Promise<string> {
		const year = date.getFullYear();
		const prefix = `MAT-DN-${year}-`;

		const lastEntry = await this.prisma.deliveryNote.findFirst({
			where: {
				series: { startsWith: prefix },
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		let nextNumber = 1;
		if (lastEntry) {
			const numStr = lastEntry.series.slice(prefix.length);
			const num = parseInt(numStr, 10);
			if (!Number.isNaN(num)) {
				nextNumber = num + 1;
			}
		}

		return `${prefix}${String(nextNumber).padStart(5, "0")}`;
	}

	/**
	 * Compute the Delivery Note Trends report.
	 *
	 * Groups submitted delivery note items by a chosen dimension (Item, Item
	 * Group, Customer, or Project) and aggregates qty / amount per time period
	 * within the given date range.
	 */
	async findDeliveryNoteTrends(
		params: Inventory.ListDeliveryNoteTrendsInput,
	): Promise<Inventory.DeliveryNoteTrendsResult> {
		const company = params.company.trim();
		const customer = params.customer?.trim();
		const itemCode = params.itemCode?.trim();
		const warehouse = params.warehouse?.trim();
		const { fromDate, toDate, period, basedOn } = params;

		if (fromDate > toDate) {
			throw new BadRequestException(
				"'From Date' must not be later than 'To Date'.",
			);
		}

		const periods = buildDeliveryNoteTrendsPeriods(fromDate, toDate, period);

		// Statuses that represent submitted (non-draft, non-cancelled) delivery notes
		const submittedStatuses: Prisma.EnumDeliveryNoteStatusFilter = {
			in: ["TO_BILL", "COMPLETED", "RETURN_ISSUED", "CLOSED"],
		};

		// Build base delivery note where clause
		const noteWhere: Prisma.DeliveryNoteWhereInput = {
			status: submittedStatuses,
			company: { contains: company, mode: "insensitive" },
			postingDate: { gte: fromDate, lte: toDate },
			...(customer
				? { customer: { contains: customer, mode: "insensitive" } }
				: {}),
		};

		// Build item where clause
		const itemWhere: Prisma.DeliveryNoteItemWhereInput = {};
		if (itemCode) {
			itemWhere.itemCode = { contains: itemCode, mode: "insensitive" };
		}
		if (warehouse) {
			itemWhere.warehouse = { contains: warehouse, mode: "insensitive" };
		}

		// For Item Group dimension, pre-resolve item codes belonging to matching groups
		let itemCodesByGroup: Map<string, string> | undefined;

		if (basedOn === "Item Group") {
			const items = await this.prisma.item.findMany({
				select: {
					code: true,
					itemGroup: { select: { groupName: true } },
				},
			});
			itemCodesByGroup = new Map<string, string>();
			for (const item of items) {
				if (item.itemGroup?.groupName) {
					itemCodesByGroup.set(item.code, item.itemGroup.groupName);
				}
			}
		}

		// Query delivery notes with items
		const notes = await this.prisma.deliveryNote.findMany({
			where: noteWhere,
			select: {
				postingDate: true,
				customer: true,
				project: true,
				items: {
					where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
					select: {
						itemCode: true,
						itemName: true,
						quantity: true,
						amount: true,
					},
				},
			},
		});

		// Flatten into source entries
		const entries: DeliveryNoteTrendsSourceEntry[] = [];

		for (const note of notes) {
			for (const item of note.items) {
				let dimensionKey: string;
				let dimensionLabel: string | null | undefined;

				switch (basedOn) {
					case "Item": {
						dimensionKey = item.itemCode;
						dimensionLabel = item.itemName;
						break;
					}
					case "Item Group": {
						const group = itemCodesByGroup?.get(item.itemCode);
						if (!group) continue; // skip items with no group
						dimensionKey = group;
						dimensionLabel = null;
						break;
					}
					case "Customer": {
						dimensionKey = note.customer;
						dimensionLabel = null;
						break;
					}
					case "Project": {
						if (!note.project) continue; // skip notes without a project
						dimensionKey = note.project;
						dimensionLabel = null;
						break;
					}
					default:
						continue;
				}

				entries.push({
					postingDate: note.postingDate,
					quantity: item.quantity,
					amount: item.amount,
					dimensionKey,
					dimensionLabel,
				});
			}
		}

		return buildDeliveryNoteTrendsRows(entries, periods);
	}

	/**
	 * Get delivery notes with pagination support.
	 * Defaults to the 250 most recent records when no params are provided.
	 */
	async findAllDeliveryNotes(params?: {
		skip?: number;
		take?: number;
	}): Promise<Inventory.DeliveryNote[]> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;

		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const notes = await this.prisma.deliveryNote.findMany({
			orderBy: { createdAt: "desc" },
			include: { items: true },
			skip,
			take,
		});
		return notes.map(toInventoryDeliveryNote);
	}

	/**
	 * Get a single delivery note by id.
	 */
	async findDeliveryNoteById(
		id: string,
	): Promise<Inventory.DeliveryNote | null> {
		const note = await this.prisma.deliveryNote.findUnique({
			where: { id },
			include: { items: true },
		});
		return note ? toInventoryDeliveryNote(note) : null;
	}

	/**
	 * Compute delivery note totals from items and discount settings.
	 * totalAmount = sum of item amounts; grandTotal applies any discount.
	 */
	private computeDeliveryNoteTotals(
		items: { quantity: number; rate: number }[],
		additionalDiscountPercent?: number | null,
		additionalDiscountAmount?: number | null,
	): {
		totalQuantity: number;
		totalAmount: number;
		grandTotal: number;
		roundingAdjustment: number;
		roundedTotal: number;
	} {
		const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
		const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.rate, 0);

		let grandTotal = totalAmount;

		// Discount precedence: percent takes priority over fixed amount if both are provided.
		if (additionalDiscountPercent != null) {
			grandTotal = totalAmount * (1 - additionalDiscountPercent / 100);
		} else if (additionalDiscountAmount != null) {
			grandTotal = Math.max(0, totalAmount - additionalDiscountAmount);
		}

		const roundedTotal = Math.round(grandTotal);
		const roundingAdjustment = roundedTotal - grandTotal;

		return {
			totalQuantity,
			totalAmount,
			grandTotal,
			roundingAdjustment,
			roundedTotal,
		};
	}

	/**
	 * Create a new delivery note.
	 * Retries up to 3 times on a series uniqueness conflict (P2002).
	 * Item amounts are computed as quantity × rate on creation.
	 */
	async createDeliveryNote(
		data: Inventory.CreateDeliveryNoteInput,
	): Promise<Inventory.DeliveryNote> {
		const postingDate = data.postingDate ?? new Date();

		for (let attempt = 0; attempt < 3; attempt++) {
			const series = await this.generateDeliveryNoteSeries(postingDate);
			try {
				const itemsWithAmounts = data.items.map((item) => ({
					itemCode: item.itemCode,
					itemName: item.itemName,
					description: item.description,
					quantity: item.quantity,
					uom: item.uom,
					rate: item.rate ?? 0,
					amount: item.quantity * (item.rate ?? 0),
					warehouse: item.warehouse,
				}));

				const totals = this.computeDeliveryNoteTotals(
					itemsWithAmounts,
					data.additionalDiscountPercent,
					data.additionalDiscountAmount,
				);

				const created = await this.prisma.deliveryNote.create({
					data: {
						series,
						postingDate,
						customer: data.customer,
						company: data.company,
						status: "DRAFT",
						isReturn: data.isReturn ?? false,
						currency: data.currency,
						priceList: data.priceList,
						sourceWarehouse: data.sourceWarehouse,
						...totals,
						additionalDiscountOn: data.additionalDiscountOn,
						additionalDiscountPercent: data.additionalDiscountPercent,
						additionalDiscountAmount: data.additionalDiscountAmount,
						shippingAddress: data.shippingAddress,
						dispatchAddress: data.dispatchAddress,
						companyAddress: data.companyAddress,
						companyContact: data.companyContact,
						companyTRN: data.companyTRN,
						terms: data.terms,
						termsContent: data.termsContent,
						transporter: data.transporter,
						driverName: data.driverName,
						driver: data.driver,
						transportReceiptDate: data.transportReceiptDate,
						transportReceiptNo: data.transportReceiptNo,
						vehicleNo: data.vehicleNo,
						customerPoNo: data.customerPoNo,
						customerPoDate: data.customerPoDate,
						salesPartner: data.salesPartner,
						commissionRate: data.commissionRate,
						letterHead: data.letterHead,
						printHeading: data.printHeading,
						printWithoutAmount: data.printWithoutAmount ?? false,
						groupSameItems: data.groupSameItems ?? false,
						permitNumber: data.permitNumber,
						vatEmirate: data.vatEmirate,
						project: data.project,
						items: {
							create: itemsWithAmounts,
						},
					},
					include: { items: true },
				});
				return toInventoryDeliveryNote(created);
			} catch (error) {
				const isSeriesConflict =
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002";
				if (isSeriesConflict && attempt < 2) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.computeBackoffMs(attempt)),
					);
					continue;
				}
				throw error;
			}
		}
		throw new Error("Failed to allocate a unique series number");
	}

	/**
	 * Update an existing delivery note.
	 * Items are upserted: existing items (matched by id) are updated in-place,
	 * new items (no id) are created, items absent from the payload are deleted.
	 * Item amounts and totals are recomputed on every update.
	 * All mutations run in a single transaction.
	 */
	async updateDeliveryNote(
		data: Inventory.UpdateDeliveryNoteInput,
	): Promise<Inventory.DeliveryNote> {
		const { id, items, ...rest } = data;

		const existing = await this.prisma.deliveryNote.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!existing) {
			throw new NotFoundException(`Delivery note with ID ${id} not found`);
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			await tx.deliveryNote.update({
				where: { id },
				data: {
					...(rest.postingDate !== undefined && {
						postingDate: rest.postingDate,
					}),
					...(rest.customer !== undefined && { customer: rest.customer }),
					...(rest.company !== undefined && { company: rest.company }),
					...(rest.status !== undefined && { status: rest.status }),
					...(rest.isReturn !== undefined && { isReturn: rest.isReturn }),
					...(rest.currency !== undefined && { currency: rest.currency }),
					...(rest.priceList !== undefined && { priceList: rest.priceList }),
					...(rest.sourceWarehouse !== undefined && {
						sourceWarehouse: rest.sourceWarehouse,
					}),
					...(rest.additionalDiscountOn !== undefined && {
						additionalDiscountOn: rest.additionalDiscountOn,
					}),
					...(rest.additionalDiscountPercent !== undefined && {
						additionalDiscountPercent: rest.additionalDiscountPercent,
					}),
					...(rest.additionalDiscountAmount !== undefined && {
						additionalDiscountAmount: rest.additionalDiscountAmount,
					}),
					...(rest.shippingAddress !== undefined && {
						shippingAddress: rest.shippingAddress,
					}),
					...(rest.dispatchAddress !== undefined && {
						dispatchAddress: rest.dispatchAddress,
					}),
					...(rest.companyAddress !== undefined && {
						companyAddress: rest.companyAddress,
					}),
					...(rest.companyContact !== undefined && {
						companyContact: rest.companyContact,
					}),
					...(rest.companyTRN !== undefined && {
						companyTRN: rest.companyTRN,
					}),
					...(rest.terms !== undefined && { terms: rest.terms }),
					...(rest.termsContent !== undefined && {
						termsContent: rest.termsContent,
					}),
					...(rest.transporter !== undefined && {
						transporter: rest.transporter,
					}),
					...(rest.driverName !== undefined && {
						driverName: rest.driverName,
					}),
					...(rest.driver !== undefined && { driver: rest.driver }),
					...(rest.transportReceiptDate !== undefined && {
						transportReceiptDate: rest.transportReceiptDate,
					}),
					...(rest.transportReceiptNo !== undefined && {
						transportReceiptNo: rest.transportReceiptNo,
					}),
					...(rest.vehicleNo !== undefined && { vehicleNo: rest.vehicleNo }),
					...(rest.customerPoNo !== undefined && {
						customerPoNo: rest.customerPoNo,
					}),
					...(rest.customerPoDate !== undefined && {
						customerPoDate: rest.customerPoDate,
					}),
					...(rest.salesPartner !== undefined && {
						salesPartner: rest.salesPartner,
					}),
					...(rest.commissionRate !== undefined && {
						commissionRate: rest.commissionRate,
					}),
					...(rest.letterHead !== undefined && {
						letterHead: rest.letterHead,
					}),
					...(rest.printHeading !== undefined && {
						printHeading: rest.printHeading,
					}),
					...(rest.printWithoutAmount !== undefined && {
						printWithoutAmount: rest.printWithoutAmount,
					}),
					...(rest.groupSameItems !== undefined && {
						groupSameItems: rest.groupSameItems,
					}),
					...(rest.permitNumber !== undefined && {
						permitNumber: rest.permitNumber,
					}),
					...(rest.vatEmirate !== undefined && {
						vatEmirate: rest.vatEmirate,
					}),
					...(rest.project !== undefined && { project: rest.project }),
				},
			});

			if (items !== undefined) {
				const keptIds = items
					.filter((i): i is typeof i & { id: string } => Boolean(i.id))
					.map((i) => i.id);
				if (keptIds.length > 0) {
					const ownedItems = await tx.deliveryNoteItem.findMany({
						where: {
							id: { in: keptIds },
							deliveryNoteId: id,
						},
						select: { id: true },
					});
					const ownedIds = new Set(ownedItems.map((item) => item.id));
					const foreignItemId = keptIds.find((itemId) => !ownedIds.has(itemId));
					if (foreignItemId) {
						throw new BadRequestException(
							`Delivery note item with ID ${foreignItemId} does not belong to delivery note ${id}`,
						);
					}
				}

				// Delete items no longer present in the payload
				if (keptIds.length === 0) {
					await tx.deliveryNoteItem.deleteMany({
						where: { deliveryNoteId: id },
					});
				} else {
					await tx.deliveryNoteItem.deleteMany({
						where: {
							deliveryNoteId: id,
							id: { notIn: keptIds },
						},
					});
				}

				// Update existing items in-place; create new items
				for (const item of items) {
					const rate = item.rate ?? 0;
					const amount = item.quantity * rate;

					if (item.id) {
						await tx.deliveryNoteItem.update({
							where: { id: item.id },
							data: {
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								quantity: item.quantity,
								uom: item.uom,
								rate,
								amount,
								warehouse: item.warehouse,
							},
						});
					} else {
						await tx.deliveryNoteItem.create({
							data: {
								deliveryNoteId: id,
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								quantity: item.quantity,
								uom: item.uom,
								rate,
								amount,
								warehouse: item.warehouse,
							},
						});
					}
				}

				// Recompute totals from updated items
				const allItems = await tx.deliveryNoteItem.findMany({
					where: { deliveryNoteId: id },
					select: { quantity: true, rate: true },
				});

				const currentNote = await tx.deliveryNote.findUniqueOrThrow({
					where: { id },
					select: {
						additionalDiscountPercent: true,
						additionalDiscountAmount: true,
					},
				});

				const newTotals = this.computeDeliveryNoteTotals(
					allItems,
					currentNote.additionalDiscountPercent,
					currentNote.additionalDiscountAmount,
				);

				await tx.deliveryNote.update({
					where: { id },
					data: newTotals,
				});
			}

			return tx.deliveryNote.findUniqueOrThrow({
				where: { id },
				include: { items: true },
			});
		});

		return toInventoryDeliveryNote(updated);
	}

	/**
	 * Delete a single delivery note.
	 */
	async deleteDeliveryNote(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.deliveryNote.delete({ where: { id } });
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				return { success: false, id };
			}
			throw error;
		}
	}

	/**
	 * Delete multiple delivery notes.
	 */
	async deleteManyDeliveryNotes(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const uniqueIds = [...new Set(ids)];
		try {
			const result = await this.prisma.deliveryNote.deleteMany({
				where: { id: { in: uniqueIds } },
			});
			return { success: true, count: result.count, ids: uniqueIds };
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				this.logger.error(
					`Bulk delete delivery notes failed [${error.code}]`,
					error.stack,
				);
			}
			throw error;
		}
	}

	/**
	 * Get stock ledger report rows derived from stock entry items.
	 * Rows are bounded, filterable, and ordered deterministically before running
	 * balances are computed per item-and-warehouse partition.
	 */
	async findStockLedger(params?: Inventory.ListStockLedgerInput) {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const search = params?.search?.trim();
		const company = params?.company?.trim();
		const warehouse = params?.warehouse?.trim();
		const itemCode = params?.itemCode?.trim();
		const itemGroup = params?.itemGroup?.trim();
		const brand = params?.brand?.trim();
		const voucherNo = params?.voucherNo?.trim();
		const project = params?.project?.trim();
		const dateFrom = params?.dateFrom;
		const dateTo = params?.dateTo;

		if (dateFrom && dateTo && dateFrom > dateTo) {
			throw new BadRequestException("dateFrom cannot be later than dateTo");
		}

		let filteredItemCodes: string[] | undefined;

		if (itemGroup || brand) {
			const matchingItems = await this.prisma.item.findMany({
				where: {
					...(itemGroup
						? {
								itemGroup: {
									groupName: {
										contains: itemGroup,
										mode: "insensitive",
									},
								},
							}
						: {}),
					...(brand
						? {
								brand: {
									name: {
										contains: brand,
										mode: "insensitive",
									},
								},
							}
						: {}),
				},
				select: { code: true },
			});

			filteredItemCodes = matchingItems.map((item) => item.code);

			if (filteredItemCodes.length === 0) {
				return [];
			}
		}

		const whereClauses: Prisma.StockEntryItemWhereInput[] = [];

		if (itemCode) {
			whereClauses.push({
				itemCode: {
					contains: itemCode,
					mode: "insensitive",
				},
			});
		}

		if (filteredItemCodes) {
			whereClauses.push({
				itemCode: {
					in: filteredItemCodes,
				},
			});
		}

		if (warehouse) {
			whereClauses.push({
				OR: [
					{ sourceWarehouse: { equals: warehouse, mode: "insensitive" } },
					{ targetWarehouse: { equals: warehouse, mode: "insensitive" } },
					{
						stockEntry: {
							defaultSourceWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
					{
						stockEntry: {
							defaultTargetWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
				],
			});
		}

		if (search) {
			whereClauses.push({
				OR: [
					{ itemCode: { contains: search, mode: "insensitive" } },
					{ itemName: { contains: search, mode: "insensitive" } },
					{ description: { contains: search, mode: "insensitive" } },
					{ sourceWarehouse: { contains: search, mode: "insensitive" } },
					{ targetWarehouse: { contains: search, mode: "insensitive" } },
					{
						stockEntry: {
							series: { contains: search, mode: "insensitive" },
						},
					},
					{
						stockEntry: {
							company: { contains: search, mode: "insensitive" },
						},
					},
					{
						stockEntry: {
							remarks: { contains: search, mode: "insensitive" },
						},
					},
				],
			});
		}

		const stockEntryWhere: Prisma.StockEntryWhereInput = {
			...(company
				? {
						company: { contains: company, mode: "insensitive" },
					}
				: {}),
			...(voucherNo
				? {
						series: { contains: voucherNo, mode: "insensitive" },
					}
				: {}),
			...(params?.stockEntryType
				? { stockEntryType: params.stockEntryType }
				: {}),
			...(params?.status ? { status: params.status } : {}),
			...(project
				? {
						project: { contains: project, mode: "insensitive" },
					}
				: {}),
			...(dateFrom || dateTo
				? {
						postingDate: {
							...(dateFrom ? { gte: dateFrom } : {}),
							...(dateTo ? { lte: dateTo } : {}),
						},
					}
				: {}),
		};

		if (Object.keys(stockEntryWhere).length > 0) {
			whereClauses.push({ stockEntry: stockEntryWhere });
		}

		const where: Prisma.StockEntryItemWhereInput =
			whereClauses.length === 0
				? {}
				: whereClauses.length === 1
					? whereClauses[0]
					: { AND: whereClauses };

		const items = await this.prisma.stockEntryItem.findMany({
			where,
			include: { stockEntry: true },
			orderBy: [
				{ stockEntry: { postingDate: "asc" } },
				{ stockEntry: { createdAt: "asc" } },
				{ id: "asc" },
			],
			skip,
			take,
		});

		const itemCodes = [...new Set(items.map((item) => item.itemCode))];
		const itemMetadata =
			itemCodes.length === 0
				? []
				: await this.prisma.item.findMany({
						where: {
							code: {
								in: itemCodes,
							},
						},
						select: {
							code: true,
							valuationRate: true,
							itemGroup: {
								select: {
									groupName: true,
								},
							},
							brand: {
								select: {
									name: true,
								},
							},
						},
					});

		const metadataByCode = new Map(
			itemMetadata.map((item) => [item.code, item] as const),
		);

		return buildStockLedgerRows(items, { warehouse }).map((row) => {
			const metadata = metadataByCode.get(row.itemCode);
			const valuationRate = metadata?.valuationRate ?? null;

			return {
				...row,
				voucherNo: row.series,
				itemGroupName: metadata?.itemGroup?.groupName ?? null,
				brandName: metadata?.brand?.name ?? null,
				valuationRate,
				balanceValue:
					valuationRate == null ? null : valuationRate * row.balanceQty,
			};
		});
	}

	/**
	 * Get warehouse-wise stock balance movement rows.
	 * This report focuses on warehouse-level item movements and keeps
	 * one row per stock movement line.
	 */
	async findWarehouseWiseStockBalance(
		params?: Inventory.ListWarehouseWiseStockBalanceInput,
	) {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const search = params?.search?.trim();
		const company = params?.company?.trim();
		const warehouse = params?.warehouse?.trim();
		const itemCode = params?.itemCode?.trim();
		const voucherNo = params?.voucherNo?.trim();
		const dateFrom = params?.dateFrom;
		const dateTo = params?.dateTo;
		const status = params?.status ?? "SUBMITTED";

		if (dateFrom && dateTo && dateFrom > dateTo) {
			throw new BadRequestException("dateFrom cannot be later than dateTo");
		}

		const whereClauses: Prisma.StockEntryItemWhereInput[] = [];

		if (itemCode) {
			whereClauses.push({
				itemCode: {
					contains: itemCode,
					mode: "insensitive",
				},
			});
		}

		if (warehouse) {
			whereClauses.push({
				OR: [
					{ sourceWarehouse: { equals: warehouse, mode: "insensitive" } },
					{ targetWarehouse: { equals: warehouse, mode: "insensitive" } },
					{
						stockEntry: {
							defaultSourceWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
					{
						stockEntry: {
							defaultTargetWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
				],
			});
		}

		if (search) {
			whereClauses.push({
				OR: [
					{ itemCode: { contains: search, mode: "insensitive" } },
					{ itemName: { contains: search, mode: "insensitive" } },
					{ sourceWarehouse: { contains: search, mode: "insensitive" } },
					{ targetWarehouse: { contains: search, mode: "insensitive" } },
					{
						stockEntry: {
							series: { contains: search, mode: "insensitive" },
						},
					},
					{
						stockEntry: {
							company: { contains: search, mode: "insensitive" },
						},
					},
				],
			});
		}

		const stockEntryWhere: Prisma.StockEntryWhereInput = {
			status,
			...(company
				? {
						company: { contains: company, mode: "insensitive" },
					}
				: {}),
			...(voucherNo
				? {
						series: { contains: voucherNo, mode: "insensitive" },
					}
				: {}),
			...(dateFrom || dateTo
				? {
						postingDate: {
							...(dateFrom ? { gte: dateFrom } : {}),
							...(dateTo ? { lte: dateTo } : {}),
						},
					}
				: {}),
		};

		whereClauses.push({ stockEntry: stockEntryWhere });

		const where: Prisma.StockEntryItemWhereInput =
			whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses };

		const items = await this.prisma.stockEntryItem.findMany({
			where,
			include: { stockEntry: true },
			orderBy: [
				{ stockEntry: { postingDate: "desc" } },
				{ stockEntry: { createdAt: "desc" } },
				{ id: "asc" },
			],
		});

		const rows = buildWarehouseWiseStockBalanceRows(
			buildStockLedgerRows(items, { warehouse }),
		);

		return rows.slice(skip, skip + take);
	}

	/**
	 * Get stock balance rows aggregated by company, item, and warehouse.
	 * The report derives opening, inward, outward, and closing values from
	 * stock entry movements up to the requested end date.
	 */
	async findStockBalance(params?: Inventory.ListStockBalanceInput) {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const search = params?.search?.trim();
		const company = params?.company?.trim();
		const warehouse = params?.warehouse?.trim();
		const itemCode = params?.itemCode?.trim();
		const itemGroup = params?.itemGroup?.trim();
		const brand = params?.brand?.trim();
		const project = params?.project?.trim();
		const dateFrom = params?.dateFrom;
		const dateTo = params?.dateTo;
		const status = params?.status ?? "SUBMITTED";

		if (dateFrom && dateTo && dateFrom > dateTo) {
			throw new BadRequestException("dateFrom cannot be later than dateTo");
		}

		let filteredItemCodes: string[] | undefined;

		if (itemGroup || brand) {
			const matchingItems = await this.prisma.item.findMany({
				where: {
					...(itemGroup
						? {
								itemGroup: {
									groupName: {
										contains: itemGroup,
										mode: "insensitive",
									},
								},
							}
						: {}),
					...(brand
						? {
								brand: {
									name: {
										contains: brand,
										mode: "insensitive",
									},
								},
							}
						: {}),
				},
				select: { code: true },
			});

			filteredItemCodes = matchingItems.map((item) => item.code);

			if (filteredItemCodes.length === 0) {
				return [];
			}
		}

		const whereClauses: Prisma.StockEntryItemWhereInput[] = [];

		if (itemCode) {
			whereClauses.push({
				itemCode: {
					contains: itemCode,
					mode: "insensitive",
				},
			});
		}

		if (filteredItemCodes) {
			whereClauses.push({
				itemCode: {
					in: filteredItemCodes,
				},
			});
		}

		if (warehouse) {
			whereClauses.push({
				OR: [
					{ sourceWarehouse: { equals: warehouse, mode: "insensitive" } },
					{ targetWarehouse: { equals: warehouse, mode: "insensitive" } },
					{
						stockEntry: {
							defaultSourceWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
					{
						stockEntry: {
							defaultTargetWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
				],
			});
		}

		if (search) {
			whereClauses.push({
				OR: [
					{ itemCode: { contains: search, mode: "insensitive" } },
					{ itemName: { contains: search, mode: "insensitive" } },
					{ description: { contains: search, mode: "insensitive" } },
					{ sourceWarehouse: { contains: search, mode: "insensitive" } },
					{ targetWarehouse: { contains: search, mode: "insensitive" } },
					{
						stockEntry: {
							company: { contains: search, mode: "insensitive" },
						},
					},
					{
						stockEntry: {
							series: { contains: search, mode: "insensitive" },
						},
					},
				],
			});
		}

		const stockEntryWhere: Prisma.StockEntryWhereInput = {
			...(company
				? {
						company: { contains: company, mode: "insensitive" },
					}
				: {}),
			status,
			...(project
				? {
						project: { contains: project, mode: "insensitive" },
					}
				: {}),
			...(dateTo
				? {
						postingDate: {
							lte: dateTo,
						},
					}
				: {}),
		};

		whereClauses.push({ stockEntry: stockEntryWhere });

		const where: Prisma.StockEntryItemWhereInput =
			whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses };

		const items = await this.prisma.stockEntryItem.findMany({
			where,
			include: { stockEntry: true },
			orderBy: [
				{ stockEntry: { postingDate: "asc" } },
				{ stockEntry: { createdAt: "asc" } },
				{ id: "asc" },
			],
		});

		if (items.length === 0) {
			return [];
		}

		const itemCodes = [...new Set(items.map((item) => item.itemCode))];
		const itemMetadata = await this.prisma.item.findMany({
			where: {
				code: {
					in: itemCodes,
				},
			},
			select: {
				code: true,
				valuationRate: true,
				itemGroup: {
					select: {
						groupName: true,
					},
				},
				brand: {
					select: {
						name: true,
					},
				},
			},
		});

		const metadataByCode = new Map(
			itemMetadata.map((item) => [item.code, item] as const),
		);

		const balanceRows = buildStockBalanceRows(
			buildStockLedgerRows(items, { warehouse }).map((row) => {
				const metadata = metadataByCode.get(row.itemCode);

				return {
					company: row.company,
					itemCode: row.itemCode,
					itemName: row.itemName,
					itemGroupName: metadata?.itemGroup?.groupName ?? null,
					brandName: metadata?.brand?.name ?? null,
					warehouse: row.warehouse,
					unitOfMeasure: row.unitOfMeasure,
					postingDate: row.postingDate,
					qtyIn: row.qtyIn,
					qtyOut: row.qtyOut,
					basicAmount: row.basicAmount,
					valuationRate: metadata?.valuationRate ?? null,
				};
			}),
			{
				dateFrom,
				includeZeroStockItems: params?.includeZeroStockItems,
			},
		);

		return balanceRows.slice(skip, skip + take);
	}

	/**
	 * Quick Stock Balance lookup.
	 *
	 * Returns the stock quantity and value for a single item at a specific
	 * warehouse on a specific date. The caller must supply exactly one of
	 * `itemCode` or `barcode`; if neither is provided, a `BadRequestException`
	 * is thrown. If a barcode is supplied but no matching item is found in
	 * `inventory_items`, a `NotFoundException` is thrown.
	 */
	async getQuickStockBalance(
		params: Inventory.QuickStockBalanceInput,
	): Promise<Inventory.QuickStockBalanceResult> {
		const warehouse = params.warehouse.trim();
		const date = params.date;

		if (!params.itemCode && !params.barcode) {
			throw new BadRequestException(
				"Provide either an item code or a barcode.",
			);
		}

		// Resolve item code from barcode when barcode lookup is requested
		let resolvedItemCode: string;

		if (params.barcode) {
			const barcodeEntry = await this.prisma.itemBarcode.findFirst({
				where: { barcode: params.barcode.trim() },
				select: { item: { select: { code: true } } },
			});

			if (!barcodeEntry) {
				throw new NotFoundException(
					`No item is registered for barcode "${params.barcode}".`,
				);
			}

			resolvedItemCode = barcodeEntry.item.code;
		} else {
			resolvedItemCode = (params.itemCode as string).trim();
		}

		// Load item metadata
		const item = await this.prisma.inventoryItem.findFirst({
			where: { code: { equals: resolvedItemCode, mode: "insensitive" } },
			select: {
				name: true,
				code: true,
				description: true,
				valuationRate: true,
				barcodes: { select: { barcode: true } },
			},
		});

		if (!item) {
			throw new NotFoundException(
				`Item with code "${resolvedItemCode}" was not found.`,
			);
		}

		// Pull all submitted stock entry movements for this item up to the date
		const movements = await this.prisma.stockEntryItem.findMany({
			where: {
				itemCode: { equals: resolvedItemCode, mode: "insensitive" },
				stockEntry: {
					status: "SUBMITTED",
					postingDate: { lte: date },
				},
			},
			include: { stockEntry: true },
			orderBy: [
				{ stockEntry: { postingDate: "asc" } },
				{ stockEntry: { createdAt: "asc" } },
				{ id: "asc" },
			],
		});

		// Build ledger rows for the specific warehouse, then compute balance
		const ledgerRows = buildStockLedgerRows(movements, { warehouse });

		let availableQty = 0;
		for (const row of ledgerRows) {
			availableQty += row.qtyIn - row.qtyOut;
		}

		const valuationRate = item.valuationRate ?? 0;
		const stockValue = availableQty * valuationRate;

		return {
			itemCode: item.code,
			itemName: item.name,
			description: item.description ?? null,
			barcodes: item.barcodes.map((b) => b.barcode),
			availableQty,
			stockValue,
		};
	}

	/**
	 * Get projected stock rows by combining on-hand stock, open demand/supply,
	 * pending production movements, and warehouse reorder settings.
	 */
	private async collectStockProjectedQtyRows(params?: StockAvailabilityParams) {
		const search = params?.search?.trim().toLowerCase();
		const company = params?.company?.trim();
		const warehouse = params?.warehouse?.trim();
		const itemCode = params?.itemCode?.trim();
		const itemGroup = params?.itemGroup?.trim();
		const brand = params?.brand?.trim();

		const codeFilterSets: string[][] = [];

		if (itemGroup) {
			const groupItems = await this.prisma.inventoryItem.findMany({
				where: {
					itemGroup: {
						groupName: {
							contains: itemGroup,
							mode: "insensitive",
						},
					},
				},
				select: { code: true },
			});

			codeFilterSets.push(groupItems.map((entry) => entry.code));
		}

		if (brand) {
			const brandItems = await this.prisma.item.findMany({
				where: {
					brand: {
						name: {
							contains: brand,
							mode: "insensitive",
						},
					},
				},
				select: { code: true },
			});

			codeFilterSets.push(brandItems.map((entry) => entry.code));
		}

		const filteredItemCodes =
			codeFilterSets.length === 0
				? undefined
				: codeFilterSets.reduce<string[]>((current, next) => {
						if (current.length === 0) {
							return [...new Set(next)];
						}

						const nextSet = new Set(next);
						return current.filter((code) => nextSet.has(code));
					}, []);

		if (filteredItemCodes && filteredItemCodes.length === 0) {
			return [];
		}

		const stockWhereClauses: Prisma.StockEntryItemWhereInput[] = [];

		if (itemCode) {
			stockWhereClauses.push({
				itemCode: {
					contains: itemCode,
					mode: "insensitive",
				},
			});
		}

		if (filteredItemCodes) {
			stockWhereClauses.push({
				itemCode: {
					in: filteredItemCodes,
				},
			});
		}

		if (warehouse) {
			stockWhereClauses.push({
				OR: [
					{ sourceWarehouse: { equals: warehouse, mode: "insensitive" } },
					{ targetWarehouse: { equals: warehouse, mode: "insensitive" } },
					{
						stockEntry: {
							defaultSourceWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
					{
						stockEntry: {
							defaultTargetWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
				],
			});
		}

		if (search) {
			stockWhereClauses.push({
				OR: [
					{ itemCode: { contains: search, mode: "insensitive" } },
					{ itemName: { contains: search, mode: "insensitive" } },
					{ description: { contains: search, mode: "insensitive" } },
					{ sourceWarehouse: { contains: search, mode: "insensitive" } },
					{ targetWarehouse: { contains: search, mode: "insensitive" } },
					{
						stockEntry: {
							series: { contains: search, mode: "insensitive" },
						},
					},
				],
			});
		}

		stockWhereClauses.push({
			stockEntry: {
				status: "SUBMITTED",
				...(company
					? {
							company: {
								contains: company,
								mode: "insensitive",
							},
						}
					: {}),
			},
		});

		const stockEntryItems = await this.prisma.stockEntryItem.findMany({
			where:
				stockWhereClauses.length === 1
					? stockWhereClauses[0]
					: { AND: stockWhereClauses },
			include: { stockEntry: true },
			orderBy: [
				{ stockEntry: { postingDate: "asc" } },
				{ stockEntry: { createdAt: "asc" } },
				{ id: "asc" },
			],
		});

		const actualRows = buildStockLedgerRows(stockEntryItems, { warehouse }).map(
			(row) => ({
				company: row.company,
				itemCode: row.itemCode,
				itemName: row.itemName,
				description: row.description,
				warehouse: row.warehouse,
				unitOfMeasure: row.unitOfMeasure,
				actualQty: row.qtyIn - row.qtyOut,
				lastActivityDate: row.postingDate,
			}),
		);

		const plannedWhereClauses: Prisma.StockEntryItemWhereInput[] = [];

		if (itemCode) {
			plannedWhereClauses.push({
				itemCode: {
					contains: itemCode,
					mode: "insensitive",
				},
			});
		}

		if (filteredItemCodes) {
			plannedWhereClauses.push({
				itemCode: {
					in: filteredItemCodes,
				},
			});
		}

		plannedWhereClauses.push({
			stockEntry: {
				status: "DRAFT",
				stockEntryType: {
					in: ["MANUFACTURE", "MATERIAL_TRANSFER_FOR_MANUFACTURE"],
				},
				...(company
					? {
							company: {
								contains: company,
								mode: "insensitive",
							},
						}
					: {}),
			},
		});

		const plannedEntryItems = await this.prisma.stockEntryItem.findMany({
			where:
				plannedWhereClauses.length === 1
					? plannedWhereClauses[0]
					: { AND: plannedWhereClauses },
			include: { stockEntry: true },
		});

		const plannedRows = plannedEntryItems
			.map((item) => {
				const targetWarehouse =
					item.targetWarehouse ?? item.stockEntry.defaultTargetWarehouse;

				if (!targetWarehouse) {
					return null;
				}

				if (
					warehouse &&
					targetWarehouse.localeCompare(warehouse, undefined, {
						sensitivity: "accent",
					}) !== 0
				) {
					return null;
				}

				return {
					company: item.stockEntry.company,
					itemCode: item.itemCode,
					itemName: item.itemName,
					description: item.description,
					warehouse: targetWarehouse,
					unitOfMeasure: item.unitOfMeasure,
					plannedQty: item.qty,
					lastActivityDate: item.stockEntry.postingDate,
				};
			})
			.filter((row): row is NonNullable<typeof row> => row != null);

		const subcontractWhereClauses: Prisma.StockEntryItemWhereInput[] = [];

		if (itemCode) {
			subcontractWhereClauses.push({
				itemCode: {
					contains: itemCode,
					mode: "insensitive",
				},
			});
		}

		if (filteredItemCodes) {
			subcontractWhereClauses.push({
				itemCode: {
					in: filteredItemCodes,
				},
			});
		}

		subcontractWhereClauses.push({
			stockEntry: {
				status: "DRAFT",
				stockEntryType: "SEND_TO_SUBCONTRACTOR",
				...(company
					? {
							company: {
								contains: company,
								mode: "insensitive",
							},
						}
					: {}),
			},
		});

		const subcontractEntryItems = await this.prisma.stockEntryItem.findMany({
			where:
				subcontractWhereClauses.length === 1
					? subcontractWhereClauses[0]
					: { AND: subcontractWhereClauses },
			include: { stockEntry: true },
		});

		const subcontractRows = subcontractEntryItems
			.map((item) => {
				const sourceWarehouse =
					item.sourceWarehouse ?? item.stockEntry.defaultSourceWarehouse;

				if (!sourceWarehouse) {
					return null;
				}

				if (
					warehouse &&
					sourceWarehouse.localeCompare(warehouse, undefined, {
						sensitivity: "accent",
					}) !== 0
				) {
					return null;
				}

				return {
					company: item.stockEntry.company,
					itemCode: item.itemCode,
					itemName: item.itemName,
					description: item.description,
					warehouse: sourceWarehouse,
					unitOfMeasure: item.unitOfMeasure,
					reservedQtyForSubcontracting: item.qty,
					lastActivityDate: item.stockEntry.postingDate,
				};
			})
			.filter((row): row is NonNullable<typeof row> => row != null);

		const materialRequests = await this.prisma.materialRequest.findMany({
			where: {
				status: {
					in: [
						"PENDING",
						"APPROVED",
						"ORDERED",
						"PARTIALLY_ORDERED",
						"PARTIALLY_RECEIVED",
					],
				},
				...(company
					? {
							company: {
								contains: company,
								mode: "insensitive",
							},
						}
					: {}),
			},
			include: { items: true },
			orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
		});

		const requestRows = materialRequests.flatMap((request) =>
			request.items
				.map((item) => {
					const rowWarehouse = item.targetWarehouse ?? request.targetWarehouse;

					if (!rowWarehouse) {
						return null;
					}

					if (
						warehouse &&
						rowWarehouse.localeCompare(warehouse, undefined, {
							sensitivity: "accent",
						}) !== 0
					) {
						return null;
					}

					if (
						itemCode &&
						!item.itemCode.toLowerCase().includes(itemCode.toLowerCase())
					) {
						return null;
					}

					if (filteredItemCodes && !filteredItemCodes.includes(item.itemCode)) {
						return null;
					}

					if (
						search &&
						![
							request.series,
							request.company,
							item.itemCode,
							item.itemName,
							rowWarehouse,
						]
							.filter((value): value is string => Boolean(value))
							.some((value) => value.toLowerCase().includes(search))
					) {
						return null;
					}

					return {
						company: request.company,
						itemCode: item.itemCode,
						itemName: item.itemName,
						warehouse: rowWarehouse,
						unitOfMeasure: item.unitOfMeasure,
						requestedQty: Math.max(item.quantity - item.orderedQty, 0),
						orderedQty: Math.max(item.orderedQty - item.receivedQty, 0),
						lastActivityDate: item.requiredBy ?? request.transactionDate,
					};
				})
				.filter((row): row is NonNullable<typeof row> => row != null),
		);

		const deliveryNotes = await this.prisma.deliveryNote.findMany({
			where: {
				status: {
					in: ["DRAFT", "TO_BILL"],
				},
				isReturn: false,
				...(company
					? {
							company: {
								contains: company,
								mode: "insensitive",
							},
						}
					: {}),
			},
			include: { items: true },
			orderBy: [{ postingDate: "asc" }, { createdAt: "asc" }],
		});

		const reservedRows = deliveryNotes.flatMap((note) =>
			note.items
				.map((item) => {
					const rowWarehouse = item.warehouse ?? note.sourceWarehouse;

					if (!rowWarehouse) {
						return null;
					}

					if (
						warehouse &&
						rowWarehouse.localeCompare(warehouse, undefined, {
							sensitivity: "accent",
						}) !== 0
					) {
						return null;
					}

					if (
						itemCode &&
						!item.itemCode.toLowerCase().includes(itemCode.toLowerCase())
					) {
						return null;
					}

					if (filteredItemCodes && !filteredItemCodes.includes(item.itemCode)) {
						return null;
					}

					if (
						search &&
						![
							note.series,
							note.company,
							item.itemCode,
							item.itemName,
							rowWarehouse,
						]
							.filter((value): value is string => Boolean(value))
							.some((value) => value.toLowerCase().includes(search))
					) {
						return null;
					}

					return {
						company: note.company,
						itemCode: item.itemCode,
						itemName: item.itemName,
						description: item.description,
						warehouse: rowWarehouse,
						unitOfMeasure: item.uom,
						reservedQty: item.quantity,
						lastActivityDate: note.postingDate,
					};
				})
				.filter((row): row is NonNullable<typeof row> => row != null),
		);

		const pickLists = await this.prisma.pickList.findMany({
			where: {
				status: {
					in: ["DRAFT", "OPEN"],
				},
				purpose: "MATERIAL_TRANSFER_FOR_MANUFACTURE",
				...(company
					? {
							company: {
								contains: company,
								mode: "insensitive",
							},
						}
					: {}),
			},
			include: { items: true },
			orderBy: [{ createdAt: "asc" }, { updatedAt: "asc" }],
		});

		const productionReservationRows = pickLists.flatMap((pickList) =>
			pickList.items
				.map((item) => {
					const rowWarehouse = item.warehouse ?? pickList.warehouse;
					const outstandingQty = Math.max(item.qty - (item.pickedQty ?? 0), 0);

					if (!rowWarehouse || outstandingQty <= 0) {
						return null;
					}

					if (
						warehouse &&
						rowWarehouse.localeCompare(warehouse, undefined, {
							sensitivity: "accent",
						}) !== 0
					) {
						return null;
					}

					if (
						itemCode &&
						!item.item.toLowerCase().includes(itemCode.toLowerCase())
					) {
						return null;
					}

					if (filteredItemCodes && !filteredItemCodes.includes(item.item)) {
						return null;
					}

					if (
						search &&
						![pickList.series, pickList.company, item.item, rowWarehouse]
							.filter((value): value is string => Boolean(value))
							.some((value) => value.toLowerCase().includes(search))
					) {
						return null;
					}

					return {
						company: pickList.company,
						itemCode: item.item,
						warehouse: rowWarehouse,
						reservedQtyForProduction: outstandingQty,
						lastActivityDate: pickList.updatedAt,
					};
				})
				.filter((row): row is NonNullable<typeof row> => row != null),
		);

		const allItemCodes = new Set<string>();
		for (const row of [
			...actualRows,
			...plannedRows,
			...subcontractRows,
			...requestRows,
			...reservedRows,
			...productionReservationRows,
		]) {
			allItemCodes.add(row.itemCode);
		}

		const codes = [...allItemCodes];

		const inventoryItems =
			codes.length === 0
				? []
				: await this.prisma.inventoryItem.findMany({
						where: { code: { in: codes } },
						include: {
							defaultUnitOfMeasure: {
								select: {
									name: true,
								},
							},
							itemGroup: {
								select: {
									groupName: true,
								},
							},
							reorderSettings: true,
						},
					});

		const itemsByCode = new Map(
			inventoryItems.map((entry) => [entry.code, entry] as const),
		);

		const brandMetadata =
			codes.length === 0
				? []
				: await this.prisma.item.findMany({
						where: { code: { in: codes } },
						select: {
							code: true,
							brand: {
								select: {
									name: true,
								},
							},
						},
					});

		const brandsByCode = new Map(
			brandMetadata.map(
				(entry) => [entry.code, entry.brand?.name ?? null] as const,
			),
		);

		const companyCandidatesByItemWarehouse = new Map<string, Set<string>>();
		for (const row of [
			...actualRows,
			...plannedRows,
			...subcontractRows,
			...requestRows,
			...reservedRows,
			...productionReservationRows,
		]) {
			const key = `${row.itemCode}::${row.warehouse}`;
			const candidates =
				companyCandidatesByItemWarehouse.get(key) ?? new Set<string>();
			if (row.company) {
				candidates.add(row.company);
			}
			companyCandidatesByItemWarehouse.set(key, candidates);
		}

		const reorderRows = inventoryItems.flatMap((entry) =>
			entry.reorderSettings.flatMap((setting) => {
				if (warehouse && setting.warehouse !== warehouse) {
					return [];
				}

				const key = `${entry.code}::${setting.warehouse}`;
				const companiesForRow = company
					? [company]
					: [
							...(companyCandidatesByItemWarehouse.get(key) ??
								new Set<string>(["All Companies"])),
						];

				return companiesForRow.map((rowCompany) => ({
					company: rowCompany,
					itemCode: entry.code,
					itemName: entry.name,
					description: entry.description,
					itemGroupName: entry.itemGroup?.groupName ?? null,
					brandName: brandsByCode.get(entry.code) ?? null,
					warehouse: setting.warehouse,
					reorderLevel: setting.reorderLevel,
					reorderQty: setting.reorderQty,
					lastActivityDate: entry.updatedAt,
				}));
			}),
		);

		const projectedSourceRows: StockProjectedQtySourceRow[] = [
			...actualRows,
			...plannedRows,
			...subcontractRows,
			...requestRows,
			...reservedRows,
			...productionReservationRows,
			...reorderRows,
		].map((row) => {
			const sourceRow = row as Partial<StockProjectedQtySourceRow>;
			const inventoryItem = itemsByCode.get(row.itemCode);
			const normalizedCompany = row.company ?? company ?? "Unknown Company";
			return {
				company: normalizedCompany,
				itemCode: row.itemCode,
				itemName: sourceRow.itemName ?? inventoryItem?.name ?? null,
				description:
					sourceRow.description ?? inventoryItem?.description ?? null,
				itemGroupName:
					sourceRow.itemGroupName ??
					inventoryItem?.itemGroup?.groupName ??
					null,
				brandName:
					sourceRow.brandName ?? brandsByCode.get(row.itemCode) ?? null,
				warehouse: row.warehouse,
				unitOfMeasure:
					sourceRow.unitOfMeasure ??
					inventoryItem?.defaultUnitOfMeasure?.name ??
					null,
				actualQty: sourceRow.actualQty ?? 0,
				plannedQty: sourceRow.plannedQty ?? 0,
				requestedQty: sourceRow.requestedQty ?? 0,
				orderedQty: sourceRow.orderedQty ?? 0,
				reservedQty: sourceRow.reservedQty ?? 0,
				reservedQtyForProduction: sourceRow.reservedQtyForProduction ?? 0,
				reservedQtyForSubcontracting:
					sourceRow.reservedQtyForSubcontracting ?? 0,
				reservedQtyForProductionPlan:
					sourceRow.reservedQtyForProductionPlan ?? 0,
				reorderLevel: sourceRow.reorderLevel ?? 0,
				reorderQty: sourceRow.reorderQty ?? 0,
				lastActivityDate: row.lastActivityDate ?? null,
			};
		});

		const projectedRows = buildStockProjectedQtyRows(projectedSourceRows, {
			includeZeroStockItems: params?.includeZeroStockItems,
		});

		return projectedRows;
	}

	async findStockProjectedQty(params?: Inventory.ListStockProjectedQtyInput) {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const projectedRows = await this.collectStockProjectedQtyRows(params);

		return projectedRows.slice(skip, skip + take);
	}

	/**
	 * Get items with negative projected quantity, indicating an active shortage.
	 *
	 * Results are sorted by projectedQty ascending so the most critical shortages
	 * appear first, mirroring ERPNext's Item Shortage Report behavior.
	 */
	async findItemShortageReport(
		params?: Inventory.ListItemShortageInput,
	): Promise<Inventory.ItemShortageRow[]> {
		const company = params?.company?.trim();
		const warehouses = params?.warehouses?.map((w) => w.trim()).filter(Boolean);

		if (warehouses && warehouses.length > 0) {
			const rowMap = new Map<string, Inventory.ItemShortageRow>();

			for (const warehouse of warehouses) {
				const projected = await this.collectStockProjectedQtyRows({
					company,
					warehouse,
				});
				const filtered = buildItemShortageRows(projected);
				for (const row of filtered) {
					rowMap.set(row.id, row);
				}
			}

			return [...rowMap.values()].sort(
				(a, b) => a.projectedQty - b.projectedQty,
			);
		}

		const projected = await this.collectStockProjectedQtyRows({ company });

		return buildItemShortageRows(projected);
	}

	/**
	 * Get material-request lines still awaiting stock transfer or material issue.
	 *
	 * Mirrors ERPNext's Requested Items To Be Transferred report by listing
	 * non-draft, non-cancelled Material Requests of purpose Material Transfer or
	 * Material Issue where orderedQty remains below requested quantity.
	 */
	async findRequestedItemsToBeTransferred(
		params?: Inventory.ListRequestedItemsToBeTransferredInput,
	): Promise<Inventory.RequestedItemsToBeTransferredResult> {
		const company = params?.company?.trim();
		const materialRequest = params?.materialRequest?.trim();
		const itemCode = params?.itemCode?.trim();
		const targetWarehouse = params?.targetWarehouse?.trim();
		const purpose = params?.purpose;

		const materialRequests = await this.prisma.materialRequest.findMany({
			where: {
				purpose: purpose
					? purpose
					: {
							in: ["MATERIAL_TRANSFER", "MATERIAL_ISSUE"],
						},
				status: {
					notIn: ["DRAFT", "CANCELLED"],
				},
				...(company
					? {
							company: {
								contains: company,
								mode: "insensitive",
							},
						}
					: {}),
				...(materialRequest
					? {
							series: {
								contains: materialRequest,
								mode: "insensitive",
							},
						}
					: {}),
			},
			include: { items: true },
			orderBy: [{ transactionDate: "asc" }, { series: "asc" }],
		});

		const itemCodes = [
			...new Set(
				materialRequests.flatMap((request) =>
					request.items.map((item) => item.itemCode),
				),
			),
		];

		const inventoryItems =
			itemCodes.length > 0
				? await this.prisma.inventoryItem.findMany({
						where: {
							code: {
								in: itemCodes,
							},
						},
						select: {
							code: true,
							name: true,
							description: true,
						},
					})
				: [];

		const itemMetadata = new Map(
			inventoryItems.map(
				(item) =>
					[
						item.code,
						{
							name: item.name,
							description: item.description,
						},
					] as const,
			),
		);

		const sourceRows = materialRequests.flatMap((request) =>
			request.items
				.map((item) => {
					const resolvedTargetWarehouse =
						item.targetWarehouse ?? request.targetWarehouse ?? null;

					if (
						itemCode &&
						!item.itemCode.toLowerCase().includes(itemCode.toLowerCase())
					) {
						return null;
					}

					if (
						targetWarehouse &&
						!(resolvedTargetWarehouse ?? "")
							.toLowerCase()
							.includes(targetWarehouse.toLowerCase())
					) {
						return null;
					}

					const metadata = itemMetadata.get(item.itemCode);

					return {
						id: item.id,
						materialRequestId: request.id,
						materialRequest: request.series,
						date: request.transactionDate,
						purpose: request.purpose,
						status: request.status,
						itemCode: item.itemCode,
						itemName: item.itemName ?? metadata?.name ?? null,
						description: metadata?.description ?? null,
						company: request.company,
						targetWarehouse: resolvedTargetWarehouse,
						requiredBy: item.requiredBy ?? request.requiredBy ?? null,
						unitOfMeasure: item.unitOfMeasure ?? null,
						qty: item.quantity,
						transferredQty: item.orderedQty,
					};
				})
				.filter((row): row is NonNullable<typeof row> => row != null),
		);

		const rows = buildRequestedItemsToBeTransferredRows(sourceRows);

		return {
			rows,
			summary: summarizeRequestedItemsToBeTransferredRows(rows),
		};
	}
	/**
	 * Get batch-wise balance history rows.
	 *
	 * Queries all non-disabled `Batch` records matching the given filters and
	 * classifies each batch as either opening (received before `fromDate`) or
	 * incoming (received within the date window). Balance qty reflects the
	 * current on-hand quantity stored on the batch record.
	 */
	async findBatchWiseBalanceHistory(
		params: Inventory.ListBatchWiseBalanceInput,
	): Promise<Inventory.BatchWiseBalanceRow[]> {
		const company = params.company.trim();
		const fromDate = params.fromDate;
		const toDate = params.toDate;
		const itemCode = params.itemCode?.trim();
		const warehouse = params.warehouse?.trim();
		const batchNo = params.batchNo?.trim();

		if (fromDate > toDate) {
			throw new BadRequestException(
				"'From Date' must not be later than 'To Date'.",
			);
		}

		const batches = (await this.batchModel.findMany({
			where: {
				company: { contains: company, mode: "insensitive" },
				isDisabled: false,
				...(itemCode
					? {
							item: {
								code: {
									contains: itemCode,
									mode: "insensitive",
								},
							},
						}
					: {}),
				...(warehouse
					? {
							currentWarehouse: {
								name: {
									contains: warehouse,
									mode: "insensitive",
								},
							},
						}
					: {}),
				...(batchNo
					? {
							batchId: {
								contains: batchNo,
								mode: "insensitive",
							},
						}
					: {}),
			},
			select: {
				id: true,
				batchId: true,
				company: true,
				quantity: true,
				manufacturingDate: true,
				expiryDate: true,
				item: {
					select: {
						code: true,
						name: true,
						description: true,
						valuationRate: true,
						defaultUnitOfMeasure: {
							select: { name: true },
						},
					},
				},
				currentWarehouse: {
					select: { name: true },
				},
				purchaseReceipt: {
					select: { postingDate: true },
				},
				stockEntry: {
					select: { postingDate: true },
				},
			},
			orderBy: [{ item: { code: "asc" } }, { batchId: "asc" }],
		})) as BatchWiseBalanceSourceBatch[];

		return buildBatchWiseBalanceRows(batches, { fromDate, toDate });
	}

	/**
	 * Get batch item expiry status rows.
	 *
	 * Returns all active (non-disabled, qty > 0) batches whose record was
	 * created within [fromDate, toDate], optionally filtered by item code.
	 * Rows are ordered by creation date ascending then batch id.
	 */
	async findBatchItemExpiry(
		params: Inventory.ListBatchItemExpiryInput,
	): Promise<Inventory.BatchItemExpiryRow[]> {
		const fromDate = params.fromDate;
		const toDate = params.toDate;
		const itemCode = params.itemCode?.trim();

		if (fromDate > toDate) {
			throw new BadRequestException(
				"'From Date' must not be later than 'To Date'.",
			);
		}

		const batches = (await this.batchModel.findMany({
			where: {
				isDisabled: false,
				quantity: { gt: 0 },
				createdAt: {
					gte: fromDate,
					lte: toDate,
				},
				...(itemCode
					? {
							item: {
								code: { contains: itemCode, mode: "insensitive" },
							},
						}
					: {}),
			},
			select: {
				id: true,
				batchId: true,
				quantity: true,
				expiryDate: true,
				createdAt: true,
				item: {
					select: {
						code: true,
						name: true,
						defaultUnitOfMeasure: {
							select: { name: true },
						},
					},
				},
			},
			orderBy: [{ createdAt: "asc" }, { batchId: "asc" }],
		})) as BatchItemExpirySourceBatch[];

		return buildBatchItemExpiryRows(batches);
	}

	/**
	 * Get item prices rows showing each item's valuation rate, selling rate, and
	 * last purchase rate, filtered by enabled/disabled status and optional
	 * item code, group, and brand searches.
	 */
	async findItemPrices(
		params?: Inventory.ListItemPricesInput,
	): Promise<Inventory.ItemPricesRow[]> {
		const itemsFilter = params?.itemsFilter ?? "enabled";
		const itemCode = params?.itemCode?.trim();
		const itemGroup = params?.itemGroup?.trim();
		const brand = params?.brand?.trim();

		const disabledFilter =
			itemsFilter === "enabled"
				? false
				: itemsFilter === "disabled"
					? true
					: undefined;

		const items = (await this.prisma.item.findMany({
			where: {
				...(disabledFilter !== undefined ? { disabled: disabledFilter } : {}),
				...(itemCode
					? { code: { contains: itemCode, mode: "insensitive" } }
					: {}),
				...(itemGroup
					? {
							itemGroup: {
								is: { groupName: { contains: itemGroup, mode: "insensitive" } },
							},
						}
					: {}),
				...(brand
					? {
							brand: {
								name: { contains: brand, mode: "insensitive" },
							},
						}
					: {}),
			},
			select: {
				code: true,
				name: true,
				description: true,
				disabled: true,
				itemGroup: { select: { groupName: true } },
				brand: { select: { name: true } },
				defaultUnitOfMeasure: { select: { name: true } },
				valuationRate: true,
				standardSellingRate: true,
			},
		})) as ItemPricesSourceItem[];

		if (items.length === 0) {
			return [];
		}

		const itemCodes = items.map((item) => item.code);

		// Derive the last purchase rate from the most-recent purchase receipt item
		// per item code, ordered by the receipt's posting date descending.
		const lastPurchaseRows = await this.prisma.purchaseReceiptItem.findMany({
			where: {
				itemCode: { in: itemCodes },
				purchaseReceipt: { status: { notIn: ["DRAFT", "CANCELLED"] } },
			},
			select: {
				itemCode: true,
				rate: true,
				purchaseReceipt: { select: { postingDate: true } },
			},
			orderBy: [
				{ purchaseReceipt: { postingDate: "desc" } },
				{ itemCode: "asc" },
			],
		});

		// Keep only the most recent rate per item code.
		const lastPurchaseRateByCode = new Map<string, number>();
		for (const row of lastPurchaseRows) {
			if (!lastPurchaseRateByCode.has(row.itemCode)) {
				lastPurchaseRateByCode.set(row.itemCode, row.rate);
			}
		}

		return buildItemPricesRows(items, lastPurchaseRateByCode);
	}

	/**
	 * Get stock summary rows for operational triage, ordered by a selected metric.
	 */
	async findStockSummary(params?: Inventory.ListStockSummaryInput) {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const projectedRows = await this.collectStockProjectedQtyRows(params);
		const summaryRows = buildStockSummaryRows(
			projectedRows.map((row) => ({
				id: row.id,
				company: row.company,
				itemCode: row.itemCode,
				itemName: row.itemName ?? null,
				description: row.description ?? null,
				itemGroupName: row.itemGroupName ?? null,
				brandName: row.brandName ?? null,
				warehouse: row.warehouse,
				unitOfMeasure: row.unitOfMeasure ?? null,
				actualQty: row.actualQty,
				plannedQty: row.plannedQty,
				requestedQty: row.requestedQty,
				orderedQty: row.orderedQty,
				reservedQty: row.reservedQty,
				reservedQtyForProduction: row.reservedQtyForProduction,
				reservedQtyForSubcontracting: row.reservedQtyForSubcontracting,
				reservedQtyForProductionPlan: row.reservedQtyForProductionPlan,
				projectedQty: row.projectedQty,
				reorderLevel: row.reorderLevel,
				reorderQty: row.reorderQty,
				shortageQty: row.shortageQty,
				lastActivityDate: row.lastActivityDate ?? null,
			})),
			{
				metric: params?.metric,
				sortDirection: params?.sortDirection,
			},
		);

		return summaryRows.slice(skip, skip + take);
	}

	/**
	 * Get item price stock rows by combining current stock availability with
	 * configured buying/selling rates for each item.
	 */
	async findItemPriceStock(params?: Inventory.ListItemPriceStockInput) {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const projectedRows = await this.collectStockProjectedQtyRows(params);

		if (projectedRows.length === 0) {
			return [];
		}

		const itemCodes = [...new Set(projectedRows.map((row) => row.itemCode))];
		const priceMetadata = await this.prisma.inventoryItem.findMany({
			where: {
				code: {
					in: itemCodes,
				},
			},
			select: {
				code: true,
				valuationRate: true,
				standardSellingRate: true,
			},
		});

		const ratesByCode = new Map(
			priceMetadata.map((item) => [item.code, item] as const),
		);

		const rows = buildItemPriceStockRows(
			projectedRows.map((row) => {
				const rates = ratesByCode.get(row.itemCode);
				return {
					id: row.id,
					company: row.company,
					itemCode: row.itemCode,
					itemName: row.itemName,
					itemGroupName: row.itemGroupName,
					brandName: row.brandName,
					warehouse: row.warehouse,
					actualQty: row.actualQty,
					buyingRate: rates?.valuationRate ?? 0,
					sellingRate: rates?.standardSellingRate ?? 0,
					lastActivityDate: row.lastActivityDate,
				};
			}),
			{
				includeZeroStockItems: params?.includeZeroStockItems,
			},
		);

		return rows.slice(skip, skip + take);
	}

	/**
	 * Get stock ageing rows using FIFO-preserved layer ages across warehouses.
	 */
	async findStockAgeing(params?: Inventory.ListStockAgeingInput) {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;
		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const company = params?.company?.trim();
		const warehouse = params?.warehouse?.trim();
		const itemCode = params?.itemCode?.trim();
		const brand = params?.brand?.trim();
		const asOfDate = params?.asOfDate ?? new Date();
		const bucketRanges = parseStockAgeingBucketRanges(params?.ageingRanges);

		let filteredItemCodes: string[] | undefined;

		if (brand) {
			const matchingItems = await this.prisma.item.findMany({
				where: {
					brand: {
						name: {
							contains: brand,
							mode: "insensitive",
						},
					},
				},
				select: { code: true },
			});

			filteredItemCodes = matchingItems.map((item) => item.code);

			if (filteredItemCodes.length === 0) {
				return [];
			}
		}

		const whereClauses: Prisma.StockEntryItemWhereInput[] = [
			{
				stockEntry: {
					status: "SUBMITTED",
					postingDate: {
						lte: asOfDate,
					},
					...(company
						? {
								company: {
									contains: company,
									mode: "insensitive",
								},
							}
						: {}),
				},
			},
		];

		if (itemCode) {
			whereClauses.push({
				itemCode: {
					contains: itemCode,
					mode: "insensitive",
				},
			});
		}

		if (filteredItemCodes) {
			whereClauses.push({
				itemCode: {
					in: filteredItemCodes,
				},
			});
		}

		if (warehouse) {
			whereClauses.push({
				OR: [
					{ sourceWarehouse: { equals: warehouse, mode: "insensitive" } },
					{ targetWarehouse: { equals: warehouse, mode: "insensitive" } },
					{
						stockEntry: {
							defaultSourceWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
					{
						stockEntry: {
							defaultTargetWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
				],
			});
		}

		const stockItems = await this.prisma.stockEntryItem.findMany({
			where:
				whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses },
			include: { stockEntry: true },
			orderBy: [
				{ stockEntry: { postingDate: "asc" } },
				{ stockEntry: { createdAt: "asc" } },
				{ id: "asc" },
			],
		});

		if (stockItems.length === 0) {
			return [];
		}

		const ageingRows = buildStockAgeingRows(stockItems, {
			asOfDate,
			showWarehouseWiseStock: params?.showWarehouseWiseStock,
			bucketRanges,
		});

		if (ageingRows.length === 0) {
			return [];
		}

		const itemCodes = [...new Set(ageingRows.map((row) => row.itemCode))];
		const [inventoryItems, brandMetadata] = await Promise.all([
			this.prisma.inventoryItem.findMany({
				where: { code: { in: itemCodes } },
				include: {
					defaultUnitOfMeasure: {
						select: { name: true },
					},
					itemGroup: {
						select: { groupName: true },
					},
				},
			}),
			this.prisma.item.findMany({
				where: { code: { in: itemCodes } },
				select: {
					code: true,
					brand: {
						select: { name: true },
					},
				},
			}),
		]);

		const inventoryItemsByCode = new Map(
			inventoryItems.map((item) => [item.code, item] as const),
		);
		const brandNamesByCode = new Map(
			brandMetadata.map(
				(item) => [item.code, item.brand?.name ?? null] as const,
			),
		);

		return ageingRows
			.map((row) => {
				const inventoryItem = inventoryItemsByCode.get(row.itemCode);
				return {
					...row,
					itemName: row.itemName ?? inventoryItem?.name ?? null,
					description: row.description ?? inventoryItem?.description ?? null,
					itemGroupName: inventoryItem?.itemGroup?.groupName ?? null,
					brandName: brandNamesByCode.get(row.itemCode) ?? null,
					unitOfMeasure:
						row.unitOfMeasure ??
						inventoryItem?.defaultUnitOfMeasure?.name ??
						null,
				};
			})
			.slice(skip, skip + take);
	}

	/**
	 * Build the Stock Analytics report — period-by-period running stock
	 * balances for all matching items.
	 *
	 * The query fetches all submitted StockEntryItems up to `toDate` so that
	 * running balances are accurate even when `fromDate` is mid-history.
	 */
	async findStockAnalytics(
		params: Inventory.ListStockAnalyticsInput,
	): Promise<Inventory.StockAnalyticsResult> {
		const company = params.company?.trim();
		const warehouse = params.warehouse?.trim();
		const itemCode = params.itemCode?.trim();
		const itemGroup = params.itemGroup?.trim();
		const brand = params.brand?.trim();
		const { fromDate, toDate, frequency, valueQuantity } = params;

		if (fromDate > toDate) {
			throw new BadRequestException(
				"'From Date' must not be later than 'To Date'.",
			);
		}

		// Resolve item codes for item group / brand filters
		let filteredItemCodes: string[] | undefined;

		if (itemGroup || brand) {
			const matchingItems = await this.prisma.item.findMany({
				where: {
					...(itemGroup
						? {
								itemGroup: {
									groupName: {
										contains: itemGroup,
										mode: "insensitive",
									},
								},
							}
						: {}),
					...(brand
						? {
								brand: {
									name: {
										contains: brand,
										mode: "insensitive",
									},
								},
							}
						: {}),
				},
				select: { code: true },
			});

			filteredItemCodes = matchingItems.map((i) => i.code);

			if (filteredItemCodes.length === 0) {
				const periods = getPeriodDateRangesForService(
					fromDate,
					toDate,
					frequency,
				);
				return { periods, rows: [] };
			}
		}

		// Build item code filter for direct itemCode param
		const whereClauses: Prisma.StockEntryItemWhereInput[] = [
			{
				stockEntry: {
					status: "SUBMITTED",
					postingDate: { lte: toDate },
					...(company
						? { company: { contains: company, mode: "insensitive" } }
						: {}),
				},
			},
		];

		if (itemCode) {
			whereClauses.push({
				itemCode: { contains: itemCode, mode: "insensitive" },
			});
		}

		if (filteredItemCodes) {
			whereClauses.push({ itemCode: { in: filteredItemCodes } });
		}

		if (warehouse) {
			whereClauses.push({
				OR: [
					{ sourceWarehouse: { equals: warehouse, mode: "insensitive" } },
					{ targetWarehouse: { equals: warehouse, mode: "insensitive" } },
					{
						stockEntry: {
							defaultSourceWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
					{
						stockEntry: {
							defaultTargetWarehouse: {
								equals: warehouse,
								mode: "insensitive",
							},
						},
					},
				],
			});
		}

		const stockItems = await this.prisma.stockEntryItem.findMany({
			where:
				whereClauses.length === 1 ? whereClauses[0] : { AND: whereClauses },
			include: { stockEntry: true },
			orderBy: [
				{ stockEntry: { postingDate: "asc" } },
				{ stockEntry: { createdAt: "asc" } },
				{ id: "asc" },
			],
		});

		if (stockItems.length === 0) {
			const periods = getPeriodDateRangesForService(
				fromDate,
				toDate,
				frequency,
			);
			return { periods, rows: [] };
		}

		// Map raw stock items to source entries using buildStockLedgerRows
		const ledgerRows = buildStockLedgerRows(stockItems, { warehouse });

		const sourceEntries: StockAnalyticsSourceEntry[] = ledgerRows.map(
			(row) => ({
				company: row.company,
				itemCode: row.itemCode,
				warehouse: row.warehouse,
				postingDate: row.postingDate,
				qtyChange: row.qtyIn - row.qtyOut,
				valueChange:
					row.qtyIn > 0
						? row.basicAmount
						: row.qtyOut > 0
							? -row.basicAmount
							: 0,
			}),
		);

		// Build item metadata map
		const itemCodes = [...new Set(sourceEntries.map((e) => e.itemCode))];
		const [inventoryItems, itemMeta] = await Promise.all([
			this.prisma.inventoryItem.findMany({
				where: { code: { in: itemCodes } },
				include: {
					defaultUnitOfMeasure: { select: { name: true } },
					itemGroup: { select: { groupName: true } },
				},
			}),
			this.prisma.item.findMany({
				where: { code: { in: itemCodes } },
				select: {
					code: true,
					brand: { select: { name: true } },
				},
			}),
		]);

		const inventoryItemsByCode = new Map(
			inventoryItems.map((item) => [item.code, item] as const),
		);
		const brandByCode = new Map(
			itemMeta.map((item) => [item.code, item.brand?.name ?? null] as const),
		);

		const metaMap = new Map<
			string,
			{
				itemName?: string | null;
				itemGroup?: string | null;
				brand?: string | null;
				unitOfMeasure?: string | null;
			}
		>();

		for (const code of itemCodes) {
			const inv = inventoryItemsByCode.get(code);
			metaMap.set(code, {
				itemName: inv?.name ?? null,
				itemGroup: inv?.itemGroup?.groupName ?? null,
				brand: brandByCode.get(code) ?? null,
				unitOfMeasure: inv?.defaultUnitOfMeasure?.name ?? null,
			});
		}

		return buildStockAnalyticsRows(sourceEntries, metaMap, {
			fromDate,
			toDate,
			frequency,
			valueQuantity,
		});
	}

	// ============================================================================
	// Purchase Receipt Methods
	// ============================================================================

	private roundCurrency(value: number): number {
		const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
		return Object.is(rounded, -0) ? 0 : rounded;
	}

	private normalizePurchaseReceiptSeriesPattern(
		seriesPattern?: string | null,
	): string {
		const raw = seriesPattern?.trim();
		if (!raw) {
			return "MAT-PRE-.YYYY.-";
		}
		return raw;
	}

	private resolvePurchaseReceiptSeriesPrefix(
		seriesPattern: string,
		date: Date,
	): string {
		const year = String(date.getFullYear());
		let prefix = seriesPattern
			.replace(/\.YYYY\./g, year)
			.replace(/YYYY/g, year)
			.replace(/\./g, "")
			.replace(/--+/g, "-")
			.trim();

		if (!prefix.endsWith("-")) {
			prefix = `${prefix}-`;
		}

		return prefix;
	}

	private normalizePostingTime(
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

	private computePurchaseReceiptTotals(
		items: Array<{
			acceptedQuantity: number;
			rejectedQuantity: number;
			rate: number;
		}>,
		taxes: Array<{ taxRate: number; amount?: number | null }>,
		options: {
			isReturn: boolean;
			disableRoundedTotal: boolean;
			preferProvidedTaxAmounts: boolean;
		},
	): {
		items: Array<{ amount: number }>;
		taxes: Array<{ amount: number; total: number }>;
		totals: {
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
		};
	} {
		const sign = options.isReturn ? -1 : 1;

		const computedItems = items.map((item) => {
			const acceptedQuantity = this.roundCurrency(item.acceptedQuantity * sign);
			const rejectedQuantity = this.roundCurrency(item.rejectedQuantity * sign);
			const rowQuantity = this.roundCurrency(
				acceptedQuantity + rejectedQuantity,
			);
			const amount = this.roundCurrency(rowQuantity * item.rate);

			return { amount, acceptedQuantity, rejectedQuantity, rowQuantity };
		});

		const totalAcceptedQuantity = this.roundCurrency(
			computedItems.reduce((sum, item) => sum + item.acceptedQuantity, 0),
		);
		const totalRejectedQuantity = this.roundCurrency(
			computedItems.reduce((sum, item) => sum + item.rejectedQuantity, 0),
		);
		const totalQuantity = this.roundCurrency(
			computedItems.reduce((sum, item) => sum + item.rowQuantity, 0),
		);
		const totalAmount = this.roundCurrency(
			computedItems.reduce((sum, item) => sum + item.amount, 0),
		);

		let runningTotal = totalAmount;
		const computedTaxes = taxes.map((tax) => {
			const providedAmount =
				typeof tax.amount === "number" && Number.isFinite(tax.amount)
					? tax.amount
					: null;
			const shouldUseProvidedAmount =
				providedAmount !== null &&
				(options.preferProvidedTaxAmounts ||
					Math.abs(tax.taxRate) < Number.EPSILON);
			const amount = shouldUseProvidedAmount
				? this.roundCurrency(providedAmount)
				: this.roundCurrency((totalAmount * tax.taxRate) / 100);

			runningTotal = this.roundCurrency(runningTotal + amount);
			return {
				amount,
				total: runningTotal,
			};
		});

		const taxesAndChargesAdded = this.roundCurrency(
			computedTaxes.reduce((sum, tax) => {
				return tax.amount > 0 ? sum + tax.amount : sum;
			}, 0),
		);
		const taxesAndChargesDeducted = this.roundCurrency(
			computedTaxes.reduce((sum, tax) => {
				return tax.amount < 0 ? sum + Math.abs(tax.amount) : sum;
			}, 0),
		);
		const totalTaxesAndCharges = this.roundCurrency(
			computedTaxes.reduce((sum, tax) => sum + tax.amount, 0),
		);
		const grandTotal = this.roundCurrency(totalAmount + totalTaxesAndCharges);
		const roundedTotal = options.disableRoundedTotal
			? grandTotal
			: Math.round(grandTotal);
		const roundingAdjustment = options.disableRoundedTotal
			? 0
			: this.roundCurrency(roundedTotal - grandTotal);

		return {
			items: computedItems.map((item) => ({ amount: item.amount })),
			taxes: computedTaxes,
			totals: {
				totalQuantity,
				totalAcceptedQuantity,
				totalRejectedQuantity,
				totalAmount,
				taxesAndChargesAdded,
				taxesAndChargesDeducted,
				totalTaxesAndCharges,
				grandTotal,
				roundingAdjustment,
				roundedTotal,
			},
		};
	}

	/**
	 * Generate a unique series number for a new Purchase Receipt.
	 * Format default: MAT-PRE-YYYY-NNNNN.
	 */
	private async generatePurchaseReceiptSeries(
		date: Date,
		seriesPattern?: string | null,
	): Promise<string> {
		const normalizedPattern =
			this.normalizePurchaseReceiptSeriesPattern(seriesPattern);
		const prefix = this.resolvePurchaseReceiptSeriesPrefix(
			normalizedPattern,
			date,
		);

		const lastReceipt = await this.prisma.purchaseReceipt.findFirst({
			where: {
				series: { startsWith: prefix },
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		let nextNumber = 1;
		if (lastReceipt) {
			const numStr = lastReceipt.series.slice(prefix.length);
			const num = parseInt(numStr, 10);
			if (!Number.isNaN(num)) {
				nextNumber = num + 1;
			}
		}

		return `${prefix}${String(nextNumber).padStart(5, "0")}`;
	}

	/**
	 * Aggregate purchase receipt item data into period/dimension trend rows.
	 *
	 * @param params - Filter input from the frontend
	 * @returns Period buckets + aggregated dimension rows + grand totals
	 */
	async findPurchaseReceiptTrends(
		params: Inventory.ListPurchaseReceiptTrendsInput,
	): Promise<Inventory.PurchaseReceiptTrendsResult> {
		const company = params.company.trim();
		const supplier = params.supplier?.trim();
		const itemCode = params.itemCode?.trim();
		const warehouse = params.warehouse?.trim();
		const { fromDate, toDate, period, basedOn } = params;

		if (fromDate > toDate) {
			throw new BadRequestException(
				"'From Date' must not be later than 'To Date'.",
			);
		}

		const periods = buildPurchaseReceiptTrendsPeriods(fromDate, toDate, period);

		// Statuses that represent submitted (non-draft, non-cancelled) purchase receipts
		const submittedStatuses: Prisma.EnumPurchaseReceiptStatusFilter = {
			in: ["PARTLY_BILLED", "TO_BILL", "COMPLETED", "RETURN_ISSUED", "CLOSED"],
		};

		const receiptWhere: Prisma.PurchaseReceiptWhereInput = {
			status: submittedStatuses,
			company: { contains: company, mode: "insensitive" },
			postingDate: { gte: fromDate, lte: toDate },
			...(supplier
				? { supplier: { contains: supplier, mode: "insensitive" } }
				: {}),
		};

		const itemWhere: Prisma.PurchaseReceiptItemWhereInput = {};
		if (itemCode) {
			itemWhere.itemCode = { contains: itemCode, mode: "insensitive" };
		}
		if (warehouse) {
			itemWhere.acceptedWarehouse = {
				contains: warehouse,
				mode: "insensitive",
			};
		}

		// For Item Group dimension, pre-resolve item codes → group name
		let itemCodeToGroup: Map<string, string> | undefined;

		if (basedOn === "Item Group") {
			const items = await this.prisma.item.findMany({
				select: {
					code: true,
					itemGroup: { select: { groupName: true } },
				},
			});
			itemCodeToGroup = new Map<string, string>();
			for (const item of items) {
				if (item.itemGroup?.groupName) {
					itemCodeToGroup.set(item.code, item.itemGroup.groupName);
				}
			}
		}

		const receipts = await this.prisma.purchaseReceipt.findMany({
			where: receiptWhere,
			select: {
				postingDate: true,
				supplier: true,
				items: {
					where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
					select: {
						itemCode: true,
						itemName: true,
						acceptedQuantity: true,
						amount: true,
					},
				},
			},
		});

		const entries: PurchaseReceiptTrendsSourceEntry[] = [];

		for (const receipt of receipts) {
			for (const item of receipt.items) {
				let dimensionKey: string;
				let dimensionLabel: string | null | undefined;

				switch (basedOn) {
					case "Item": {
						dimensionKey = item.itemCode;
						dimensionLabel = item.itemName;
						break;
					}
					case "Item Group": {
						const group = itemCodeToGroup?.get(item.itemCode);
						if (!group) continue; // skip items with no group
						dimensionKey = group;
						dimensionLabel = null;
						break;
					}
					case "Supplier": {
						dimensionKey = receipt.supplier;
						dimensionLabel = null;
						break;
					}
					default:
						continue;
				}

				entries.push({
					postingDate: receipt.postingDate,
					quantity: item.acceptedQuantity,
					amount: item.amount,
					dimensionKey,
					dimensionLabel,
				});
			}
		}

		return buildPurchaseReceiptTrendsRows(entries, periods);
	}

	// ---------------------------------------------------------------------------
	// Sales Order Analysis
	// ---------------------------------------------------------------------------

	/**
	 * Return all Sales Order line items (or SO-grouped rows) within the given
	 * date range, with delay and billing completion metrics.
	 *
	 * @remarks
	 * - Excludes DRAFT orders.
	 * - Delay is clamped to 0 for COMPLETED / TO_BILL orders.
	 * - timeTakenToDeliverSeconds is 0 unless a delivery has been recorded.
	 * - When groupBySalesOrder is true, numeric fields are summed per SO and
	 *   item-level fields (itemCode, warehouse, description) are set to null.
	 */
	async findSalesOrderAnalysis(
		params: Inventory.ListSalesOrderAnalysisInput,
	): Promise<Inventory.SalesOrderAnalysisResult> {
		const company = params.company.trim();
		const warehouse = params.warehouse?.trim();
		const { fromDate, toDate, groupBySalesOrder } = params;

		if (fromDate > toDate) {
			throw new BadRequestException(
				"'From Date' must not be later than 'To Date'.",
			);
		}

		const statusFilter: Prisma.EnumSalesOrderStatusFilter = params.status
			?.length
			? { in: params.status }
			: {
					in: [
						"TO_DELIVER_AND_BILL",
						"TO_DELIVER",
						"TO_BILL",
						"COMPLETED",
						"CLOSED",
					],
				};

		const soWhere: Prisma.SalesOrderWhereInput = {
			company: { contains: company, mode: "insensitive" },
			transactionDate: { gte: fromDate, lte: toDate },
			status: statusFilter,
			...(params.salesOrders?.length
				? { series: { in: params.salesOrders } }
				: {}),
		};

		const itemWhere: Prisma.SalesOrderItemWhereInput = warehouse
			? { warehouse: { contains: warehouse, mode: "insensitive" } }
			: {};

		const orders = await this.prisma.salesOrder.findMany({
			where: soWhere,
			orderBy: [{ transactionDate: "asc" }, { series: "asc" }],
			select: {
				id: true,
				series: true,
				transactionDate: true,
				customer: true,
				company: true,
				status: true,
				conversionRate: true,
				items: {
					where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
					orderBy: { itemCode: "asc" },
					select: {
						id: true,
						itemCode: true,
						itemName: true,
						description: true,
						deliveryDate: true,
						qty: true,
						deliveredQty: true,
						billedQty: true,
						baseRate: true,
						amount: true,
						baseAmount: true,
						billedAmount: true,
						warehouse: true,
						lastDeliveryDate: true,
					},
				},
			},
		});

		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);

		const rows = buildSalesOrderAnalysisRows(
			orders,
			today,
			groupBySalesOrder ?? false,
		);

		const summary = computeSalesOrderAnalysisSummary(rows);

		return { rows, summary };
	}

	/**
	 * Run the Purchase Order Analysis report.
	 *
	 * @remarks
	 * - Excludes DRAFT, STOPPED, and ON_HOLD orders by default.
	 * - When groupByPurchaseOrder is true, numeric fields are summed per PO and
	 *   item-level fields (itemCode, project, warehouse) are set to null.
	 */
	async findPurchaseOrderAnalysis(
		params: Inventory.ListPurchaseOrderAnalysisInput,
	): Promise<Inventory.PurchaseOrderAnalysisResult> {
		const company = params.company.trim();
		const project = params.project?.trim();
		const { fromDate, toDate, groupByPurchaseOrder } = params;

		if (fromDate > toDate) {
			throw new BadRequestException(
				"'From Date' must not be later than 'To Date'.",
			);
		}

		const statusFilter: Prisma.EnumPurchaseOrderStatusFilter = params.status
			?.length
			? { in: params.status }
			: {
					in: [
						"TO_PAY",
						"TO_BILL",
						"TO_RECEIVE",
						"TO_RECEIVE_AND_BILL",
						"COMPLETED",
						"CLOSED",
					],
				};

		const poWhere: Prisma.PurchaseOrderWhereInput = {
			company: { contains: company, mode: "insensitive" },
			transactionDate: { gte: fromDate, lte: toDate },
			status: statusFilter,
			...(params.purchaseOrders?.length
				? { series: { in: params.purchaseOrders } }
				: {}),
		};

		const itemWhere: Prisma.PurchaseOrderItemWhereInput = project
			? { project: { contains: project, mode: "insensitive" } }
			: {};

		const orders = await this.prisma.purchaseOrder.findMany({
			where: poWhere,
			orderBy: [{ transactionDate: "asc" }, { series: "asc" }],
			select: {
				id: true,
				series: true,
				transactionDate: true,
				supplier: true,
				company: true,
				status: true,
				conversionRate: true,
				items: {
					where: Object.keys(itemWhere).length > 0 ? itemWhere : undefined,
					orderBy: { itemCode: "asc" },
					select: {
						id: true,
						itemCode: true,
						itemName: true,
						requiredDate: true,
						qty: true,
						receivedQty: true,
						billedQty: true,
						baseRate: true,
						amount: true,
						baseAmount: true,
						billedAmount: true,
						receivedQtyAmount: true,
						warehouse: true,
						project: true,
					},
				},
			},
		});

		const rows = buildPurchaseOrderAnalysisRows(
			orders,
			groupByPurchaseOrder ?? false,
		);

		const summary = computePurchaseOrderAnalysisSummary(rows);

		return { rows, summary };
	}

	/**
	 * Get purchase receipts with bounded pagination, optional status filter, and search.
	 */
	async findAllPurchaseReceipts(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.PurchaseReceiptStatus;
	}): Promise<Inventory.PurchaseReceipt[]> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? 100;
		const search = params?.search?.trim();

		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const where: Prisma.PurchaseReceiptWhereInput = {
			...(params?.status ? { status: params.status } : {}),
			...(search
				? {
						OR: [
							{ series: { contains: search, mode: "insensitive" } },
							{ supplier: { contains: search, mode: "insensitive" } },
							{ company: { contains: search, mode: "insensitive" } },
						],
					}
				: {}),
		};

		const receipts = await this.prisma.purchaseReceipt.findMany({
			where,
			orderBy: { createdAt: "desc" },
			include: {
				items: true,
				taxes: true,
			},
			skip,
			take,
		});

		return receipts.map(toInventoryPurchaseReceipt);
	}

	/**
	 * Get a single purchase receipt by id.
	 */
	async findPurchaseReceiptById(
		id: string,
	): Promise<Inventory.PurchaseReceipt | null> {
		const receipt = await this.prisma.purchaseReceipt.findUnique({
			where: { id },
			include: {
				items: true,
				taxes: true,
			},
		});

		return receipt ? toInventoryPurchaseReceipt(receipt) : null;
	}

	/**
	 * Create a new purchase receipt.
	 * Retries up to 3 times on a series uniqueness conflict (P2002).
	 */
	async createPurchaseReceipt(
		data: Inventory.CreatePurchaseReceiptInput,
	): Promise<Inventory.PurchaseReceipt> {
		const postingDate = data.postingDate ?? new Date();
		const postingTime = this.normalizePostingTime(
			data.postingTime,
			postingDate,
		);
		const seriesPattern = this.normalizePurchaseReceiptSeriesPattern(
			data.seriesPattern,
		);
		const isReturn = data.isReturn ?? false;
		const disableRoundedTotal = data.disableRoundedTotal ?? false;

		const computed = this.computePurchaseReceiptTotals(
			data.items.map((item) => ({
				acceptedQuantity: item.acceptedQuantity,
				rejectedQuantity: item.rejectedQuantity ?? 0,
				rate: item.rate ?? 0,
			})),
			(data.taxes ?? []).map((tax) => ({
				taxRate: tax.taxRate ?? 0,
				amount: tax.amount,
			})),
			{
				isReturn,
				disableRoundedTotal,
				preferProvidedTaxAmounts: true,
			},
		);

		for (let attempt = 0; attempt < 3; attempt++) {
			const series = await this.generatePurchaseReceiptSeries(
				postingDate,
				seriesPattern,
			);
			try {
				const created = await this.prisma.purchaseReceipt.create({
					data: {
						series,
						seriesPattern,
						postingDate,
						postingTime,
						editPostingDateTime: data.editPostingDateTime ?? false,
						supplier: data.supplier,
						company: data.company,
						status: data.status ?? "DRAFT",
						isReturn,
						applyPutawayRule: data.applyPutawayRule ?? false,
						supplierDeliveryNote: data.supplierDeliveryNote,
						acceptedWarehouse: data.acceptedWarehouse,
						rejectedWarehouse: data.rejectedWarehouse,
						isSubcontracted: data.isSubcontracted ?? false,
						currency: data.currency,
						priceList: data.priceList,
						disableRoundedTotal,
						...computed.totals,
						supplierAddress: data.supplierAddress,
						contactPerson: data.contactPerson,
						shippingAddressTemplate: data.shippingAddressTemplate,
						companyTRN: data.companyTRN,
						billingAddress: data.billingAddress,
						terms: data.terms,
						termsContent: data.termsContent,
						letterHead: data.letterHead,
						printHeading: data.printHeading,
						groupSameItems: data.groupSameItems ?? false,
						permitNumber: data.permitNumber,
						recoverableStandardRatedExpenses:
							data.recoverableStandardRatedExpenses ?? 0,
						reverseChargeApplicable: data.reverseChargeApplicable ?? "N",
						transporterName: data.transporterName,
						vehicleNumber: data.vehicleNumber,
						vehicleDate: data.vehicleDate,
						instructions: data.instructions,
						remarks: data.remarks,
						isInternalSupplier: data.isInternalSupplier ?? false,
						items: {
							create: data.items.map((item, index) => ({
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								acceptedQuantity: item.acceptedQuantity,
								rejectedQuantity: item.rejectedQuantity ?? 0,
								rate: item.rate ?? 0,
								amount: computed.items[index]?.amount ?? 0,
								uom: item.uom,
								acceptedWarehouse: item.acceptedWarehouse,
								rejectedWarehouse: item.rejectedWarehouse,
							})),
						},
						taxes: {
							create: (data.taxes ?? []).map((tax, index) => ({
								type: tax.type,
								accountHead: tax.accountHead,
								taxRate: tax.taxRate ?? 0,
								amount: computed.taxes[index]?.amount ?? 0,
								total: computed.taxes[index]?.total ?? 0,
							})),
						},
					},
					include: {
						items: true,
						taxes: true,
					},
				});

				return toInventoryPurchaseReceipt(created);
			} catch (error) {
				const isSeriesConflict =
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002";
				if (isSeriesConflict && attempt < 2) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.computeBackoffMs(attempt)),
					);
					continue;
				}
				throw error;
			}
		}

		throw new ConflictException("Failed to allocate a unique series number");
	}

	/**
	 * Update an existing purchase receipt with nested items/taxes upsert logic.
	 */
	async updatePurchaseReceipt(
		data: Inventory.UpdatePurchaseReceiptInput,
	): Promise<Inventory.PurchaseReceipt> {
		const { id, items, taxes, ...rest } = data;

		const existing = await this.prisma.purchaseReceipt.findUnique({
			where: { id },
			select: {
				id: true,
				isReturn: true,
				disableRoundedTotal: true,
			},
		});

		if (!existing) {
			throw new NotFoundException(`Purchase receipt with ID ${id} not found`);
		}

		const effectiveIsReturn = rest.isReturn ?? existing.isReturn;
		const effectiveDisableRoundedTotal =
			rest.disableRoundedTotal ?? existing.disableRoundedTotal;

		const updated = await this.prisma.$transaction(async (tx) => {
			await tx.purchaseReceipt.update({
				where: { id },
				data: {
					...(rest.seriesPattern !== undefined && {
						seriesPattern:
							rest.seriesPattern === null
								? this.normalizePurchaseReceiptSeriesPattern(null)
								: this.normalizePurchaseReceiptSeriesPattern(
										rest.seriesPattern,
									),
					}),
					...(rest.postingDate !== undefined && {
						postingDate: rest.postingDate,
					}),
					...(rest.postingTime !== undefined && {
						postingTime:
							rest.postingTime === null
								? this.normalizePostingTime(undefined, new Date())
								: this.normalizePostingTime(
										rest.postingTime,
										rest.postingDate ?? new Date(),
									),
					}),
					...(rest.editPostingDateTime !== undefined && {
						editPostingDateTime: rest.editPostingDateTime,
					}),
					...(rest.supplier !== undefined && { supplier: rest.supplier }),
					...(rest.company !== undefined && { company: rest.company }),
					...(rest.status !== undefined && { status: rest.status }),
					...(rest.isReturn !== undefined && { isReturn: rest.isReturn }),
					...(rest.applyPutawayRule !== undefined && {
						applyPutawayRule: rest.applyPutawayRule,
					}),
					...(rest.supplierDeliveryNote !== undefined && {
						supplierDeliveryNote: rest.supplierDeliveryNote,
					}),
					...(rest.acceptedWarehouse !== undefined && {
						acceptedWarehouse: rest.acceptedWarehouse,
					}),
					...(rest.rejectedWarehouse !== undefined && {
						rejectedWarehouse: rest.rejectedWarehouse,
					}),
					...(rest.isSubcontracted !== undefined && {
						isSubcontracted: rest.isSubcontracted,
					}),
					...(rest.currency !== undefined && { currency: rest.currency }),
					...(rest.priceList !== undefined && { priceList: rest.priceList }),
					...(rest.disableRoundedTotal !== undefined && {
						disableRoundedTotal: rest.disableRoundedTotal,
					}),
					...(rest.supplierAddress !== undefined && {
						supplierAddress: rest.supplierAddress,
					}),
					...(rest.contactPerson !== undefined && {
						contactPerson: rest.contactPerson,
					}),
					...(rest.shippingAddressTemplate !== undefined && {
						shippingAddressTemplate: rest.shippingAddressTemplate,
					}),
					...(rest.companyTRN !== undefined && {
						companyTRN: rest.companyTRN,
					}),
					...(rest.billingAddress !== undefined && {
						billingAddress: rest.billingAddress,
					}),
					...(rest.terms !== undefined && { terms: rest.terms }),
					...(rest.termsContent !== undefined && {
						termsContent: rest.termsContent,
					}),
					...(rest.letterHead !== undefined && {
						letterHead: rest.letterHead,
					}),
					...(rest.printHeading !== undefined && {
						printHeading: rest.printHeading,
					}),
					...(rest.groupSameItems !== undefined && {
						groupSameItems: rest.groupSameItems,
					}),
					...(rest.permitNumber !== undefined && {
						permitNumber: rest.permitNumber,
					}),
					...(rest.recoverableStandardRatedExpenses !== undefined && {
						recoverableStandardRatedExpenses:
							rest.recoverableStandardRatedExpenses,
					}),
					...(rest.reverseChargeApplicable !== undefined && {
						reverseChargeApplicable: rest.reverseChargeApplicable,
					}),
					...(rest.transporterName !== undefined && {
						transporterName: rest.transporterName,
					}),
					...(rest.vehicleNumber !== undefined && {
						vehicleNumber: rest.vehicleNumber,
					}),
					...(rest.vehicleDate !== undefined && {
						vehicleDate: rest.vehicleDate,
					}),
					...(rest.instructions !== undefined && {
						instructions: rest.instructions,
					}),
					...(rest.remarks !== undefined && { remarks: rest.remarks }),
					...(rest.isInternalSupplier !== undefined && {
						isInternalSupplier: rest.isInternalSupplier,
					}),
				},
			});

			if (items !== undefined) {
				const keptIds = items
					.filter((item): item is typeof item & { id: string } =>
						Boolean(item.id),
					)
					.map((item) => item.id);

				if (keptIds.length > 0) {
					const ownedItems = await tx.purchaseReceiptItem.findMany({
						where: {
							id: { in: keptIds },
							purchaseReceiptId: id,
						},
						select: { id: true },
					});
					const ownedIds = new Set(ownedItems.map((item) => item.id));
					const foreignItemId = keptIds.find((itemId) => !ownedIds.has(itemId));
					if (foreignItemId) {
						throw new BadRequestException(
							`Purchase receipt item with ID ${foreignItemId} does not belong to purchase receipt ${id}`,
						);
					}
				}

				if (keptIds.length === 0) {
					await tx.purchaseReceiptItem.deleteMany({
						where: { purchaseReceiptId: id },
					});
				} else {
					await tx.purchaseReceiptItem.deleteMany({
						where: {
							purchaseReceiptId: id,
							id: { notIn: keptIds },
						},
					});
				}

				for (const item of items) {
					const lineRate = item.rate ?? 0;
					const lineAmount = this.roundCurrency(
						(item.acceptedQuantity + (item.rejectedQuantity ?? 0)) *
							lineRate *
							(effectiveIsReturn ? -1 : 1),
					);

					if (item.id) {
						await tx.purchaseReceiptItem.update({
							where: { id: item.id },
							data: {
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								acceptedQuantity: item.acceptedQuantity,
								rejectedQuantity: item.rejectedQuantity ?? 0,
								rate: lineRate,
								amount: lineAmount,
								uom: item.uom,
								acceptedWarehouse: item.acceptedWarehouse,
								rejectedWarehouse: item.rejectedWarehouse,
							},
						});
					} else {
						await tx.purchaseReceiptItem.create({
							data: {
								purchaseReceiptId: id,
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								acceptedQuantity: item.acceptedQuantity,
								rejectedQuantity: item.rejectedQuantity ?? 0,
								rate: lineRate,
								amount: lineAmount,
								uom: item.uom,
								acceptedWarehouse: item.acceptedWarehouse,
								rejectedWarehouse: item.rejectedWarehouse,
							},
						});
					}
				}
			}

			if (taxes !== undefined) {
				const keptIds = taxes
					.filter((tax): tax is typeof tax & { id: string } => Boolean(tax.id))
					.map((tax) => tax.id);

				if (keptIds.length > 0) {
					const ownedTaxes = await tx.purchaseReceiptTax.findMany({
						where: {
							id: { in: keptIds },
							purchaseReceiptId: id,
						},
						select: { id: true },
					});
					const ownedIds = new Set(ownedTaxes.map((tax) => tax.id));
					const foreignTaxId = keptIds.find((taxId) => !ownedIds.has(taxId));
					if (foreignTaxId) {
						throw new BadRequestException(
							`Purchase receipt tax row with ID ${foreignTaxId} does not belong to purchase receipt ${id}`,
						);
					}
				}

				if (keptIds.length === 0) {
					await tx.purchaseReceiptTax.deleteMany({
						where: { purchaseReceiptId: id },
					});
				} else {
					await tx.purchaseReceiptTax.deleteMany({
						where: {
							purchaseReceiptId: id,
							id: { notIn: keptIds },
						},
					});
				}

				for (const tax of taxes) {
					if (tax.id) {
						await tx.purchaseReceiptTax.update({
							where: { id: tax.id },
							data: {
								type: tax.type,
								accountHead: tax.accountHead,
								taxRate: tax.taxRate ?? 0,
								amount: tax.amount ?? 0,
							},
						});
					} else {
						await tx.purchaseReceiptTax.create({
							data: {
								purchaseReceiptId: id,
								type: tax.type,
								accountHead: tax.accountHead,
								taxRate: tax.taxRate ?? 0,
								amount: tax.amount ?? 0,
								total: 0,
							},
						});
					}
				}
			}

			const allItems = await tx.purchaseReceiptItem.findMany({
				where: { purchaseReceiptId: id },
				orderBy: { id: "asc" },
				select: {
					id: true,
					acceptedQuantity: true,
					rejectedQuantity: true,
					rate: true,
				},
			});
			const allTaxes = await tx.purchaseReceiptTax.findMany({
				where: { purchaseReceiptId: id },
				orderBy: { id: "asc" },
				select: {
					id: true,
					taxRate: true,
					amount: true,
				},
			});

			const recomputed = this.computePurchaseReceiptTotals(
				allItems.map((item) => ({
					acceptedQuantity: item.acceptedQuantity,
					rejectedQuantity: item.rejectedQuantity,
					rate: item.rate,
				})),
				allTaxes.map((tax) => ({
					taxRate: tax.taxRate,
					amount: tax.amount,
				})),
				{
					isReturn: effectiveIsReturn,
					disableRoundedTotal: effectiveDisableRoundedTotal,
					preferProvidedTaxAmounts: taxes !== undefined,
				},
			);

			await Promise.all(
				allItems.map((item, index) =>
					tx.purchaseReceiptItem.update({
						where: { id: item.id },
						data: { amount: recomputed.items[index]?.amount ?? 0 },
					}),
				),
			);

			await Promise.all(
				allTaxes.map((tax, index) =>
					tx.purchaseReceiptTax.update({
						where: { id: tax.id },
						data: {
							amount: recomputed.taxes[index]?.amount ?? 0,
							total: recomputed.taxes[index]?.total ?? 0,
						},
					}),
				),
			);

			await tx.purchaseReceipt.update({
				where: { id },
				data: {
					...recomputed.totals,
				},
			});

			return tx.purchaseReceipt.findUniqueOrThrow({
				where: { id },
				include: {
					items: true,
					taxes: true,
				},
			});
		});

		return toInventoryPurchaseReceipt(updated);
	}

	/**
	 * Delete a single purchase receipt.
	 */
	async deletePurchaseReceipt(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.purchaseReceipt.delete({
				where: { id },
			});
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Purchase receipt with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Delete multiple purchase receipts.
	 */
	async deleteManyPurchaseReceipts(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const uniqueIds = [...new Set(ids)];
		try {
			const result = await this.prisma.purchaseReceipt.deleteMany({
				where: { id: { in: uniqueIds } },
			});
			return { success: true, count: result.count, ids: uniqueIds };
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				this.logger.error(
					`Bulk delete purchase receipts failed [${error.code}]`,
					error.stack,
				);
			}
			throw error;
		}
	}

	// ============================================================================
	// Pick List
	// ============================================================================

	/**
	 * Compute exponential backoff delay for series-conflict retries.
	 * Adds ±50 ms jitter to reduce thundering-herd contention.
	 *
	 * @param attempt - Zero-based attempt index (0 = first retry).
	 * @returns Delay in milliseconds.
	 */
	private computeBackoffMs(attempt: number): number {
		return 50 * 2 ** attempt + Math.floor(Math.random() * 50);
	}

	/**
	 * Generate a unique series number for a pick list using prefix STO-PICK.
	 * Uses read-then-retry with exponential backoff to handle concurrent writes.
	 */
	private async generatePickListSeries(date: Date): Promise<string> {
		const year = date.getFullYear();
		const prefix = `STO-PICK-${year}-`;

		const lastPickList = await this.prisma.pickList.findFirst({
			where: { series: { startsWith: prefix } },
			orderBy: { series: "desc" },
			select: { series: true },
		});

		let nextNumber = 1;
		if (lastPickList) {
			const numStr = lastPickList.series.slice(prefix.length);
			const num = parseInt(numStr, 10);
			if (!Number.isNaN(num)) {
				nextNumber = num + 1;
			}
		}

		return `${prefix}${String(nextNumber).padStart(5, "0")}`;
	}

	/**
	 * Get pick lists with bounded pagination, optional status filter, and search.
	 */
	async findAllPickLists(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.PickListStatus;
	}): Promise<Inventory.PickList[]> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? 100;
		const search = params?.search?.trim();

		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const where: Prisma.PickListWhereInput = {
			...(params?.status ? { status: params.status } : {}),
			...(search
				? {
						OR: [
							{ series: { contains: search, mode: "insensitive" } },
							{ company: { contains: search, mode: "insensitive" } },
							{ customer: { contains: search, mode: "insensitive" } },
						],
					}
				: {}),
		};

		const pickLists = await this.prisma.pickList.findMany({
			where,
			orderBy: { createdAt: "desc" },
			include: { items: true },
			skip,
			take,
		});

		return pickLists.map(toInventoryPickList);
	}

	/**
	 * Get a single pick list by id.
	 */
	async findPickListById(id: string): Promise<Inventory.PickList | null> {
		const pickList = await this.prisma.pickList.findUnique({
			where: { id },
			include: { items: true },
		});

		return pickList ? toInventoryPickList(pickList) : null;
	}

	/**
	 * Create a new pick list.
	 * Retries up to 3 times on a series uniqueness conflict (P2002).
	 */
	async createPickList(
		data: Inventory.CreatePickListInput,
	): Promise<Inventory.PickList> {
		const postingDate = new Date();

		for (let attempt = 0; attempt < 3; attempt++) {
			const series = await this.generatePickListSeries(postingDate);
			try {
				const created = await this.prisma.pickList.create({
					data: {
						series,
						company: data.company,
						customer: data.customer,
						status: data.status ?? "DRAFT",
						purpose: data.purpose ?? "MATERIAL_TRANSFER_FOR_MANUFACTURE",
						workOrder: data.workOrder,
						warehouse: data.warehouse,
						considerRejectedWarehouses:
							data.considerRejectedWarehouses ?? false,
						pickManually: data.pickManually ?? false,
						ignorePricingRule: data.ignorePricingRule ?? false,
						scanMode: data.scanMode ?? false,
						promptQty: data.promptQty ?? false,
						scanBarcode: data.scanBarcode,
						groupSameItems: data.groupSameItems ?? false,
						items: {
							create: (data.items ?? []).map((item) => ({
								item: item.item,
								warehouse: item.warehouse,
								qty: item.qty,
								stockQty: item.stockQty,
								pickedQty: item.pickedQty,
							})),
						},
					},
					include: { items: true },
				});

				return toInventoryPickList(created);
			} catch (error) {
				const isSeriesConflict =
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002";
				if (isSeriesConflict && attempt < 2) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.computeBackoffMs(attempt)),
					);
					continue;
				}
				if (!isSeriesConflict) {
					throw error;
				}
				// Series conflict on last attempt — fall through to throw below.
			}
		}

		throw new ConflictException("Failed to allocate a unique series number");
	}

	/**
	 * Update an existing pick list with nested item upsert logic.
	 * Preserves existing item rows; removes rows no longer in the payload.
	 */
	async updatePickList(
		data: Inventory.UpdatePickListInput,
	): Promise<Inventory.PickList> {
		const { id, items, ...rest } = data;

		const existing = await this.prisma.pickList.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!existing) {
			throw new NotFoundException(`Pick list with ID ${id} not found`);
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			await tx.pickList.update({
				where: { id },
				data: {
					...(rest.company !== undefined && { company: rest.company }),
					...(rest.customer !== undefined && { customer: rest.customer }),
					...(rest.purpose !== undefined && { purpose: rest.purpose }),
					...(rest.workOrder !== undefined && { workOrder: rest.workOrder }),
					...(rest.warehouse !== undefined && { warehouse: rest.warehouse }),
					...(rest.considerRejectedWarehouses !== undefined && {
						considerRejectedWarehouses: rest.considerRejectedWarehouses,
					}),
					...(rest.pickManually !== undefined && {
						pickManually: rest.pickManually,
					}),
					...(rest.ignorePricingRule !== undefined && {
						ignorePricingRule: rest.ignorePricingRule,
					}),
					...(rest.scanMode !== undefined && { scanMode: rest.scanMode }),
					...(rest.promptQty !== undefined && { promptQty: rest.promptQty }),
					...(rest.scanBarcode !== undefined && {
						scanBarcode: rest.scanBarcode,
					}),
					...(rest.groupSameItems !== undefined && {
						groupSameItems: rest.groupSameItems,
					}),
					...(rest.status !== undefined && { status: rest.status }),
				},
			});

			if (items !== undefined) {
				const keptIds = items
					.filter((item): item is typeof item & { id: string } =>
						Boolean(item.id),
					)
					.map((item) => item.id);

				if (keptIds.length > 0) {
					const ownedItems = await tx.pickListItem.findMany({
						where: {
							id: { in: keptIds },
							pickListId: id,
						},
						select: { id: true },
					});
					const ownedIds = new Set(ownedItems.map((item) => item.id));
					const foreignItemId = keptIds.find((itemId) => !ownedIds.has(itemId));
					if (foreignItemId) {
						throw new BadRequestException(
							`Pick list item with ID ${foreignItemId} does not belong to pick list ${id}`,
						);
					}
				}

				if (keptIds.length === 0) {
					await tx.pickListItem.deleteMany({
						where: { pickListId: id },
					});
				} else {
					await tx.pickListItem.deleteMany({
						where: {
							pickListId: id,
							id: { notIn: keptIds },
						},
					});
				}

				for (const item of items) {
					if (item.id) {
						await tx.pickListItem.update({
							where: { id: item.id },
							data: {
								item: item.item,
								warehouse: item.warehouse,
								qty: item.qty,
								stockQty: item.stockQty,
								pickedQty: item.pickedQty,
							},
						});
					} else {
						await tx.pickListItem.create({
							data: {
								pickListId: id,
								item: item.item,
								warehouse: item.warehouse,
								qty: item.qty,
								stockQty: item.stockQty,
								pickedQty: item.pickedQty,
							},
						});
					}
				}
			}

			return tx.pickList.findUniqueOrThrow({
				where: { id },
				include: { items: true },
			});
		});

		return toInventoryPickList(updated);
	}

	/**
	 * Delete a single pick list.
	 */
	async deletePickList(id: string): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.pickList.delete({
				where: { id },
			});
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Pick list with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Delete multiple pick lists.
	 */
	async deleteManyPickLists(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const uniqueIds = [...new Set(ids)];
		try {
			const result = await this.prisma.pickList.deleteMany({
				where: { id: { in: uniqueIds } },
			});
			return { success: true, count: result.count, ids: uniqueIds };
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				this.logger.error(
					`Bulk delete pick lists failed [${error.code}]`,
					error.stack,
				);
			}
			throw error;
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Delivery Trip
	// ═══════════════════════════════════════════════════════════════════════════

	/**
	 * Generate a unique series number for a delivery trip using prefix MAT-DT.
	 * Uses read-then-retry with exponential backoff to handle concurrent writes.
	 */
	private async generateDeliveryTripSeries(date: Date): Promise<string> {
		const year = date.getFullYear();
		const prefix = `MAT-DT-${year}-`;

		const trips = await this.prisma.deliveryTrip.findMany({
			where: { series: { startsWith: prefix } },
			orderBy: { createdAt: "desc" },
			select: { series: true },
		});

		let maxNumber = 0;
		for (const trip of trips) {
			const numStr = trip.series.slice(prefix.length);
			const num = parseInt(numStr, 10);
			if (!Number.isNaN(num) && num > maxNumber) {
				maxNumber = num;
			}
		}

		const nextNumber = maxNumber + 1;
		return `${prefix}${String(nextNumber).padStart(5, "0")}`;
	}

	/**
	 * Get delivery trips with bounded pagination, optional status filter, and search.
	 */
	async findAllDeliveryTrips(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.DeliveryTripStatus;
	}): Promise<Inventory.DeliveryTrip[]> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? 100;
		const search = params?.search?.trim();

		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const where: Prisma.DeliveryTripWhereInput = {
			...(params?.status ? { status: params.status } : {}),
			...(search
				? {
						OR: [
							{ series: { contains: search, mode: "insensitive" } },
							{ driver: { contains: search, mode: "insensitive" } },
							{ company: { contains: search, mode: "insensitive" } },
							{ vehicle: { contains: search, mode: "insensitive" } },
						],
					}
				: {}),
		};

		const trips = await this.prisma.deliveryTrip.findMany({
			where,
			orderBy: { createdAt: "desc" },
			include: { stops: { orderBy: { stopNumber: "asc" } } },
			skip,
			take,
		});

		return trips.map(toInventoryDeliveryTrip);
	}

	/**
	 * Find a single delivery trip by ID.
	 */
	async findDeliveryTripById(
		id: string,
	): Promise<Inventory.DeliveryTrip | null> {
		const trip = await this.prisma.deliveryTrip.findUnique({
			where: { id },
			include: { stops: { orderBy: { stopNumber: "asc" } } },
		});
		return trip ? toInventoryDeliveryTrip(trip) : null;
	}

	/**
	 * Create a delivery trip with its stops.
	 * Series generation uses retry + exponential backoff to handle concurrent writes.
	 */
	async createDeliveryTrip(
		data: Inventory.CreateDeliveryTripInput,
	): Promise<Inventory.DeliveryTrip> {
		const departureTime = data.departureTime ?? undefined;
		const createdAt = new Date();

		for (let attempt = 0; attempt < 3; attempt++) {
			const series = await this.generateDeliveryTripSeries(createdAt);
			try {
				const created = await this.prisma.deliveryTrip.create({
					data: {
						series,
						company: data.company,
						status: data.status ?? "DRAFT",
						driver: data.driver ?? null,
						driverAddress: data.driverAddress ?? null,
						vehicle: data.vehicle ?? null,
						departureTime: departureTime ?? null,
						initialEmailNotificationSent:
							data.initialEmailNotificationSent ?? false,
						stops: {
							create: (data.stops ?? []).map((stop) => ({
								stopNumber: stop.stopNumber,
								customer: stop.customer ?? null,
								addressName: stop.addressName,
								locked: stop.locked ?? false,
								deliveryNote: stop.deliveryNote ?? null,
								estimatedArrival: stop.estimatedArrival ?? null,
							})),
						},
					},
					include: { stops: { orderBy: { stopNumber: "asc" } } },
				});
				return toInventoryDeliveryTrip(created);
			} catch (error) {
				const isSeriesConflict =
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002";
				if (isSeriesConflict && attempt < 2) {
					// Back off before retrying series allocation; computeBackoffMs uses the
					// current attempt (e.g. for exponential backoff) to determine the delay.
					await new Promise((resolve) =>
						setTimeout(resolve, this.computeBackoffMs(attempt)),
					);
					continue;
				}
				if (!isSeriesConflict) {
					throw error;
				}
				// Series conflict on last attempt — fall through to throw below.
			}
		}

		throw new ConflictException("Failed to allocate a unique series number");
	}

	/**
	 * Update a delivery trip and its stops using a safe upsert strategy.
	 * Existing stops are updated in-place; removed stops are deleted; new stops are created.
	 */
	async updateDeliveryTrip(
		data: Inventory.UpdateDeliveryTripInput,
	): Promise<Inventory.DeliveryTrip> {
		const { id, stops, ...rest } = data;

		const existing = await this.prisma.deliveryTrip.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!existing) {
			throw new NotFoundException(`Delivery trip with ID ${id} not found`);
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			// 1. Update parent fields (only non-undefined)
			await tx.deliveryTrip.update({
				where: { id },
				data: {
					...(rest.company !== undefined && { company: rest.company }),
					...(rest.driver !== undefined && { driver: rest.driver }),
					...(rest.driverAddress !== undefined && {
						driverAddress: rest.driverAddress,
					}),
					...(rest.vehicle !== undefined && { vehicle: rest.vehicle }),
					...(rest.departureTime !== undefined && {
						departureTime: rest.departureTime,
					}),
					...(rest.status !== undefined && { status: rest.status }),
					...(rest.initialEmailNotificationSent !== undefined && {
						initialEmailNotificationSent: rest.initialEmailNotificationSent,
					}),
				},
			});

			if (stops !== undefined) {
				// 2. Validate ownership of any stops with existing IDs
				const keptIds = stops
					.filter((s): s is typeof s & { id: string } => Boolean(s.id))
					.map((s) => s.id);

				if (keptIds.length > 0) {
					const ownedStops = await tx.deliveryTripStop.findMany({
						where: { id: { in: keptIds }, deliveryTripId: id },
						select: { id: true },
					});
					const ownedIds = new Set(ownedStops.map((s) => s.id));
					const foreignStopId = keptIds.find((sid) => !ownedIds.has(sid));
					if (foreignStopId) {
						throw new BadRequestException(
							`Delivery trip stop with ID ${foreignStopId} does not belong to delivery trip ${id}`,
						);
					}
				}

				// 3. Delete stops no longer in payload
				await tx.deliveryTripStop.deleteMany({
					where: {
						deliveryTripId: id,
						...(keptIds.length > 0 ? { id: { notIn: keptIds } } : {}),
					},
				});

				// 4. Upsert: update existing (by id), create new (no id)
				for (const stop of stops) {
					if (stop.id) {
						await tx.deliveryTripStop.update({
							where: { id: stop.id },
							data: {
								stopNumber: stop.stopNumber,
								customer: stop.customer ?? null,
								addressName: stop.addressName,
								locked: stop.locked ?? false,
								deliveryNote: stop.deliveryNote ?? null,
								estimatedArrival: stop.estimatedArrival ?? null,
							},
						});
					} else {
						await tx.deliveryTripStop.create({
							data: {
								deliveryTripId: id,
								stopNumber: stop.stopNumber,
								customer: stop.customer ?? null,
								addressName: stop.addressName,
								locked: stop.locked ?? false,
								deliveryNote: stop.deliveryNote ?? null,
								estimatedArrival: stop.estimatedArrival ?? null,
							},
						});
					}
				}
			}

			// 5. Return updated record
			return tx.deliveryTrip.findUniqueOrThrow({
				where: { id },
				include: { stops: { orderBy: { stopNumber: "asc" } } },
			});
		});

		return toInventoryDeliveryTrip(updated);
	}

	/**
	 * Delete a single delivery trip. Stops are removed via cascade.
	 */
	async deleteDeliveryTrip(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.deliveryTrip.delete({ where: { id } });
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Delivery trip with ID ${id} not found`);
			}
			throw error;
		}
	}

	/**
	 * Delete multiple delivery trips.
	 */
	async deleteManyDeliveryTrips(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const uniqueIds = [...new Set(ids)];
		try {
			const result = await this.prisma.deliveryTrip.deleteMany({
				where: { id: { in: uniqueIds } },
			});
			return { success: true, count: result.count, ids: uniqueIds };
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				this.logger.error(
					`Bulk delete delivery trips failed [${error.code}]`,
					error.stack,
				);
			}
			throw error;
		}
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Packing Slip
	// ─────────────────────────────────────────────────────────────────────────────

	private async generatePackingSlipSeries(date: Date): Promise<string> {
		const year = date.getFullYear();
		const prefix = `MAT-PAC-${year}-`;

		const lastEntry = await this.prisma.packingSlip.findFirst({
			where: { series: { startsWith: prefix } },
			orderBy: { series: "desc" },
			select: { series: true },
		});

		let nextNumber = 1;
		if (lastEntry) {
			const numStr = lastEntry.series.slice(prefix.length);
			const num = parseInt(numStr, 10);
			if (!Number.isNaN(num)) {
				nextNumber = num + 1;
			}
		}

		return `${prefix}${String(nextNumber).padStart(5, "0")}`;
	}

	/**
	 * Calculate the net weight and UOM for a packing slip from its items.
	 * Throws if items use different UOMs.
	 */
	private computePackingSlipWeights(
		items: { netWeight: number; weightUom?: string | null }[],
		grossWeightPkg?: number,
	): {
		netWeightPkg: number;
		netWeightUom: string | null;
		grossWeightPkg: number;
		grossWeightUom: string | null;
	} {
		const uom = items.length > 0 ? (items[0].weightUom ?? null) : null;

		for (const item of items) {
			if ((item.weightUom ?? null) !== uom) {
				throw new BadRequestException(
					"All items must use the same weight UOM. Ensure every item has the same UOM.",
				);
			}
		}

		const netWeightPkg = items.reduce(
			(sum, item) => sum + (item.netWeight ?? 0),
			0,
		);

		const gross = grossWeightPkg != null ? grossWeightPkg : netWeightPkg;

		return {
			netWeightPkg: Math.round(netWeightPkg * 100) / 100,
			netWeightUom: uom,
			grossWeightPkg: Math.round(gross * 100) / 100,
			grossWeightUom: uom,
		};
	}

	/**
	 * Validate that package numbers don't overlap with existing submitted packing slips.
	 */
	private async validateCaseNos(
		deliveryNoteId: string,
		fromCaseNo: number,
		toCaseNo: number,
		excludeId?: string,
	): Promise<void> {
		if (fromCaseNo <= 0) {
			throw new BadRequestException("From Package No. must be greater than 0.");
		}
		if (toCaseNo < fromCaseNo) {
			throw new BadRequestException(
				"To Package No. cannot be less than From Package No.",
			);
		}

		const overlapping = await this.prisma.packingSlip.findFirst({
			where: {
				deliveryNoteId,
				status: "SUBMITTED",
				...(excludeId ? { id: { not: excludeId } } : {}),
				OR: [
					{ fromCaseNo: { gte: fromCaseNo, lte: toCaseNo } },
					{ toCaseNo: { gte: fromCaseNo, lte: toCaseNo } },
					{
						AND: [
							{ fromCaseNo: { lte: fromCaseNo } },
							{ toCaseNo: { gte: fromCaseNo } },
						],
					},
				],
			},
			select: { toCaseNo: true },
		});

		if (overlapping) {
			const recommended = overlapping.toCaseNo + 1;
			throw new BadRequestException(
				`Package No(s) already in use. Try from Package No ${recommended}.`,
			);
		}
	}

	/**
	 * Validate that item quantities don't exceed remaining unpacked quantities.
	 */
	private async validatePackingSlipItemQtys(
		items: { deliveryNoteItemId: string; qty: number }[],
		excludePackingSlipId?: string,
	): Promise<void> {
		for (const item of items) {
			const dn = await this.prisma.deliveryNoteItem.findUnique({
				where: { id: item.deliveryNoteItemId },
				select: { quantity: true, packedQty: true },
			});

			if (!dn) {
				throw new BadRequestException(
					`Delivery note item "${item.deliveryNoteItemId}" not found.`,
				);
			}

			// When updating, subtract the current packing slip's contribution from packedQty
			let alreadyPacked = dn.packedQty;
			if (excludePackingSlipId) {
				const existingQty = await this.prisma.packingSlipItem.findFirst({
					where: {
						packingSlipId: excludePackingSlipId,
						deliveryNoteItemId: item.deliveryNoteItemId,
					},
					select: { qty: true },
				});
				if (existingQty) {
					alreadyPacked = Math.max(0, alreadyPacked - existingQty.qty);
				}
			}

			const remaining = dn.quantity - alreadyPacked;

			if (item.qty <= 0) {
				throw new BadRequestException(`Item quantity must be greater than 0.`);
			}

			if (item.qty > remaining + 0.0001) {
				throw new BadRequestException(
					`Quantity ${item.qty} exceeds the remaining unpacked quantity ${remaining} for this item.`,
				);
			}
		}
	}

	/**
	 * Get recommended next package number for a delivery note.
	 */
	async getRecommendedCaseNo(deliveryNoteId: string): Promise<number> {
		const last = await this.prisma.packingSlip.findFirst({
			where: { deliveryNoteId, status: "SUBMITTED" },
			orderBy: { toCaseNo: "desc" },
			select: { toCaseNo: true },
		});
		return (last?.toCaseNo ?? 0) + 1;
	}

	/**
	 * List packing slips with optional filtering.
	 */
	async findAllPackingSlips(params?: {
		deliveryNoteId?: string;
		status?: Inventory.PackingSlipStatus;
		skip?: number;
		take?: number;
	}): Promise<Inventory.PackingSlip[]> {
		const skip = Math.max(0, params?.skip ?? 0);
		const take = Math.min(
			Math.max(1, params?.take ?? LIST_QUERY_TAKE_MAX),
			LIST_QUERY_TAKE_MAX,
		);

		const slips = await this.prisma.packingSlip.findMany({
			where: {
				...(params?.deliveryNoteId
					? { deliveryNoteId: params.deliveryNoteId }
					: {}),
				...(params?.status ? { status: params.status } : {}),
			},
			include: { items: true },
			orderBy: { createdAt: "desc" },
			skip,
			take,
		});

		return slips.map(toInventoryPackingSlip);
	}

	/**
	 * Get a single packing slip by ID.
	 */
	async findPackingSlipById(id: string): Promise<Inventory.PackingSlip | null> {
		const ps = await this.prisma.packingSlip.findUnique({
			where: { id },
			include: { items: true },
		});
		return ps ? toInventoryPackingSlip(ps) : null;
	}

	/**
	 * Create a new packing slip for a draft delivery note.
	 * Validates:
	 * - Delivery note exists and is in DRAFT status
	 * - Package numbers are valid and non-overlapping
	 * - Item quantities don't exceed remaining unpacked quantities
	 */
	async createPackingSlip(
		data: Inventory.CreatePackingSlipInput,
	): Promise<Inventory.PackingSlip> {
		const dn = await this.prisma.deliveryNote.findUnique({
			where: { id: data.deliveryNoteId },
			select: { id: true, status: true },
		});

		if (!dn) {
			throw new NotFoundException(
				`Delivery note with ID "${data.deliveryNoteId}" not found.`,
			);
		}

		if (dn.status !== "DRAFT") {
			throw new BadRequestException(
				"A Packing Slip can only be created for a Draft Delivery Note.",
			);
		}

		const fromCaseNo = data.fromCaseNo;
		const toCaseNo = data.toCaseNo ?? fromCaseNo;

		await this.validateCaseNos(data.deliveryNoteId, fromCaseNo, toCaseNo);
		await this.validatePackingSlipItemQtys(data.items);

		const weights = this.computePackingSlipWeights(
			data.items.map((i) => ({
				netWeight: i.netWeight ?? 0,
				weightUom: i.weightUom,
			})),
			data.grossWeightPkg,
		);

		for (let attempt = 0; attempt < 3; attempt++) {
			const series = await this.generatePackingSlipSeries(new Date());
			try {
				const ps = await this.prisma.packingSlip.create({
					data: {
						series,
						status: "DRAFT",
						deliveryNoteId: data.deliveryNoteId,
						fromCaseNo,
						toCaseNo,
						netWeightPkg: weights.netWeightPkg,
						netWeightUom: weights.netWeightUom,
						grossWeightPkg: weights.grossWeightPkg,
						grossWeightUom: data.grossWeightUom ?? weights.grossWeightUom,
						letterHead: data.letterHead,
						items: {
							create: data.items.map((item) => ({
								deliveryNoteItemId: item.deliveryNoteItemId,
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								qty: item.qty,
								netWeight: item.netWeight ?? 0,
								weightUom: item.weightUom,
								batchNo: item.batchNo,
							})),
						},
					},
					include: { items: true },
				});
				return toInventoryPackingSlip(ps);
			} catch (error) {
				const isConflict =
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002";
				if (isConflict && attempt < 2) {
					await new Promise((r) =>
						setTimeout(r, this.computeBackoffMs(attempt)),
					);
					continue;
				}
				throw error;
			}
		}
		throw new Error("Failed to allocate a unique packing slip series");
	}

	/**
	 * Update a draft packing slip. Only draft slips can be updated.
	 */
	async updatePackingSlip(
		data: Inventory.UpdatePackingSlipInput,
	): Promise<Inventory.PackingSlip> {
		const existing = await this.prisma.packingSlip.findUnique({
			where: { id: data.id },
			include: { items: true },
		});

		if (!existing) {
			throw new NotFoundException(
				`Packing slip with ID "${data.id}" not found.`,
			);
		}

		if (existing.status !== "DRAFT") {
			throw new BadRequestException("Only Draft packing slips can be edited.");
		}

		const fromCaseNo = data.fromCaseNo ?? existing.fromCaseNo;
		const toCaseNo = data.toCaseNo ?? existing.toCaseNo;

		await this.validateCaseNos(
			existing.deliveryNoteId,
			fromCaseNo,
			toCaseNo,
			existing.id,
		);

		if (data.items) {
			await this.validatePackingSlipItemQtys(data.items, existing.id);
		}

		const itemsForWeight = (data.items ?? existing.items).map(
			(i: { netWeight?: number | null; weightUom?: string | null }) => ({
				netWeight: i.netWeight ?? 0,
				weightUom: i.weightUom,
			}),
		);
		const weights = this.computePackingSlipWeights(
			itemsForWeight,
			data.grossWeightPkg ?? existing.grossWeightPkg,
		);

		const updated = await this.prisma.$transaction(async (tx) => {
			if (data.items) {
				await tx.packingSlipItem.deleteMany({
					where: { packingSlipId: existing.id },
				});
			}

			return tx.packingSlip.update({
				where: { id: existing.id },
				data: {
					fromCaseNo,
					toCaseNo,
					netWeightPkg: weights.netWeightPkg,
					netWeightUom: weights.netWeightUom,
					grossWeightPkg: weights.grossWeightPkg,
					grossWeightUom:
						data.grossWeightUom !== undefined
							? data.grossWeightUom
							: weights.grossWeightUom,
					...(data.letterHead !== undefined && { letterHead: data.letterHead }),
					...(data.items && {
						items: {
							create: data.items.map((item) => ({
								deliveryNoteItemId: item.deliveryNoteItemId,
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								qty: item.qty,
								netWeight: item.netWeight ?? 0,
								weightUom: item.weightUom,
								batchNo: item.batchNo,
							})),
						},
					}),
				},
				include: { items: true },
			});
		});

		return toInventoryPackingSlip(updated);
	}

	/**
	 * Submit a packing slip. Transitions to SUBMITTED and increments packedQty
	 * on each referenced delivery note item.
	 */
	async submitPackingSlip(id: string): Promise<Inventory.PackingSlip> {
		const existing = await this.prisma.packingSlip.findUnique({
			where: { id },
			include: { items: true },
		});

		if (!existing) {
			throw new NotFoundException(`Packing slip with ID "${id}" not found.`);
		}

		if (existing.status !== "DRAFT") {
			throw new BadRequestException(
				"Only Draft packing slips can be submitted.",
			);
		}

		// Validate case nos (no overlap with already-submitted ones)
		await this.validateCaseNos(
			existing.deliveryNoteId,
			existing.fromCaseNo,
			existing.toCaseNo,
			existing.id,
		);

		// Validate quantities (fresh check at submit time)
		await this.validatePackingSlipItemQtys(existing.items, existing.id);

		const updated = await this.prisma.$transaction(async (tx) => {
			for (const item of existing.items) {
				await tx.deliveryNoteItem.update({
					where: { id: item.deliveryNoteItemId },
					data: { packedQty: { increment: item.qty } },
				});
			}

			return tx.packingSlip.update({
				where: { id },
				data: { status: "SUBMITTED" },
				include: { items: true },
			});
		});

		return toInventoryPackingSlip(updated);
	}

	/**
	 * Cancel a submitted packing slip. Reverses packedQty on delivery note items.
	 */
	async cancelPackingSlip(id: string): Promise<Inventory.PackingSlip> {
		const existing = await this.prisma.packingSlip.findUnique({
			where: { id },
			include: { items: true },
		});

		if (!existing) {
			throw new NotFoundException(`Packing slip with ID "${id}" not found.`);
		}

		if (existing.status !== "SUBMITTED") {
			throw new BadRequestException(
				"Only Submitted packing slips can be cancelled.",
			);
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			for (const item of existing.items) {
				await tx.deliveryNoteItem.update({
					where: { id: item.deliveryNoteItemId },
					data: {
						packedQty: { decrement: item.qty },
					},
				});
			}

			return tx.packingSlip.update({
				where: { id },
				data: { status: "CANCELLED" },
				include: { items: true },
			});
		});

		return toInventoryPackingSlip(updated);
	}

	/**
	 * Delete a draft packing slip.
	 */
	async deletePackingSlip(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.packingSlip.findUnique({
			where: { id },
			select: { id: true, status: true },
		});

		if (!existing) {
			throw new NotFoundException(`Packing slip with ID "${id}" not found.`);
		}

		if (existing.status === "SUBMITTED") {
			throw new BadRequestException(
				"Submitted packing slips cannot be deleted. Cancel them first.",
			);
		}

		await this.prisma.packingSlip.delete({ where: { id } });
		return { success: true, id };
	}

	/**
	 * Bulk delete draft/cancelled packing slips.
	 */
	async deleteManyPackingSlips(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const uniqueIds = [...new Set(ids)];

		const submitted = await this.prisma.packingSlip.findMany({
			where: { id: { in: uniqueIds }, status: "SUBMITTED" },
			select: { series: true },
		});

		if (submitted.length > 0) {
			const series = submitted.map((s) => s.series).join(", ");
			throw new BadRequestException(
				`Cannot delete submitted packing slips: ${series}. Cancel them first.`,
			);
		}

		const result = await this.prisma.packingSlip.deleteMany({
			where: { id: { in: uniqueIds } },
		});

		return { success: true, count: result.count, ids: uniqueIds };
	}

	// ─── Quality Inspection Parameter Groups ──────────────────────────────────

	async findAllQiParameterGroups(): Promise<Inventory.QiParameterGroup[]> {
		const groups = await this.prisma.qiParameterGroup.findMany({
			orderBy: { name: "asc" },
		});
		return groups.map(toInventoryQiParameterGroup);
	}

	async createQiParameterGroup(data: {
		name: string;
	}): Promise<Inventory.QiParameterGroup> {
		const existing = await this.prisma.qiParameterGroup.findUnique({
			where: { name: data.name },
		});
		if (existing) {
			throw new ConflictException(
				`A parameter group named "${data.name}" already exists`,
			);
		}
		const created = await this.prisma.qiParameterGroup.create({
			data: { name: data.name },
		});
		return toInventoryQiParameterGroup(created);
	}

	async updateQiParameterGroup(data: {
		id: string;
		name: string;
	}): Promise<Inventory.QiParameterGroup> {
		const existing = await this.prisma.qiParameterGroup.findUnique({
			where: { id: data.id },
		});
		if (!existing) {
			throw new NotFoundException(
				`QI parameter group with id "${data.id}" not found`,
			);
		}
		const duplicate = await this.prisma.qiParameterGroup.findFirst({
			where: { name: data.name, id: { not: data.id } },
		});
		if (duplicate) {
			throw new ConflictException(
				`A parameter group named "${data.name}" already exists`,
			);
		}
		const updated = await this.prisma.qiParameterGroup.update({
			where: { id: data.id },
			data: { name: data.name },
		});
		return toInventoryQiParameterGroup(updated);
	}

	async deleteQiParameterGroup(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.qiParameterGroup.findUnique({
			where: { id },
		});
		if (!existing) {
			throw new NotFoundException(
				`QI parameter group with id "${id}" not found`,
			);
		}
		await this.prisma.qiParameterGroup.delete({ where: { id } });
		return { success: true, id };
	}

	// ─── Quality Inspection Parameters ───────────────────────────────────────

	async findAllQiParameters(params?: {
		search?: string;
		groupId?: string;
	}): Promise<Inventory.QiParameter[]> {
		const parameters = await this.prisma.qiParameter.findMany({
			where: {
				...(params?.search && {
					parameter: { contains: params.search, mode: "insensitive" },
				}),
				...(params?.groupId !== undefined && { groupId: params.groupId }),
			},
			include: { group: true },
			orderBy: { parameter: "asc" },
		});
		return parameters.map(toInventoryQiParameter);
	}

	async findQiParameterById(id: string): Promise<Inventory.QiParameter | null> {
		const p = await this.prisma.qiParameter.findUnique({
			where: { id },
			include: { group: true },
		});
		return p ? toInventoryQiParameter(p) : null;
	}

	async createQiParameter(data: {
		parameter: string;
		description?: string | null;
		groupId?: string | null;
	}): Promise<Inventory.QiParameter> {
		const existing = await this.prisma.qiParameter.findUnique({
			where: { parameter: data.parameter },
		});
		if (existing) {
			throw new ConflictException(
				`A parameter named "${data.parameter}" already exists`,
			);
		}
		if (data.groupId) {
			const group = await this.prisma.qiParameterGroup.findUnique({
				where: { id: data.groupId },
			});
			if (!group) {
				throw new NotFoundException(
					`QI parameter group with id "${data.groupId}" not found`,
				);
			}
		}
		const created = await this.prisma.qiParameter.create({
			data: {
				parameter: data.parameter,
				description: data.description ?? null,
				groupId: data.groupId ?? null,
			},
			include: { group: true },
		});
		return toInventoryQiParameter(created);
	}

	async updateQiParameter(data: {
		id: string;
		parameter?: string;
		description?: string | null;
		groupId?: string | null;
	}): Promise<Inventory.QiParameter> {
		const existing = await this.prisma.qiParameter.findUnique({
			where: { id: data.id },
		});
		if (!existing) {
			throw new NotFoundException(
				`QI parameter with id "${data.id}" not found`,
			);
		}
		if (data.parameter && data.parameter !== existing.parameter) {
			const duplicate = await this.prisma.qiParameter.findUnique({
				where: { parameter: data.parameter },
			});
			if (duplicate) {
				throw new ConflictException(
					`A parameter named "${data.parameter}" already exists`,
				);
			}
		}
		if (data.groupId) {
			const group = await this.prisma.qiParameterGroup.findUnique({
				where: { id: data.groupId },
			});
			if (!group) {
				throw new NotFoundException(
					`QI parameter group with id "${data.groupId}" not found`,
				);
			}
		}
		const updated = await this.prisma.qiParameter.update({
			where: { id: data.id },
			data: {
				...(data.parameter != null && { parameter: data.parameter }),
				...(data.description !== undefined && {
					description: data.description,
				}),
				...(data.groupId !== undefined && { groupId: data.groupId }),
			},
			include: { group: true },
		});
		return toInventoryQiParameter(updated);
	}

	async deleteQiParameter(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.qiParameter.findUnique({
			where: { id },
		});
		if (!existing) {
			throw new NotFoundException(`QI parameter with id "${id}" not found`);
		}
		await this.prisma.qiParameter.delete({ where: { id } });
		return { success: true, id };
	}

	// ─── Quality Inspection Templates ─────────────────────────────────────────

	async findAllQiTemplates(params?: {
		search?: string;
		skip?: number;
		take?: number;
	}): Promise<Inventory.QiTemplate[]> {
		const templates = await this.prisma.qiTemplate.findMany({
			where: params?.search
				? { name: { contains: params.search, mode: "insensitive" } }
				: undefined,
			include: {
				items: {
					include: { parameter: { include: { group: true } } },
					orderBy: { sortOrder: "asc" },
				},
			},
			orderBy: { name: "asc" },
			skip: params?.skip,
			take: params?.take,
		});
		return templates.map(toInventoryQiTemplate);
	}

	async findQiTemplateById(id: string): Promise<Inventory.QiTemplate | null> {
		const t = await this.prisma.qiTemplate.findUnique({
			where: { id },
			include: {
				items: {
					include: { parameter: { include: { group: true } } },
					orderBy: { sortOrder: "asc" },
				},
			},
		});
		return t ? toInventoryQiTemplate(t) : null;
	}

	async createQiTemplate(data: {
		name: string;
		items: Array<{
			parameterId: string;
			sortOrder?: number;
			numeric?: boolean;
			formulaBased?: boolean;
			value?: string | null;
			minValue?: number | null;
			maxValue?: number | null;
			acceptanceFormula?: string | null;
		}>;
	}): Promise<Inventory.QiTemplate> {
		const existing = await this.prisma.qiTemplate.findUnique({
			where: { name: data.name },
		});
		if (existing) {
			throw new ConflictException(
				`A template named "${data.name}" already exists`,
			);
		}
		// Validate all parameters exist
		const paramIds = [...new Set(data.items.map((i) => i.parameterId))];
		const foundParams = await this.prisma.qiParameter.findMany({
			where: { id: { in: paramIds } },
			select: { id: true },
		});
		if (foundParams.length !== paramIds.length) {
			const missing = paramIds.filter(
				(id) => !foundParams.some((p) => p.id === id),
			);
			throw new NotFoundException(
				`QI parameters not found: ${missing.join(", ")}`,
			);
		}
		const template = await this.prisma.qiTemplate.create({
			data: {
				name: data.name,
				items: {
					create: data.items.map((item, idx) => ({
						parameterId: item.parameterId,
						sortOrder: item.sortOrder ?? idx,
						numeric: item.numeric ?? true,
						formulaBased: item.formulaBased ?? false,
						value: item.value ?? null,
						minValue: item.minValue ?? null,
						maxValue: item.maxValue ?? null,
						acceptanceFormula: item.acceptanceFormula ?? null,
					})),
				},
			},
			include: {
				items: {
					include: { parameter: { include: { group: true } } },
					orderBy: { sortOrder: "asc" },
				},
			},
		});
		return toInventoryQiTemplate(template);
	}

	async updateQiTemplate(data: {
		id: string;
		name?: string;
		items?: Array<{
			id?: string;
			parameterId: string;
			sortOrder?: number;
			numeric?: boolean;
			formulaBased?: boolean;
			value?: string | null;
			minValue?: number | null;
			maxValue?: number | null;
			acceptanceFormula?: string | null;
		}>;
	}): Promise<Inventory.QiTemplate> {
		const existing = await this.prisma.qiTemplate.findUnique({
			where: { id: data.id },
		});
		if (!existing) {
			throw new NotFoundException(`QI template with id "${data.id}" not found`);
		}
		if (data.name && data.name !== existing.name) {
			const duplicate = await this.prisma.qiTemplate.findUnique({
				where: { name: data.name },
			});
			if (duplicate) {
				throw new ConflictException(
					`A template named "${data.name}" already exists`,
				);
			}
		}
		if (data.items) {
			const paramIds = [...new Set(data.items.map((i) => i.parameterId))];
			const foundParams = await this.prisma.qiParameter.findMany({
				where: { id: { in: paramIds } },
				select: { id: true },
			});
			if (foundParams.length !== paramIds.length) {
				const missing = paramIds.filter(
					(id) => !foundParams.some((p) => p.id === id),
				);
				throw new NotFoundException(
					`QI parameters not found: ${missing.join(", ")}`,
				);
			}
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			if (data.name) {
				await tx.qiTemplate.update({
					where: { id: data.id },
					data: { name: data.name },
				});
			}
			if (data.items) {
				await tx.qiTemplateItem.deleteMany({
					where: { templateId: data.id },
				});
				await tx.qiTemplateItem.createMany({
					data: data.items.map((item, idx) => ({
						templateId: data.id,
						parameterId: item.parameterId,
						sortOrder: item.sortOrder ?? idx,
						numeric: item.numeric ?? true,
						formulaBased: item.formulaBased ?? false,
						value: item.value ?? null,
						minValue: item.minValue ?? null,
						maxValue: item.maxValue ?? null,
						acceptanceFormula: item.acceptanceFormula ?? null,
					})),
				});
			}
			return tx.qiTemplate.findUniqueOrThrow({
				where: { id: data.id },
				include: {
					items: {
						include: { parameter: { include: { group: true } } },
						orderBy: { sortOrder: "asc" },
					},
				},
			});
		});

		return toInventoryQiTemplate(updated);
	}

	async deleteQiTemplate(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.qiTemplate.findUnique({
			where: { id },
		});
		if (!existing) {
			throw new NotFoundException(`QI template with id "${id}" not found`);
		}
		await this.prisma.qiTemplate.delete({ where: { id } });
		return { success: true, id };
	}

	async deleteManyQiTemplates(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const uniqueIds = [...new Set(ids)];
		const result = await this.prisma.qiTemplate.deleteMany({
			where: { id: { in: uniqueIds } },
		});
		return { success: true, count: result.count, ids: uniqueIds };
	}

	// ============================================================================
	// Itemwise Recommended Reorder Level Report
	// ============================================================================

	async findItemwiseRecommendedReorderLevel(
		params: Inventory.ListItemwiseRecommendedReorderLevelInput,
	): Promise<Inventory.ItemwiseRecommendedReorderLevelRow[]> {
		const fromDate = params.fromDate;
		const toDate = params.toDate;
		const itemGroup = params.itemGroup?.trim();
		const brand = params.brand?.trim();

		if (fromDate > toDate) {
			throw new BadRequestException("From Date must be before To Date");
		}

		const numberOfDays =
			Math.floor(
				(toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
			) + 1;

		// -------------------------------------------------------------------
		// 1. Resolve item codes filtered by brand / item group (via Item catalog)
		// -------------------------------------------------------------------
		let filteredItemCodes: string[] | undefined;

		if (itemGroup || brand) {
			const matchingCatalogItems = await this.prisma.item.findMany({
				where: {
					...(itemGroup
						? {
								itemGroup: {
									groupName: {
										contains: itemGroup,
										mode: "insensitive" as const,
									},
								},
							}
						: {}),
					...(brand
						? {
								brand: {
									name: {
										contains: brand,
										mode: "insensitive" as const,
									},
								},
							}
						: {}),
				},
				select: { code: true, brand: { select: { name: true } } },
			});

			filteredItemCodes = matchingCatalogItems.map((i) => i.code);
			if (filteredItemCodes.length === 0) return [];
		}

		// -------------------------------------------------------------------
		// 2. Load active stock items
		// -------------------------------------------------------------------
		const inventoryItems = await this.prisma.inventoryItem.findMany({
			where: {
				maintainStock: true,
				disabled: false,
				...(filteredItemCodes ? { code: { in: filteredItemCodes } } : {}),
			},
			select: {
				code: true,
				name: true,
				description: true,
				safetyStock: true,
				leadTimeDays: true,
				itemGroup: { select: { groupName: true } },
			},
		});

		if (inventoryItems.length === 0) return [];

		// Build a brand-lookup map from the catalog Item model
		const allCodes = inventoryItems.map((i) => i.code);

		const catalogItems = await this.prisma.item.findMany({
			where: { code: { in: allCodes } },
			select: { code: true, brand: { select: { name: true } } },
		});
		const brandByCode = new Map<string, string | null>();
		for (const ci of catalogItems) {
			brandByCode.set(ci.code, ci.brand?.name ?? null);
		}

		const itemSources = inventoryItems.map((item) => ({
			code: item.code,
			name: item.name,
			description: item.description,
			safetyStock: item.safetyStock,
			leadTimeDays: item.leadTimeDays,
			itemGroupName: item.itemGroup?.groupName ?? null,
			brandName: brandByCode.get(item.code) ?? null,
		}));

		// -------------------------------------------------------------------
		// 3. Calculate consumed quantities from stock entries
		//    Exclude: MATERIAL_TRANSFER, MATERIAL_TRANSFER_FOR_MANUFACTURE,
		//             SEND_TO_SUBCONTRACTOR, MATERIAL_RECEIPT
		//    Only items leaving stock (sourceWarehouse is set).
		// -------------------------------------------------------------------
		const consumedEntries = await this.prisma.stockEntryItem.groupBy({
			by: ["itemCode"],
			where: {
				sourceWarehouse: { not: null },
				itemCode: { in: allCodes },
				stockEntry: {
					status: "SUBMITTED",
					postingDate: { gte: fromDate, lte: toDate },
					stockEntryType: {
						in: ["MATERIAL_ISSUE", "MANUFACTURE", "REPACK"],
					},
				},
			},
			_sum: { qty: true },
		});

		const consumedByItem = new Map<string, number>();
		for (const entry of consumedEntries) {
			consumedByItem.set(entry.itemCode, entry._sum.qty ?? 0);
		}

		// -------------------------------------------------------------------
		// 4. Calculate delivered quantities from delivery notes
		//    Only submitted (non-draft, non-cancelled, non-return) notes.
		// -------------------------------------------------------------------
		const deliveredEntries = await this.prisma.deliveryNoteItem.groupBy({
			by: ["itemCode"],
			where: {
				itemCode: { in: allCodes },
				deliveryNote: {
					status: { notIn: ["DRAFT", "CANCELLED"] },
					isReturn: false,
					postingDate: { gte: fromDate, lte: toDate },
				},
			},
			_sum: { quantity: true },
		});

		const deliveredByItem = new Map<string, number>();
		for (const entry of deliveredEntries) {
			deliveredByItem.set(entry.itemCode, entry._sum.quantity ?? 0);
		}

		// -------------------------------------------------------------------
		// 5. Build report rows
		// -------------------------------------------------------------------
		return buildItemwiseRecommendedReorderLevelRows(
			itemSources,
			consumedByItem,
			deliveredByItem,
			numberOfDays,
		);
	}

	// =========================================================================
	// Item Variant Details Report
	// =========================================================================

	async findItemVariantDetails(
		params: Inventory.ListItemVariantDetailsInput,
	): Promise<Inventory.ItemVariantDetailsResult> {
		const itemCode = params.itemCode.trim();

		// 1. Verify the template item exists and has variants
		const templateItem = await this.prisma.inventoryItem.findFirst({
			where: { code: itemCode, hasVariants: true, disabled: false },
			select: { id: true, code: true },
		});

		if (!templateItem) {
			return { attributeNames: [], rows: [] };
		}

		// 2. Fetch all non-disabled variant items of the template
		const variants = await this.prisma.inventoryItem.findMany({
			where: {
				templateItemId: templateItem.id,
				disabled: false,
			},
			select: {
				id: true,
				code: true,
				name: true,
				quantity: true,
				standardSellingRate: true,
			},
		});

		if (variants.length === 0) {
			return { attributeNames: [], rows: [] };
		}

		const variantIds = variants.map((v) => v.id);
		const variantCodes = variants.map((v) => v.code);

		// 3. Fetch attribute values for each variant
		const variantAttrRows = await this.prisma.inventoryItemAttribute.findMany({
			where: { itemId: { in: variantIds } },
			select: {
				itemId: true,
				attributeValue: true,
				attribute: { select: { name: true } },
			},
		});

		const variantAttributes = variantAttrRows.map(
			(row: {
				itemId: string;
				attributeValue: string;
				attribute: { name: string };
			}) => ({
				itemId: row.itemId,
				attributeName: row.attribute.name,
				attributeValue: row.attributeValue,
			}),
		);

		// 4. Average buying price from purchase receipt items
		const buyingPriceRows = await this.prisma.purchaseReceiptItem.groupBy({
			by: ["itemCode"],
			where: {
				itemCode: { in: variantCodes },
				purchaseReceipt: { status: { notIn: ["DRAFT", "CANCELLED"] } },
			},
			_avg: { rate: true },
		});

		const avgBuyingPriceMap = new Map<string, number>();
		for (const row of buyingPriceRows) {
			avgBuyingPriceMap.set(row.itemCode, row._avg.rate ?? 0);
		}

		// 5. Open sales orders count (qty - deliveredQty for non-completed orders)
		const openOrderRows = await this.prisma.salesOrderItem.groupBy({
			by: ["itemCode"],
			where: {
				itemCode: { in: variantCodes },
				salesOrder: {
					status: { notIn: ["DRAFT", "COMPLETED", "CLOSED"] },
				},
			},
			_sum: { qty: true, deliveredQty: true },
		});

		const openOrdersMap = new Map<string, number>();
		for (const row of openOrderRows) {
			const sumQty = row._sum?.qty ?? 0;
			const sumDeliveredQty = row._sum?.deliveredQty ?? 0;
			const remaining = sumQty - sumDeliveredQty;
			openOrdersMap.set(row.itemCode, Math.max(0, remaining));
		}

		// 6. Build result
		return buildItemVariantDetailsResult(
			variants,
			variantAttributes,
			avgBuyingPriceMap,
			openOrdersMap,
		);
	}
}
