/**
 * Purchase receipt sub-service.
 *
 * Manages inbound goods: purchase receipt CRUD with items/taxes,
 * series generation, return-mode receipts, and purchase-receipt trend
 * analytics.
 *
 * @module PurchaseReceiptSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/purchase-receipt | ERPNext Purchase Receipt}
 */
import type { Inventory } from "@aria/types";
import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import {
	allocateDocumentSeries,
	getSeriesSeedValue,
} from "../../../shared/document-series";
import type { PrismaService } from "../../../shared/prisma.service";
import { toInventoryPurchaseReceipt } from "../inventory.types";
import {
	buildPurchaseOrderAnalysisRows,
	computePurchaseOrderAnalysisSummary,
} from "../reports/transaction/purchase-order-analysis-report";
import {
	buildPurchaseReceiptTrendsPeriods,
	buildPurchaseReceiptTrendsRows,
	type PurchaseReceiptTrendsSourceEntry,
} from "../reports/transaction/purchase-receipt-trends-report";
import {
	buildSalesOrderAnalysisRows,
	computeSalesOrderAnalysisSummary,
} from "../reports/transaction/sales-order-analysis-report";
import { LIST_QUERY_TAKE_MAX, normalizePostingTime } from "./inventory-shared";

export class PurchaseReceiptSubService {
	private readonly logger = new Logger(PurchaseReceiptSubService.name);

	constructor(private readonly prisma: PrismaService) {}

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

		const existingCounter = await this.prisma.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			return allocateDocumentSeries(this.prisma, prefix);
		}

		const lastReceipt = await this.prisma.purchaseReceipt.findFirst({
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
			getSeriesSeedValue(prefix, lastReceipt?.series),
		);
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
		const postingTime = normalizePostingTime(data.postingTime, postingDate);
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

		const series = await this.generatePurchaseReceiptSeries(
			postingDate,
			seriesPattern,
		);
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
								? normalizePostingTime(undefined, new Date())
								: normalizePostingTime(
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
}
