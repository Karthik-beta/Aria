/**
 * Unit of measurement sub-service.
 *
 * CRUD operations for units of measurement plus the bootstrap seed
 * that ensures standard UOMs exist on application start-up.
 *
 * @module UomSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/uom | ERPNext UOM}
 */
import type { Inventory } from "@aria/types";
import { ConflictException, Logger, NotFoundException } from "@nestjs/common";
import type { z } from "zod";
import { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import { toInventoryUnitOfMeasure } from "../inventory.types";
import {
	loadUomSeedEntriesFromCsv,
	normalizeUomName,
	type UomSeedEntry,
} from "../uom-seed";
import { removeUndefined, unitOfMeasureSelect } from "./inventory-shared";

export class UomSubService {
	private readonly logger = new Logger(UomSubService.name);

	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Get all units of measure
	 */
	async findAllUnitsOfMeasure(
		search?: string,
	): Promise<Inventory.UnitOfMeasure[]> {
		const units = await this.prisma.unitOfMeasurement.findMany({
			where: search
				? {
						name: {
							contains: search,
							mode: "insensitive",
						},
					}
				: undefined,
			select: unitOfMeasureSelect,
			orderBy: { name: "asc" },
		});

		return units.map(toInventoryUnitOfMeasure);
	}

	/**
	 * Preload standard UOM records from seed CSV.
	 *
	 * This operation is idempotent:
	 * - Existing rows are never updated/deleted.
	 * - Only missing names (case-insensitive) are inserted.
	 */
	async preloadStandardUnitsOfMeasure(
		seedEntries?: UomSeedEntry[],
	): Promise<{ total: number; inserted: number }> {
		const entries = seedEntries ?? (await loadUomSeedEntriesFromCsv());
		if (entries.length === 0) {
			this.logger.warn("No UOM seed entries found; skipping preload");
			return { total: 0, inserted: 0 };
		}

		const existingUnits = await this.prisma.unitOfMeasurement.findMany({
			select: { name: true },
		});
		const existingNames = new Set(
			existingUnits.map((unit) => normalizeUomName(unit.name)),
		);

		const missingEntries = entries.filter(
			(entry) => !existingNames.has(normalizeUomName(entry.name)),
		);

		if (missingEntries.length === 0) {
			this.logger.log(
				`UOM preload skipped: all ${entries.length} standard units already exist`,
			);
			return { total: entries.length, inserted: 0 };
		}

		const created = await this.prisma.unitOfMeasurement.createMany({
			data: missingEntries.map((entry) => ({
				name: entry.name,
				disabled: entry.disabled,
				isWholeNumber: entry.isWholeNumber,
			})),
		});

		this.logger.log(
			`UOM preload inserted ${created.count} missing records (source total: ${entries.length})`,
		);
		return { total: entries.length, inserted: created.count };
	}

	/**
	 * Get a single unit of measure by id
	 */
	async findUnitOfMeasureById(
		id: string,
	): Promise<Inventory.UnitOfMeasure | null> {
		const unit = await this.prisma.unitOfMeasurement.findUnique({
			where: { id },
			select: unitOfMeasureSelect,
		});

		return unit ? toInventoryUnitOfMeasure(unit) : null;
	}

	/**
	 * Create a unit of measure
	 */
	async createUnitOfMeasure(
		data: z.infer<typeof Inventory.createUnitOfMeasureSchema>,
	): Promise<Inventory.UnitOfMeasure> {
		const duplicate = await this.prisma.unitOfMeasurement.findFirst({
			where: {
				name: {
					equals: data.name,
					mode: "insensitive",
				},
			},
			select: { id: true },
		});

		if (duplicate) {
			throw new ConflictException(
				`Unit of measure with name "${data.name}" already exists`,
			);
		}

		try {
			const created = await this.prisma.unitOfMeasurement.create({
				data: {
					name: data.name,
					disabled: data.disabled ?? false,
					isWholeNumber: data.isWholeNumber ?? true,
				},
				select: unitOfMeasureSelect,
			});

			return toInventoryUnitOfMeasure(created);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				throw new ConflictException(
					`Unit of measure with name "${data.name}" already exists`,
				);
			}
			throw error;
		}
	}

	/**
	 * Update a unit of measure
	 */
	async updateUnitOfMeasure(
		data: z.infer<typeof Inventory.updateUnitOfMeasureSchema>,
	): Promise<Inventory.UnitOfMeasure> {
		const { id, ...rest } = data;

		const existing = await this.prisma.unitOfMeasurement.findUnique({
			where: { id },
			select: { id: true, name: true },
		});

		if (!existing) {
			throw new NotFoundException(`Unit of measure with ID ${id} not found`);
		}

		if (rest.name !== undefined) {
			const duplicate = await this.prisma.unitOfMeasurement.findFirst({
				where: {
					id: { not: id },
					name: {
						equals: rest.name,
						mode: "insensitive",
					},
				},
				select: { id: true },
			});

			if (duplicate) {
				throw new ConflictException(
					`Unit of measure with name "${rest.name}" already exists`,
				);
			}
		}

		try {
			const updated = await this.prisma.unitOfMeasurement.update({
				where: { id },
				data: removeUndefined(rest),
				select: unitOfMeasureSelect,
			});

			return toInventoryUnitOfMeasure(updated);
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Unit of measure with ID ${id} not found`);
			}
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				const conflictName = rest.name ?? existing.name;
				throw new ConflictException(
					conflictName
						? `Unit of measure with name "${conflictName}" already exists`
						: "Unit of measure already exists",
				);
			}
			throw error;
		}
	}

	/**
	 * Delete a unit of measure
	 */
	async deleteUnitOfMeasure(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		try {
			await this.prisma.unitOfMeasurement.delete({ where: { id } });
			return { success: true, id };
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2025"
			) {
				throw new NotFoundException(`Unit of measure with ID ${id} not found`);
			}
			throw error;
		}
	}
}
