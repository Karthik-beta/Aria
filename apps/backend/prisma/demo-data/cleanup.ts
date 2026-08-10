/**
 * Demo Data — Cleanup
 *
 * Deletes demo-owned data in reverse dependency order to avoid FK violations.
 * Company-scoped documents use the configured company; shared reference tables
 * are restricted to deterministic demo identifiers and are only reachable
 * after the CLI safety gate confirms an isolated disposable database.
 */

import { buildIndianFiscalYears } from "../../src/apps/asset/depreciation/demo-data.utils.js";
import type { Prisma } from "../../src/generated/prisma/client.js";
import type { PrismaService } from "../../src/shared/prisma.service.js";
import { ASSET_CATEGORIES, ASSET_LOCATIONS } from "./asset-data.js";
import type { DemoConfig } from "./config.js";
import {
	BRANDS,
	ITEM_ATTRIBUTES,
	ITEM_GROUPS,
	ITEMS,
	QI_TEMPLATES,
	SHIPPING_RULES,
} from "./data.js";
import {
	assertDemoMutationSafety,
	type DemoMutationSafetyOptions,
} from "./safety.js";

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

const DEMO_ITEM_CODES = ITEMS.map((item) => item.code);
const DEMO_BRAND_NAMES = BRANDS.map((brand) => brand.name);
const DEMO_ITEM_ATTRIBUTE_NAMES = ITEM_ATTRIBUTES.map(
	(attribute) => attribute.name,
);
const DEMO_ITEM_GROUP_NAMES = (function flattenItemGroupNames(
	groups: typeof ITEM_GROUPS,
): string[] {
	return groups.flatMap((group) => [
		group.name,
		...(group.children ? flattenItemGroupNames(group.children) : []),
	]);
})(ITEM_GROUPS);
const DEMO_QI_TEMPLATE_NAMES = QI_TEMPLATES.map((template) => template.name);
const DEMO_QI_PARAMETER_NAMES = QI_TEMPLATES.flatMap((template) =>
	template.parameters.map((parameter) => parameter.name),
);
const DEMO_QI_PARAMETER_GROUP_NAMES = QI_TEMPLATES.flatMap((template) =>
	template.parameters.map((parameter) => parameter.group),
);
const DEMO_SHIPPING_RULE_LABELS = SHIPPING_RULES.map((rule) => rule.label);

/**
 * Remove all demo data. Returns a summary of deleted record counts.
 */
