/**
 * Demo Data — Cleanup
 *
 * Deletes all demo data in reverse dependency order to avoid FK violations.
 * Uses the company name from config to scope the deletion (won't touch
 * records belonging to other companies). Settings singletons are deleted
 * unconditionally since they're shared.
 */

import type { PrismaService } from "../../src/shared/prisma.service.js";
import { ASSET_CATEGORIES, ASSET_LOCATIONS } from "./asset-data.js";
import type { DemoConfig } from "./config.js";

const DEMO_ASSET_CATEGORY_NAMES = ASSET_CATEGORIES.map(
	(category) => category.name,
);

function flattenAssetLocationNames(
	locations: typeof ASSET_LOCATIONS,
): string[] {
	return locations.flatMap((location) => [
		location.name,
		...(location.children ? flattenAssetLocationNames(location.children) : []),
	]);
}

const DEMO_ASSET_LOCATION_NAMES = flattenAssetLocationNames(ASSET_LOCATIONS);

/**
 * Remove all demo data. Returns a summary of deleted record counts.
 */
export async function cleanDemoData(
	prisma: PrismaService,
	config: DemoConfig,
): Promise<Record<string, number>> {
	const company = config.company;
	const counts: Record<string, number> = {};

	// Helper: delete by company filter and record count
	async function del(label: string, fn: () => Promise<{ count: number }>) {
		const result = await fn();
		counts[label] = result.count;
	}

	// ── Transaction-level (children auto-cascade via onDelete) ────

	await del("SubcontractingOrder", () =>
		prisma.subcontractingOrder.deleteMany({ where: { company } }),
	);

	// ── Asset Management transaction-level ──────────────────────

	await del("AssetMaintenance", () =>
		prisma.assetMaintenance.deleteMany({ where: { company } }),
	);

	await del("AssetMaintenanceTeam", () =>
		prisma.assetMaintenanceTeam.deleteMany({ where: { company } }),
	);

	await del("AssetValueAdjustment", () =>
		prisma.assetValueAdjustment.deleteMany({
			where: { companySnapshot: company },
		}),
	);

	await del("AssetActivity", () =>
		prisma.assetActivity.deleteMany({ where: { asset: { company } } }),
	);

	await del("Asset", () => prisma.asset.deleteMany({ where: { company } }));

	await del("AssetCategory", () =>
		prisma.assetCategory.deleteMany({
			where: { name: { in: DEMO_ASSET_CATEGORY_NAMES } },
		}),
	);

	await del("Location", () =>
		prisma.location.deleteMany({
			where: { name: { in: DEMO_ASSET_LOCATION_NAMES } },
		}),
	);

	await del("InstallationNote", () =>
		prisma.installationNote.deleteMany({ where: { company } }),
	);

	await del("DeliveryTrip", () =>
		prisma.deliveryTrip.deleteMany({ where: { company } }),
	);

	// PackingSlips linked to DeliveryNotes — delete via DN
	await del("PackingSlip", () =>
		prisma.packingSlip.deleteMany({
			where: { deliveryNote: { company } },
		}),
	);

	await del("PickList", () =>
		prisma.pickList.deleteMany({ where: { company } }),
	);

	await del("InstallationNoteItem", () =>
		prisma.installationNoteItem.deleteMany({}),
	);

	await del("SerialNoHistory", () =>
		prisma.serialNoHistory.deleteMany({
			where: { serialNo: { company } },
		}),
	);

	await del("SerialNo", () =>
		prisma.serialNo.deleteMany({ where: { company } }),
	);

	await del("Batch", () => prisma.batch.deleteMany({ where: { company } }));

	await del("DeliveryNote", () =>
		prisma.deliveryNote.deleteMany({ where: { company } }),
	);

	await del("SalesOrder", () =>
		prisma.salesOrder.deleteMany({ where: { company } }),
	);

	await del("MaterialRequest", () =>
		prisma.materialRequest.deleteMany({ where: { company } }),
	);

	await del("StockEntry", () =>
		prisma.stockEntry.deleteMany({ where: { company } }),
	);

	await del("PurchaseReceipt", () =>
		prisma.purchaseReceipt.deleteMany({ where: { company } }),
	);

	await del("PurchaseOrder", () =>
		prisma.purchaseOrder.deleteMany({ where: { company } }),
	);

	// ── Master data ──────────────────────────────────────────────

	// Warehouses (children cascade)
	await del("Warehouse", () =>
		prisma.warehouse.deleteMany({ where: { company } }),
	);

	// QI Templates (cascade items)
	await del("QiTemplate", () => prisma.qiTemplate.deleteMany({}));

	await del("QiParameter", () => prisma.qiParameter.deleteMany({}));

	await del("QiParameterGroup", () => prisma.qiParameterGroup.deleteMany({}));

	// Shipping rules
	await del("ShippingRule", () => prisma.shippingRule.deleteMany({}));

	// Product bundles and related children must be deleted in dependency order.
	await del("ProductBundleItem", () => prisma.productBundleItem.deleteMany({}));
	await del("ProductBundle", () => prisma.productBundle.deleteMany({}));

	await del("ItemAlternate", () => prisma.itemAlternate.deleteMany({}));

	await del("ItemManufacturer", () => prisma.itemManufacturer.deleteMany({}));

	await del("Item", () => prisma.item.deleteMany({}));

	// Inventory items and their direct state must be deleted in dependency order.
	// InventoryItem is not company-scoped, so remove all batches and serials first.
	await del("Batch", () => prisma.batch.deleteMany({}));
	await del("SerialNo", () => prisma.serialNo.deleteMany({}));
	await del("InventoryItem", () => prisma.inventoryItem.deleteMany({}));

	// Item attributes & values (cascade)
	await del("ItemAttribute", () => prisma.itemAttribute.deleteMany({}));

	// Item groups (self-referencing — delete leaves first, then parents)
	// Delete in two passes: non-group then group
	await del("ItemGroup(leaves)", () =>
		prisma.itemGroup.deleteMany({ where: { isGroup: false } }),
	);
	await del("ItemGroup(parents)", () => prisma.itemGroup.deleteMany({}));

	await del("Brand", () => prisma.brand.deleteMany({}));

	// Settings singletons
	await del("StockSettings", () => prisma.stockSettings.deleteMany({}));

	await del("ItemVariantSettings", () =>
		prisma.itemVariantSettings.deleteMany({}),
	);

	return counts;
}

