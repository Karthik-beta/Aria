/**
 * Serial number tracking sub-service.
 *
 * Handles serial-number lifecycle with status state-machine transitions
 * (DRAFT → AVAILABLE → DELIVERED → INSTALLED → …), warranty and service-
 * contract expiry tracking, and relationship validation against items,
 * warehouses, and transaction documents.
 *
 * @module SerialNoSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/serial-no | ERPNext Serial No}
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
import { toInventorySerialNo } from "../inventory.types";
import {
	addUtcDays,
	diffUtcDays,
	LIST_QUERY_TAKE_MAX,
	normalizeOptionalText,
	SERIAL_NO_ALLOWED_STATUS_TRANSITIONS,
	serialNoInclude,
	startOfUtcDay,
} from "./inventory-shared";

export class SerialNoSubService {
	constructor(private readonly prisma: PrismaService) {}

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
}
