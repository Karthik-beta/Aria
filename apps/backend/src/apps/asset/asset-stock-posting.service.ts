import type { DateOnlyInput } from "@aria/types";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import {
	allocateDocumentSeries,
	getSeriesSeedValue,
} from "../../shared/document-series";
import {
	type AssetOrganizationId,
	assertAssetOrganizationId,
	companyWhereForOrganization,
} from "./asset-organization-scope";
import {
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
	normalizeDateOnly,
} from "./depreciation/depreciation.config";

export type AssetStockSourceType = "ASSET_CAPITALIZATION" | "ASSET_REPAIR";

export interface AssetMaterialIssueLine {
	itemCode: string;
	warehouse: string;
	quantity: number;
	valuationRate: number;
}

export interface CreateAssetMaterialIssueInput {
	companyId: string;
	postingDate: DateOnlyInput;
	sourceType: AssetStockSourceType;
	sourceId: string;
	lines: readonly AssetMaterialIssueLine[];
}

export interface AssetMaterialIssueResult {
	id: string;
	series: string;
}

/**
 * Creates and reverses submitted material-issue documents for Asset workflows.
 *
 * The caller supplies its existing Prisma transaction so the stock document and
 * the owning repair/capitalization document commit or roll back together.
 */
@Injectable()
export class AssetStockPostingService {
	async createMaterialIssue(
		tx: Prisma.TransactionClient,
		organizationId: AssetOrganizationId,
		input: CreateAssetMaterialIssueInput,
	): Promise<AssetMaterialIssueResult> {
		assertAssetOrganizationId(organizationId);
		const postingDate = dateOnlyUtc(normalizeDateOnly(input.postingDate));
		const companyId = input.companyId.trim();
		if (!companyId) {
			throw new BadRequestException(
				"Company ID is required for a material issue",
			);
		}
		if (input.lines.length === 0) {
			throw new BadRequestException(
				"At least one consumed stock item is required",
			);
		}

		const lines = input.lines.map((line) => ({
			itemCode: line.itemCode.trim(),
			warehouse: line.warehouse.trim(),
			quantity: line.quantity,
			valuationRate: line.valuationRate,
		}));
		const duplicateKeys = new Set<string>();
		const seenKeys = new Set<string>();
		for (const line of lines) {
			if (!line.itemCode || !line.warehouse) {
				throw new BadRequestException(
					"Every consumed stock item requires an item code and source warehouse",
				);
			}
			if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
				throw new BadRequestException(
					`Consumed quantity for ${line.itemCode} must be greater than zero`,
				);
			}
			if (!Number.isFinite(line.valuationRate) || line.valuationRate < 0) {
				throw new BadRequestException(
					`Valuation rate for ${line.itemCode} cannot be negative`,
				);
			}

			const key = `${line.itemCode}\u0000${line.warehouse}`;
			if (seenKeys.has(key)) duplicateKeys.add(key);
			seenKeys.add(key);
		}
		if (duplicateKeys.size > 0) {
			throw new BadRequestException(
				"Consumed stock items must be unique by item and warehouse",
			);
		}

		const companyRecord = await tx.company.findFirst({
			where: companyWhereForOrganization(organizationId, { id: companyId }),
			select: { id: true, name: true, disabled: true },
		});
		if (!companyRecord || companyRecord.disabled) {
			throw new BadRequestException(
				`Company ${companyId} is missing or disabled`,
			);
		}
		const company = companyRecord.name;

		const warehouseNames = [...new Set(lines.map((line) => line.warehouse))];
		const warehouses = await tx.warehouse.findMany({
			where: { name: { in: warehouseNames }, company },
			select: { name: true, disabled: true, isGroupWarehouse: true },
		});
		const warehouseByName = new Map(
			warehouses.map((warehouse) => [warehouse.name, warehouse]),
		);
		for (const warehouseName of warehouseNames) {
			const warehouse = warehouseByName.get(warehouseName);
			if (!warehouse) {
				throw new BadRequestException(
					`Warehouse ${warehouseName} does not belong to ${company}`,
				);
			}
			if (warehouse.disabled || warehouse.isGroupWarehouse) {
				throw new BadRequestException(
					`Warehouse ${warehouseName} cannot issue stock`,
				);
			}
		}

