/**
 * Demo Data — Orchestrator
 *
 * Coordinates master-data seeding → transaction seeding in the correct
 * order, and exposes the cleanup and status functions.
 */

export { cleanDemoData, getDemoStatus } from "./cleanup.js";
export {
	type DemoConfig,
	type DemoScale,
	getDefaultConfig,
	resolveConfig,
} from "./config.js";
export { type MasterIds, seedMasterData } from "./seed-master.js";
export { seedTransactions } from "./seed-transactions.js";

import type { DemoDepreciationCoordinator } from "../../src/apps/asset/depreciation/demo-data.types.js";
import { reconcileInventoryItemQuantities } from "../../src/apps/inventory/services/stock-snapshot.js";
import type { PrismaService } from "../../src/shared/prisma.service.js";
import { ASSET_REGISTER } from "./asset-data.js";
import type { DemoConfig } from "./config.js";
import { ITEMS } from "./data.js";
import { seedAssetLifecycleTransactions } from "./seed-asset-lifecycle.js";
import { seedMasterData } from "./seed-master.js";
import { seedTransactions } from "./seed-transactions.js";

/**
 * Seed the full demo dataset (master data + transactions).
 */
export async function seedAll(
	prisma: PrismaService,
	config: DemoConfig,
	depreciation: DemoDepreciationCoordinator,
): Promise<void> {
	const ids = await seedMasterData(prisma, config);
	await seedTransactions(prisma, config, ids, depreciation);
	const companyId = ids.companyIds.get(config.company);
	if (!companyId) {
		throw new Error(
			`Company "${config.company}" was not created during demo seeding`,
		);
	}
	await depreciation.ensurePosted({
		throughDate: config.dateRange.to,
		companyId,
	});
	await seedAssetLifecycleTransactions(prisma, config, ids);

	for (const asset of ASSET_REGISTER) {
		const assetId = ids.assetIds.get(asset.key);
		if (!assetId) throw new Error(`Missing seeded asset ${asset.key}`);
		if (asset.status === "FULLY_DEPRECIATED") {
			const calculated = await prisma.asset.findUniqueOrThrow({
				where: { id: assetId },
				select: { status: true, isFullyDepreciated: true },
			});
			if (
				calculated.status !== "FULLY_DEPRECIATED" ||
				!calculated.isFullyDepreciated
			) {
				throw new Error(
					`Asset ${asset.key} did not reach its calculated fully depreciated state`,
				);
			}
		}
		if (asset.status !== "IN_MAINTENANCE" && asset.status !== "OUT_OF_ORDER") {
			continue;
		}
		await prisma.asset.update({
			where: { id: assetId },
			data: { status: asset.status },
		});
	}
	await reconcileInventoryItemQuantities(prisma, {
		company: config.company,
		itemCodes: ITEMS.filter((item) => item.maintainStock).map(
			(item) => item.code,
		),
	});
}
