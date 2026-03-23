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
	toInventoryItem,
	toInventoryItemAlternative,
	toInventoryItemGroup,
	toInventoryItemManufacturer,
	toInventoryMaterialRequest,
	toInventoryProductBundle,
	toInventoryShippingRule,
	toInventoryStockEntry,
	toInventoryUnitOfMeasure,
} from "./inventory.types";
import {
	loadUomSeedEntriesFromCsv,
	normalizeUomName,
	type UomSeedEntry,
} from "./uom-seed";

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
}
