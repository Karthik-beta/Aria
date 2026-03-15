import type { Inventory } from "@aria/types";
import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { Prisma } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import {
	toInventoryItem,
	toInventoryItemGroup,
	toInventoryProductBundle,
	toInventoryShippingRule,
} from "./inventory.types";

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

/**
 * Simple inventory service with type-safe CRUD operations
 */
@Injectable()
export class InventoryService {
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
		return this.prisma.unitOfMeasurement.findMany({
			where: search
				? {
						name: {
							contains: search,
							mode: "insensitive",
						},
					}
				: undefined,
			orderBy: { name: "asc" },
		});
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
}
