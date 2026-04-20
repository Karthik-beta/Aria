import { EventEmitter } from "node:events";
import { Inventory } from "@aria/types";
import { Injectable } from "@nestjs/common";
import type {
	TRPCBuiltRouter,
	TRPCDecorateCreateRouterOptions,
} from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../../shared/prisma.service";
import type { accountRouter } from "../../../trpc/routers/account.router";
import { protectedProcedure, router } from "../../../trpc/trpc";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { InventoryService } from "../inventory.service";
import { ItemActivityService } from "../services/item-activity.service";
import { ReportTemplateService } from "../services/report-template.service";

// Global event emitter for real-time subscriptions
const inventoryEvents = new EventEmitter({ captureRejections: true });
inventoryEvents.setMaxListeners(50);

type ItemGroupsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.ItemGroup | { id: string };
};

type ItemsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.Item | { id: string };
};

type SerialNosChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.SerialNo | { id: string };
};

type BatchesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.Batch | { id: string };
};

type InstallationNotesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.InstallationNote | { id: string };
};

const inventoryChangeScopeSchema = z
	.object({
		company: z.string().max(255).optional(),
		warehouse: z.string().max(255).optional(),
		itemCode: z.string().max(100).optional(),
	})
	.optional();

type InventoryChangeScopeFilter = z.infer<typeof inventoryChangeScopeSchema>;

type InventoryChangeScope = {
	id: string;
	company?: string | null;
	warehouses: string[];
	itemCodes: string[];
};

function uniqueValues(values: Array<string | null | undefined>) {
	return [
		...new Set(
			values
				.map((value) => value?.trim())
				.filter((value): value is string => Boolean(value)),
		),
	];
}

function normalizeFilterValue(value?: string | null) {
	return value?.trim().toLowerCase() ?? "";
}

function matchesInventoryChangeScope(
	scope: InventoryChangeScope,
	filter?: InventoryChangeScopeFilter,
) {
	if (!filter) return true;

	const companyFilter = normalizeFilterValue(filter.company);
	if (
		companyFilter &&
		!(scope.company ?? "").toLowerCase().includes(companyFilter)
	) {
		return false;
	}

	const warehouseFilter = normalizeFilterValue(filter.warehouse);
	if (
		warehouseFilter &&
		!scope.warehouses.some(
			(warehouse) => warehouse.toLowerCase() === warehouseFilter,
		)
	) {
		return false;
	}

	const itemCodeFilter = normalizeFilterValue(filter.itemCode);
	if (
		itemCodeFilter &&
		!scope.itemCodes.some((itemCode) =>
			itemCode.toLowerCase().includes(itemCodeFilter),
		)
	) {
		return false;
	}

	return true;
}

function toMaterialRequestChangeScope(request: {
	id: string;
	company?: string | null;
	targetWarehouse?: string | null;
	items?: Array<{
		targetWarehouse?: string | null;
		itemCode?: string | null;
	}>;
}): InventoryChangeScope {
	const itemRows = request.items ?? [];
	return {
		id: request.id,
		company: request.company ?? null,
		warehouses: uniqueValues(
			itemRows.flatMap((item) => [
				item.targetWarehouse,
				request.targetWarehouse,
			]),
		),
		itemCodes: uniqueValues(itemRows.map((item) => item.itemCode)),
	};
}

function toStockEntryChangeScope(entry: {
	id: string;
	company?: string | null;
	defaultSourceWarehouse?: string | null;
	defaultTargetWarehouse?: string | null;
	items?: Array<{
		sourceWarehouse?: string | null;
		targetWarehouse?: string | null;
		itemCode?: string | null;
	}>;
}): InventoryChangeScope {
	const itemRows = entry.items ?? [];
	return {
		id: entry.id,
		company: entry.company ?? null,
		warehouses: uniqueValues(
			itemRows.flatMap((item) => [
				item.sourceWarehouse,
				item.targetWarehouse,
				entry.defaultSourceWarehouse,
				entry.defaultTargetWarehouse,
			]),
		),
		itemCodes: uniqueValues(itemRows.map((item) => item.itemCode)),
	};
}

function toDeliveryNoteChangeScope(note: {
	id: string;
	company?: string | null;
	sourceWarehouse?: string | null;
	items?: Array<{
		warehouse?: string | null;
		itemCode?: string | null;
	}>;
}): InventoryChangeScope {
	const itemRows = note.items ?? [];
	return {
		id: note.id,
		company: note.company ?? null,
		warehouses: uniqueValues(
			itemRows.flatMap((item) => [item.warehouse, note.sourceWarehouse]),
		),
		itemCodes: uniqueValues(itemRows.map((item) => item.itemCode)),
	};
}

function toPickListChangeScope(pickList: {
	id: string;
	company?: string | null;
	warehouse?: string | null;
	items?: Array<{
		warehouse?: string | null;
		item?: string | null;
	}>;
}): InventoryChangeScope {
	const itemRows = pickList.items ?? [];
	return {
		id: pickList.id,
		company: pickList.company ?? null,
		warehouses: uniqueValues(
			itemRows.flatMap((item) => [item.warehouse, pickList.warehouse]),
		),
		itemCodes: uniqueValues(itemRows.map((item) => item.item)),
	};
}

function createListItemsProcedure(inventoryService: InventoryService) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAll();
	});
}

function createListItemCatalogueProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listItemsSchema)
		.query(async ({ input }) => {
			return inventoryService.findPagedItems(input);
		});
}

function createListItemGroupsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ search: z.string().optional() }).optional())
		.query(async ({ input }) => {
			return inventoryService.findAllItemGroups(input?.search);
		});
}

function createListUnitsOfMeasureProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ search: z.string().optional() }).optional())
		.query(async ({ input }) => {
			return inventoryService.findAllUnitsOfMeasure(input?.search);
		});
}

function createListWarehousesProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listWarehousesSchema)
		.query(async ({ input }) => {
			return inventoryService.findWarehouses(input);
		});
}

function createListSerialNosProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listSerialNosSchema)
		.query(async ({ input }) => {
			return inventoryService.findSerialNos(input);
		});
}

function createListSerialNoServiceContractExpiryProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listSerialNoServiceContractExpirySchema)
		.query(async ({ input }) => {
			return inventoryService.findSerialNoServiceContractExpiry(input);
		});
}

function createListSerialNoWarrantyExpiryProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listSerialNoWarrantyExpirySchema)
		.query(async ({ input }) => {
			return inventoryService.findSerialNoWarrantyExpiry(input);
		});
}

function createListSerialNoStatusProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listSerialNoStatusSchema)
		.query(async ({ input }) => {
			return inventoryService.findSerialNoStatus(input);
		});
}

function createListBatchesProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listBatchesSchema)
		.query(async ({ input }) => {
			return inventoryService.findBatches(input);
		});
}

function createGetBatchByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findBatchById(input.id);
		});
}

function createCreateBatchProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createBatchSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createBatch(input);
			void inventoryEvents.emit("batchCreated", result);
			return result;
		});
}

function createUpdateBatchProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateBatchSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateBatch(input);
			void inventoryEvents.emit("batchUpdated", result);
			return result;
		});
}

function createDeleteBatchProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteBatch(input.id);
			void inventoryEvents.emit("batchDeleted", { id: input.id });
			return result;
		});
}

function createGetSerialNoByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findSerialNoById(input.id);
		});
}

function createCreateSerialNoProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createSerialNoSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createSerialNo(input);
			void inventoryEvents.emit("serialNoCreated", result);
			return result;
		});
}

function createUpdateSerialNoProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateSerialNoSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateSerialNo(input);
			void inventoryEvents.emit("serialNoUpdated", result);
			return result;
		});
}

function createDeleteSerialNoProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteSerialNo(input.id);
			void inventoryEvents.emit("serialNoDeleted", { id: input.id });
			return result;
		});
}

function createListInstallationNotesProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listInstallationNotesSchema)
		.query(async ({ input }) => {
			return inventoryService.findInstallationNotes(input);
		});
}

function createGetInstallationNoteByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findInstallationNoteById(input.id);
		});
}

function createCreateInstallationNoteProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createInstallationNoteSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createInstallationNote(input);
			void inventoryEvents.emit("installationNoteCreated", result);
			return result;
		});
}

function createUpdateInstallationNoteProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateInstallationNoteSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateInstallationNote(input);
			void inventoryEvents.emit("installationNoteUpdated", result);
			return result;
		});
}

function createDeleteInstallationNoteProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteInstallationNote(input.id);
			void inventoryEvents.emit("installationNoteDeleted", { id: input.id });
			return result;
		});
}

function createGetWarehouseByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findWarehouseById(input.id);
		});
}

function createCreateWarehouseProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createWarehouseSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createWarehouse(input);
		});
}

function createUpdateWarehouseProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateWarehouseSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateWarehouse(input);
		});
}

function createDeleteWarehouseProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteWarehouse(input.id);
		});
}

function createGetStockSettingsProcedure(inventoryService: InventoryService) {
	return protectedProcedure.query(async () => {
		return inventoryService.findStockSettings();
	});
}

function createGetItemVariantSettingsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure.query(async () => {
		return inventoryService.findItemVariantSettings();
	});
}

function createUpdateItemVariantSettingsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateItemVariantSettingsSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateItemVariantSettings(input);
		});
}

function createUpdateStockSettingsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateStockSettingsSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateStockSettings(input);
		});
}

function createGetUnitOfMeasureByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findUnitOfMeasureById(input.id);
		});
}

function createCreateUnitOfMeasureProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createUnitOfMeasureSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createUnitOfMeasure(input);
		});
}

function createUpdateUnitOfMeasureProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateUnitOfMeasureSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateUnitOfMeasure(input);
		});
}

function createDeleteUnitOfMeasureProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteUnitOfMeasure(input.id);
		});
}

function createListBrandsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ search: z.string().optional() }).optional())
		.query(async ({ input }) => {
			return inventoryService.findAllBrands(input?.search);
		});
}

function createGetBrandByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findBrandById(input.id);
		});
}

function createCreateBrandProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createBrandSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createBrand(input);
		});
}

function createUpdateBrandProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateBrandSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateBrand(input);
		});
}

function createDeleteBrandProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteBrand(input.id);
		});
}

// ============================================================================
// Item Attribute procedures
// ============================================================================

function createListItemAttributesProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ search: z.string().optional() }).optional())
		.query(async ({ input }) => {
			return inventoryService.findAllItemAttributes(input?.search);
		});
}

function createGetItemAttributeByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findItemAttributeById(input.id);
		});
}

function createCreateItemAttributeProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createItemAttributeSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createItemAttribute(input);
		});
}

function createUpdateItemAttributeProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateItemAttributeSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateItemAttribute(input);
		});
}

function createDeleteItemAttributeProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteItemAttribute(input.id);
		});
}

function createListBundleItemsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ search: z.string().optional() }).optional())
		.query(async ({ input }) => {
			return inventoryService.findAllItemsForBundleSelection(input?.search);
		});
}

function createListProductBundlesProcedure(inventoryService: InventoryService) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllProductBundles();
	});
}

function createGetProductBundleByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findProductBundleById(input.id);
		});
}

function createCreateProductBundleProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createProductBundleSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createProductBundle(input);
		});
}

function createUpdateProductBundleProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateProductBundleSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateProductBundle(input);
		});
}

function createDeleteProductBundleProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteProductBundle(input.id);
		});
}

function createListShippingRulesProcedure(inventoryService: InventoryService) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllShippingRules();
	});
}

function createGetShippingRuleByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findShippingRuleById(input.id);
		});
}

function createCreateShippingRuleProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createShippingRuleSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createShippingRule(input);
		});
}

function createUpdateShippingRuleProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateShippingRuleSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateShippingRule(input);
		});
}

function createDeleteShippingRuleProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteShippingRule(input.id);
		});
}

function createListItemManufacturersProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllItemManufacturers();
	});
}

function createGetItemManufacturerByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findItemManufacturerById(input.id);
		});
}

function createCreateItemManufacturerProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createItemManufacturerSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createItemManufacturer(input);
		});
}

function createUpdateItemManufacturerProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateItemManufacturerSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateItemManufacturer(input);
		});
}

function createDeleteItemManufacturerProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteItemManufacturer(input.id);
		});
}

function createListItemActivityProcedure(prisma: PrismaService) {
	return protectedProcedure
		.input(
			z.object({
				itemId: z.string().min(1),
				fromDate: z.date().optional(),
				toDate: z.date().optional(),
				activityType: z.enum(Inventory.ITEM_ACTIVITY_TYPES).optional(),
				limit: z.number().min(1).max(100).optional(),
				offset: z.number().min(0).optional(),
			}),
		)
		.query(async ({ input }) => {
			const service = new ItemActivityService(prisma);
			return service.getActivityForItem({
				itemId: input.itemId,
				fromDate: input.fromDate,
				toDate: input.toDate,
				activityType: input.activityType,
				limit: input.limit,
				offset: input.offset,
			});
		});
}

function createLogItemActivityProcedure(prisma: PrismaService) {
	return protectedProcedure
		.input(
			z.object({
				itemId: z.string().min(1),
				activityType: z.enum(Inventory.ITEM_ACTIVITY_TYPES),
				description: z.string().min(1).max(500),
				quantity: z.number().nullable().optional(),
				value: z.number().nullable().optional(),
				company: z.string().max(255).nullable().optional(),
				warehouse: z.string().max(255).nullable().optional(),
				referenceType: z.string().max(50).nullable().optional(),
				referenceId: z.string().max(100).nullable().optional(),
				referenceName: z.string().max(255).nullable().optional(),
				metadata: z.record(z.string(), z.unknown()).nullable().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const service = new ItemActivityService(prisma);
			return service.logActivity(input);
		});
}

function createListItemAlternativesProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllItemAlternatives();
	});
}

function createGetItemAlternativeByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.query(async ({ input }) => {
			return inventoryService.findItemAlternativeById(input.id);
		});
}

function createCreateItemAlternativeProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createItemAlternativeSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createItemAlternative(input);
		});
}

function createUpdateItemAlternativeProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateItemAlternativeSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateItemAlternative(input);
		});
}

function createDeleteItemAlternativeProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().cuid() }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteItemAlternative(input.id);
		});
}

function createCreateItemProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createSchema)
		.mutation(async ({ input }) => {
			const item = await inventoryService.create(input);
			void inventoryEvents.emit("itemCreated", item);
			return item;
		});
}

function createUpdateItemProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateSchema)
		.mutation(async ({ input }) => {
			const item = await inventoryService.update(input);
			void inventoryEvents.emit("itemUpdated", item);
			return item;
		});
}

function createDeleteItemProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			await inventoryService.delete(input.id);
			inventoryEvents.emit("itemDeleted", { id: input.id });
			return { success: true, id: input.id };
		});
}

function createBulkDeleteItemsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.bulkDeleteSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteMany(input.ids);

			for (const id of result.ids) {
				inventoryEvents.emit("itemDeleted", { id });
			}

			return result;
		});
}

function createCreateItemGroupProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createGroupSchema)
		.mutation(async ({ input }) => {
			const group = await inventoryService.createGroup(input);
			inventoryEvents.emit("itemGroupCreated", group);
			return group;
		});
}

function createUpdateItemGroupProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateGroupSchema)
		.mutation(async ({ input }) => {
			const group = await inventoryService.updateGroup(input);
			inventoryEvents.emit("itemGroupUpdated", group);
			return group;
		});
}

function createDeleteItemGroupProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteGroup(input.id);
			inventoryEvents.emit("itemGroupDeleted", { id: input.id });
			return result;
		});
}

const onItemGroupsChangedProcedure = protectedProcedure.subscription(() => {
	return observable<ItemGroupsChangedEvent>((emit) => {
		const onCreated = (data: Inventory.ItemGroup) => {
			emit.next({ type: "created", data });
		};
		const onUpdated = (data: Inventory.ItemGroup) => {
			emit.next({ type: "updated", data });
		};
		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("itemGroupCreated", onCreated);
		inventoryEvents.on("itemGroupUpdated", onUpdated);
		inventoryEvents.on("itemGroupDeleted", onDeleted);

		return () => {
			inventoryEvents.off("itemGroupCreated", onCreated);
			inventoryEvents.off("itemGroupUpdated", onUpdated);
			inventoryEvents.off("itemGroupDeleted", onDeleted);
		};
	});
});

const onItemCreatedProcedure = protectedProcedure.subscription(() => {
	return observable<Inventory.Item>((emit) => {
		const onCreated = (data: Inventory.Item) => {
			emit.next(data);
		};

		inventoryEvents.on("itemCreated", onCreated);

		return () => {
			inventoryEvents.off("itemCreated", onCreated);
		};
	});
});

const onItemUpdatedProcedure = protectedProcedure.subscription(() => {
	return observable<Inventory.Item>((emit) => {
		const onUpdated = (data: Inventory.Item) => {
			emit.next(data);
		};

		inventoryEvents.on("itemUpdated", onUpdated);

		return () => {
			inventoryEvents.off("itemUpdated", onUpdated);
		};
	});
});

const onItemDeletedProcedure = protectedProcedure.subscription(() => {
	return observable<{ id: string }>((emit) => {
		const onDeleted = (data: { id: string }) => {
			emit.next(data);
		};

		inventoryEvents.on("itemDeleted", onDeleted);

		return () => {
			inventoryEvents.off("itemDeleted", onDeleted);
		};
	});
});

const onItemsChangedProcedure = protectedProcedure.subscription(() => {
	return observable<ItemsChangedEvent>((emit) => {
		const onCreated = (data: Inventory.Item) => {
			emit.next({ type: "created", data });
		};

		const onUpdated = (data: Inventory.Item) => {
			emit.next({ type: "updated", data });
		};

		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("itemCreated", onCreated);
		inventoryEvents.on("itemUpdated", onUpdated);
		inventoryEvents.on("itemDeleted", onDeleted);

		return () => {
			inventoryEvents.off("itemCreated", onCreated);
			inventoryEvents.off("itemUpdated", onUpdated);
			inventoryEvents.off("itemDeleted", onDeleted);
		};
	});
});

const onSerialNosChangedProcedure = protectedProcedure.subscription(() => {
	return observable<SerialNosChangedEvent>((emit) => {
		const onCreated = (data: Inventory.SerialNo) => {
			emit.next({ type: "created", data });
		};
		const onUpdated = (data: Inventory.SerialNo) => {
			emit.next({ type: "updated", data });
		};
		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("serialNoCreated", onCreated);
		inventoryEvents.on("serialNoUpdated", onUpdated);
		inventoryEvents.on("serialNoDeleted", onDeleted);

		return () => {
			inventoryEvents.off("serialNoCreated", onCreated);
			inventoryEvents.off("serialNoUpdated", onUpdated);
			inventoryEvents.off("serialNoDeleted", onDeleted);
		};
	});
});

const onBatchesChangedProcedure = protectedProcedure.subscription(() => {
	return observable<BatchesChangedEvent>((emit) => {
		const onCreated = (data: Inventory.Batch) => {
			emit.next({ type: "created", data });
		};
		const onUpdated = (data: Inventory.Batch) => {
			emit.next({ type: "updated", data });
		};
		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("batchCreated", onCreated);
		inventoryEvents.on("batchUpdated", onUpdated);
		inventoryEvents.on("batchDeleted", onDeleted);

		return () => {
			inventoryEvents.off("batchCreated", onCreated);
			inventoryEvents.off("batchUpdated", onUpdated);
			inventoryEvents.off("batchDeleted", onDeleted);
		};
	});
});

