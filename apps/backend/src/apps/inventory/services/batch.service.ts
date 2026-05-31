/**
 * Batch tracking sub-service.
 *
 * Manages batch lifecycle (create / update / delete), relationship
 * validation against items, warehouses, and UOM, and list queries
 * with flexible sorting.
 *
 * @module BatchSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/batch | ERPNext Batch}
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
import { type InventoryBatch, toInventoryBatch } from "../inventory.types";
import {
	type BatchCapablePrisma,
	type BatchCapableTransactionClient,
	type BatchDelegate,
	batchInclude,
	LIST_QUERY_TAKE_MAX,
	normalizeOptionalText,
} from "./inventory-shared";

export class BatchSubService {
	constructor(private readonly prisma: PrismaService) {}

	private get batchModel(): BatchDelegate {
		return (this.prisma as BatchCapablePrisma).batch;
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
}
