/**
 * Delivery & fulfillment sub-service.
 *
 * Covers the outbound flow: delivery notes, pick lists, delivery trips,
 * and packing slips. Each document type uses auto-incrementing series
 * with conflict-retry logic.
 *
 * @module DeliverySubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/delivery-note | ERPNext Delivery Note}
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/pick-list | ERPNext Pick List}
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/delivery-trip | ERPNext Delivery Trip}
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/packing-slip | ERPNext Packing Slip}
 */
import type { Inventory } from "@aria/types";
import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import {
	allocateDocumentSeries,
	getSeriesSeedValue,
} from "../../../shared/document-series";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	toInventoryDeliveryNote,
	toInventoryDeliveryTrip,
	toInventoryPackingSlip,
	toInventoryPickList,
} from "../inventory.types";
import {
	buildDeliveryNoteTrendsPeriods,
	buildDeliveryNoteTrendsRows,
	type DeliveryNoteTrendsSourceEntry,
} from "../reports/transaction/delivery-note-trends-report";
import { LIST_QUERY_TAKE_MAX } from "./inventory-shared";

export class DeliverySubService {
	private readonly logger = new Logger(DeliverySubService.name);

	constructor(private readonly prisma: PrismaService) {}

	private async lockDeliveryNoteRows(
		tx: Prisma.TransactionClient,
		deliveryNoteIds: string[],
	): Promise<void> {
		const uniqueIds = [...new Set(deliveryNoteIds.map((id) => id.trim()))]
			.filter((id) => id.length > 0)
			.sort();

		if (uniqueIds.length === 0) {
			return;
		}

		await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
			SELECT id
			FROM delivery_notes
			WHERE id IN (${Prisma.join(uniqueIds)})
			ORDER BY id
			FOR UPDATE
		`);
	}

	// ============================================================================
	// Delivery Note Methods
	// ============================================================================

	/**
	 * Generate a unique series number for a new Delivery Note.
	 * Format: MAT-DN-YYYY-NNNNN.
	 * Uses a database-backed counter so concurrent writers stay bounded.
	 */
	private async generateDeliveryNoteSeries(date: Date): Promise<string> {
		const year = date.getFullYear();
		const prefix = `MAT-DN-${year}-`;

		const existingCounter = await this.prisma.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			return allocateDocumentSeries(this.prisma, prefix);
		}

		const lastEntry = await this.prisma.deliveryNote.findFirst({
			where: {
				series: { startsWith: prefix },
			},
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			this.prisma,
			prefix,
			5,
			getSeriesSeedValue(prefix, lastEntry?.series),
		);
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
	 * Get delivery notes with bounded pagination, optional status filter, and search.
	 * Defaults to the 250 most recent records when no params are provided.
	 */
	async findAllDeliveryNotes(params?: {
		skip?: number;
		take?: number;
		search?: string;
		status?: Inventory.DeliveryNoteStatus;
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

		const where: Record<string, unknown> = {};
		if (params?.status) {
			where.status = params.status;
		}
		if (params?.search) {
			where.OR = [
				{ series: { contains: params.search, mode: "insensitive" } },
				{ customer: { contains: params.search, mode: "insensitive" } },
				{ company: { contains: params.search, mode: "insensitive" } },
			];
		}

		const notes = await this.prisma.deliveryNote.findMany({
			where,
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
	 * Item amounts are computed as quantity × rate on creation.
	 */
	async createDeliveryNote(
		data: Inventory.CreateDeliveryNoteInput,
	): Promise<Inventory.DeliveryNote> {
		const postingDate = data.postingDate ?? new Date();
		const series = await this.generateDeliveryNoteSeries(postingDate);
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
				throw new NotFoundException(`Delivery note with ID ${id} not found`);
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
	/**
	 * Generate a unique series number for a pick list using prefix STO-PICK.
	 * Uses read-then-retry with exponential backoff to handle concurrent writes.
	 */
	private async generatePickListSeries(date: Date): Promise<string> {
		const year = date.getFullYear();
		const prefix = `STO-PICK-${year}-`;

		const existingCounter = await this.prisma.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			return allocateDocumentSeries(this.prisma, prefix);
		}

		const lastPickList = await this.prisma.pickList.findFirst({
			where: { series: { startsWith: prefix } },
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			this.prisma,
			prefix,
			5,
			getSeriesSeedValue(prefix, lastPickList?.series),
		);
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
	 */
	async createPickList(
		data: Inventory.CreatePickListInput,
	): Promise<Inventory.PickList> {
		const postingDate = new Date();
		const series = await this.generatePickListSeries(postingDate);
		const created = await this.prisma.pickList.create({
			data: {
				series,
				company: data.company,
				customer: data.customer,
				status: data.status ?? "DRAFT",
				purpose: data.purpose ?? "MATERIAL_TRANSFER_FOR_MANUFACTURE",
				workOrder: data.workOrder,
				warehouse: data.warehouse,
				considerRejectedWarehouses: data.considerRejectedWarehouses ?? false,
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

		const existingCounter = await this.prisma.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			return allocateDocumentSeries(this.prisma, prefix);
		}

		const lastTrip = await this.prisma.deliveryTrip.findFirst({
			where: { series: { startsWith: prefix } },
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			this.prisma,
			prefix,
			5,
			getSeriesSeedValue(prefix, lastTrip?.series),
		);
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
	 * Series generation uses a database-backed allocator to stay safe under concurrency.
	 */
	async createDeliveryTrip(
		data: Inventory.CreateDeliveryTripInput,
	): Promise<Inventory.DeliveryTrip> {
		const departureTime = data.departureTime ?? undefined;
		const createdAt = new Date();
		const series = await this.generateDeliveryTripSeries(createdAt);
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

	private async generatePackingSlipSeries(
		date: Date,
		client: Prisma.TransactionClient | PrismaService = this.prisma,
	): Promise<string> {
		const year = date.getFullYear();
		const prefix = `MAT-PAC-${year}-`;

		const existingCounter = await client.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			return allocateDocumentSeries(client, prefix);
		}

		const lastEntry = await client.packingSlip.findFirst({
			where: { series: { startsWith: prefix } },
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			client,
			prefix,
			5,
			getSeriesSeedValue(prefix, lastEntry?.series),
		);
	}

	/**
	 * Calculate the net weight and UOM for a packing slip from its items.
	 * Net weight is computed as `SUM(item.netWeight × item.qty)` (matching
	 * ERPNext's `calculate_net_total_pkg` logic).
	 * Throws if items use different UOMs.
	 */
	private computePackingSlipWeights(
		items: { netWeight: number; qty: number; weightUom?: string | null }[],
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
			(sum, item) => sum + (item.netWeight ?? 0) * (item.qty ?? 0),
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
		tx: Prisma.TransactionClient,
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

		const overlapping = await tx.packingSlip.findFirst({
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
		tx: Prisma.TransactionClient,
		items: { deliveryNoteItemId: string; qty: number }[],
		excludePackingSlipId?: string,
	): Promise<void> {
		for (const item of items) {
			const dn = await tx.deliveryNoteItem.findUnique({
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
				const existingQty = await tx.packingSlipItem.findFirst({
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
		search?: string;
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
				...(params?.search
					? {
							series: { contains: params.search, mode: "insensitive" as const },
						}
					: {}),
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
		const created = await this.prisma.$transaction(async (tx) => {
			await this.lockDeliveryNoteRows(tx, [data.deliveryNoteId]);

			const dn = await tx.deliveryNote.findUnique({
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

			await this.validateCaseNos(tx, data.deliveryNoteId, fromCaseNo, toCaseNo);
			await this.validatePackingSlipItemQtys(tx, data.items);

			// Auto-fill missing weight / UOM from Item master (ERPNext: set_missing_values)
			const uniqueCodes = [...new Set(data.items.map((i) => i.itemCode))];
			const itemMasters = await tx.inventoryItem.findMany({
				where: { code: { in: uniqueCodes } },
				select: { code: true, weightPerUnit: true, weightUom: true },
			});
			const masterByCode = new Map(itemMasters.map((m) => [m.code, m]));
			const enrichedItems = data.items.map((i) => {
				const master = masterByCode.get(i.itemCode);
				return {
					...i,
					netWeight:
						i.netWeight != null && i.netWeight !== 0
							? i.netWeight
							: (master?.weightPerUnit ?? 0),
					weightUom: i.weightUom ?? master?.weightUom ?? null,
				};
			});

			const weights = this.computePackingSlipWeights(
				enrichedItems.map((i) => ({
					netWeight: i.netWeight,
					qty: i.qty,
					weightUom: i.weightUom,
				})),
				data.grossWeightPkg,
			);

			const series = await this.generatePackingSlipSeries(new Date(), tx);
			return tx.packingSlip.create({
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
						create: enrichedItems.map((item) => ({
							deliveryNoteItemId: item.deliveryNoteItemId,
							itemCode: item.itemCode,
							itemName: item.itemName,
							description: item.description,
							qty: item.qty,
							netWeight: item.netWeight,
							weightUom: item.weightUom,
							batchNo: item.batchNo,
						})),
					},
				},
				include: { items: true },
			});
		});

		return toInventoryPackingSlip(created);
	}

	/**
	 * Update a draft packing slip. Only draft slips can be updated.
	 */
	async updatePackingSlip(
		data: Inventory.UpdatePackingSlipInput,
	): Promise<Inventory.PackingSlip> {
		const updated = await this.prisma.$transaction(async (tx) => {
			const reference = await tx.packingSlip.findUnique({
				where: { id: data.id },
				select: { deliveryNoteId: true },
			});

			if (!reference) {
				throw new NotFoundException(
					`Packing slip with ID "${data.id}" not found.`,
				);
			}

			await this.lockDeliveryNoteRows(tx, [reference.deliveryNoteId]);

			const existing = await tx.packingSlip.findUnique({
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
				tx,
				existing.deliveryNoteId,
				fromCaseNo,
				toCaseNo,
				existing.id,
			);

			if (data.items) {
				await this.validatePackingSlipItemQtys(tx, data.items, existing.id);
			}

			// Auto-fill missing weight / UOM from Item master when new items are provided
			let enrichedUpdateItems: typeof data.items | undefined;
			if (data.items) {
				const uniqueCodes = [...new Set(data.items.map((i) => i.itemCode))];
				const itemMasters = await tx.inventoryItem.findMany({
					where: { code: { in: uniqueCodes } },
					select: { code: true, weightPerUnit: true, weightUom: true },
				});
				const masterByCode = new Map(itemMasters.map((m) => [m.code, m]));
				enrichedUpdateItems = data.items.map((i) => {
					const master = masterByCode.get(i.itemCode);
					return {
						...i,
						netWeight:
							i.netWeight != null && i.netWeight !== 0
								? i.netWeight
								: (master?.weightPerUnit ?? 0),
						weightUom: i.weightUom ?? master?.weightUom ?? null,
					};
				});
			}

			const itemsForWeight = (enrichedUpdateItems ?? existing.items).map(
				(i: {
					netWeight?: number | null;
					qty?: number | null;
					weightUom?: string | null;
				}) => ({
					netWeight: i.netWeight ?? 0,
					qty: i.qty ?? 0,
					weightUom: i.weightUom,
				}),
			);
			const weights = this.computePackingSlipWeights(
				itemsForWeight,
				data.grossWeightPkg ?? existing.grossWeightPkg,
			);

			if (enrichedUpdateItems) {
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
					...(enrichedUpdateItems && {
						items: {
							create: enrichedUpdateItems.map((item) => ({
								deliveryNoteItemId: item.deliveryNoteItemId,
								itemCode: item.itemCode,
								itemName: item.itemName,
								description: item.description,
								qty: item.qty,
								netWeight: item.netWeight,
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
		const updated = await this.prisma.$transaction(async (tx) => {
			const reference = await tx.packingSlip.findUnique({
				where: { id },
				select: { deliveryNoteId: true },
			});

			if (!reference) {
				throw new NotFoundException(`Packing slip with ID "${id}" not found.`);
			}

			await this.lockDeliveryNoteRows(tx, [reference.deliveryNoteId]);

			const existing = await tx.packingSlip.findUnique({
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
				tx,
				existing.deliveryNoteId,
				existing.fromCaseNo,
				existing.toCaseNo,
				existing.id,
			);

			// Validate quantities (fresh check at submit time)
			await this.validatePackingSlipItemQtys(tx, existing.items, existing.id);

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
		const updated = await this.prisma.$transaction(async (tx) => {
			const reference = await tx.packingSlip.findUnique({
				where: { id },
				select: { deliveryNoteId: true },
			});

			if (!reference) {
				throw new NotFoundException(`Packing slip with ID "${id}" not found.`);
			}

			await this.lockDeliveryNoteRows(tx, [reference.deliveryNoteId]);

			const existing = await tx.packingSlip.findUnique({
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
		return this.prisma.$transaction(async (tx) => {
			const reference = await tx.packingSlip.findUnique({
				where: { id },
				select: { deliveryNoteId: true },
			});

			if (!reference) {
				throw new NotFoundException(`Packing slip with ID "${id}" not found.`);
			}

			await this.lockDeliveryNoteRows(tx, [reference.deliveryNoteId]);

			const existing = await tx.packingSlip.findUnique({
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

			await tx.packingSlip.delete({ where: { id } });
			return { success: true, id };
		});
	}

	/**
	 * Bulk delete draft/cancelled packing slips.
	 */
	async deleteManyPackingSlips(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const uniqueIds = [...new Set(ids)];

		return this.prisma.$transaction(async (tx) => {
			const deliveryNoteRefs = await tx.packingSlip.findMany({
				where: { id: { in: uniqueIds } },
				select: { deliveryNoteId: true },
			});

			await this.lockDeliveryNoteRows(
				tx,
				deliveryNoteRefs.map((slip) => slip.deliveryNoteId),
			);

			const currentSlips = await tx.packingSlip.findMany({
				where: { id: { in: uniqueIds } },
				select: { series: true, status: true },
			});

			const submitted = currentSlips.filter((slip) => slip.status === "SUBMITTED");

			if (submitted.length > 0) {
				const series = submitted.map((slip) => slip.series).join(", ");
				throw new BadRequestException(
					`Cannot delete submitted packing slips: ${series}. Cancel them first.`,
				);
			}

			const result = await tx.packingSlip.deleteMany({
				where: { id: { in: uniqueIds } },
			});

			return { success: true, count: result.count, ids: uniqueIds };
		});
	}
}
