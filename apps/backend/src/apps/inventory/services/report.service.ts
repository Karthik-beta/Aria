/**
 * Stock reporting & analytics sub-service.
 *
 * Contains all read-only analytical queries: stock ledger, stock
 * balance, projected qty, ageing, item prices, batch history,
 * and more.
 *
 * @module ReportSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/stock-reports | ERPNext Stock Reports}
 */
import type { Inventory } from "@aria/types";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	type BatchItemExpirySourceBatch,
	buildBatchItemExpiryRows,
} from "../reports/item/batch-item-expiry-report";
import {
	type BatchWiseBalanceSourceBatch,
	buildBatchWiseBalanceRows,
} from "../reports/item/batch-wise-balance-report";
import {
	buildItemPricesRows,
	type ItemPricesSourceItem,
} from "../reports/item/item-prices-report";
import { buildItemShortageRows } from "../reports/item/item-shortage-report";
import { buildItemVariantDetailsResult } from "../reports/item/item-variant-details-report";
import { buildItemwiseRecommendedReorderLevelRows } from "../reports/item/itemwise-recommended-reorder-level-report";
import { buildItemPriceStockRows } from "../reports/stock/item-price-stock-report";
import { buildStockAgeingRows } from "../reports/stock/stock-ageing-report";
import {
	buildStockAnalyticsRows,
	getPeriodDateRanges as getPeriodDateRangesForService,
	type StockAnalyticsSourceEntry,
} from "../reports/stock/stock-analytics-report";
import { buildStockBalanceRows } from "../reports/stock/stock-balance-report";
import { buildStockLedgerRows } from "../reports/stock/stock-ledger-report";
import {
	buildStockProjectedQtyRows,
	type StockProjectedQtySourceRow,
} from "../reports/stock/stock-projected-qty-report";
import { buildStockSummaryRows } from "../reports/stock/stock-summary-report";
import { buildWarehouseWiseStockBalanceRows } from "../reports/stock/warehouse-wise-stock-balance-report";
import {
	buildRequestedItemsToBeTransferredRows,
	summarizeRequestedItemsToBeTransferredRows,
} from "../reports/transaction/requested-items-to-be-transferred-report";
import {
	buildSubcontractedItemReceivedRows,
	summarizeSubcontractedItemReceivedRows,
} from "../reports/transaction/subcontracted-item-received-report";
import {
	buildSubcontractedRawMaterialsRows,
	summarizeSubcontractedRawMaterialsRows,
} from "../reports/transaction/subcontracted-raw-materials-report";
import {
	getBatchModel,
	LIST_QUERY_TAKE_MAX,
	parseStockAgeingBucketRanges,
	type StockAvailabilityParams,
} from "./inventory-shared";