		const itemCodes = [...new Set(lines.map((line) => line.itemCode))];
		const items = await tx.inventoryItem.findMany({
			where: {
				code: { in: itemCodes },
				disabled: false,
				maintainStock: true,
			},
			select: {
				code: true,
				name: true,
				defaultUnitOfMeasure: { select: { name: true } },
			},
		});
		const itemByCode = new Map(items.map((item) => [item.code, item]));
		for (const itemCode of itemCodes) {
			if (!itemByCode.has(itemCode)) {
				throw new BadRequestException(
					`Stock item ${itemCode} is missing, disabled, or does not maintain stock`,
				);
			}
		}

		const year = dateOnlyFromPersistedDateTime(postingDate).slice(0, 4);
		const prefix = `MAT-STE-${year}-`;
		const lastEntry = await tx.stockEntry.findFirst({
			where: { series: { startsWith: prefix } },
			orderBy: { series: "desc" },
			select: { series: true },
		});
		const series = await allocateDocumentSeries(
			tx,
			prefix,
			5,
			getSeriesSeedValue(prefix, lastEntry?.series),
		);

		const created = await tx.stockEntry.create({
			data: {
				series,
				stockEntryType: "MATERIAL_ISSUE",
				postingDate,
				company,
				status: "SUBMITTED",
				remarks: `${input.sourceType} ${input.sourceId}`,
				items: {
					create: lines.map((line) => {
						const item = itemByCode.get(line.itemCode);
						return {
							sourceWarehouse: line.warehouse,
							itemCode: line.itemCode,
							itemName: item?.name ?? null,
							qty: line.quantity,
							basicRate: line.valuationRate,
							basicAmount: line.quantity * line.valuationRate,
							unitOfMeasure: item?.defaultUnitOfMeasure?.name ?? null,
						};
					}),
				},
			},
			select: { id: true, series: true },
		});

		return created;
	}

	async cancelMaterialIssue(
		tx: Prisma.TransactionClient,
		organizationId: AssetOrganizationId,
		companyId: string,
		stockEntryId: string,
		sourceType: AssetStockSourceType,
		sourceId: string,
	): Promise<void> {
		assertAssetOrganizationId(organizationId);
		const companyRecord = await tx.company.findFirst({
			where: companyWhereForOrganization(organizationId, { id: companyId }),
			select: { name: true },
		});
		if (!companyRecord) {
			throw new NotFoundException(
				`Company ${companyId} is not available in the active organization`,
			);
		}
		const sourceRelation =
			sourceType === "ASSET_REPAIR"
				? {
						assetRepairs: {
							some: {
								id: sourceId,
								company: {
									is: companyWhereForOrganization(organizationId, {
										id: companyId,
									}),
								},
							},
						},
					}
				: {
						assetCapitalizations: {
							some: {
								id: sourceId,
								company: {
									is: companyWhereForOrganization(organizationId, {
										id: companyId,
									}),
								},
							},
						},
					};
		const scopedWhere = {
			AND: [
				{ id: stockEntryId, status: "SUBMITTED" as const },
				{ company: companyRecord.name },
				sourceRelation,
			],
		};
		const result = await tx.stockEntry.updateMany({
			where: scopedWhere,
			data: { status: "CANCELLED" },
		});
		if (result.count === 1) return;

		const existing = await tx.stockEntry.findFirst({
			where: {
				AND: [
					{ id: stockEntryId },
					{ company: companyRecord.name },
					sourceRelation,
				],
			},
			select: { status: true },
		});
		if (!existing) {
			throw new NotFoundException(`Stock Entry ${stockEntryId} not found`);
		}
		if (existing.status === "CANCELLED") return;
		throw new BadRequestException(
			`Stock Entry ${stockEntryId} cannot be cancelled from ${existing.status}`,
		);
	}
}