const onInstallationNotesChangedProcedure = protectedProcedure.subscription(
	() => {
		return observable<InstallationNotesChangedEvent>((emit) => {
			const onCreated = (data: Inventory.InstallationNote) => {
				emit.next({ type: "created", data });
			};
			const onUpdated = (data: Inventory.InstallationNote) => {
				emit.next({ type: "updated", data });
			};
			const onDeleted = (data: { id: string }) => {
				emit.next({ type: "deleted", data });
			};

			inventoryEvents.on("installationNoteCreated", onCreated);
			inventoryEvents.on("installationNoteUpdated", onUpdated);
			inventoryEvents.on("installationNoteDeleted", onDeleted);

			return () => {
				inventoryEvents.off("installationNoteCreated", onCreated);
				inventoryEvents.off("installationNoteUpdated", onUpdated);
				inventoryEvents.off("installationNoteDeleted", onDeleted);
			};
		});
	},
);

// ─── Material Request Procedures ────────────────────────────────────────────

type MaterialRequestsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: InventoryChangeScope;
};

function createListMaterialRequestsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listMaterialRequestsSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllMaterialRequests(input);
		});
}

function createGetMaterialRequestByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findMaterialRequestById(input.id);
		});
}

function createCreateMaterialRequestProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createMaterialRequestSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createMaterialRequest(input);
			void inventoryEvents.emit(
				"materialRequestCreated",
				toMaterialRequestChangeScope(result),
			);
			return result;
		});
}

function createUpdateMaterialRequestProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateMaterialRequestSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateMaterialRequest(input);
			void inventoryEvents.emit(
				"materialRequestUpdated",
				toMaterialRequestChangeScope(result),
			);
			return result;
		});
}

function createDeleteMaterialRequestProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const existing = await inventoryService.findMaterialRequestById(input.id);
			const result = await inventoryService.deleteMaterialRequest(input.id);
			inventoryEvents.emit(
				"materialRequestDeleted",
				existing
					? toMaterialRequestChangeScope(existing)
					: { id: input.id, company: null, warehouses: [], itemCodes: [] },
			);
			return result;
		});
}

function createDeleteManyMaterialRequestsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeleteMaterialRequestsSchema)
		.mutation(async ({ input }) => {
			const existingRequests = (
				await Promise.all(
					input.ids.map((id) => inventoryService.findMaterialRequestById(id)),
				)
			).filter(
				(request): request is Inventory.MaterialRequest => request != null,
			);
			const result = await inventoryService.deleteManyMaterialRequests(
				input.ids,
			);
			for (const request of existingRequests) {
				inventoryEvents.emit(
					"materialRequestDeleted",
					toMaterialRequestChangeScope(request),
				);
			}
			return result;
		});
}

const onMaterialRequestsChangedProcedure = protectedProcedure
	.input(inventoryChangeScopeSchema)
	.subscription(({ input }) => {
		return observable<MaterialRequestsChangedEvent>((emit) => {
			const onCreated = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "created", data });
				}
			};

			const onUpdated = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "updated", data });
				}
			};

			const onDeleted = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "deleted", data });
				}
			};

			inventoryEvents.on("materialRequestCreated", onCreated);
			inventoryEvents.on("materialRequestUpdated", onUpdated);
			inventoryEvents.on("materialRequestDeleted", onDeleted);

			return () => {
				inventoryEvents.off("materialRequestCreated", onCreated);
				inventoryEvents.off("materialRequestUpdated", onUpdated);
				inventoryEvents.off("materialRequestDeleted", onDeleted);
			};
		});
	});

// ─── Stock Entry Procedures ──────────────────────────────────────────────────

type StockEntriesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: InventoryChangeScope;
};

function createListStockEntriesProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listStockEntriesSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllStockEntries(input);
		});
}

function createGetStockEntryByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findStockEntryById(input.id);
		});
}

function createCreateStockEntryProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createStockEntrySchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createStockEntry(input);
			void inventoryEvents.emit(
				"stockEntryCreated",
				toStockEntryChangeScope(result),
			);
			return result;
		});
}

function createUpdateStockEntryProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateStockEntrySchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateStockEntry(input);
			void inventoryEvents.emit(
				"stockEntryUpdated",
				toStockEntryChangeScope(result),
			);
			return result;
		});
}

function createDeleteStockEntryProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const existing = await inventoryService.findStockEntryById(input.id);
			const result = await inventoryService.deleteStockEntry(input.id);
			void inventoryEvents.emit(
				"stockEntryDeleted",
				existing
					? toStockEntryChangeScope(existing)
					: { id: input.id, company: null, warehouses: [], itemCodes: [] },
			);
			return result;
		});
}

function createDeleteManyStockEntriesProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeleteStockEntriesSchema)
		.mutation(async ({ input }) => {
			const existingEntries = (
				await Promise.all(
					input.ids.map((id) => inventoryService.findStockEntryById(id)),
				)
			).filter((entry): entry is Inventory.StockEntry => entry != null);
			const result = await inventoryService.deleteManyStockEntries(input.ids);
			for (const entry of existingEntries) {
				inventoryEvents.emit(
					"stockEntryDeleted",
					toStockEntryChangeScope(entry),
				);
			}
			return result;
		});
}

const onStockEntriesChangedProcedure = protectedProcedure
	.input(inventoryChangeScopeSchema)
	.subscription(({ input }) => {
		return observable<StockEntriesChangedEvent>((emit) => {
			const onCreated = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "created", data });
				}
			};
			const onUpdated = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "updated", data });
				}
			};
			const onDeleted = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "deleted", data });
				}
			};

			inventoryEvents.on("stockEntryCreated", onCreated);
			inventoryEvents.on("stockEntryUpdated", onUpdated);
			inventoryEvents.on("stockEntryDeleted", onDeleted);

			return () => {
				inventoryEvents.off("stockEntryCreated", onCreated);
				inventoryEvents.off("stockEntryUpdated", onUpdated);
				inventoryEvents.off("stockEntryDeleted", onDeleted);
			};
		});
	});

function createListStockLedgerProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listStockLedgerSchema)
		.query(async ({ input }) => {
			return inventoryService.findStockLedger(input);
		});
}

function createExportStockLedgerExcelProcedure(
	inventoryService: InventoryService,
	reportTemplateService: ReportTemplateService,
) {
	return protectedProcedure
		.input(Inventory.listStockLedgerSchema)
		.mutation(async ({ input }) => {
			if (!input) {
				throw new Error("Invalid input");
			}
			// Fetch all data (up to 10000 rows for export)
			const data = await inventoryService.findStockLedger({
				...input,
				take: 10000,
			});

			const columns = [
				{ key: "postingDate", header: "Date" },
				{ key: "itemCode", header: "Item" },
				{ key: "itemName", header: "Item Name" },
				{ key: "warehouse", header: "Warehouse" },
				{ key: "unitOfMeasure", header: "UOM" },
				{ key: "qtyIn", header: "In Qty" },
				{ key: "qtyOut", header: "Out Qty" },
				{ key: "balanceQty", header: "Balance Qty" },
				{ key: "basicRate", header: "Incoming Rate" },
				{ key: "valuationRate", header: "Avg Rate" },
				{ key: "balanceValue", header: "Valuation" },
				{ key: "stockEntryType", header: "Voucher Type" },
				{ key: "voucherNo", header: "Voucher #" },
				{ key: "batchNo", header: "Batch No" },
				{ key: "serialNo", header: "Serial No" },
				{ key: "company", header: "Company" },
				{ key: "movementType", header: "Movement" },
				{ key: "status", header: "Status" },
			];

			const filters: Array<{ label: string; value: string }> = [];
			if (input.company)
				filters.push({ label: "Company", value: input.company });
			if (input.warehouse)
				filters.push({ label: "Warehouse", value: input.warehouse });
			if (input.itemCode)
				filters.push({ label: "Item", value: input.itemCode });
			if (input.dateFrom)
				filters.push({ label: "From", value: String(input.dateFrom) });
			if (input.dateTo)
				filters.push({ label: "To", value: String(input.dateTo) });

			const metadata = {
				title: "Stock Ledger Report",
				generatedAt: new Date(),
				filters,
			};

			// Convert dates for export
			const exportData = data.map((row) => ({
				...row,
				postingDate: row.postingDate,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			}));

			return reportTemplateService.buildExcelBuffer(
				metadata,
				exportData as unknown as Record<string, unknown>[],
				columns,
			);
		});
}

function createListStockBalanceProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listStockBalanceSchema)
		.query(async ({ input }) => {
			return inventoryService.findStockBalance(input);
		});
}

function createGetQuickStockBalanceProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.quickStockBalanceSchema)
		.query(async ({ input }) => {
			return inventoryService.getQuickStockBalance(input);
		});
}

function createListStockProjectedQtyProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listStockProjectedQtySchema)
		.query(async ({ input }) => {
			return inventoryService.findStockProjectedQty(input);
		});
}

function createListItemShortageReportProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listItemShortageSchema)
		.query(async ({ input }) => {
			return inventoryService.findItemShortageReport(input);
		});
}

function createListRequestedItemsToBeTransferredProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listRequestedItemsToBeTransferredSchema)
		.query(async ({ input }) => {
			return inventoryService.findRequestedItemsToBeTransferred(input);
		});
}

function createListSubcontractedRawMaterialsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listSubcontractedRawMaterialsSchema)
		.query(async ({ input }) => {
			return inventoryService.findSubcontractedRawMaterials(input);
		});
}

function createListSubcontractedItemToBeReceivedProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listSubcontractedItemToBeReceivedSchema)
		.query(async ({ input }) => {
			return inventoryService.findSubcontractedItemToBeReceived(input);
		});
}

function createListBatchWiseBalanceProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listBatchWiseBalanceSchema)
		.query(async ({ input }) => {
			return inventoryService.findBatchWiseBalanceHistory(input);
		});
}

function createListBatchItemExpiryProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listBatchItemExpirySchema)
		.query(async ({ input }) => {
			return inventoryService.findBatchItemExpiry(input);
		});
}

function createListItemPricesProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listItemPricesSchema)
		.query(async ({ input }) => {
			return inventoryService.findItemPrices(input);
		});
}

function createListItemwiseRecommendedReorderLevelProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listItemwiseRecommendedReorderLevelSchema)
		.query(async ({ input }) => {
			return inventoryService.findItemwiseRecommendedReorderLevel(input);
		});
}

function createListItemVariantDetailsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listItemVariantDetailsSchema)
		.query(async ({ input }) => {
			return inventoryService.findItemVariantDetails(input);
		});
}

function createListStockSummaryProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listStockSummarySchema)
		.query(async ({ input }) => {
			return inventoryService.findStockSummary(input);
		});
}

function createListStockAgeingProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listStockAgeingSchema)
		.query(async ({ input }) => {
			return inventoryService.findStockAgeing(input);
		});
}

function createListItemPriceStockProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listItemPriceStockSchema)
		.query(async ({ input }) => {
			return inventoryService.findItemPriceStock(input);
		});
}

function createListWarehouseWiseStockBalanceProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listWarehouseWiseStockBalanceSchema)
		.query(async ({ input }) => {
			return inventoryService.findWarehouseWiseStockBalance(input);
		});
}

function createListStockAnalyticsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listStockAnalyticsSchema)
		.query(async ({ input }) => {
			return inventoryService.findStockAnalytics(input);
		});
}

function createListDeliveryNoteTrendsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listDeliveryNoteTrendsSchema)
		.query(async ({ input }) => {
			return inventoryService.findDeliveryNoteTrends(input);
		});
}

function createListPurchaseReceiptTrendsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listPurchaseReceiptTrendsSchema)
		.query(async ({ input }) => {
			return inventoryService.findPurchaseReceiptTrends(input);
		});
}

function createListSalesOrderAnalysisProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listSalesOrderAnalysisSchema)
		.query(async ({ input }) => {
			return inventoryService.findSalesOrderAnalysis(input);
		});
}

function createListPurchaseOrderAnalysisProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listPurchaseOrderAnalysisSchema)
		.query(async ({ input }) => {
			return inventoryService.findPurchaseOrderAnalysis(input);
		});
}

// ─── Delivery Note Procedures ────────────────────────────────────────────────

type DeliveryNotesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: InventoryChangeScope;
};

function createListDeliveryNotesProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listDeliveryNotesSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllDeliveryNotes(input);
		});
}

function createGetDeliveryNoteByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findDeliveryNoteById(input.id);
		});
}

function createCreateDeliveryNoteProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createDeliveryNoteSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createDeliveryNote(input);
			void inventoryEvents.emit(
				"deliveryNoteCreated",
				toDeliveryNoteChangeScope(result),
			);
			return result;
		});
}

function createUpdateDeliveryNoteProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateDeliveryNoteSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateDeliveryNote(input);
			void inventoryEvents.emit(
				"deliveryNoteUpdated",
				toDeliveryNoteChangeScope(result),
			);
			return result;
		});
}

function createDeleteDeliveryNoteProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const existing = await inventoryService.findDeliveryNoteById(input.id);
			const result = await inventoryService.deleteDeliveryNote(input.id);
			void inventoryEvents.emit(
				"deliveryNoteDeleted",
				existing
					? toDeliveryNoteChangeScope(existing)
					: { id: input.id, company: null, warehouses: [], itemCodes: [] },
			);
			return result;
		});
}

function createDeleteManyDeliveryNotesProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeleteDeliveryNotesSchema)
		.mutation(async ({ input }) => {
			const existingNotes = (
				await Promise.all(
					input.ids.map((id) => inventoryService.findDeliveryNoteById(id)),
				)
			).filter((note): note is Inventory.DeliveryNote => note != null);
			const result = await inventoryService.deleteManyDeliveryNotes(input.ids);
			for (const note of existingNotes) {
				inventoryEvents.emit(
					"deliveryNoteDeleted",
					toDeliveryNoteChangeScope(note),
				);
			}
			return result;
		});
}

const onDeliveryNotesChangedProcedure = protectedProcedure
	.input(inventoryChangeScopeSchema)
	.subscription(({ input }) => {
		return observable<DeliveryNotesChangedEvent>((emit) => {
			const onCreated = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "created", data });
				}
			};
			const onUpdated = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "updated", data });
				}
			};
			const onDeleted = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "deleted", data });
				}
			};

			inventoryEvents.on("deliveryNoteCreated", onCreated);
			inventoryEvents.on("deliveryNoteUpdated", onUpdated);
			inventoryEvents.on("deliveryNoteDeleted", onDeleted);

			return () => {
				inventoryEvents.off("deliveryNoteCreated", onCreated);
				inventoryEvents.off("deliveryNoteUpdated", onUpdated);
				inventoryEvents.off("deliveryNoteDeleted", onDeleted);
			};
		});
	});

// ─── Purchase Receipt Procedures ─────────────────────────────────────────────

function createListPurchaseReceiptsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.listPurchaseReceiptsSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllPurchaseReceipts(input);
		});
}

function createGetPurchaseReceiptByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findPurchaseReceiptById(input.id);
		});
}

function createCreatePurchaseReceiptProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createPurchaseReceiptSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createPurchaseReceipt(input);
			void inventoryEvents.emit("purchaseReceiptCreated", result);
			return result;
		});
}

function createUpdatePurchaseReceiptProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updatePurchaseReceiptSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updatePurchaseReceipt(input);
			void inventoryEvents.emit("purchaseReceiptUpdated", result);
			return result;
		});
}

function createDeletePurchaseReceiptProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deletePurchaseReceipt(input.id);
			void inventoryEvents.emit("purchaseReceiptDeleted", { id: input.id });
			return result;
		});
}

function createDeleteManyPurchaseReceiptsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeletePurchaseReceiptsSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteManyPurchaseReceipts(
				input.ids,
			);
			for (const id of result.ids) {
				void inventoryEvents.emit("purchaseReceiptDeleted", { id });
			}
			return result;
		});
}

type PurchaseReceiptsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.PurchaseReceipt | { id: string };
};

const onPurchaseReceiptsChangedProcedure = protectedProcedure.subscription(
	() => {
		return observable<PurchaseReceiptsChangedEvent>((emit) => {
			const onCreated = (data: Inventory.PurchaseReceipt) => {
				emit.next({ type: "created", data });
			};
			const onUpdated = (data: Inventory.PurchaseReceipt) => {
				emit.next({ type: "updated", data });
			};
			const onDeleted = (data: { id: string }) => {
				emit.next({ type: "deleted", data });
			};

			inventoryEvents.on("purchaseReceiptCreated", onCreated);
			inventoryEvents.on("purchaseReceiptUpdated", onUpdated);
			inventoryEvents.on("purchaseReceiptDeleted", onDeleted);

			return () => {
				inventoryEvents.off("purchaseReceiptCreated", onCreated);
				inventoryEvents.off("purchaseReceiptUpdated", onUpdated);
				inventoryEvents.off("purchaseReceiptDeleted", onDeleted);
			};
		});
	},
);

// ─── Pick List Procedures ────────────────────────────────────────────────────

type PickListsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: InventoryChangeScope;
};

function createListPickListsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listPickListsSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllPickLists(input);
		});
}

function createGetPickListByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findPickListById(input.id);
		});
}

function createCreatePickListProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createPickListSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createPickList(input);
			void inventoryEvents.emit(
				"pickListCreated",
				toPickListChangeScope(result),
			);
			return result;
		});
}

function createUpdatePickListProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updatePickListSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updatePickList(input);
			void inventoryEvents.emit(
				"pickListUpdated",
				toPickListChangeScope(result),
			);
			return result;
		});
}

function createDeletePickListProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const existing = await inventoryService.findPickListById(input.id);
			const result = await inventoryService.deletePickList(input.id);
			void inventoryEvents.emit(
				"pickListDeleted",
				existing
					? toPickListChangeScope(existing)
					: { id: input.id, company: null, warehouses: [], itemCodes: [] },
			);
			return result;
		});
}

function createDeleteManyPickListsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeletePickListsSchema)
		.mutation(async ({ input }) => {
			const existingPickLists = (
				await Promise.all(
					input.ids.map((id) => inventoryService.findPickListById(id)),
				)
			).filter((pickList): pickList is Inventory.PickList => pickList != null);
			const result = await inventoryService.deleteManyPickLists(input.ids);
			for (const pickList of existingPickLists) {
				void inventoryEvents.emit(
					"pickListDeleted",
					toPickListChangeScope(pickList),
				);
			}
			return result;
		});
}

const onPickListsChangedProcedure = protectedProcedure
	.input(inventoryChangeScopeSchema)
	.subscription(({ input }) => {
		return observable<PickListsChangedEvent>((emit) => {
			const onCreated = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "created", data });
				}
			};
			const onUpdated = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "updated", data });
				}
			};
			const onDeleted = (data: InventoryChangeScope) => {
				if (matchesInventoryChangeScope(data, input)) {
					emit.next({ type: "deleted", data });
				}
			};

			inventoryEvents.on("pickListCreated", onCreated);
			inventoryEvents.on("pickListUpdated", onUpdated);
			inventoryEvents.on("pickListDeleted", onDeleted);

			return () => {
				inventoryEvents.off("pickListCreated", onCreated);
				inventoryEvents.off("pickListUpdated", onUpdated);
				inventoryEvents.off("pickListDeleted", onDeleted);
			};
		});
	});

// ─────────────────────────────────────────────────────────────────────────────
// Delivery Trip procedures
// ─────────────────────────────────────────────────────────────────────────────

type DeliveryTripsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.DeliveryTrip | { id: string };
};

function createListDeliveryTripsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listDeliveryTripsSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllDeliveryTrips(input);
		});
}

function createGetDeliveryTripByIdProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findDeliveryTripById(input.id);
		});
}

function createCreateDeliveryTripProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createDeliveryTripSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createDeliveryTrip(input);
			void inventoryEvents.emit("deliveryTripCreated", result);
			return result;
		});
}

function createUpdateDeliveryTripProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateDeliveryTripSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updateDeliveryTrip(input);
			void inventoryEvents.emit("deliveryTripUpdated", result);
			return result;
		});
}

function createDeleteDeliveryTripProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteDeliveryTrip(input.id);
			void inventoryEvents.emit("deliveryTripDeleted", { id: input.id });
			return result;
		});
}

function createDeleteManyDeliveryTripsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeleteDeliveryTripsSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteManyDeliveryTrips(input.ids);
			for (const id of result.ids) {
				void inventoryEvents.emit("deliveryTripDeleted", { id });
			}
			return result;
		});
}

const onDeliveryTripsChangedProcedure = protectedProcedure.subscription(() => {
	return observable<DeliveryTripsChangedEvent>((emit) => {
		const onCreated = (data: Inventory.DeliveryTrip) => {
			emit.next({ type: "created", data });
		};
		const onUpdated = (data: Inventory.DeliveryTrip) => {
			emit.next({ type: "updated", data });
		};
		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("deliveryTripCreated", onCreated);
		inventoryEvents.on("deliveryTripUpdated", onUpdated);
		inventoryEvents.on("deliveryTripDeleted", onDeleted);

		return () => {
			inventoryEvents.off("deliveryTripCreated", onCreated);
			inventoryEvents.off("deliveryTripUpdated", onUpdated);
			inventoryEvents.off("deliveryTripDeleted", onDeleted);
		};
	});
});

// ─── Packing Slip Procedures ──────────────────────────────────────────────────

type PackingSlipsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Inventory.PackingSlip | { id: string };
};

function createListPackingSlipsProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listPackingSlipsSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllPackingSlips(input);
		});
}

function createGetPackingSlipByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findPackingSlipById(input.id);
		});
}

function createGetRecommendedCaseNoProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ deliveryNoteId: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.getRecommendedCaseNo(input.deliveryNoteId);
		});
}

function createCreatePackingSlipProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createPackingSlipSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.createPackingSlip(input);
			void inventoryEvents.emit("packingSlipCreated", result);
			return result;
		});
}

function createUpdatePackingSlipProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updatePackingSlipSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.updatePackingSlip(input);
			void inventoryEvents.emit("packingSlipUpdated", result);
			return result;
		});
}

function createSubmitPackingSlipProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.submitPackingSlip(input.id);
			void inventoryEvents.emit("packingSlipUpdated", result);
			return result;
		});
}

function createCancelPackingSlipProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.cancelPackingSlip(input.id);
			void inventoryEvents.emit("packingSlipUpdated", result);
			return result;
		});
}

function createDeletePackingSlipProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			const result = await inventoryService.deletePackingSlip(input.id);
			void inventoryEvents.emit("packingSlipDeleted", { id: input.id });
			return result;
		});
}

function createDeleteManyPackingSlipsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeletePackingSlipsSchema)
		.mutation(async ({ input }) => {
			const result = await inventoryService.deleteManyPackingSlips(input.ids);
			for (const id of result.ids) {
				inventoryEvents.emit("packingSlipDeleted", { id });
			}
			return result;
		});
}

const onPackingSlipsChangedProcedure = protectedProcedure.subscription(() => {
	return observable<PackingSlipsChangedEvent>((emit) => {
		const onCreated = (data: Inventory.PackingSlip) => {
			emit.next({ type: "created", data });
		};
		const onUpdated = (data: Inventory.PackingSlip) => {
			emit.next({ type: "updated", data });
		};
		const onDeleted = (data: { id: string }) => {
			emit.next({ type: "deleted", data });
		};

		inventoryEvents.on("packingSlipCreated", onCreated);
		inventoryEvents.on("packingSlipUpdated", onUpdated);
		inventoryEvents.on("packingSlipDeleted", onDeleted);

		return () => {
			inventoryEvents.off("packingSlipCreated", onCreated);
			inventoryEvents.off("packingSlipUpdated", onUpdated);
			inventoryEvents.off("packingSlipDeleted", onDeleted);
		};
	});
});

// ─── QI Parameter Group Procedures ───────────────────────────────────────────

function createListQiParameterGroupsProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure.query(async () => {
		return inventoryService.findAllQiParameterGroups();
	});
}

function createCreateQiParameterGroupProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.createQiParameterGroupSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createQiParameterGroup(input);
		});
}

function createUpdateQiParameterGroupProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.updateQiParameterGroupSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateQiParameterGroup(input);
		});
}

function createDeleteQiParameterGroupProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteQiParameterGroup(input.id);
		});
}

// ─── QI Parameter Procedures ─────────────────────────────────────────────────

function createListQiParametersProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listQiParametersSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllQiParameters(input);
		});
}

function createGetQiParameterByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findQiParameterById(input.id);
		});
}

function createCreateQiParameterProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createQiParameterSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createQiParameter(input);
		});
}

function createUpdateQiParameterProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateQiParameterSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateQiParameter(input);
		});
}

function createDeleteQiParameterProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteQiParameter(input.id);
		});
}

// ─── QI Template Procedures ───────────────────────────────────────────────────

function createListQiTemplatesProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.listQiTemplatesSchema)
		.query(async ({ input }) => {
			return inventoryService.findAllQiTemplates(input);
		});
}

function createGetQiTemplateByIdProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			return inventoryService.findQiTemplateById(input.id);
		});
}

function createCreateQiTemplateProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.createQiTemplateSchema)
		.mutation(async ({ input }) => {
			return inventoryService.createQiTemplate(input);
		});
}

function createUpdateQiTemplateProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(Inventory.updateQiTemplateSchema)
		.mutation(async ({ input }) => {
			return inventoryService.updateQiTemplate(input);
		});
}

function createDeleteQiTemplateProcedure(inventoryService: InventoryService) {
	return protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ input }) => {
			return inventoryService.deleteQiTemplate(input.id);
		});
}

function createDeleteManyQiTemplatesProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure
		.input(Inventory.bulkDeleteQiTemplatesSchema)
		.mutation(async ({ input }) => {
			return inventoryService.deleteManyQiTemplates(input.ids);
		});
}

function createGetDashboardDataProcedure(inventoryService: InventoryService) {
	return protectedProcedure.query(async () => {
		return inventoryService.getDashboardData();
	});
}

function createGetDashboardOverviewDataProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure.query(async () => {
		return inventoryService.getDashboardOverviewData();
	});
}

function createGetDashboardTopChartsDataProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure.query(async () => {
		return inventoryService.getDashboardTopChartsData();
	});
}

function createGetDashboardBottomChartsDataProcedure(
	inventoryService: InventoryService,
) {
	return protectedProcedure.query(async () => {
		return inventoryService.getDashboardBottomChartsData();
	});
}