export async function cleanDemoData(
	prisma: PrismaService,
	config: DemoConfig,
	safety?: DemoMutationSafetyOptions,
): Promise<Record<string, number>> {
	assertDemoMutationSafety("clean", safety);
	const company = config.company;
	const counts: Record<string, number> = {};

	// Helper: delete by company filter and record count
	async function del(label: string, fn: () => Promise<{ count: number }>) {
		const result = await fn();
		counts[label] = result.count;
	}

	async function delUntilStable(
		label: string,
		fn: () => Promise<{ count: number }>,
	): Promise<void> {
		let total = 0;
		for (;;) {
			const result = await fn();
			total += result.count;
			if (result.count === 0) break;
		}
		counts[label] = total;
	}

	// ── Transaction-level (children auto-cascade via onDelete) ────

	await del("SubcontractingOrder", () =>
		prisma.subcontractingOrder.deleteMany({ where: { company } }),
	);

	// ── Asset Management transaction-level ──────────────────────
	// Lifecycle documents must be removed before their asset, stock-entry, and
	// accounting-entry parents. Their owned line items cascade from the document.
	await del("AssetMovement", () =>
		prisma.assetMovement.deleteMany({ where: { company } }),
	);

	await del("AssetRepair", () =>
		prisma.assetRepair.deleteMany({ where: { company } }),
	);

	await del("AssetCapitalization", () =>
		prisma.assetCapitalization.deleteMany({ where: { company } }),
	);

	await del("AssetDisposal", () =>
		prisma.assetDisposal.deleteMany({ where: { company } }),
	);

	await del("AssetAccountingEntry", () =>
		prisma.client.assetAccountingEntry.deleteMany({ where: { company } }),
	);

	await del("AssetMaintenance", () =>
		prisma.assetMaintenance.deleteMany({ where: { company } }),
	);

	await del("AssetMaintenanceTeam", () =>
		prisma.assetMaintenanceTeam.deleteMany({ where: { company } }),
	);

	await del("AssetDepreciationJournalEntry", () =>
		prisma.assetDepreciationJournalEntry.deleteMany({ where: { company } }),
	);

	await del("AssetDepreciationSchedule", () =>
		prisma.assetDepreciationSchedule.deleteMany({
			where: { asset: { company } },
		}),
	);

	await del("AssetFinanceBook", () =>
		prisma.assetFinanceBook.deleteMany({ where: { asset: { company } } }),
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

	// Locations are global reference rows with a unique name and no company
	// ownership. Preserve them; the seed path reuses existing rows by name.

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
		prisma.installationNoteItem.deleteMany({
			where: { installationNote: { company } },
		}),
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
	await del("QiTemplate", () =>
		prisma.qiTemplate.deleteMany({
			where: { name: { in: DEMO_QI_TEMPLATE_NAMES } },
		}),
	);

	await del("QiParameter", () =>
		prisma.qiParameter.deleteMany({
			where: {
				parameter: { in: DEMO_QI_PARAMETER_NAMES },
				// A shared parameter may be referenced by another company's
				// template; preserve it rather than breaking that template.
				templateItems: {
					none: {
						template: { name: { notIn: DEMO_QI_TEMPLATE_NAMES } },
					},
				},
			},
		}),
	);

	await del("QiParameterGroup", () =>
		prisma.qiParameterGroup.deleteMany({
			where: {
				name: { in: DEMO_QI_PARAMETER_GROUP_NAMES },
				parameters: { none: {} },
			},
		}),
	);

	// Shipping rules
	await del("ShippingRule", () =>
		prisma.shippingRule.deleteMany({
			where: { shippingRuleLabel: { in: DEMO_SHIPPING_RULE_LABELS } },
		}),
	);

	// Product bundles and related children must be deleted in dependency order.
	await del("ProductBundleItem", () =>
		prisma.productBundleItem.deleteMany({
			where: {
				bundle: { parentItem: { code: { in: DEMO_ITEM_CODES } } },
			},
		}),
	);
	await del("ProductBundle", () =>
		prisma.productBundle.deleteMany({
			where: { parentItem: { code: { in: DEMO_ITEM_CODES } } },
		}),
	);

	await del("ItemAlternate", () =>
		prisma.itemAlternate.deleteMany({
			where: {
				OR: [
					{ item: { code: { in: DEMO_ITEM_CODES } } },
					{ alternateItem: { code: { in: DEMO_ITEM_CODES } } },
				],
			},
		}),
	);

	await del("ItemManufacturer", () =>
		prisma.itemManufacturer.deleteMany({
			where: { item: { code: { in: DEMO_ITEM_CODES } } },
		}),
	);

	await del("Item", () =>
		prisma.item.deleteMany({ where: { code: { in: DEMO_ITEM_CODES } } }),
	);

	// Inventory items and their direct state must be deleted in dependency order.
	// InventoryItem is not company-scoped. Restrict cleanup to the deterministic
	// demo codes; never delete another company's stock, batches, or serials.
	// Batches and serials belonging to the configured company were already
	// removed above, so no unscoped fallback is needed here.
	await del("InventoryItem", () =>
		prisma.inventoryItem.deleteMany({
			where: { code: { in: DEMO_ITEM_CODES } },
		}),
	);

	// Item attributes & values (cascade)
	await del("ItemAttribute", () =>
		prisma.itemAttribute.deleteMany({
			where: {
				name: { in: DEMO_ITEM_ATTRIBUTE_NAMES },
				inventoryItemAttributes: { none: {} },
			},
		}),
	);

	// Item groups (self-referencing — delete leaves first, then parents)
	// Delete in two passes: non-group then group
	await delUntilStable("ItemGroup(leaves)", () =>
		prisma.itemGroup.deleteMany({
			where: {
				isGroup: false,
				groupName: { in: DEMO_ITEM_GROUP_NAMES },
				items: { none: {} },
				inventoryItems: { none: {} },
				defaults: { none: {} },
				children: { none: {} },
			},
		}),
	);
	await delUntilStable("ItemGroup(parents)", () =>
		prisma.itemGroup.deleteMany({
			where: {
				groupName: { in: DEMO_ITEM_GROUP_NAMES },
				items: { none: {} },
				inventoryItems: { none: {} },
				defaults: { none: {} },
				children: { none: {} },
			},
		}),
	);

	await del("Brand", () =>
		prisma.brand.deleteMany({
			where: {
				name: { in: DEMO_BRAND_NAMES },
				// A same-name brand may be referenced by a non-demo item. The
				// relation check keeps that shared reference intact.
				items: { none: {} },
			},
		}),
	);

	// Settings are shared singletons, not demo-owned records. Preserve them;
	// loading uses an upsert and an isolated target is required by the guard.

	// ── Fiscal Year & Company ──────────────────────────────────────

	// Delete FiscalYearCompany links first (FK to both Company and FiscalYear)
	await del("FiscalYearCompany", () =>
		prisma.fiscalYearCompany.deleteMany({
			where: { company: { name: company } },
		}),
	);

	// Delete the demo Company record
	await del("Company", () =>
		prisma.company.deleteMany({ where: { name: company } }),
	);

	// Asset categories and their finance-book defaults are global reference rows
	// with a unique name. Preserve them; the seed path reuses existing rows.

	// Delete seeded fiscal years
	const seededFiscalYears = buildIndianFiscalYears(config.dateRange.to).map(
		(fiscalYear) => fiscalYear.year,
	);
	await del("FiscalYear", () =>
		prisma.fiscalYear.deleteMany({
			where: {
				year: { in: seededFiscalYears },
				// Fiscal years are shared by companies. Keep a year that is still
				// linked to another company after demo-company links are removed.
				companies: { none: {} },
			},
		}),
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
		assetDepreciationScheduleEntries,
		assetFinanceBooks,
		assetDepreciationJournalEntries,
		assetMaintenanceTeams,
		assetMaintenances,
		assetMaintenanceLogs,
		assetMovements,
		pendingAssetMovements,
		submittedAssetMovements,
		assetRepairs,
		pendingAssetRepairs,
		completedAssetRepairs,
		assetCapitalizations,
		draftAssetCapitalizations,
		submittedAssetCapitalizations,
		assetDisposals,
		postedAssetDisposals,
		cancelledAssetDisposals,
		assetAccountingEntries,
		assetAccountingEntryLines,
		qualifiedCwipAssets,
		bookedCwipAssets,
		companies,
	] = await Promise.all([
		prisma.brand.count({ where: { name: { in: DEMO_BRAND_NAMES } } }),
		prisma.itemGroup.count({
			where: { groupName: { in: DEMO_ITEM_GROUP_NAMES } },
		}),
		prisma.item.count({ where: { code: { in: DEMO_ITEM_CODES } } }),
		prisma.inventoryItem.count({ where: { code: { in: DEMO_ITEM_CODES } } }),
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
		prisma.packingSlip.count({ where: { deliveryNote: { company } } }),
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
		prisma.assetDepreciationScheduleEntry.count({
			where: { schedule: { asset: { company } } },
		}),
		prisma.assetFinanceBook.count({ where: { asset: { company } } }),
		prisma.assetDepreciationJournalEntry.count({ where: { company } }),
		prisma.assetMaintenanceTeam.count({ where: { company } }),
		prisma.assetMaintenance.count({ where: { company } }),
		prisma.assetMaintenanceLog.count({ where: { maintenance: { company } } }),
		prisma.assetMovement.count({ where: { company } }),
		prisma.assetMovement.count({ where: { company, status: "DRAFT" } }),
		prisma.assetMovement.count({ where: { company, status: "SUBMITTED" } }),
		prisma.assetRepair.count({ where: { company } }),
		prisma.assetRepair.count({ where: { company, repairStatus: "PENDING" } }),
		prisma.assetRepair.count({ where: { company, repairStatus: "COMPLETED" } }),
		prisma.assetCapitalization.count({ where: { company } }),
		prisma.assetCapitalization.count({ where: { company, status: "DRAFT" } }),
		prisma.assetCapitalization.count({
			where: { company, status: "SUBMITTED" },
		}),
		prisma.assetDisposal.count({ where: { company } }),
		prisma.assetDisposal.count({ where: { company, status: "POSTED" } }),
		prisma.assetDisposal.count({ where: { company, status: "CANCELLED" } }),
		prisma.client.assetAccountingEntry.count({ where: { company } }),
		prisma.client.assetAccountingEntryLine.count({
			where: { accountingEntry: { company } },
		}),
		prisma.asset.count({
			where: {
				company,
				status: "SUBMITTED",
				availableForUseDate: { not: null, lte: config.dateRange.to },
				netPurchaseAmount: { gt: 0 },
				cwipAccountingEntryId: null,
				assetCategory: {
					is: {
						enableCwipAccounting: true,
						accounts: {
							some: {
								company: { name: company },
								capitalWorkInProgressAccount: { not: null },
							},
						},
					},
				},
			},
		}),
		prisma.asset.count({
			where: { company, cwipAccountingEntryId: { not: null } },
		}),
		prisma.company.count({ where: { name: company } }),
	]);
	const eligibleAsset: Prisma.AssetWhereInput = {
		company,
		calculateDepreciation: true,
		status: { in: ["SUBMITTED", "PARTIALLY_DEPRECIATED"] },
	};
	const [
		postedDepreciationEntries,
		dueUnpostedDepreciationEntries,
		futureUnpostedDepreciationEntries,
		monthlyAssetFinanceBooks,
		quarterlyAssetFinanceBooks,
		halfYearlyAssetFinanceBooks,
		yearlyAssetFinanceBooks,
	] = await Promise.all([
		prisma.assetDepreciationScheduleEntry.count({
			where: { postingId: { not: null }, schedule: { asset: { company } } },
		}),
		prisma.assetDepreciationScheduleEntry.count({
			where: {
				postingId: null,
				scheduleDate: { lte: config.dateRange.to },
				schedule: { status: "ACTIVE", asset: eligibleAsset },
			},
		}),
		prisma.assetDepreciationScheduleEntry.count({
			where: {
				postingId: null,
				scheduleDate: { gt: config.dateRange.to },
				schedule: { status: "ACTIVE", asset: { company } },
			},
		}),
		...([1, 3, 6, 12] as const).map((frequencyOfDepreciation) =>
			prisma.assetFinanceBook.count({
				where: {
					frequencyOfDepreciation,
					asset: { company },
				},
			}),
		),
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
		assetDepreciationScheduleEntries,
		assetFinanceBooks,
		assetDepreciationJournalEntries,
		postedDepreciationEntries,
		dueUnpostedDepreciationEntries,
		futureUnpostedDepreciationEntries,
		monthlyAssetFinanceBooks,
		quarterlyAssetFinanceBooks,
		halfYearlyAssetFinanceBooks,
		yearlyAssetFinanceBooks,
		assetMaintenanceTeams,
		assetMaintenances,
		assetMaintenanceLogs,
		assetMovements,
		pendingAssetMovements,
		submittedAssetMovements,
		assetRepairs,
		pendingAssetRepairs,
		completedAssetRepairs,
		assetCapitalizations,
		draftAssetCapitalizations,
		submittedAssetCapitalizations,
		assetDisposals,
		postedAssetDisposals,
		cancelledAssetDisposals,
		assetAccountingEntries,
		assetAccountingEntryLines,
		qualifiedCwipAssets,
		bookedCwipAssets,
		companies,
	};
}
