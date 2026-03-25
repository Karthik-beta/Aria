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
	itemAlternativeInclude,
	toInventoryDeliveryNote,
	toInventoryDeliveryTrip,
	toInventoryItem,
	toInventoryItemAlternative,
	toInventoryItemGroup,
	toInventoryItemManufacturer,
	toInventoryMaterialRequest,
	toInventoryPickList,
	toInventoryProductBundle,
	toInventoryPurchaseReceipt,
	toInventoryShippingRule,
	toInventoryStockEntry,
	toInventoryStockSettings,
	toInventoryUnitOfMeasure,
} from "./inventory.types";
import { buildItemPriceStockRows } from "./item-price-stock-report";
import {
	buildStockAgeingRows,
	type StockAgeingBucketRange,
} from "./stock-ageing-report";
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

const unitOfMeasureSelect = {
	id: true,
	name: true,
	disabled: true,
	isWholeNumber: true,
	createdAt: true,
	updatedAt: true,
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

const DEFAULT_STOCK_AGEING_BREAKS = [30, 60, 90] as const;

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

	private normalizeStockSettingsText(value?: string | null): string | null {
		const normalized = value?.trim();
		return normalized ? normalized : null;
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
}