export class ReportSubService {
	constructor(private readonly prisma: PrismaService) {}

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
	 * Quick Stock Balance lookup.
	 *
	 * Returns the stock quantity and value for a single item at a specific
	 * warehouse on a specific date. The caller must supply exactly one of
	 * `itemCode` or `barcode`; if neither is provided, a `BadRequestException`
	 * is thrown. If a barcode is supplied but no matching item is found in
	 * `inventory_items`, a `NotFoundException` is thrown.
	 */
	async getQuickStockBalance(
		params: Inventory.QuickStockBalanceInput,
	): Promise<Inventory.QuickStockBalanceResult> {
		const warehouse = params.warehouse.trim();
		const date = params.date;

		if (!params.itemCode && !params.barcode) {
			throw new BadRequestException(
				"Provide either an item code or a barcode.",
			);
		}

		// Resolve item code from barcode when barcode lookup is requested
		let resolvedItemCode: string;

		if (params.barcode) {
			const barcodeEntry = await this.prisma.itemBarcode.findFirst({
				where: { barcode: params.barcode.trim() },
				select: { item: { select: { code: true } } },
			});

			if (!barcodeEntry) {
				throw new NotFoundException(
					`No item is registered for barcode "${params.barcode}".`,
				);
			}

			resolvedItemCode = barcodeEntry.item.code;
		} else {
			resolvedItemCode = (params.itemCode as string).trim();
		}

		// Load item metadata
		const item = await this.prisma.inventoryItem.findFirst({
			where: { code: { equals: resolvedItemCode, mode: "insensitive" } },
			select: {
				name: true,
				code: true,
				description: true,
				valuationRate: true,
				barcodes: { select: { barcode: true } },
			},
		});

		if (!item) {
			throw new NotFoundException(
				`Item with code "${resolvedItemCode}" was not found.`,
			);
		}

		// Pull all submitted stock entry movements for this item up to the date
		const movements = await this.prisma.stockEntryItem.findMany({
			where: {
				itemCode: { equals: resolvedItemCode, mode: "insensitive" },
				stockEntry: {
					status: "SUBMITTED",
					postingDate: { lte: date },
				},
			},
			include: { stockEntry: true },
			orderBy: [
				{ stockEntry: { postingDate: "asc" } },
				{ stockEntry: { createdAt: "asc" } },
				{ id: "asc" },
			],
		});

		// Build ledger rows for the specific warehouse, then compute balance
		const ledgerRows = buildStockLedgerRows(movements, { warehouse });

		let availableQty = 0;
		for (const row of ledgerRows) {
			availableQty += row.qtyIn - row.qtyOut;
		}

		const valuationRate = item.valuationRate ?? 0;
		const stockValue = availableQty * valuationRate;

		return {
			itemCode: item.code,
			itemName: item.name,
			description: item.description ?? null,
			barcodes: item.barcodes.map((b) => b.barcode),
			availableQty,
			stockValue,
		};
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
	 * Get items with negative projected quantity, indicating an active shortage.
	 *
	 * Results are sorted by projectedQty ascending so the most critical shortages
	 * appear first, mirroring ERPNext's Item Shortage Report behavior.
	 */
	async findItemShortageReport(
		params?: Inventory.ListItemShortageInput,
	): Promise<Inventory.ItemShortageRow[]> {
		const company = params?.company?.trim();
		const warehouses = params?.warehouses?.map((w) => w.trim()).filter(Boolean);

		if (warehouses && warehouses.length > 0) {
			const rowMap = new Map<string, Inventory.ItemShortageRow>();

			for (const warehouse of warehouses) {
				const projected = await this.collectStockProjectedQtyRows({
					company,
					warehouse,
				});
				const filtered = buildItemShortageRows(projected);
				for (const row of filtered) {
					rowMap.set(row.id, row);
				}
			}

			return [...rowMap.values()].sort(
				(a, b) => a.projectedQty - b.projectedQty,
			);
		}

		const projected = await this.collectStockProjectedQtyRows({ company });

		return buildItemShortageRows(projected);
	}

	/**
	 * Get material-request lines still awaiting stock transfer or material issue.
	 *
	 * Mirrors ERPNext's Requested Items To Be Transferred report by listing
	 * non-draft, non-cancelled Material Requests of purpose Material Transfer or
	 * Material Issue where orderedQty remains below requested quantity.
	 */
	async findRequestedItemsToBeTransferred(
		params?: Inventory.ListRequestedItemsToBeTransferredInput,
	): Promise<Inventory.RequestedItemsToBeTransferredResult> {
		const company = params?.company?.trim();
		const materialRequest = params?.materialRequest?.trim();
		const itemCode = params?.itemCode?.trim();
		const targetWarehouse = params?.targetWarehouse?.trim();
		const purpose = params?.purpose;

		const materialRequests = await this.prisma.materialRequest.findMany({
			where: {
				purpose: purpose
					? purpose
					: {
							in: ["MATERIAL_TRANSFER", "MATERIAL_ISSUE"],
						},
				status: {
					notIn: ["DRAFT", "CANCELLED"],
				},
				...(company
					? {
							company: {
								contains: company,
								mode: "insensitive",
							},
						}
					: {}),
				...(materialRequest
					? {
							series: {
								contains: materialRequest,
								mode: "insensitive",
							},
						}
					: {}),
			},
			include: { items: true },
			orderBy: [{ transactionDate: "asc" }, { series: "asc" }],
		});

		const itemCodes = [
			...new Set(
				materialRequests.flatMap((request) =>
					request.items.map((item) => item.itemCode),
				),
			),
		];

		const inventoryItems =
			itemCodes.length > 0
				? await this.prisma.inventoryItem.findMany({
						where: {
							code: {
								in: itemCodes,
							},
						},
						select: {
							code: true,
							name: true,
							description: true,
						},
					})
				: [];

		const itemMetadata = new Map(
			inventoryItems.map(
				(item) =>
					[
						item.code,
						{
							name: item.name,
							description: item.description,
						},
					] as const,
			),
		);

		const sourceRows = materialRequests.flatMap((request) =>
			request.items
				.map((item) => {
					const resolvedTargetWarehouse =
						item.targetWarehouse ?? request.targetWarehouse ?? null;

					if (
						itemCode &&
						!item.itemCode.toLowerCase().includes(itemCode.toLowerCase())
					) {
						return null;
					}

					if (
						targetWarehouse &&
						!(resolvedTargetWarehouse ?? "")
							.toLowerCase()
							.includes(targetWarehouse.toLowerCase())
					) {
						return null;
					}

					const metadata = itemMetadata.get(item.itemCode);

					return {
						id: item.id,
						materialRequestId: request.id,
						materialRequest: request.series,
						date: request.transactionDate,
						purpose: request.purpose,
						status: request.status,
						itemCode: item.itemCode,
						itemName: item.itemName ?? metadata?.name ?? null,
						description: metadata?.description ?? null,
						company: request.company,
						targetWarehouse: resolvedTargetWarehouse,
						requiredBy: item.requiredBy ?? request.requiredBy ?? null,
						unitOfMeasure: item.unitOfMeasure ?? null,
						qty: item.quantity,
						transferredQty: item.orderedQty,
					};
				})
				.filter((row): row is NonNullable<typeof row> => row != null),
		);

		const rows = buildRequestedItemsToBeTransferredRows(sourceRows);

		return {
			rows,
			summary: summarizeRequestedItemsToBeTransferredRows(rows),
		};
	}
	/**
	 * Get batch-wise balance history rows.
	 *
	 * Queries all non-disabled `Batch` records matching the given filters and
	 * classifies each batch as either opening (received before `fromDate`) or
	 * incoming (received within the date window). Balance qty reflects the
	 * current on-hand quantity stored on the batch record.
	 */
	async findBatchWiseBalanceHistory(
		params: Inventory.ListBatchWiseBalanceInput,
	): Promise<Inventory.BatchWiseBalanceRow[]> {
		const company = params.company.trim();
		const fromDate = params.fromDate;
		const toDate = params.toDate;
		const itemCode = params.itemCode?.trim();
		const warehouse = params.warehouse?.trim();
		const batchNo = params.batchNo?.trim();

		if (fromDate > toDate) {
			throw new BadRequestException(
				"'From Date' must not be later than 'To Date'.",
			);
		}

		const batches = (await getBatchModel(this.prisma).findMany({
			where: {
				company: { contains: company, mode: "insensitive" },
				isDisabled: false,
				...(itemCode
					? {
							item: {
								code: {
									contains: itemCode,
									mode: "insensitive",
								},
							},
						}
					: {}),
				...(warehouse
					? {
							currentWarehouse: {
								name: {
									contains: warehouse,
									mode: "insensitive",
								},
							},
						}
					: {}),
				...(batchNo
					? {
							batchId: {
								contains: batchNo,
								mode: "insensitive",
							},
						}
					: {}),
			},
			select: {
				id: true,
				batchId: true,
				company: true,
				quantity: true,
				manufacturingDate: true,
				expiryDate: true,
				item: {
					select: {
						code: true,
						name: true,
						description: true,
						valuationRate: true,
						defaultUnitOfMeasure: {
							select: { name: true },
						},
					},
				},
				currentWarehouse: {
					select: { name: true },
				},
				purchaseReceipt: {
					select: { postingDate: true },
				},
				stockEntry: {
					select: { postingDate: true },
				},
			},
			orderBy: [{ item: { code: "asc" } }, { batchId: "asc" }],
		})) as BatchWiseBalanceSourceBatch[];

		return buildBatchWiseBalanceRows(batches, { fromDate, toDate });
	}

	/**
	 * Get batch item expiry status rows.
	 *
	 * Returns all active (non-disabled, qty > 0) batches whose record was
	 * created within [fromDate, toDate], optionally filtered by item code.
	 * Rows are ordered by creation date ascending then batch id.
	 */
	async findBatchItemExpiry(
		params: Inventory.ListBatchItemExpiryInput,
	): Promise<Inventory.BatchItemExpiryRow[]> {
		const fromDate = params.fromDate;
		const toDate = params.toDate;
		const itemCode = params.itemCode?.trim();

		if (fromDate > toDate) {
			throw new BadRequestException(
				"'From Date' must not be later than 'To Date'.",
			);
		}

		const batches = (await getBatchModel(this.prisma).findMany({
			where: {
				isDisabled: false,
				quantity: { gt: 0 },
				createdAt: {
					gte: fromDate,
					lte: toDate,
				},
				...(itemCode
					? {
							item: {
								code: { contains: itemCode, mode: "insensitive" },
							},
						}
					: {}),
			},
			select: {
				id: true,
				batchId: true,
				quantity: true,
				expiryDate: true,
				createdAt: true,
				item: {
					select: {
						code: true,
						name: true,
						defaultUnitOfMeasure: {
							select: { name: true },
						},
					},
				},
			},
			orderBy: [{ createdAt: "asc" }, { batchId: "asc" }],
		})) as BatchItemExpirySourceBatch[];

		return buildBatchItemExpiryRows(batches);
	}

	/**
	 * Get item prices rows showing each item's valuation rate, selling rate, and
	 * last purchase rate, filtered by enabled/disabled status and optional
	 * item code, group, and brand searches.
	 */
	async findItemPrices(
		params?: Inventory.ListItemPricesInput,
	): Promise<Inventory.ItemPricesRow[]> {
		const itemsFilter = params?.itemsFilter ?? "enabled";
		const itemCode = params?.itemCode?.trim();
		const itemGroup = params?.itemGroup?.trim();
		const brand = params?.brand?.trim();

		const disabledFilter =
			itemsFilter === "enabled"
				? false
				: itemsFilter === "disabled"
					? true
					: undefined;

		const items = (await this.prisma.item.findMany({
			where: {
				...(disabledFilter !== undefined ? { disabled: disabledFilter } : {}),
				...(itemCode
					? { code: { contains: itemCode, mode: "insensitive" } }
					: {}),
				...(itemGroup
					? {
							itemGroup: {
								is: { groupName: { contains: itemGroup, mode: "insensitive" } },
							},
						}
					: {}),
				...(brand
					? {
							brand: {
								name: { contains: brand, mode: "insensitive" },
							},
						}
					: {}),
			},
			select: {
				code: true,
				name: true,
				description: true,
				disabled: true,
				itemGroup: { select: { groupName: true } },
				brand: { select: { name: true } },
				defaultUnitOfMeasure: { select: { name: true } },
				valuationRate: true,
				standardSellingRate: true,
			},
		})) as ItemPricesSourceItem[];

		if (items.length === 0) {
			return [];
		}

		const itemCodes = items.map((item) => item.code);

		// Derive the last purchase rate from purchase receipts and purchase orders
		// (mirrors ERPNext which considers PO, PR, and PI as sources).

		// 1. Most-recent purchase receipt items
		const lastPurchaseReceiptRows =
			await this.prisma.purchaseReceiptItem.findMany({
				where: {
					itemCode: { in: itemCodes },
					purchaseReceipt: { status: { notIn: ["DRAFT", "CANCELLED"] } },
				},
				select: {
					itemCode: true,
					rate: true,
					purchaseReceipt: { select: { postingDate: true } },
				},
				orderBy: [
					{ purchaseReceipt: { postingDate: "desc" } },
					{ itemCode: "asc" },
				],
			});

		// 2. Most-recent purchase order items
		const lastPurchaseOrderRows = await this.prisma.purchaseOrderItem.findMany({
			where: {
				itemCode: { in: itemCodes },
				purchaseOrder: { status: { notIn: ["DRAFT", "STOPPED", "CLOSED"] } },
			},
			select: {
				itemCode: true,
				baseRate: true,
				purchaseOrder: { select: { transactionDate: true } },
			},
			orderBy: [
				{ purchaseOrder: { transactionDate: "desc" } },
				{ itemCode: "asc" },
			],
		});

		// Merge: for each item, keep the rate from whichever source has the more
		// recent date (purchase receipt postingDate vs purchase order transactionDate).
		const lastPurchaseRateByCode = new Map<
			string,
			{ rate: number; date: Date }
		>();

		for (const row of lastPurchaseReceiptRows) {
			if (!lastPurchaseRateByCode.has(row.itemCode)) {
				lastPurchaseRateByCode.set(row.itemCode, {
					rate: row.rate,
					date: row.purchaseReceipt.postingDate,
				});
			}
		}

		for (const row of lastPurchaseOrderRows) {
			const existing = lastPurchaseRateByCode.get(row.itemCode);
			const poDate = row.purchaseOrder.transactionDate;
			if (!existing || poDate > existing.date) {
				lastPurchaseRateByCode.set(row.itemCode, {
					rate: row.baseRate,
					date: poDate,
				});
			}
		}

		const rateMap = new Map<string, number>();
		for (const [code, entry] of lastPurchaseRateByCode) {
			rateMap.set(code, entry.rate);
		}

		return buildItemPricesRows(items, rateMap);
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

	/**
	 * Build the Stock Analytics report — period-by-period running stock
	 * balances for all matching items.
	 *
	 * The query fetches all submitted StockEntryItems up to `toDate` so that
	 * running balances are accurate even when `fromDate` is mid-history.
	 */
	async findStockAnalytics(
		params: Inventory.ListStockAnalyticsInput,
	): Promise<Inventory.StockAnalyticsResult> {
		const company = params.company?.trim();
		const warehouse = params.warehouse?.trim();
		const itemCode = params.itemCode?.trim();
		const itemGroup = params.itemGroup?.trim();
		const brand = params.brand?.trim();
		const { fromDate, toDate, frequency, valueQuantity } = params;

		if (fromDate > toDate) {
			throw new BadRequestException(
				"'From Date' must not be later than 'To Date'.",
			);
		}

		// Resolve item codes for item group / brand filters
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

			filteredItemCodes = matchingItems.map((i) => i.code);

			if (filteredItemCodes.length === 0) {
				const periods = getPeriodDateRangesForService(
					fromDate,
					toDate,
					frequency,
				);
				return { periods, rows: [] };
			}
		}

		// Build item code filter for direct itemCode param
		const whereClauses: Prisma.StockEntryItemWhereInput[] = [
			{
				stockEntry: {
					status: "SUBMITTED",
					postingDate: { lte: toDate },
					...(company
						? { company: { contains: company, mode: "insensitive" } }
						: {}),
				},
			},
		];

		if (itemCode) {
			whereClauses.push({
				itemCode: { contains: itemCode, mode: "insensitive" },
			});
		}

		if (filteredItemCodes) {
			whereClauses.push({ itemCode: { in: filteredItemCodes } });
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
			const periods = getPeriodDateRangesForService(
				fromDate,
				toDate,
				frequency,
			);
			return { periods, rows: [] };
		}

		// Map raw stock items to source entries using buildStockLedgerRows
		const ledgerRows = buildStockLedgerRows(stockItems, { warehouse });

		const sourceEntries: StockAnalyticsSourceEntry[] = ledgerRows.map(
			(row) => ({
				company: row.company,
				itemCode: row.itemCode,
				warehouse: row.warehouse,
				postingDate: row.postingDate,
				qtyChange: row.qtyIn - row.qtyOut,
				valueChange:
					row.qtyIn > 0
						? row.basicAmount
						: row.qtyOut > 0
							? -row.basicAmount
							: 0,
			}),
		);

		// Build item metadata map
		const itemCodes = [...new Set(sourceEntries.map((e) => e.itemCode))];
		const [inventoryItems, itemMeta] = await Promise.all([
			this.prisma.inventoryItem.findMany({
				where: { code: { in: itemCodes } },
				include: {
					defaultUnitOfMeasure: { select: { name: true } },
					itemGroup: { select: { groupName: true } },
				},
			}),
			this.prisma.item.findMany({
				where: { code: { in: itemCodes } },
				select: {
					code: true,
					brand: { select: { name: true } },
				},
			}),
		]);

		const inventoryItemsByCode = new Map(
			inventoryItems.map((item) => [item.code, item] as const),
		);
		const brandByCode = new Map(
			itemMeta.map((item) => [item.code, item.brand?.name ?? null] as const),
		);

		const metaMap = new Map<
			string,
			{
				itemName?: string | null;
				itemGroup?: string | null;
				brand?: string | null;
				unitOfMeasure?: string | null;
			}
		>();

		for (const code of itemCodes) {
			const inv = inventoryItemsByCode.get(code);
			metaMap.set(code, {
				itemName: inv?.name ?? null,
				itemGroup: inv?.itemGroup?.groupName ?? null,
				brand: brandByCode.get(code) ?? null,
				unitOfMeasure: inv?.defaultUnitOfMeasure?.name ?? null,
			});
		}

		return buildStockAnalyticsRows(sourceEntries, metaMap, {
			fromDate,
			toDate,
			frequency,
			valueQuantity,
		});
	}

	// ============================================================================
	// Itemwise Recommended Reorder Level Report
	// ============================================================================

	async findItemwiseRecommendedReorderLevel(
		params: Inventory.ListItemwiseRecommendedReorderLevelInput,
	): Promise<Inventory.ItemwiseRecommendedReorderLevelRow[]> {
		const fromDate = params.fromDate;
		const toDate = params.toDate;
		const itemGroup = params.itemGroup?.trim();
		const brand = params.brand?.trim();

		if (fromDate > toDate) {
			throw new BadRequestException("From Date must be before To Date");
		}

		const numberOfDays =
			Math.floor(
				(toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
			) + 1;

		// -------------------------------------------------------------------
		// 1. Resolve item codes filtered by brand / item group (via Item catalog)
		// -------------------------------------------------------------------
		let filteredItemCodes: string[] | undefined;

		if (itemGroup || brand) {
			const matchingCatalogItems = await this.prisma.item.findMany({
				where: {
					...(itemGroup
						? {
								itemGroup: {
									groupName: {
										contains: itemGroup,
										mode: "insensitive" as const,
									},
								},
							}
						: {}),
					...(brand
						? {
								brand: {
									name: {
										contains: brand,
										mode: "insensitive" as const,
									},
								},
							}
						: {}),
				},
				select: { code: true, brand: { select: { name: true } } },
			});

			filteredItemCodes = matchingCatalogItems.map((i) => i.code);
			if (filteredItemCodes.length === 0) return [];
		}

		// -------------------------------------------------------------------
		// 2. Load active stock items
		// -------------------------------------------------------------------
		const inventoryItems = await this.prisma.inventoryItem.findMany({
			where: {
				maintainStock: true,
				disabled: false,
				...(filteredItemCodes ? { code: { in: filteredItemCodes } } : {}),
			},
			select: {
				code: true,
				name: true,
				description: true,
				safetyStock: true,
				leadTimeDays: true,
				itemGroup: { select: { groupName: true } },
			},
		});

		if (inventoryItems.length === 0) return [];

		// Build a brand-lookup map from the catalog Item model
		const allCodes = inventoryItems.map((i) => i.code);

		const catalogItems = await this.prisma.item.findMany({
			where: { code: { in: allCodes } },
			select: { code: true, brand: { select: { name: true } } },
		});
		const brandByCode = new Map<string, string | null>();
		for (const ci of catalogItems) {
			brandByCode.set(ci.code, ci.brand?.name ?? null);
		}

		const itemSources = inventoryItems.map((item) => ({
			code: item.code,
			name: item.name,
			description: item.description,
			safetyStock: item.safetyStock,
			leadTimeDays: item.leadTimeDays,
			itemGroupName: item.itemGroup?.groupName ?? null,
			brandName: brandByCode.get(item.code) ?? null,
		}));

		// -------------------------------------------------------------------
		// 3. Calculate consumed quantities from stock entries
		//    Exclude: MATERIAL_TRANSFER, MATERIAL_TRANSFER_FOR_MANUFACTURE,
		//             SEND_TO_SUBCONTRACTOR, MATERIAL_RECEIPT
		//    Only items leaving stock (sourceWarehouse is set).
		// -------------------------------------------------------------------
		const consumedEntries = await this.prisma.stockEntryItem.groupBy({
			by: ["itemCode"],
			where: {
				sourceWarehouse: { not: null },
				itemCode: { in: allCodes },
				stockEntry: {
					status: "SUBMITTED",
					postingDate: { gte: fromDate, lte: toDate },
					stockEntryType: {
						in: ["MATERIAL_ISSUE", "MANUFACTURE", "REPACK"],
					},
				},
			},
			_sum: { qty: true },
		});

		const consumedByItem = new Map<string, number>();
		for (const entry of consumedEntries) {
			consumedByItem.set(entry.itemCode, entry._sum.qty ?? 0);
		}

		// -------------------------------------------------------------------
		// 4. Calculate delivered quantities from delivery notes
		//    Only submitted (non-draft, non-cancelled, non-return) notes.
		// -------------------------------------------------------------------
		const deliveredEntries = await this.prisma.deliveryNoteItem.groupBy({
			by: ["itemCode"],
			where: {
				itemCode: { in: allCodes },
				deliveryNote: {
					status: { notIn: ["DRAFT", "CANCELLED"] },
					isReturn: false,
					postingDate: { gte: fromDate, lte: toDate },
				},
			},
			_sum: { quantity: true },
		});

		const deliveredByItem = new Map<string, number>();
		for (const entry of deliveredEntries) {
			deliveredByItem.set(entry.itemCode, entry._sum.quantity ?? 0);
		}

		// -------------------------------------------------------------------
		// 5. Build report rows
		// -------------------------------------------------------------------
		return buildItemwiseRecommendedReorderLevelRows(
			itemSources,
			consumedByItem,
			deliveredByItem,
			numberOfDays,
		);
	}

	// =========================================================================
	// Item Variant Details Report
	// =========================================================================

	async findItemVariantDetails(
		params: Inventory.ListItemVariantDetailsInput,
	): Promise<Inventory.ItemVariantDetailsResult> {
		const itemCode = params.itemCode.trim();

		// 1. Verify the template item exists and has variants
		const templateItem = await this.prisma.inventoryItem.findFirst({
			where: { code: itemCode, hasVariants: true, disabled: false },
			select: { id: true, code: true },
		});

		if (!templateItem) {
			return { attributeNames: [], rows: [] };
		}

		// 2. Fetch all non-disabled variant items of the template
		const variants = await this.prisma.inventoryItem.findMany({
			where: {
				templateItemId: templateItem.id,
				disabled: false,
			},
			select: {
				id: true,
				code: true,
				name: true,
				quantity: true,
				standardSellingRate: true,
			},
		});

		if (variants.length === 0) {
			return { attributeNames: [], rows: [] };
		}

		const variantIds = variants.map((v) => v.id);
		const variantCodes = variants.map((v) => v.code);

		// 3. Fetch attribute values for each variant
		const variantAttrRows = await this.prisma.inventoryItemAttribute.findMany({
			where: { itemId: { in: variantIds } },
			select: {
				itemId: true,
				attributeValue: true,
				attribute: { select: { name: true } },
			},
		});

		const variantAttributes = variantAttrRows.map(
			(row: {
				itemId: string;
				attributeValue: string;
				attribute: { name: string };
			}) => ({
				itemId: row.itemId,
				attributeName: row.attribute.name,
				attributeValue: row.attributeValue,
			}),
		);

		// 4. Average buying price from purchase receipt items
		const buyingPriceRows = await this.prisma.purchaseReceiptItem.groupBy({
			by: ["itemCode"],
			where: {
				itemCode: { in: variantCodes },
				purchaseReceipt: { status: { notIn: ["DRAFT", "CANCELLED"] } },
			},
			_avg: { rate: true },
		});

		const avgBuyingPriceMap = new Map<string, number>();
		for (const row of buyingPriceRows) {
			avgBuyingPriceMap.set(row.itemCode, row._avg.rate ?? 0);
		}

		// 5. Open sales orders count (number of distinct orders per variant)
		const openOrderItems = await this.prisma.salesOrderItem.findMany({
			where: {
				itemCode: { in: variantCodes },
				salesOrder: {
					status: { notIn: ["DRAFT", "COMPLETED", "CLOSED"] },
				},
			},
			select: {
				itemCode: true,
				salesOrderId: true,
			},
			distinct: ["itemCode", "salesOrderId"],
		});

		const openOrdersMap = new Map<string, number>();
		for (const row of openOrderItems) {
			openOrdersMap.set(
				row.itemCode,
				(openOrdersMap.get(row.itemCode) ?? 0) + 1,
			);
		}

		// 6. Build result
		return buildItemVariantDetailsResult(
			variants,
			variantAttributes,
			avgBuyingPriceMap,
			openOrdersMap,
		);
	}

	async findSubcontractedRawMaterials(
		params: Inventory.ListSubcontractedRawMaterialsInput,
	): Promise<Inventory.SubcontractedRawMaterialsResult> {
		const supplier = params.supplier.trim();
		const fromDate = new Date(params.fromDate);
		const toDate = new Date(params.toDate);
		const company = params.company?.trim();
		const rmItemCode = params.rmItemCode?.trim();

		if (fromDate >= toDate) {
			return {
				rows: [],
				summary: {
					orderCount: 0,
					rowCount: 0,
					totalRequiredQty: 0,
					totalTransferredQty: 0,
					totalReturnedQty: 0,
					totalPendingQty: 0,
				},
			};
		}

		const orders = await this.prisma.subcontractingOrder.findMany({
			where: {
				supplier: {
					contains: supplier,
					mode: "insensitive",
				},
				transactionDate: {
					gte: fromDate,
					lte: toDate,
				},
				status: {
					notIn: ["DRAFT", "CANCELLED"],
				},
				percentReceived: {
					lt: 100,
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
			include: { suppliedItems: true },
			orderBy: [{ transactionDate: "asc" }, { series: "asc" }],
		});

		const sourceRows = orders.flatMap((order) =>
			order.suppliedItems
				.filter((item) => {
					if (
						rmItemCode &&
						!item.rmItemCode.toLowerCase().includes(rmItemCode.toLowerCase())
					) {
						return false;
					}
					return true;
				})
				.map((item) => ({
					id: item.id,
					subcontractingOrderId: order.id,
					subcontractOrder: order.series,
					date: order.transactionDate,
					supplier: order.supplier,
					status: order.status as Inventory.SubcontractingOrderStatus,
					percentReceived: order.percentReceived,
					rmItemCode: item.rmItemCode,
					rmItemName: item.rmItemName,
					requiredQty: item.requiredQty,
					suppliedQty: item.suppliedQty,
					returnedQty: item.returnedQty,
				})),
		);

		const rows = buildSubcontractedRawMaterialsRows(sourceRows);

		return {
			rows,
			summary: summarizeSubcontractedRawMaterialsRows(rows),
		};
	}

	async findSubcontractedItemToBeReceived(
		params: Inventory.ListSubcontractedItemToBeReceivedInput,
	): Promise<Inventory.SubcontractedItemToBeReceivedResult> {
		const supplier = params.supplier.trim();
		const fromDate = new Date(params.fromDate);
		const toDate = new Date(params.toDate);
		const company = params.company?.trim();
		const fgItemCode = params.fgItemCode?.trim();

		if (fromDate >= toDate) {
			return {
				rows: [],
				summary: {
					orderCount: 0,
					rowCount: 0,
					totalRequiredQty: 0,
					totalReceivedQty: 0,
					totalPendingQty: 0,
				},
			};
		}

		const orders = await this.prisma.subcontractingOrder.findMany({
			where: {
				supplier: {
					contains: supplier,
					mode: "insensitive",
				},
				transactionDate: {
					gte: fromDate,
					lte: toDate,
				},
				status: {
					notIn: ["DRAFT", "CANCELLED"],
				},
				percentReceived: {
					lt: 100,
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
			orderBy: [{ transactionDate: "asc" }, { series: "asc" }],
		});

		const sourceRows = orders.flatMap((order) =>
			order.items
				.filter((item) => {
					if (
						fgItemCode &&
						!item.itemCode.toLowerCase().includes(fgItemCode.toLowerCase())
					) {
						return false;
					}
					return true;
				})
				.map((item) => ({
					id: item.id,
					subcontractingOrderId: order.id,
					subcontractOrder: order.series,
					date: order.transactionDate,
					supplier: order.supplier,
					status: order.status as Inventory.SubcontractingOrderStatus,
					percentReceived: order.percentReceived,
					fgItemCode: item.itemCode,
					itemName: item.itemName,
					qty: item.qty,
					receivedQty: item.receivedQty,
				})),
		);

		const rows = buildSubcontractedItemReceivedRows(sourceRows);

		return {
			rows,
			summary: summarizeSubcontractedItemReceivedRows(rows),
		};
	}
}