type InventoryRouterInput = {
	getDashboardData: ReturnType<typeof createGetDashboardDataProcedure>;
	getDashboardOverviewData: ReturnType<
		typeof createGetDashboardOverviewDataProcedure
	>;
	getDashboardTopChartsData: ReturnType<
		typeof createGetDashboardTopChartsDataProcedure
	>;
	getDashboardBottomChartsData: ReturnType<
		typeof createGetDashboardBottomChartsDataProcedure
	>;
	listItems: ReturnType<typeof createListItemsProcedure>;
	listItemCatalogue: ReturnType<typeof createListItemCatalogueProcedure>;
	listItemGroups: ReturnType<typeof createListItemGroupsProcedure>;
	listUnitsOfMeasure: ReturnType<typeof createListUnitsOfMeasureProcedure>;
	listWarehouses: ReturnType<typeof createListWarehousesProcedure>;
	listBatches: ReturnType<typeof createListBatchesProcedure>;
	getBatchById: ReturnType<typeof createGetBatchByIdProcedure>;
	createBatch: ReturnType<typeof createCreateBatchProcedure>;
	updateBatch: ReturnType<typeof createUpdateBatchProcedure>;
	deleteBatch: ReturnType<typeof createDeleteBatchProcedure>;
	listSerialNos: ReturnType<typeof createListSerialNosProcedure>;
	listSerialNoServiceContractExpiry: ReturnType<
		typeof createListSerialNoServiceContractExpiryProcedure
	>;
	listSerialNoWarrantyExpiry: ReturnType<
		typeof createListSerialNoWarrantyExpiryProcedure
	>;
	listSerialNoStatus: ReturnType<typeof createListSerialNoStatusProcedure>;
	getSerialNoById: ReturnType<typeof createGetSerialNoByIdProcedure>;
	createSerialNo: ReturnType<typeof createCreateSerialNoProcedure>;
	updateSerialNo: ReturnType<typeof createUpdateSerialNoProcedure>;
	deleteSerialNo: ReturnType<typeof createDeleteSerialNoProcedure>;
	listInstallationNotes: ReturnType<
		typeof createListInstallationNotesProcedure
	>;
	getInstallationNoteById: ReturnType<
		typeof createGetInstallationNoteByIdProcedure
	>;
	createInstallationNote: ReturnType<
		typeof createCreateInstallationNoteProcedure
	>;
	updateInstallationNote: ReturnType<
		typeof createUpdateInstallationNoteProcedure
	>;
	deleteInstallationNote: ReturnType<
		typeof createDeleteInstallationNoteProcedure
	>;
	getWarehouseById: ReturnType<typeof createGetWarehouseByIdProcedure>;
	createWarehouse: ReturnType<typeof createCreateWarehouseProcedure>;
	updateWarehouse: ReturnType<typeof createUpdateWarehouseProcedure>;
	deleteWarehouse: ReturnType<typeof createDeleteWarehouseProcedure>;
	getStockSettings: ReturnType<typeof createGetStockSettingsProcedure>;
	getItemVariantSettings: ReturnType<
		typeof createGetItemVariantSettingsProcedure
	>;
	updateItemVariantSettings: ReturnType<
		typeof createUpdateItemVariantSettingsProcedure
	>;
	updateStockSettings: ReturnType<typeof createUpdateStockSettingsProcedure>;
	getUnitOfMeasureById: ReturnType<typeof createGetUnitOfMeasureByIdProcedure>;
	createUnitOfMeasure: ReturnType<typeof createCreateUnitOfMeasureProcedure>;
	updateUnitOfMeasure: ReturnType<typeof createUpdateUnitOfMeasureProcedure>;
	deleteUnitOfMeasure: ReturnType<typeof createDeleteUnitOfMeasureProcedure>;
	listBrands: ReturnType<typeof createListBrandsProcedure>;
	getBrandById: ReturnType<typeof createGetBrandByIdProcedure>;
	createBrand: ReturnType<typeof createCreateBrandProcedure>;
	updateBrand: ReturnType<typeof createUpdateBrandProcedure>;
	deleteBrand: ReturnType<typeof createDeleteBrandProcedure>;
	listItemAttributes: ReturnType<typeof createListItemAttributesProcedure>;
	getItemAttributeById: ReturnType<typeof createGetItemAttributeByIdProcedure>;
	createItemAttribute: ReturnType<typeof createCreateItemAttributeProcedure>;
	updateItemAttribute: ReturnType<typeof createUpdateItemAttributeProcedure>;
	deleteItemAttribute: ReturnType<typeof createDeleteItemAttributeProcedure>;
	listBundleItems: ReturnType<typeof createListBundleItemsProcedure>;
	listProductBundles: ReturnType<typeof createListProductBundlesProcedure>;
	getProductBundleById: ReturnType<typeof createGetProductBundleByIdProcedure>;
	createProductBundle: ReturnType<typeof createCreateProductBundleProcedure>;
	updateProductBundle: ReturnType<typeof createUpdateProductBundleProcedure>;
	deleteProductBundle: ReturnType<typeof createDeleteProductBundleProcedure>;
	listShippingRules: ReturnType<typeof createListShippingRulesProcedure>;
	getShippingRuleById: ReturnType<typeof createGetShippingRuleByIdProcedure>;
	createShippingRule: ReturnType<typeof createCreateShippingRuleProcedure>;
	updateShippingRule: ReturnType<typeof createUpdateShippingRuleProcedure>;
	deleteShippingRule: ReturnType<typeof createDeleteShippingRuleProcedure>;
	listItemManufacturers: ReturnType<
		typeof createListItemManufacturersProcedure
	>;
	getItemManufacturerById: ReturnType<
		typeof createGetItemManufacturerByIdProcedure
	>;
	createItemManufacturer: ReturnType<
		typeof createCreateItemManufacturerProcedure
	>;
	updateItemManufacturer: ReturnType<
		typeof createUpdateItemManufacturerProcedure
	>;
	deleteItemManufacturer: ReturnType<
		typeof createDeleteItemManufacturerProcedure
	>;
	listItemActivity: ReturnType<typeof createListItemActivityProcedure>;
	logItemActivity: ReturnType<typeof createLogItemActivityProcedure>;
	listItemAlternatives: ReturnType<typeof createListItemAlternativesProcedure>;
	getItemAlternativeById: ReturnType<
		typeof createGetItemAlternativeByIdProcedure
	>;
	createItemAlternative: ReturnType<
		typeof createCreateItemAlternativeProcedure
	>;
	updateItemAlternative: ReturnType<
		typeof createUpdateItemAlternativeProcedure
	>;
	deleteItemAlternative: ReturnType<
		typeof createDeleteItemAlternativeProcedure
	>;
	createItem: ReturnType<typeof createCreateItemProcedure>;
	updateItem: ReturnType<typeof createUpdateItemProcedure>;
	deleteItem: ReturnType<typeof createDeleteItemProcedure>;
	deleteItems: ReturnType<typeof createBulkDeleteItemsProcedure>;
	createItemGroup: ReturnType<typeof createCreateItemGroupProcedure>;
	updateItemGroup: ReturnType<typeof createUpdateItemGroupProcedure>;
	deleteItemGroup: ReturnType<typeof createDeleteItemGroupProcedure>;
	onItemGroupsChanged: typeof onItemGroupsChangedProcedure;
	onItemCreated: typeof onItemCreatedProcedure;
	onItemUpdated: typeof onItemUpdatedProcedure;
	onItemDeleted: typeof onItemDeletedProcedure;
	onItemsChanged: typeof onItemsChangedProcedure;
	onBatchesChanged: typeof onBatchesChangedProcedure;
	onSerialNosChanged: typeof onSerialNosChangedProcedure;
	onInstallationNotesChanged: typeof onInstallationNotesChangedProcedure;
	listMaterialRequests: ReturnType<typeof createListMaterialRequestsProcedure>;
	getMaterialRequestById: ReturnType<
		typeof createGetMaterialRequestByIdProcedure
	>;
	createMaterialRequest: ReturnType<
		typeof createCreateMaterialRequestProcedure
	>;
	updateMaterialRequest: ReturnType<
		typeof createUpdateMaterialRequestProcedure
	>;
	deleteMaterialRequest: ReturnType<
		typeof createDeleteMaterialRequestProcedure
	>;
	deleteManyMaterialRequests: ReturnType<
		typeof createDeleteManyMaterialRequestsProcedure
	>;
	onMaterialRequestsChanged: typeof onMaterialRequestsChangedProcedure;
	listStockEntries: ReturnType<typeof createListStockEntriesProcedure>;
	getStockEntryById: ReturnType<typeof createGetStockEntryByIdProcedure>;
	createStockEntry: ReturnType<typeof createCreateStockEntryProcedure>;
	updateStockEntry: ReturnType<typeof createUpdateStockEntryProcedure>;
	deleteStockEntry: ReturnType<typeof createDeleteStockEntryProcedure>;
	deleteManyStockEntries: ReturnType<
		typeof createDeleteManyStockEntriesProcedure
	>;
	onStockEntriesChanged: typeof onStockEntriesChangedProcedure;
	listStockLedger: ReturnType<typeof createListStockLedgerProcedure>;
	exportStockLedgerExcel: ReturnType<
		typeof createExportStockLedgerExcelProcedure
	>;
	listStockBalance: ReturnType<typeof createListStockBalanceProcedure>;
	getQuickStockBalance: ReturnType<typeof createGetQuickStockBalanceProcedure>;
	listStockProjectedQty: ReturnType<
		typeof createListStockProjectedQtyProcedure
	>;
	listItemShortageReport: ReturnType<
		typeof createListItemShortageReportProcedure
	>;
	listRequestedItemsToBeTransferred: ReturnType<
		typeof createListRequestedItemsToBeTransferredProcedure
	>;
	listSubcontractedRawMaterials: ReturnType<
		typeof createListSubcontractedRawMaterialsProcedure
	>;
	listSubcontractedItemToBeReceived: ReturnType<
		typeof createListSubcontractedItemToBeReceivedProcedure
	>;
	listBatchWiseBalance: ReturnType<typeof createListBatchWiseBalanceProcedure>;
	listBatchItemExpiry: ReturnType<typeof createListBatchItemExpiryProcedure>;
	listItemPrices: ReturnType<typeof createListItemPricesProcedure>;
	listItemwiseRecommendedReorderLevel: ReturnType<
		typeof createListItemwiseRecommendedReorderLevelProcedure
	>;
	listItemVariantDetails: ReturnType<
		typeof createListItemVariantDetailsProcedure
	>;
	listStockSummary: ReturnType<typeof createListStockSummaryProcedure>;
	listStockAgeing: ReturnType<typeof createListStockAgeingProcedure>;
	listItemPriceStock: ReturnType<typeof createListItemPriceStockProcedure>;
	listWarehouseWiseStockBalance: ReturnType<
		typeof createListWarehouseWiseStockBalanceProcedure
	>;
	listStockAnalytics: ReturnType<typeof createListStockAnalyticsProcedure>;
	listDeliveryNoteTrends: ReturnType<
		typeof createListDeliveryNoteTrendsProcedure
	>;
	listPurchaseReceiptTrends: ReturnType<
		typeof createListPurchaseReceiptTrendsProcedure
	>;
	listSalesOrderAnalysis: ReturnType<
		typeof createListSalesOrderAnalysisProcedure
	>;
	listPurchaseOrderAnalysis: ReturnType<
		typeof createListPurchaseOrderAnalysisProcedure
	>;
	listDeliveryNotes: ReturnType<typeof createListDeliveryNotesProcedure>;
	getDeliveryNoteById: ReturnType<typeof createGetDeliveryNoteByIdProcedure>;
	createDeliveryNote: ReturnType<typeof createCreateDeliveryNoteProcedure>;
	updateDeliveryNote: ReturnType<typeof createUpdateDeliveryNoteProcedure>;
	deleteDeliveryNote: ReturnType<typeof createDeleteDeliveryNoteProcedure>;
	deleteManyDeliveryNotes: ReturnType<
		typeof createDeleteManyDeliveryNotesProcedure
	>;
	onDeliveryNotesChanged: typeof onDeliveryNotesChangedProcedure;
	listPurchaseReceipts: ReturnType<typeof createListPurchaseReceiptsProcedure>;
	getPurchaseReceiptById: ReturnType<
		typeof createGetPurchaseReceiptByIdProcedure
	>;
	createPurchaseReceipt: ReturnType<
		typeof createCreatePurchaseReceiptProcedure
	>;
	updatePurchaseReceipt: ReturnType<
		typeof createUpdatePurchaseReceiptProcedure
	>;
	deletePurchaseReceipt: ReturnType<
		typeof createDeletePurchaseReceiptProcedure
	>;
	deleteManyPurchaseReceipts: ReturnType<
		typeof createDeleteManyPurchaseReceiptsProcedure
	>;
	onPurchaseReceiptsChanged: typeof onPurchaseReceiptsChangedProcedure;
	listPickLists: ReturnType<typeof createListPickListsProcedure>;
	getPickListById: ReturnType<typeof createGetPickListByIdProcedure>;
	createPickList: ReturnType<typeof createCreatePickListProcedure>;
	updatePickList: ReturnType<typeof createUpdatePickListProcedure>;
	deletePickList: ReturnType<typeof createDeletePickListProcedure>;
	deleteManyPickLists: ReturnType<typeof createDeleteManyPickListsProcedure>;
	onPickListsChanged: typeof onPickListsChangedProcedure;
	listDeliveryTrips: ReturnType<typeof createListDeliveryTripsProcedure>;
	getDeliveryTripById: ReturnType<typeof createGetDeliveryTripByIdProcedure>;
	createDeliveryTrip: ReturnType<typeof createCreateDeliveryTripProcedure>;
	updateDeliveryTrip: ReturnType<typeof createUpdateDeliveryTripProcedure>;
	deleteDeliveryTrip: ReturnType<typeof createDeleteDeliveryTripProcedure>;
	deleteManyDeliveryTrips: ReturnType<
		typeof createDeleteManyDeliveryTripsProcedure
	>;
	onDeliveryTripsChanged: typeof onDeliveryTripsChangedProcedure;
	listPackingSlips: ReturnType<typeof createListPackingSlipsProcedure>;
	getPackingSlipById: ReturnType<typeof createGetPackingSlipByIdProcedure>;
	getRecommendedCaseNo: ReturnType<typeof createGetRecommendedCaseNoProcedure>;
	createPackingSlip: ReturnType<typeof createCreatePackingSlipProcedure>;
	updatePackingSlip: ReturnType<typeof createUpdatePackingSlipProcedure>;
	submitPackingSlip: ReturnType<typeof createSubmitPackingSlipProcedure>;
	cancelPackingSlip: ReturnType<typeof createCancelPackingSlipProcedure>;
	deletePackingSlip: ReturnType<typeof createDeletePackingSlipProcedure>;
	deleteManyPackingSlips: ReturnType<
		typeof createDeleteManyPackingSlipsProcedure
	>;
	onPackingSlipsChanged: typeof onPackingSlipsChangedProcedure;
	listQiParameterGroups: ReturnType<
		typeof createListQiParameterGroupsProcedure
	>;
	createQiParameterGroup: ReturnType<
		typeof createCreateQiParameterGroupProcedure
	>;
	updateQiParameterGroup: ReturnType<
		typeof createUpdateQiParameterGroupProcedure
	>;
	deleteQiParameterGroup: ReturnType<
		typeof createDeleteQiParameterGroupProcedure
	>;
	listQiParameters: ReturnType<typeof createListQiParametersProcedure>;
	getQiParameterById: ReturnType<typeof createGetQiParameterByIdProcedure>;
	createQiParameter: ReturnType<typeof createCreateQiParameterProcedure>;
	updateQiParameter: ReturnType<typeof createUpdateQiParameterProcedure>;
	deleteQiParameter: ReturnType<typeof createDeleteQiParameterProcedure>;
	listQiTemplates: ReturnType<typeof createListQiTemplatesProcedure>;
	getQiTemplateById: ReturnType<typeof createGetQiTemplateByIdProcedure>;
	createQiTemplate: ReturnType<typeof createCreateQiTemplateProcedure>;
	updateQiTemplate: ReturnType<typeof createUpdateQiTemplateProcedure>;
	deleteQiTemplate: ReturnType<typeof createDeleteQiTemplateProcedure>;
	deleteManyQiTemplates: ReturnType<
		typeof createDeleteManyQiTemplatesProcedure
	>;
};

