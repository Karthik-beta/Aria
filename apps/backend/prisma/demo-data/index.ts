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

import { reconcileInventoryItemQuantities } from "../../src/apps/inventory/services/stock-snapshot.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { DemoConfig } from "./config.js";
import { ITEMS } from "./data.js";
import { seedMasterData } from "./seed-master.js";
import { seedTransactions } from "./seed-transactions.js";

/**
 * Seed the full demo dataset (master data + transactions).
 */
export async function seedAll(
	prisma: PrismaClient,
	config: DemoConfig,
): Promise<void> {
	const ids = await seedMasterData(prisma, config);
	await seedTransactions(prisma, config, ids);
	await reconcileInventoryItemQuantities(prisma, {
		company: config.company,
		itemCodes: ITEMS.filter((item) => item.maintainStock).map(
			(item) => item.code,
		),
	});
}
