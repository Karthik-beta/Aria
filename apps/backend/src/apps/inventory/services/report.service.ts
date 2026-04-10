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
import { Prisma } from "../../../generated/prisma/client";
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
import {
	applyStockAgeingItems,
	createStockAgeingState,
	finalizeStockAgeingRows,
} from "../reports/stock/stock-ageing-report";
import { getPeriodDateRanges as getPeriodDateRangesForService } from "../reports/stock/stock-analytics-report";
import { buildStockLedgerRows } from "../reports/stock/stock-ledger-report";
import {
	buildStockProjectedQtyRows,
	type StockProjectedQtySourceRow,
} from "../reports/stock/stock-projected-qty-report";
import { buildStockSummaryRows } from "../reports/stock/stock-summary-report";
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

const STOCK_AGEING_BATCH_SIZE = 1_000;

interface ProjectedSourceAggregateRow {
	company: string;
	itemCode: string;
	itemName: string | null;
	description: string | null;
	warehouse: string;
	unitOfMeasure: string | null;
	actualQty: number;
	plannedQty: number;
	requestedQty: number;
	orderedQty: number;
	reservedQty: number;
	reservedQtyForProduction: number;
	reservedQtyForSubcontracting: number;
	reservedQtyForProductionPlan: number;
	lastActivityDate: Date | null;
}

interface StockBalanceAggregateRow {
	company: string;
	itemCode: string;
	itemName: string | null;
	warehouse: string;
	unitOfMeasure: string | null;
	openingQty: number;
	openingValue: number;
	inQty: number;
	inValue: number;
	outQty: number;
	outValue: number;
	lastPostingDate: Date | null;
}

interface WarehouseWiseStockBalanceQueryRow {
	id: string;
	stockEntryId: string;
	stockEntryItemId: string;
	company: string;
	itemCode: string;
	itemName: string | null;
	warehouse: string;
	postingDate: Date;
	voucherNo: string;
	qtyChange: number;
	incomingRate: number;
	movementType: "IN" | "OUT";
	createdAt: Date;
	updatedAt: Date;
}

interface StockAnalyticsAggregateRow {
	itemCode: string;
	itemName: string | null;
	description: string | null;
	periodStart: Date | null;
	qtyDelta: number;
	valueDelta: number;
	openingQtyDelta: number;
	openingValueDelta: number;
}

interface StockAgeingMovementRow {
	id: string;
	itemCode: string;
	itemName: string | null;
	description: string | null;
	qty: number;
	basicRate: number;
	basicAmount: number;
	unitOfMeasure: string | null;
	sourceWarehouse: string | null;
	targetWarehouse: string | null;
	stockEntry: {
		id: string;
		series: string;
		company: string;
		status: Inventory.StockEntryStatus;
		stockEntryType: Inventory.StockEntryType;
		postingDate: Date;
		defaultSourceWarehouse: string | null;
		defaultTargetWarehouse: string | null;
		project: string | null;
		remarks: string | null;
		createdAt: Date;
		updatedAt: Date;
	};
}

function clampListWindow(rawSkip?: number, rawTake?: number) {
	const skip = (rawSkip ?? 0) < 0 ? 0 : (rawSkip ?? 0);
	const take =
		(rawTake ?? LIST_QUERY_TAKE_MAX) <= 0
			? 1
			: (rawTake ?? LIST_QUERY_TAKE_MAX) > LIST_QUERY_TAKE_MAX
				? LIST_QUERY_TAKE_MAX
				: (rawTake ?? LIST_QUERY_TAKE_MAX);
	return { skip, take };
}

function escapeLikePattern(value: string) {
	return value
		.replaceAll("\\", "\\\\")
		.replaceAll("%", "\\%")
		.replaceAll("_", "\\_");
}

function buildContainsCondition(column: string, value?: string) {
	if (!value) return null;
	return Prisma.sql`${Prisma.raw(column)} ILIKE ${`%${escapeLikePattern(value)}%`} ESCAPE '\\'`;
}

function buildInsensitiveEqualsCondition(column: string, value?: string) {
	if (!value) return null;
	return Prisma.sql`LOWER(COALESCE(${Prisma.raw(column)}, '')) = ${value.toLowerCase()}`;
}

function buildInCondition(column: string, values?: string[]) {
	if (!values || values.length === 0) return null;
	return Prisma.sql`${Prisma.raw(column)} IN (${Prisma.join(values)})`;
}

function combineSqlConditions(
	conditions: Array<Prisma.Sql | null | undefined>,
	separator = " AND ",
) {
	const filtered = conditions.filter(
		(condition): condition is Prisma.Sql => condition != null,
	);

	if (filtered.length === 0) {
		return Prisma.sql`TRUE`;
	}

	return filtered
		.slice(1)
		.reduce(
			(current, condition) =>
				Prisma.sql`${current}${Prisma.raw(separator)}${condition}`,
			filtered[0],
		);
}

