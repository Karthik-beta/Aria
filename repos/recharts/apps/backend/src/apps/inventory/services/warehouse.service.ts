/**
 * Warehouse sub-service.
 *
 * Manages warehouse CRUD operations, parent-child hierarchy validation,
 * and referential integrity checks before deletion.
 *
 * @module WarehouseSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/warehouse | ERPNext Warehouse}
 */
import type { Inventory } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import type { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import { toInventoryWarehouse } from "../inventory.types";
import {
	LIST_QUERY_TAKE_MAX,
	removeUndefined,
	warehouseSelect,
} from "./inventory-shared";

export class WarehouseSubService {
	constructor(private readonly prisma: PrismaService) {}

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
}
