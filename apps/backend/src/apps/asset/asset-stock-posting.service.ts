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

export type AssetStockSourceType = "ASSET_CAPITALIZATION" | "ASSET_REPAIR";

export interface AssetMaterialIssueLine {
	itemCode: string;
	warehouse: string;
	quantity: number;
	valuationRate: number;
}

export interface CreateAssetMaterialIssueInput {
	company: string;
	postingDate: Date;
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
		input: CreateAssetMaterialIssueInput,
	): Promise<AssetMaterialIssueResult> {
		const company = input.company.trim();
		if (!company) {
			throw new BadRequestException("Company is required for a material issue");
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

		const companyRecord = await tx.company.findUnique({
			where: { name: company },
			select: { disabled: true },
		});
		if (!companyRecord || companyRecord.disabled) {
			throw new BadRequestException(
				`Company ${company} is missing or disabled`,
			);
		}

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

		const year = input.postingDate.getUTCFullYear();
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
				postingDate: input.postingDate,
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
		stockEntryId: string,
	): Promise<void> {
		const result = await tx.stockEntry.updateMany({
			where: { id: stockEntryId, status: "SUBMITTED" },
			data: { status: "CANCELLED" },
		});
		if (result.count === 1) return;

		const existing = await tx.stockEntry.findUnique({
			where: { id: stockEntryId },
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
