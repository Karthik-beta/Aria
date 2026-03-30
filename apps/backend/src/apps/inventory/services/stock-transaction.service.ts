/**
 * Stock transaction sub-service.
 *
 * Manages material requests and stock entries with auto-incrementing
 * series and item/tax line handling.
 *
 * @module StockTransactionSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/material-request | ERPNext Material Request}
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/stock-entry | ERPNext Stock Entry}
 */
import type { Inventory } from "@aria/types";
import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	toInventoryMaterialRequest,
	toInventoryStockEntry,
} from "../inventory.types";
import { LIST_QUERY_TAKE_MAX } from "./inventory-shared";

export class StockTransactionSubService {
	private readonly logger = new Logger(StockTransactionSubService.name);

	constructor(private readonly prisma: PrismaService) {}

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
	 * Get material requests with bounded pagination, optional status/purpose filter, and search.
	 */
	async findAllMaterialRequests(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.MaterialRequestStatus;
		purpose?: Inventory.MaterialRequestPurpose;
	}): Promise<Inventory.MaterialRequest[]> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;

		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const where: Record<string, unknown> = {};
		if (params?.status) {
			where.status = params.status;
		}
		if (params?.purpose) {
			where.purpose = params.purpose;
		}
		if (params?.search) {
			where.OR = [
				{ series: { contains: params.search, mode: "insensitive" } },
				{ company: { contains: params.search, mode: "insensitive" } },
			];
		}

		const requests = await this.prisma.materialRequest.findMany({
			where,
			orderBy: { createdAt: "desc" },
			include: { items: true },
			skip,
			take,
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
	 * Get stock entries with bounded pagination, optional status/type filter, and search.
	 */
	async findAllStockEntries(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.StockEntryStatus;
		stockEntryType?: Inventory.StockEntryType;
	}): Promise<Inventory.StockEntry[]> {
		const rawSkip = params?.skip ?? 0;
		const rawTake = params?.take ?? LIST_QUERY_TAKE_MAX;

		const skip = rawSkip < 0 ? 0 : rawSkip;
		const take =
			rawTake <= 0
				? 1
				: rawTake > LIST_QUERY_TAKE_MAX
					? LIST_QUERY_TAKE_MAX
					: rawTake;

		const where: Record<string, unknown> = {};
		if (params?.status) {
			where.status = params.status;
		}
		if (params?.stockEntryType) {
			where.stockEntryType = params.stockEntryType;
		}
		if (params?.search) {
			where.OR = [
				{ series: { contains: params.search, mode: "insensitive" } },
				{ company: { contains: params.search, mode: "insensitive" } },
			];
		}

		const entries = await this.prisma.stockEntry.findMany({
			where,
			orderBy: { createdAt: "desc" },
			include: { items: true },
			skip,
			take,
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