type InventoryRouterRoot = (typeof accountRouter)["_def"]["_config"]["$types"];
type InventoryRouterRecord =
	TRPCDecorateCreateRouterOptions<InventoryRouterInput>;
type InventoryAppRouter = TRPCBuiltRouter<
	InventoryRouterRoot,
	InventoryRouterRecord
>;

function createInventoryRouterRecord(
	inventoryService: InventoryService,
	prisma: PrismaService,
	reportTemplateService: ReportTemplateService,
): InventoryRouterInput {
	return {
		getDashboardData: createGetDashboardDataProcedure(inventoryService),
		getDashboardOverviewData:
			createGetDashboardOverviewDataProcedure(inventoryService),
		getDashboardTopChartsData:
			createGetDashboardTopChartsDataProcedure(inventoryService),
		getDashboardBottomChartsData:
			createGetDashboardBottomChartsDataProcedure(inventoryService),
		listItems: createListItemsProcedure(inventoryService),
		listItemCatalogue: createListItemCatalogueProcedure(inventoryService),
		listItemGroups: createListItemGroupsProcedure(inventoryService),
		listUnitsOfMeasure: createListUnitsOfMeasureProcedure(inventoryService),
		listWarehouses: createListWarehousesProcedure(inventoryService),
		listBatches: createListBatchesProcedure(inventoryService),
		getBatchById: createGetBatchByIdProcedure(inventoryService),
		createBatch: createCreateBatchProcedure(inventoryService),
		updateBatch: createUpdateBatchProcedure(inventoryService),
		deleteBatch: createDeleteBatchProcedure(inventoryService),
		listSerialNos: createListSerialNosProcedure(inventoryService),
		listSerialNoServiceContractExpiry:
			createListSerialNoServiceContractExpiryProcedure(inventoryService),
		listSerialNoWarrantyExpiry:
			createListSerialNoWarrantyExpiryProcedure(inventoryService),
		listSerialNoStatus: createListSerialNoStatusProcedure(inventoryService),
		getSerialNoById: createGetSerialNoByIdProcedure(inventoryService),
		createSerialNo: createCreateSerialNoProcedure(inventoryService),
		updateSerialNo: createUpdateSerialNoProcedure(inventoryService),
		deleteSerialNo: createDeleteSerialNoProcedure(inventoryService),
		listInstallationNotes:
			createListInstallationNotesProcedure(inventoryService),
		getInstallationNoteById:
			createGetInstallationNoteByIdProcedure(inventoryService),
		createInstallationNote:
			createCreateInstallationNoteProcedure(inventoryService),
		updateInstallationNote:
			createUpdateInstallationNoteProcedure(inventoryService),
		deleteInstallationNote:
			createDeleteInstallationNoteProcedure(inventoryService),
		getWarehouseById: createGetWarehouseByIdProcedure(inventoryService),
		createWarehouse: createCreateWarehouseProcedure(inventoryService),
		updateWarehouse: createUpdateWarehouseProcedure(inventoryService),
		deleteWarehouse: createDeleteWarehouseProcedure(inventoryService),
		getStockSettings: createGetStockSettingsProcedure(inventoryService),
		getItemVariantSettings:
			createGetItemVariantSettingsProcedure(inventoryService),
		updateItemVariantSettings:
			createUpdateItemVariantSettingsProcedure(inventoryService),
		updateStockSettings: createUpdateStockSettingsProcedure(inventoryService),
		getUnitOfMeasureById: createGetUnitOfMeasureByIdProcedure(inventoryService),
		createUnitOfMeasure: createCreateUnitOfMeasureProcedure(inventoryService),
		updateUnitOfMeasure: createUpdateUnitOfMeasureProcedure(inventoryService),
		deleteUnitOfMeasure: createDeleteUnitOfMeasureProcedure(inventoryService),
		listBrands: createListBrandsProcedure(inventoryService),
		getBrandById: createGetBrandByIdProcedure(inventoryService),
		createBrand: createCreateBrandProcedure(inventoryService),
		updateBrand: createUpdateBrandProcedure(inventoryService),
		deleteBrand: createDeleteBrandProcedure(inventoryService),
		listItemAttributes: createListItemAttributesProcedure(inventoryService),
		getItemAttributeById: createGetItemAttributeByIdProcedure(inventoryService),
		createItemAttribute: createCreateItemAttributeProcedure(inventoryService),
		updateItemAttribute: createUpdateItemAttributeProcedure(inventoryService),
		deleteItemAttribute: createDeleteItemAttributeProcedure(inventoryService),
		listBundleItems: createListBundleItemsProcedure(inventoryService),
		listProductBundles: createListProductBundlesProcedure(inventoryService),
		getProductBundleById: createGetProductBundleByIdProcedure(inventoryService),
		createProductBundle: createCreateProductBundleProcedure(inventoryService),
		updateProductBundle: createUpdateProductBundleProcedure(inventoryService),
		deleteProductBundle: createDeleteProductBundleProcedure(inventoryService),
		listShippingRules: createListShippingRulesProcedure(inventoryService),
		getShippingRuleById: createGetShippingRuleByIdProcedure(inventoryService),
		createShippingRule: createCreateShippingRuleProcedure(inventoryService),
		updateShippingRule: createUpdateShippingRuleProcedure(inventoryService),
		deleteShippingRule: createDeleteShippingRuleProcedure(inventoryService),
		listItemManufacturers:
			createListItemManufacturersProcedure(inventoryService),
		getItemManufacturerById:
			createGetItemManufacturerByIdProcedure(inventoryService),
		createItemManufacturer:
			createCreateItemManufacturerProcedure(inventoryService),
		updateItemManufacturer:
			createUpdateItemManufacturerProcedure(inventoryService),
		deleteItemManufacturer:
			createDeleteItemManufacturerProcedure(inventoryService),
		listItemActivity: createListItemActivityProcedure(prisma),
		logItemActivity: createLogItemActivityProcedure(prisma),
		listItemAlternatives: createListItemAlternativesProcedure(inventoryService),
		getItemAlternativeById:
			createGetItemAlternativeByIdProcedure(inventoryService),
		createItemAlternative:
			createCreateItemAlternativeProcedure(inventoryService),
		updateItemAlternative:
			createUpdateItemAlternativeProcedure(inventoryService),
		deleteItemAlternative:
			createDeleteItemAlternativeProcedure(inventoryService),
		createItem: createCreateItemProcedure(inventoryService),
		updateItem: createUpdateItemProcedure(inventoryService),
		deleteItem: createDeleteItemProcedure(inventoryService),
		deleteItems: createBulkDeleteItemsProcedure(inventoryService),
		createItemGroup: createCreateItemGroupProcedure(inventoryService),
		updateItemGroup: createUpdateItemGroupProcedure(inventoryService),
		deleteItemGroup: createDeleteItemGroupProcedure(inventoryService),
		onItemGroupsChanged: onItemGroupsChangedProcedure,
		onItemCreated: onItemCreatedProcedure,
		onItemUpdated: onItemUpdatedProcedure,
		onItemDeleted: onItemDeletedProcedure,
		onItemsChanged: onItemsChangedProcedure,
		onBatchesChanged: onBatchesChangedProcedure,
		onSerialNosChanged: onSerialNosChangedProcedure,
		onInstallationNotesChanged: onInstallationNotesChangedProcedure,
		listMaterialRequests: createListMaterialRequestsProcedure(inventoryService),
		getMaterialRequestById:
			createGetMaterialRequestByIdProcedure(inventoryService),
		createMaterialRequest:
			createCreateMaterialRequestProcedure(inventoryService),
		updateMaterialRequest:
			createUpdateMaterialRequestProcedure(inventoryService),
		deleteMaterialRequest:
			createDeleteMaterialRequestProcedure(inventoryService),
		deleteManyMaterialRequests:
			createDeleteManyMaterialRequestsProcedure(inventoryService),
		onMaterialRequestsChanged: onMaterialRequestsChangedProcedure,
		listStockEntries: createListStockEntriesProcedure(inventoryService),
		getStockEntryById: createGetStockEntryByIdProcedure(inventoryService),
		createStockEntry: createCreateStockEntryProcedure(inventoryService),
		updateStockEntry: createUpdateStockEntryProcedure(inventoryService),
		deleteStockEntry: createDeleteStockEntryProcedure(inventoryService),
		deleteManyStockEntries:
			createDeleteManyStockEntriesProcedure(inventoryService),
		onStockEntriesChanged: onStockEntriesChangedProcedure,
		listStockLedger: createListStockLedgerProcedure(inventoryService),
		exportStockLedgerExcel: createExportStockLedgerExcelProcedure(
			inventoryService,
			reportTemplateService,
		),
		listStockBalance: createListStockBalanceProcedure(inventoryService),
		getQuickStockBalance: createGetQuickStockBalanceProcedure(inventoryService),
		listStockProjectedQty:
			createListStockProjectedQtyProcedure(inventoryService),
		listItemShortageReport:
			createListItemShortageReportProcedure(inventoryService),
		listRequestedItemsToBeTransferred:
			createListRequestedItemsToBeTransferredProcedure(inventoryService),
		listSubcontractedRawMaterials:
			createListSubcontractedRawMaterialsProcedure(inventoryService),
		listSubcontractedItemToBeReceived:
			createListSubcontractedItemToBeReceivedProcedure(inventoryService),
		listBatchWiseBalance: createListBatchWiseBalanceProcedure(inventoryService),
		listBatchItemExpiry: createListBatchItemExpiryProcedure(inventoryService),
		listItemPrices: createListItemPricesProcedure(inventoryService),
		listItemwiseRecommendedReorderLevel:
			createListItemwiseRecommendedReorderLevelProcedure(inventoryService),
		listItemVariantDetails:
			createListItemVariantDetailsProcedure(inventoryService),
		listStockSummary: createListStockSummaryProcedure(inventoryService),
		listStockAgeing: createListStockAgeingProcedure(inventoryService),
		listItemPriceStock: createListItemPriceStockProcedure(inventoryService),
		listWarehouseWiseStockBalance:
			createListWarehouseWiseStockBalanceProcedure(inventoryService),
		listStockAnalytics: createListStockAnalyticsProcedure(inventoryService),
		listDeliveryNoteTrends:
			createListDeliveryNoteTrendsProcedure(inventoryService),
		listPurchaseReceiptTrends:
			createListPurchaseReceiptTrendsProcedure(inventoryService),
		listSalesOrderAnalysis:
			createListSalesOrderAnalysisProcedure(inventoryService),
		listPurchaseOrderAnalysis:
			createListPurchaseOrderAnalysisProcedure(inventoryService),
		listDeliveryNotes: createListDeliveryNotesProcedure(inventoryService),
		getDeliveryNoteById: createGetDeliveryNoteByIdProcedure(inventoryService),
		createDeliveryNote: createCreateDeliveryNoteProcedure(inventoryService),
		updateDeliveryNote: createUpdateDeliveryNoteProcedure(inventoryService),
		deleteDeliveryNote: createDeleteDeliveryNoteProcedure(inventoryService),
		deleteManyDeliveryNotes:
			createDeleteManyDeliveryNotesProcedure(inventoryService),
		onDeliveryNotesChanged: onDeliveryNotesChangedProcedure,
		listPurchaseReceipts: createListPurchaseReceiptsProcedure(inventoryService),
		getPurchaseReceiptById:
			createGetPurchaseReceiptByIdProcedure(inventoryService),
		createPurchaseReceipt:
			createCreatePurchaseReceiptProcedure(inventoryService),
		updatePurchaseReceipt:
			createUpdatePurchaseReceiptProcedure(inventoryService),
		deletePurchaseReceipt:
			createDeletePurchaseReceiptProcedure(inventoryService),
		deleteManyPurchaseReceipts:
			createDeleteManyPurchaseReceiptsProcedure(inventoryService),
		onPurchaseReceiptsChanged: onPurchaseReceiptsChangedProcedure,
		listPickLists: createListPickListsProcedure(inventoryService),
		getPickListById: createGetPickListByIdProcedure(inventoryService),
		createPickList: createCreatePickListProcedure(inventoryService),
		updatePickList: createUpdatePickListProcedure(inventoryService),
		deletePickList: createDeletePickListProcedure(inventoryService),
		deleteManyPickLists: createDeleteManyPickListsProcedure(inventoryService),
		onPickListsChanged: onPickListsChangedProcedure,
		listDeliveryTrips: createListDeliveryTripsProcedure(inventoryService),
		getDeliveryTripById: createGetDeliveryTripByIdProcedure(inventoryService),
		createDeliveryTrip: createCreateDeliveryTripProcedure(inventoryService),
		updateDeliveryTrip: createUpdateDeliveryTripProcedure(inventoryService),
		deleteDeliveryTrip: createDeleteDeliveryTripProcedure(inventoryService),
		deleteManyDeliveryTrips:
			createDeleteManyDeliveryTripsProcedure(inventoryService),
		onDeliveryTripsChanged: onDeliveryTripsChangedProcedure,
		listPackingSlips: createListPackingSlipsProcedure(inventoryService),
		getPackingSlipById: createGetPackingSlipByIdProcedure(inventoryService),
		getRecommendedCaseNo: createGetRecommendedCaseNoProcedure(inventoryService),
		createPackingSlip: createCreatePackingSlipProcedure(inventoryService),
		updatePackingSlip: createUpdatePackingSlipProcedure(inventoryService),
		submitPackingSlip: createSubmitPackingSlipProcedure(inventoryService),
		cancelPackingSlip: createCancelPackingSlipProcedure(inventoryService),
		deletePackingSlip: createDeletePackingSlipProcedure(inventoryService),
		deleteManyPackingSlips:
			createDeleteManyPackingSlipsProcedure(inventoryService),
		onPackingSlipsChanged: onPackingSlipsChangedProcedure,
		listQiParameterGroups:
			createListQiParameterGroupsProcedure(inventoryService),
		createQiParameterGroup:
			createCreateQiParameterGroupProcedure(inventoryService),
		updateQiParameterGroup:
			createUpdateQiParameterGroupProcedure(inventoryService),
		deleteQiParameterGroup:
			createDeleteQiParameterGroupProcedure(inventoryService),
		listQiParameters: createListQiParametersProcedure(inventoryService),
		getQiParameterById: createGetQiParameterByIdProcedure(inventoryService),
		createQiParameter: createCreateQiParameterProcedure(inventoryService),
		updateQiParameter: createUpdateQiParameterProcedure(inventoryService),
		deleteQiParameter: createDeleteQiParameterProcedure(inventoryService),
		listQiTemplates: createListQiTemplatesProcedure(inventoryService),
		getQiTemplateById: createGetQiTemplateByIdProcedure(inventoryService),
		createQiTemplate: createCreateQiTemplateProcedure(inventoryService),
		updateQiTemplate: createUpdateQiTemplateProcedure(inventoryService),
		deleteQiTemplate: createDeleteQiTemplateProcedure(inventoryService),
		deleteManyQiTemplates:
			createDeleteManyQiTemplatesProcedure(inventoryService),
	};
}

function buildInventoryRouter(
	inventoryService: InventoryService,
): InventoryAppRouter {
	const reportTemplateService = new ReportTemplateService();
	return router(
		createInventoryRouterRecord(
			inventoryService,
			inventoryService.prisma,
			reportTemplateService,
		),
	);
}

@Injectable()
export class InventoryRouter {
	constructor(private readonly inventoryService: InventoryService) {}

	getRouter(): InventoryAppRouter {
		return buildInventoryRouter(this.inventoryService);
	}
}
