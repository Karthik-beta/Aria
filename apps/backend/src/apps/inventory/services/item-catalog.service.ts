/**
 * Item catalog sub-service.
 *
 * Covers items, item groups, brands, item attributes (with values),
 * item alternatives, product bundles, shipping rules, and item
 * manufacturers. This is the largest domain surface in the inventory
 * module.
 *
 * @module ItemCatalogSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/item | ERPNext Item}
 */
import type { Inventory } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	itemAlternativeInclude,
	toInventoryBrand,
	toInventoryItem,
	toInventoryItemAlternative,
	toInventoryItemAttribute,
	toInventoryItemGroup,
	toInventoryItemManufacturer,
	toInventoryProductBundle,
	toInventoryShippingRule,
} from "../inventory.types";
import {
	brandSelect,
	formatBarcodes,
	formatItemGroupDefaults,
	formatProductBundleItems,
	formatReorderSettings,
	isDefaultItemManufacturerConstraintViolation,
	itemAttributeSelect,
	itemManufacturerInclude,
	removeUndefined,
} from "./inventory-shared";

export class ItemCatalogSubService {
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
					fromRange: data.fromRange ?? 0,
					toRange: data.toRange ?? 0,
					increment: data.increment ?? 0,
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

		// Extract numeric range fields separately so they don't go through removeUndefined
		// which would drop explicit zero values
		const numericRangeFields: Record<string, number | undefined> = {};
		if (rest.fromRange !== undefined)
			numericRangeFields.fromRange = rest.fromRange;
		if (rest.toRange !== undefined) numericRangeFields.toRange = rest.toRange;
		if (rest.increment !== undefined)
			numericRangeFields.increment = rest.increment;

		const {
			fromRange: _fr,
			toRange: _tr,
			increment: _inc,
			...scalarRest
		} = rest;

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
					data: { ...removeUndefined(scalarRest), ...numericRangeFields },
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
	 * Get a single product bundle by id
	 */
	async findProductBundleById(
		id: string,
	): Promise<Inventory.ProductBundle | null> {
		const bundle = await this.prisma.productBundle.findUnique({
			where: { id },
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

		return bundle ? toInventoryProductBundle(bundle) : null;
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
}
