/**
 * Stock & item-variant settings sub-service.
 *
 * Manages singleton configuration records for stock behaviour and
 * item-variant field settings.
 *
 * @module SettingsSubService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/stock/stock-settings | ERPNext Stock Settings}
 */
import type { Inventory } from "@aria/types";
import { BadRequestException } from "@nestjs/common";
import type { z } from "zod";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	toInventoryItemVariantSettings,
	toInventoryStockSettings,
} from "../inventory.types";
import {
	itemVariantSettingsSelect,
	stockSettingsSelect,
} from "./inventory-shared";

export class SettingsSubService {
	constructor(private readonly prisma: PrismaService) {}

	private normalizeStockSettingsText(value?: string | null): string | null {
		const normalized = value?.trim();
		return normalized ? normalized : null;
	}

	private assertUniqueItemVariantCopyFields(
		copyFields: z.infer<
			typeof Inventory.updateItemVariantSettingsSchema
		>["copyFields"],
	): void {
		const seenFieldKeys = new Set<Inventory.ItemVariantCopyFieldKey>();

		for (const field of copyFields) {
			if (seenFieldKeys.has(field.fieldKey)) {
				throw new BadRequestException(
					`Copy field "${field.fieldKey}" can only be added once`,
				);
			}

			seenFieldKeys.add(field.fieldKey);
		}
	}

	private async resolveCanonicalUnitOfMeasureName(
		name: string | null,
	): Promise<string | null> {
		if (!name) {
			return null;
		}

		const unit = await this.prisma.unitOfMeasurement.findFirst({
			where: {
				name: {
					equals: name,
					mode: "insensitive",
				},
				disabled: false,
			},
			select: { name: true },
		});

		if (!unit) {
			throw new BadRequestException(
				`Default stock UOM "${name}" does not exist or is disabled`,
			);
		}

		return unit.name;
	}

	/**
	 * Get the singleton item variant settings record, creating it when missing.
	 */
	async findItemVariantSettings(): Promise<Inventory.ItemVariantSettings> {
		const existing = await this.prisma.itemVariantSettings.findUnique({
			where: { singletonKey: "default" },
			select: itemVariantSettingsSelect,
		});

		if (existing) {
			return toInventoryItemVariantSettings(existing);
		}

		const created = await this.prisma.itemVariantSettings.upsert({
			where: { singletonKey: "default" },
			update: {},
			create: {
				singletonKey: "default",
			},
			select: itemVariantSettingsSelect,
		});

		return toInventoryItemVariantSettings(created);
	}

	/**
	 * Update the singleton item variant settings record while preserving child row identity.
	 */
	async updateItemVariantSettings(
		data: z.infer<typeof Inventory.updateItemVariantSettingsSchema>,
	): Promise<Inventory.ItemVariantSettings> {
		this.assertUniqueItemVariantCopyFields(data.copyFields);

		const updated = await this.prisma.$transaction(async (tx) => {
			const settings = await tx.itemVariantSettings.upsert({
				where: { singletonKey: "default" },
				update: {
					doNotUpdateVariantsOnSave: data.doNotUpdateVariantsOnSave,
					allowRenameAttributeValue: data.allowRenameAttributeValue,
				},
				create: {
					singletonKey: "default",
					doNotUpdateVariantsOnSave: data.doNotUpdateVariantsOnSave,
					allowRenameAttributeValue: data.allowRenameAttributeValue,
				},
				select: { id: true },
			});

			const existingFields = await tx.itemVariantSettingsField.findMany({
				where: { settingsId: settings.id },
				orderBy: { position: "asc" },
			});

			const existingFieldsById = new Map(
				existingFields.map((field) => [field.id, field]),
			);
			const incomingIds = new Set(
				data.copyFields.flatMap((field) => (field.id ? [field.id] : [])),
			);

			for (const field of data.copyFields) {
				if (field.id && !existingFieldsById.has(field.id)) {
					throw new BadRequestException(
						"One or more item variant copy field rows no longer exist",
					);
				}
			}

			const fieldIdsToDelete = existingFields
				.filter((field) => !incomingIds.has(field.id))
				.map((field) => field.id);

			if (fieldIdsToDelete.length > 0) {
				await tx.itemVariantSettingsField.deleteMany({
					where: {
						settingsId: settings.id,
						id: { in: fieldIdsToDelete },
					},
				});
			}

			for (const [position, field] of data.copyFields.entries()) {
				if (field.id) {
					await tx.itemVariantSettingsField.update({
						where: { id: field.id },
						data: {
							fieldKey: field.fieldKey,
							position,
						},
					});
					continue;
				}

				await tx.itemVariantSettingsField.create({
					data: {
						settingsId: settings.id,
						fieldKey: field.fieldKey,
						position,
					},
				});
			}

			return tx.itemVariantSettings.findUniqueOrThrow({
				where: { id: settings.id },
				select: itemVariantSettingsSelect,
			});
		});

		return toInventoryItemVariantSettings(updated);
	}

	/**
	 * Get the singleton stock settings record, creating it when missing.
	 */
	async findStockSettings(): Promise<Inventory.StockSettings> {
		const existing = await this.prisma.stockSettings.findUnique({
			where: { singletonKey: "default" },
			select: stockSettingsSelect,
		});

		if (existing) {
			return toInventoryStockSettings(existing);
		}

		const created = await this.prisma.stockSettings.upsert({
			where: { singletonKey: "default" },
			update: {},
			create: {
				singletonKey: "default",
			},
			select: stockSettingsSelect,
		});

		return toInventoryStockSettings(created);
	}

	/**
	 * Update the singleton stock settings record.
	 */
	async updateStockSettings(
		data: z.infer<typeof Inventory.updateStockSettingsSchema>,
	): Promise<Inventory.StockSettings> {
		const normalizedDefaultWarehouse = this.normalizeStockSettingsText(
			data.defaultWarehouse,
		);
		const normalizedDefaultStockUom =
			await this.resolveCanonicalUnitOfMeasureName(
				this.normalizeStockSettingsText(data.defaultStockUom),
			);

		const updated = await this.prisma.stockSettings.upsert({
			where: { singletonKey: "default" },
			update: {
				...data,
				defaultWarehouse: normalizedDefaultWarehouse,
				defaultStockUom: normalizedDefaultStockUom,
			},
			create: {
				singletonKey: "default",
				...data,
				defaultWarehouse: normalizedDefaultWarehouse,
				defaultStockUom: normalizedDefaultStockUom,
			},
			select: stockSettingsSelect,
		});

		return toInventoryStockSettings(updated);
	}
}