function buildSearchCondition(columns: string[], value?: string) {
	if (!value) return null;
	return combineSqlConditions(
		columns.map((column) => buildContainsCondition(column, value)),
		" OR ",
	);
}

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
		const { skip, take } = clampListWindow(params?.skip, params?.take);

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

		const rows = await this.prisma.client.$queryRaw<
			WarehouseWiseStockBalanceQueryRow[]
		>(Prisma.sql`
			WITH movement_rows AS (
				SELECT
					CONCAT(sei.id, ':', COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse"), ':IN') AS id,
					sei."stockEntryId" AS "stockEntryId",
					sei.id AS "stockEntryItemId",
					se.company AS company,
					sei."itemCode" AS "itemCode",
					sei."itemName" AS "itemName",
					COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse") AS warehouse,
					se."postingDate" AS "postingDate",
					se.series AS "voucherNo",
					sei.qty AS "qtyChange",
					sei."basicRate" AS "incomingRate",
					'IN'::text AS "movementType",
					se."createdAt" AS "createdAt",
					se."updatedAt" AS "updatedAt",
					se.status AS status
				FROM stock_entry_items sei
				INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
				WHERE COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse") IS NOT NULL

				UNION ALL

				SELECT
					CONCAT(sei.id, ':', COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse"), ':OUT') AS id,
					sei."stockEntryId" AS "stockEntryId",
					sei.id AS "stockEntryItemId",
					se.company AS company,
					sei."itemCode" AS "itemCode",
					sei."itemName" AS "itemName",
					COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse") AS warehouse,
					se."postingDate" AS "postingDate",
					se.series AS "voucherNo",
					-sei.qty AS "qtyChange",
					0::double precision AS "incomingRate",
					'OUT'::text AS "movementType",
					se."createdAt" AS "createdAt",
					se."updatedAt" AS "updatedAt",
					se.status AS status
				FROM stock_entry_items sei
				INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
				WHERE COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse") IS NOT NULL
			)
			SELECT
				id,
				"stockEntryId",
				"stockEntryItemId",
				company,
				"itemCode",
				"itemName",
				warehouse,
				"postingDate",
				"voucherNo",
				"qtyChange",
				"incomingRate",
				"movementType",
				"createdAt",
				"updatedAt"
			FROM movement_rows
			WHERE ${combineSqlConditions([
				Prisma.sql`status = ${status}`,
				buildContainsCondition(`company`, company),
				buildContainsCondition(`"voucherNo"`, voucherNo),
				buildContainsCondition(`"itemCode"`, itemCode),
				buildInsensitiveEqualsCondition(`warehouse`, warehouse),
				dateFrom ? Prisma.sql`"postingDate" >= ${dateFrom}` : null,
				dateTo ? Prisma.sql`"postingDate" <= ${dateTo}` : null,
				buildSearchCondition(
					[`company`, `"itemCode"`, `"itemName"`, `warehouse`, `"voucherNo"`],
					search,
				),
			])}
			ORDER BY "postingDate" DESC, "updatedAt" DESC, id ASC
			OFFSET ${skip}
			LIMIT ${take}
		`);

		return rows.map((row) => ({
			...row,
			qtyChange: Number(row.qtyChange ?? 0),
			incomingRate: Number(row.incomingRate ?? 0),
			movementType: row.movementType,
		}));
	}

	/**
	 * Get stock balance rows aggregated by company, item, and warehouse.
	 * The report derives opening, inward, outward, and closing values from
	 * stock entry movements up to the requested end date.
	 */
	async findStockBalance(params?: Inventory.ListStockBalanceInput) {
		const { skip, take } = clampListWindow(params?.skip, params?.take);

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

		const aggregateRows = await this.prisma.client.$queryRaw<
			StockBalanceAggregateRow[]
		>(Prisma.sql`
			WITH movement_rows AS (
				SELECT
					se.company AS company,
					se.status AS status,
					sei."itemCode" AS "itemCode",
					sei."itemName" AS "itemName",
					COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse") AS warehouse,
					sei."unitOfMeasure" AS "unitOfMeasure",
					se."postingDate" AS "postingDate",
					se.project AS project,
					se.series AS series,
					sei.description AS description,
					sei.qty AS "qtyIn",
					0::double precision AS "qtyOut",
					sei."basicAmount" AS "basicAmount"
				FROM stock_entry_items sei
				INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
				WHERE COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse") IS NOT NULL

				UNION ALL

				SELECT
					se.company AS company,
					se.status AS status,
					sei."itemCode" AS "itemCode",
					sei."itemName" AS "itemName",
					COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse") AS warehouse,
					sei."unitOfMeasure" AS "unitOfMeasure",
					se."postingDate" AS "postingDate",
					se.project AS project,
					se.series AS series,
					sei.description AS description,
					0::double precision AS "qtyIn",
					sei.qty AS "qtyOut",
					sei."basicAmount" AS "basicAmount"
				FROM stock_entry_items sei
				INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
				WHERE COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse") IS NOT NULL
			)
			SELECT
				company,
				"itemCode",
				MAX("itemName") AS "itemName",
				warehouse,
				MAX("unitOfMeasure") AS "unitOfMeasure",
				SUM(
					CASE
						WHEN ${dateFrom ? Prisma.sql`"postingDate" < ${dateFrom}` : Prisma.sql`FALSE`}
						THEN "qtyIn" - "qtyOut"
						ELSE 0
					END
				) AS "openingQty",
				SUM(
					CASE
						WHEN ${dateFrom ? Prisma.sql`"postingDate" < ${dateFrom}` : Prisma.sql`FALSE`}
						THEN CASE
							WHEN "qtyIn" > 0 THEN "basicAmount"
							WHEN "qtyOut" > 0 THEN -"basicAmount"
							ELSE 0
						END
						ELSE 0
					END
				) AS "openingValue",
				SUM(
					CASE
						WHEN ${dateFrom ? Prisma.sql`"postingDate" >= ${dateFrom}` : Prisma.sql`TRUE`}
						THEN "qtyIn"
						ELSE 0
					END
				) AS "inQty",
				SUM(
					CASE
						WHEN ${dateFrom ? Prisma.sql`"postingDate" >= ${dateFrom}` : Prisma.sql`TRUE`} AND "qtyIn" > 0
						THEN "basicAmount"
						ELSE 0
					END
				) AS "inValue",
				SUM(
					CASE
						WHEN ${dateFrom ? Prisma.sql`"postingDate" >= ${dateFrom}` : Prisma.sql`TRUE`}
						THEN "qtyOut"
						ELSE 0
					END
				) AS "outQty",
				SUM(
					CASE
						WHEN ${dateFrom ? Prisma.sql`"postingDate" >= ${dateFrom}` : Prisma.sql`TRUE`} AND "qtyOut" > 0
						THEN "basicAmount"
						ELSE 0
					END
				) AS "outValue",
				MAX("postingDate") AS "lastPostingDate"
			FROM movement_rows
			WHERE ${combineSqlConditions([
				Prisma.sql`warehouse IS NOT NULL`,
				Prisma.sql`status = ${status}`,
				buildContainsCondition(`company`, company),
				buildContainsCondition(`"itemCode"`, itemCode),
				buildInCondition(`"itemCode"`, filteredItemCodes),
				buildInsensitiveEqualsCondition(`warehouse`, warehouse),
				buildContainsCondition(`project`, project),
				dateTo ? Prisma.sql`"postingDate" <= ${dateTo}` : null,
				buildSearchCondition(
					[
						`company`,
						`"itemCode"`,
						`"itemName"`,
						`description`,
						`warehouse`,
						`series`,
					],
					search,
				),
			])}
			GROUP BY company, "itemCode", warehouse
			${
				params?.includeZeroStockItems
					? Prisma.empty
					: Prisma.sql`HAVING SUM(
					CASE
						WHEN ${dateFrom ? Prisma.sql`"postingDate" < ${dateFrom}` : Prisma.sql`FALSE`}
						THEN "qtyIn" - "qtyOut"
						ELSE 0
					END
				) + SUM(
					CASE
						WHEN ${dateFrom ? Prisma.sql`"postingDate" >= ${dateFrom}` : Prisma.sql`TRUE`}
						THEN "qtyIn" - "qtyOut"
						ELSE 0
					END
				) <> 0`
			}
			ORDER BY company ASC, "itemCode" ASC, warehouse ASC
			OFFSET ${skip}
			LIMIT ${take}
		`);

		if (aggregateRows.length === 0) {
			return [];
		}

		const itemCodes = [...new Set(aggregateRows.map((row) => row.itemCode))];
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

		return aggregateRows.map((row) => {
			const metadata = metadataByCode.get(row.itemCode);
			const openingQty = Number(row.openingQty ?? 0);
			const openingValue = Number(row.openingValue ?? 0);
			const inQty = Number(row.inQty ?? 0);
			const inValue = Number(row.inValue ?? 0);
			const outQty = Number(row.outQty ?? 0);
			const outValue = Number(row.outValue ?? 0);
			const balanceQty = openingQty + inQty - outQty;
			const valuationRate = metadata?.valuationRate ?? null;
			return {
				id: `${row.company}::${row.itemCode}::${row.warehouse}`,
				company: row.company,
				itemCode: row.itemCode,
				itemName: row.itemName ?? null,
				itemGroupName: metadata?.itemGroup?.groupName ?? null,
				brandName: metadata?.brand?.name ?? null,
				warehouse: row.warehouse,
				unitOfMeasure: row.unitOfMeasure ?? null,
				openingQty,
				openingValue,
				inQty,
				inValue,
				outQty,
				outValue,
				balanceQty,
				valuationRate,
				balanceValue:
					valuationRate == null
						? openingValue + inValue - outValue
						: valuationRate * balanceQty,
				lastPostingDate: row.lastPostingDate ?? null,
			};
		});
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

		const sourceRows = await this.prisma.client.$queryRaw<
			ProjectedSourceAggregateRow[]
		>(Prisma.sql`
			WITH actual_source_rows AS (
				SELECT
					company,
					"itemCode",
					MAX("itemName") AS "itemName",
					MAX(description) AS description,
					warehouse,
					MAX("unitOfMeasure") AS "unitOfMeasure",
					SUM("actualQty") AS "actualQty",
					0::double precision AS "plannedQty",
					0::double precision AS "requestedQty",
					0::double precision AS "orderedQty",
					0::double precision AS "reservedQty",
					0::double precision AS "reservedQtyForProduction",
					0::double precision AS "reservedQtyForSubcontracting",
					0::double precision AS "reservedQtyForProductionPlan",
					MAX("postingDate") AS "lastActivityDate"
				FROM (
					SELECT
						se.company AS company,
						se.series AS series,
						se."postingDate" AS "postingDate",
						sei."itemCode" AS "itemCode",
						sei."itemName" AS "itemName",
						sei.description AS description,
						COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse") AS warehouse,
						sei."unitOfMeasure" AS "unitOfMeasure",
						sei.qty AS "actualQty"
					FROM stock_entry_items sei
					INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
					WHERE se.status = 'SUBMITTED'
						AND COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse") IS NOT NULL

					UNION ALL

					SELECT
						se.company AS company,
						se.series AS series,
						se."postingDate" AS "postingDate",
						sei."itemCode" AS "itemCode",
						sei."itemName" AS "itemName",
						sei.description AS description,
						COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse") AS warehouse,
						sei."unitOfMeasure" AS "unitOfMeasure",
						-sei.qty AS "actualQty"
					FROM stock_entry_items sei
					INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
					WHERE se.status = 'SUBMITTED'
						AND COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse") IS NOT NULL
				) actual_rows
				WHERE ${combineSqlConditions([
					buildContainsCondition(`company`, company),
					buildContainsCondition(`"itemCode"`, itemCode),
					buildInCondition(`"itemCode"`, filteredItemCodes),
					buildInsensitiveEqualsCondition(`warehouse`, warehouse),
					buildSearchCondition(
						[
							`company`,
							`series`,
							`"itemCode"`,
							`"itemName"`,
							`description`,
							`warehouse`,
						],
						search,
					),
				])}
				GROUP BY company, "itemCode", warehouse
			),
			planned_source_rows AS (
				SELECT
					se.company AS company,
					sei."itemCode" AS "itemCode",
					MAX(sei."itemName") AS "itemName",
					MAX(sei.description) AS description,
					COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse") AS warehouse,
					MAX(sei."unitOfMeasure") AS "unitOfMeasure",
					0::double precision AS "actualQty",
					SUM(sei.qty) AS "plannedQty",
					0::double precision AS "requestedQty",
					0::double precision AS "orderedQty",
					0::double precision AS "reservedQty",
					0::double precision AS "reservedQtyForProduction",
					0::double precision AS "reservedQtyForSubcontracting",
					0::double precision AS "reservedQtyForProductionPlan",
					MAX(se."postingDate") AS "lastActivityDate"
				FROM stock_entry_items sei
				INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
				WHERE ${combineSqlConditions([
					Prisma.sql`se.status = 'DRAFT'`,
					Prisma.sql`se."stockEntryType" IN ('MANUFACTURE', 'MATERIAL_TRANSFER_FOR_MANUFACTURE')`,
					Prisma.sql`COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse") IS NOT NULL`,
					buildContainsCondition(`se.company`, company),
					buildContainsCondition(`sei."itemCode"`, itemCode),
					buildInCondition(`sei."itemCode"`, filteredItemCodes),
					buildInsensitiveEqualsCondition(
						`COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse")`,
						warehouse,
					),
					buildSearchCondition(
						[
							`se.company`,
							`se.series`,
							`sei."itemCode"`,
							`sei."itemName"`,
							`sei.description`,
							`COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse")`,
						],
						search,
					),
				])}
				GROUP BY se.company, sei."itemCode", COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse")
			),
			subcontract_source_rows AS (
				SELECT
					se.company AS company,
					sei."itemCode" AS "itemCode",
					MAX(sei."itemName") AS "itemName",
					MAX(sei.description) AS description,
					COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse") AS warehouse,
					MAX(sei."unitOfMeasure") AS "unitOfMeasure",
					0::double precision AS "actualQty",
					0::double precision AS "plannedQty",
					0::double precision AS "requestedQty",
					0::double precision AS "orderedQty",
					0::double precision AS "reservedQty",
					0::double precision AS "reservedQtyForProduction",
					SUM(sei.qty) AS "reservedQtyForSubcontracting",
					0::double precision AS "reservedQtyForProductionPlan",
					MAX(se."postingDate") AS "lastActivityDate"
				FROM stock_entry_items sei
				INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
				WHERE ${combineSqlConditions([
					Prisma.sql`se.status = 'DRAFT'`,
					Prisma.sql`se."stockEntryType" = 'SEND_TO_SUBCONTRACTOR'`,
					Prisma.sql`COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse") IS NOT NULL`,
					buildContainsCondition(`se.company`, company),
					buildContainsCondition(`sei."itemCode"`, itemCode),
					buildInCondition(`sei."itemCode"`, filteredItemCodes),
					buildInsensitiveEqualsCondition(
						`COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse")`,
						warehouse,
					),
					buildSearchCondition(
						[
							`se.company`,
							`se.series`,
							`sei."itemCode"`,
							`sei."itemName"`,
							`sei.description`,
							`COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse")`,
						],
						search,
					),
				])}
				GROUP BY se.company, sei."itemCode", COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse")
			),
			request_source_rows AS (
				SELECT
					mr.company AS company,
					mri."itemCode" AS "itemCode",
					MAX(mri."itemName") AS "itemName",
					NULL::text AS description,
					COALESCE(mri."targetWarehouse", mr."targetWarehouse") AS warehouse,
					MAX(mri."unitOfMeasure") AS "unitOfMeasure",
					0::double precision AS "actualQty",
					0::double precision AS "plannedQty",
					SUM(GREATEST(mri.quantity - mri."orderedQty", 0)) AS "requestedQty",
					SUM(GREATEST(mri."orderedQty" - mri."receivedQty", 0)) AS "orderedQty",
					0::double precision AS "reservedQty",
					0::double precision AS "reservedQtyForProduction",
					0::double precision AS "reservedQtyForSubcontracting",
					0::double precision AS "reservedQtyForProductionPlan",
					MAX(COALESCE(mri."requiredBy", mr."transactionDate")) AS "lastActivityDate"
				FROM material_request_items mri
				INNER JOIN material_requests mr ON mr.id = mri."materialRequestId"
				WHERE ${combineSqlConditions([
					Prisma.sql`mr.status IN ('PENDING', 'APPROVED', 'ORDERED', 'PARTIALLY_ORDERED', 'PARTIALLY_RECEIVED')`,
					Prisma.sql`COALESCE(mri."targetWarehouse", mr."targetWarehouse") IS NOT NULL`,
					buildContainsCondition(`mr.company`, company),
					buildContainsCondition(`mri."itemCode"`, itemCode),
					buildInCondition(`mri."itemCode"`, filteredItemCodes),
					buildInsensitiveEqualsCondition(
						`COALESCE(mri."targetWarehouse", mr."targetWarehouse")`,
						warehouse,
					),
					buildSearchCondition(
						[
							`mr.company`,
							`mr.series`,
							`mri."itemCode"`,
							`mri."itemName"`,
							`COALESCE(mri."targetWarehouse", mr."targetWarehouse")`,
						],
						search,
					),
				])}
				GROUP BY mr.company, mri."itemCode", COALESCE(mri."targetWarehouse", mr."targetWarehouse")
			),
			reserved_source_rows AS (
				SELECT
					dn.company AS company,
					dni."itemCode" AS "itemCode",
					MAX(dni."itemName") AS "itemName",
					MAX(dni.description) AS description,
					COALESCE(dni.warehouse, dn."sourceWarehouse") AS warehouse,
					MAX(dni.uom) AS "unitOfMeasure",
					0::double precision AS "actualQty",
					0::double precision AS "plannedQty",
					0::double precision AS "requestedQty",
					0::double precision AS "orderedQty",
					SUM(dni.quantity) AS "reservedQty",
					0::double precision AS "reservedQtyForProduction",
					0::double precision AS "reservedQtyForSubcontracting",
					0::double precision AS "reservedQtyForProductionPlan",
					MAX(dn."postingDate") AS "lastActivityDate"
				FROM delivery_note_items dni
				INNER JOIN delivery_notes dn ON dn.id = dni."deliveryNoteId"
				WHERE ${combineSqlConditions([
					Prisma.sql`dn.status IN ('DRAFT', 'TO_BILL')`,
					Prisma.sql`dn."isReturn" = FALSE`,
					Prisma.sql`COALESCE(dni.warehouse, dn."sourceWarehouse") IS NOT NULL`,
					buildContainsCondition(`dn.company`, company),
					buildContainsCondition(`dni."itemCode"`, itemCode),
					buildInCondition(`dni."itemCode"`, filteredItemCodes),
					buildInsensitiveEqualsCondition(
						`COALESCE(dni.warehouse, dn."sourceWarehouse")`,
						warehouse,
					),
					buildSearchCondition(
						[
							`dn.company`,
							`dn.series`,
							`dni."itemCode"`,
							`dni."itemName"`,
							`dni.description`,
							`COALESCE(dni.warehouse, dn."sourceWarehouse")`,
						],
						search,
					),
				])}
				GROUP BY dn.company, dni."itemCode", COALESCE(dni.warehouse, dn."sourceWarehouse")
			),
			production_source_rows AS (
				SELECT
					pl.company AS company,
					pli.item AS "itemCode",
					NULL::text AS "itemName",
					NULL::text AS description,
					COALESCE(pli.warehouse, pl.warehouse) AS warehouse,
					NULL::text AS "unitOfMeasure",
					0::double precision AS "actualQty",
					0::double precision AS "plannedQty",
					0::double precision AS "requestedQty",
					0::double precision AS "orderedQty",
					0::double precision AS "reservedQty",
					SUM(GREATEST(pli.qty - COALESCE(pli."pickedQty", 0), 0)) AS "reservedQtyForProduction",
					0::double precision AS "reservedQtyForSubcontracting",
					0::double precision AS "reservedQtyForProductionPlan",
					MAX(pl."updatedAt") AS "lastActivityDate"
				FROM pick_list_items pli
				INNER JOIN pick_lists pl ON pl.id = pli."pickListId"
				WHERE ${combineSqlConditions([
					Prisma.sql`pl.status IN ('DRAFT', 'OPEN')`,
					Prisma.sql`pl.purpose = 'MATERIAL_TRANSFER_FOR_MANUFACTURE'`,
					Prisma.sql`COALESCE(pli.warehouse, pl.warehouse) IS NOT NULL`,
					Prisma.sql`GREATEST(pli.qty - COALESCE(pli."pickedQty", 0), 0) > 0`,
					buildContainsCondition(`pl.company`, company),
					buildContainsCondition(`pli.item`, itemCode),
					buildInCondition(`pli.item`, filteredItemCodes),
					buildInsensitiveEqualsCondition(
						`COALESCE(pli.warehouse, pl.warehouse)`,
						warehouse,
					),
					buildSearchCondition(
						[
							`pl.company`,
							`pl.series`,
							`pli.item`,
							`COALESCE(pli.warehouse, pl.warehouse)`,
						],
						search,
					),
				])}
				GROUP BY pl.company, pli.item, COALESCE(pli.warehouse, pl.warehouse)
			)
			SELECT * FROM actual_source_rows
			UNION ALL
			SELECT * FROM planned_source_rows
			UNION ALL
			SELECT * FROM subcontract_source_rows
			UNION ALL
			SELECT * FROM request_source_rows
			UNION ALL
			SELECT * FROM reserved_source_rows
			UNION ALL
			SELECT * FROM production_source_rows
		`);

		const actualRows = sourceRows
			.filter(
				(row) =>
					Number(row.actualQty ?? 0) !== 0 ||
					Number(row.plannedQty ?? 0) !== 0 ||
					Number(row.requestedQty ?? 0) !== 0 ||
					Number(row.orderedQty ?? 0) !== 0 ||
					Number(row.reservedQty ?? 0) !== 0 ||
					Number(row.reservedQtyForProduction ?? 0) !== 0 ||
					Number(row.reservedQtyForSubcontracting ?? 0) !== 0,
			)
			.map((row) => ({
				company: row.company,
				itemCode: row.itemCode,
				itemName: row.itemName,
				description: row.description,
				warehouse: row.warehouse,
				unitOfMeasure: row.unitOfMeasure,
				actualQty: Number(row.actualQty ?? 0),
				plannedQty: Number(row.plannedQty ?? 0),
				requestedQty: Number(row.requestedQty ?? 0),
				orderedQty: Number(row.orderedQty ?? 0),
				reservedQty: Number(row.reservedQty ?? 0),
				reservedQtyForProduction: Number(row.reservedQtyForProduction ?? 0),
				reservedQtyForSubcontracting: Number(
					row.reservedQtyForSubcontracting ?? 0,
				),
				reservedQtyForProductionPlan: Number(
					row.reservedQtyForProductionPlan ?? 0,
				),
				lastActivityDate: row.lastActivityDate ?? null,
			}));

		const allItemCodes = new Set<string>();
		for (const row of actualRows) {
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
		for (const row of actualRows) {
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
		const { skip, take } = clampListWindow(params?.skip, params?.take);

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

		const state = createStockAgeingState();
		let cursor:
			| {
					postingDate: Date;
					createdAt: Date;
					id: string;
			  }
			| undefined;

		while (true) {
			const batchRows = await this.prisma.client.$queryRaw<
				Array<{
					id: string;
					itemCode: string;
					itemName: string | null;
					description: string | null;
					qty: number;
					basicRate: number;
					basicAmount: number;
					unitOfMeasure: string | null;
					sourceWarehouse: string | null;
					targetWarehouse: string | null;
					stockEntryId: string;
					series: string;
					company: string;
					status: Inventory.StockEntryStatus;
					stockEntryType: Inventory.StockEntryType;
					postingDate: Date;
					defaultSourceWarehouse: string | null;
					defaultTargetWarehouse: string | null;
					project: string | null;
					remarks: string | null;
					createdAt: Date;
					updatedAt: Date;
				}>
			>(Prisma.sql`
				SELECT
					sei.id AS id,
					sei."itemCode" AS "itemCode",
					sei."itemName" AS "itemName",
					sei.description AS description,
					sei.qty AS qty,
					sei."basicRate" AS "basicRate",
					sei."basicAmount" AS "basicAmount",
					sei."unitOfMeasure" AS "unitOfMeasure",
					sei."sourceWarehouse" AS "sourceWarehouse",
					sei."targetWarehouse" AS "targetWarehouse",
					se.id AS "stockEntryId",
					se.series AS series,
					se.company AS company,
					se.status AS status,
					se."stockEntryType" AS "stockEntryType",
					se."postingDate" AS "postingDate",
					se."defaultSourceWarehouse" AS "defaultSourceWarehouse",
					se."defaultTargetWarehouse" AS "defaultTargetWarehouse",
					se.project AS project,
					se.remarks AS remarks,
					se."createdAt" AS "createdAt",
					se."updatedAt" AS "updatedAt"
				FROM stock_entry_items sei
				INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
				WHERE ${combineSqlConditions([
					Prisma.sql`se.status = 'SUBMITTED'`,
					Prisma.sql`se."postingDate" <= ${asOfDate}`,
					buildContainsCondition(`se.company`, company),
					buildContainsCondition(`sei."itemCode"`, itemCode),
					buildInCondition(`sei."itemCode"`, filteredItemCodes),
					warehouse
						? combineSqlConditions(
								[
									buildInsensitiveEqualsCondition(
										`COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse")`,
										warehouse,
									),
									buildInsensitiveEqualsCondition(
										`COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse")`,
										warehouse,
									),
								],
								" OR ",
							)
						: null,
					cursor
						? Prisma.sql`(se."postingDate", se."createdAt", sei.id) > (${cursor.postingDate}, ${cursor.createdAt}, ${cursor.id})`
						: null,
				])}
				ORDER BY se."postingDate" ASC, se."createdAt" ASC, sei.id ASC
				LIMIT ${STOCK_AGEING_BATCH_SIZE}
			`);

			if (batchRows.length === 0) {
				break;
			}

			const items: StockAgeingMovementRow[] = batchRows.map((row) => ({
				id: row.id,
				itemCode: row.itemCode,
				itemName: row.itemName,
				description: row.description,
				qty: Number(row.qty ?? 0),
				basicRate: Number(row.basicRate ?? 0),
				basicAmount: Number(row.basicAmount ?? 0),
				unitOfMeasure: row.unitOfMeasure,
				sourceWarehouse: row.sourceWarehouse,
				targetWarehouse: row.targetWarehouse,
				stockEntry: {
					id: row.stockEntryId,
					series: row.series,
					company: row.company,
					status: row.status,
					stockEntryType: row.stockEntryType,
					postingDate: row.postingDate,
					defaultSourceWarehouse: row.defaultSourceWarehouse,
					defaultTargetWarehouse: row.defaultTargetWarehouse,
					project: row.project,
					remarks: row.remarks,
					createdAt: row.createdAt,
					updatedAt: row.updatedAt,
				},
			}));

			applyStockAgeingItems(state, items, asOfDate);

			const lastRow = batchRows[batchRows.length - 1];
			cursor = {
				postingDate: lastRow.postingDate,
				createdAt: lastRow.createdAt,
				id: lastRow.id,
			};
		}

		const ageingRows = finalizeStockAgeingRows(state, {
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

		const periods = getPeriodDateRangesForService(fromDate, toDate, frequency);
		const periodBucketExpression =
			frequency === "Weekly"
				? `DATE_TRUNC('week', "postingDate")::date`
				: frequency === "Monthly"
					? `DATE_TRUNC('month', "postingDate")::date`
					: frequency === "Quarterly"
						? `DATE_TRUNC('quarter', "postingDate")::date`
						: `DATE_TRUNC('year', "postingDate")::date`;

		const aggregateRows = await this.prisma.client.$queryRaw<
			StockAnalyticsAggregateRow[]
		>(Prisma.sql`
			WITH movement_rows AS (
				SELECT
					sei."itemCode" AS "itemCode",
					sei."itemName" AS "itemName",
					sei.description AS description,
					se."postingDate" AS "postingDate",
					sei.qty AS "qtyDelta",
					sei."basicAmount" AS "valueDelta"
				FROM stock_entry_items sei
				INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
				WHERE ${combineSqlConditions([
					Prisma.sql`se.status = 'SUBMITTED'`,
					Prisma.sql`COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse") IS NOT NULL`,
					buildContainsCondition(`se.company`, company),
					buildContainsCondition(`sei."itemCode"`, itemCode),
					buildInCondition(`sei."itemCode"`, filteredItemCodes),
					buildInsensitiveEqualsCondition(
						`COALESCE(sei."targetWarehouse", se."defaultTargetWarehouse")`,
						warehouse,
					),
					Prisma.sql`se."postingDate" <= ${toDate}`,
				])}

				UNION ALL

				SELECT
					sei."itemCode" AS "itemCode",
					sei."itemName" AS "itemName",
					sei.description AS description,
					se."postingDate" AS "postingDate",
					-sei.qty AS "qtyDelta",
					-sei."basicAmount" AS "valueDelta"
				FROM stock_entry_items sei
				INNER JOIN stock_entries se ON se.id = sei."stockEntryId"
				WHERE ${combineSqlConditions([
					Prisma.sql`se.status = 'SUBMITTED'`,
					Prisma.sql`COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse") IS NOT NULL`,
					buildContainsCondition(`se.company`, company),
					buildContainsCondition(`sei."itemCode"`, itemCode),
					buildInCondition(`sei."itemCode"`, filteredItemCodes),
					buildInsensitiveEqualsCondition(
						`COALESCE(sei."sourceWarehouse", se."defaultSourceWarehouse")`,
						warehouse,
					),
					Prisma.sql`se."postingDate" <= ${toDate}`,
				])}
			)
			SELECT
				"itemCode",
				MAX("itemName") AS "itemName",
				MAX(description) AS description,
				CASE
					WHEN "postingDate" >= ${fromDate}
					THEN ${Prisma.raw(periodBucketExpression)}
					ELSE NULL
				END AS "periodStart",
				SUM(
					CASE
						WHEN "postingDate" >= ${fromDate}
						THEN "qtyDelta"
						ELSE 0
					END
				) AS "qtyDelta",
				SUM(
					CASE
						WHEN "postingDate" >= ${fromDate}
						THEN "valueDelta"
						ELSE 0
					END
				) AS "valueDelta",
				SUM(
					CASE
						WHEN "postingDate" < ${fromDate}
						THEN "qtyDelta"
						ELSE 0
					END
				) AS "openingQtyDelta",
				SUM(
					CASE
						WHEN "postingDate" < ${fromDate}
						THEN "valueDelta"
						ELSE 0
					END
				) AS "openingValueDelta"
			FROM movement_rows
			GROUP BY
				"itemCode",
				CASE
					WHEN "postingDate" >= ${fromDate}
					THEN ${Prisma.raw(periodBucketExpression)}
					ELSE NULL
				END
		`);

		if (aggregateRows.length === 0) {
			return { periods, rows: [] };
		}

		const itemCodes = [...new Set(aggregateRows.map((row) => row.itemCode))];
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

		const openingByCode = new Map<string, number>();
		const periodDeltaByCode = new Map<string, Map<string, number>>();
		const today = new Date();
		today.setUTCHours(23, 59, 59, 999);

		for (const row of aggregateRows) {
			const delta =
				valueQuantity === "Quantity"
					? Number(row.qtyDelta ?? 0)
					: Number(row.valueDelta ?? 0);
			const openingDelta =
				valueQuantity === "Quantity"
					? Number(row.openingQtyDelta ?? 0)
					: Number(row.openingValueDelta ?? 0);

			if (openingDelta !== 0) {
				openingByCode.set(
					row.itemCode,
					(openingByCode.get(row.itemCode) ?? 0) + openingDelta,
				);
			}

			if (row.periodStart == null || delta === 0) {
				continue;
			}

			const periodStartKey = new Date(row.periodStart).toISOString();
			const bucketMap = periodDeltaByCode.get(row.itemCode) ?? new Map();
			bucketMap.set(
				periodStartKey,
				(bucketMap.get(periodStartKey) ?? 0) + delta,
			);
			periodDeltaByCode.set(row.itemCode, bucketMap);
		}

		const rows: Inventory.StockAnalyticsRow[] = itemCodes
			.map((code) => {
				const inv = inventoryItemsByCode.get(code);
				const periodValues: Record<string, number | null> = {};
				let runningBalance = openingByCode.get(code) ?? 0;
				const bucketMap =
					periodDeltaByCode.get(code) ?? new Map<string, number>();

				for (const period of periods) {
					if (period.from > today) {
						periodValues[period.key] = null;
						continue;
					}

					const delta = bucketMap.get(period.from.toISOString()) ?? 0;
					runningBalance += delta;
					periodValues[period.key] = runningBalance;
				}

				return {
					id: code,
					itemCode: code,
					itemName: inv?.name ?? null,
					itemGroup: inv?.itemGroup?.groupName ?? null,
					brand: brandByCode.get(code) ?? null,
					unitOfMeasure: inv?.defaultUnitOfMeasure?.name ?? null,
					periodValues,
				};
			})
			.sort((left, right) => left.itemCode.localeCompare(right.itemCode));

		return { periods, rows };
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