/**
 * Return a quick status summary of demo-relevant record counts.
 */
export async function getDemoStatus(
	prisma: PrismaService,
	config: DemoConfig,
): Promise<Record<string, number>> {
	const company = config.company;

	const [
		brands,
		itemGroups,
		items,
		inventoryItems,
		warehouses,
		purchaseOrders,
		purchaseReceipts,
		stockEntries,
		salesOrders,
		materialRequests,
		deliveryNotes,
		batches,
		serialNos,
		pickLists,
		packingSlips,
		deliveryTrips,
		installationNotes,
		subcontractingOrders,
		assetLocations,
		assetCategories,
		assets,
		assetActivities,
		assetValueAdjustments,
		assetRevaluationEntries,
		assetDepreciationSchedules,
		assetMaintenanceTeams,
		assetMaintenances,
		assetMaintenanceLogs,
	] = await Promise.all([
		prisma.brand.count(),
		prisma.itemGroup.count(),
		prisma.item.count(),
		prisma.inventoryItem.count(),
		prisma.warehouse.count({ where: { company } }),
		prisma.purchaseOrder.count({ where: { company } }),
		prisma.purchaseReceipt.count({ where: { company } }),
		prisma.stockEntry.count({ where: { company } }),
		prisma.salesOrder.count({ where: { company } }),
		prisma.materialRequest.count({ where: { company } }),
		prisma.deliveryNote.count({ where: { company } }),
		prisma.batch.count({ where: { company } }),
		prisma.serialNo.count({ where: { company } }),
		prisma.pickList.count({ where: { company } }),
		prisma.packingSlip.count(),
		prisma.deliveryTrip.count({ where: { company } }),
		prisma.installationNote.count({ where: { company } }),
		prisma.subcontractingOrder.count({ where: { company } }),
		prisma.location.count({
			where: { name: { in: DEMO_ASSET_LOCATION_NAMES } },
		}),
		prisma.assetCategory.count({
			where: { name: { in: DEMO_ASSET_CATEGORY_NAMES } },
		}),
		prisma.asset.count({ where: { company } }),
		prisma.assetActivity.count({ where: { asset: { company } } }),
		prisma.assetValueAdjustment.count({ where: { companySnapshot: company } }),
		prisma.assetRevaluationEntry.count({ where: { company } }),
		prisma.assetDepreciationSchedule.count({ where: { asset: { company } } }),
		prisma.assetMaintenanceTeam.count({ where: { company } }),
		prisma.assetMaintenance.count({ where: { company } }),
		prisma.assetMaintenanceLog.count({ where: { maintenance: { company } } }),
	]);

	return {
		brands,
		itemGroups,
		items,
		inventoryItems,
		warehouses,
		purchaseOrders,
		purchaseReceipts,
		stockEntries,
		salesOrders,
		materialRequests,
		deliveryNotes,
		batches,
		serialNos,
		pickLists,
		packingSlips,
		deliveryTrips,
		installationNotes,
		subcontractingOrders,
		assetLocations,
		assetCategories,
		assets,
		assetActivities,
		assetValueAdjustments,
		assetRevaluationEntries,
		assetDepreciationSchedules,
		assetMaintenanceTeams,
		assetMaintenances,
		assetMaintenanceLogs,
	};
}
