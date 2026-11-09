#!/usr/bin/env bun
/**
 * Demo Data CLI
 *
 * Usage (run from apps/backend):
 *   bun prisma/demo-data/cli.ts load   [--scale=small|medium|large]
 *   bun prisma/demo-data/cli.ts clean
 *   bun prisma/demo-data/cli.ts status
 *
 * Requires DATABASE_URL to be set (loaded from .env at workspace root).
 */

import "dotenv/config";
import { logger } from "@aria/utils";
import { normalizeDemoAsOf } from "../../src/apps/asset/depreciation/demo-data.utils.js";
import { withDemoDepreciationExecution } from "../../src/apps/asset/depreciation/demo-data-runner.js";
import {
	businessDate,
	dateOnlyUtc,
	depreciationTimeZone,
} from "../../src/apps/asset/depreciation/depreciation.config.js";
import { PrismaService } from "../../src/shared/prisma.service.js";
import { cleanDemoData, getDemoStatus } from "./cleanup.js";
import type { DemoScale } from "./config.js";
import { resolveConfig } from "./config.js";
import { seedAll } from "./index.js";

// ── Parse CLI arguments ───────────────────────────────────────────
const [, , command, ...flags] = process.argv;

function parseScale(): DemoScale {
	const scaleFlag = flags.find((f) => f.startsWith("--scale="));
	if (!scaleFlag) return "medium";
	const val = scaleFlag.split("=")[1];
	if (val === "small" || val === "medium" || val === "large") return val;
	logger.warn(`Unknown scale "${val}", defaulting to "medium"`);
	return "medium";
}

function parseAsOf(): string {
	const asOfFlag = flags.find((flag) => flag.startsWith("--as-of="));
	const value =
		asOfFlag?.slice("--as-of=".length) ?? businessDate(depreciationTimeZone());
	return normalizeDemoAsOf(value);
}

async function withPrisma<T>(
	callback: (prisma: PrismaService) => Promise<T>,
): Promise<T> {
	const prisma = new PrismaService();
	await prisma.onModuleInit();
	try {
		return await callback(prisma);
	} finally {
		await prisma.onModuleDestroy();
	}
}

// ── Commands ─────────────────────────────────────────────────────
async function run() {
	switch (command) {
		case "load": {
			const scale = parseScale();
			const asOf = parseAsOf();
			const to = dateOnlyUtc(asOf);
			const from = new Date(to);
			from.setUTCMonth(from.getUTCMonth() - 6);
			const config = resolveConfig({ scale, dateRange: { from, to } });
			logger.info(
				`Loading demo data (scale=${scale}, company="${config.company}", ` +
					`range=${config.dateRange.from.toISOString().slice(0, 10)} → ` +
					`${config.dateRange.to.toISOString().slice(0, 10)})`,
			);
			const start = Date.now();
			logger.info("Cleaning existing demo data before loading...");
			await withDemoDepreciationExecution(async (prisma, depreciation) => {
				await cleanDemoData(prisma, config);
				const cleanupElapsed = ((Date.now() - start) / 1000).toFixed(1);
				logger.info(`Existing demo data cleaned in ${cleanupElapsed}s`);
				await seedAll(prisma, config, depreciation);
			});
			const elapsed = ((Date.now() - start) / 1000).toFixed(1);
			logger.info(`Demo data loaded successfully in ${elapsed}s`);
			break;
		}

		case "clean": {
			const config = resolveConfig();
			logger.info(`Cleaning demo data for company="${config.company}"...`);
			const start = Date.now();
			const counts = await withPrisma((prisma) =>
				cleanDemoData(prisma, config),
			);
			const elapsed = ((Date.now() - start) / 1000).toFixed(1);
			logger.info(`Cleanup complete in ${elapsed}s`);
			for (const [model, count] of Object.entries(counts)) {
				if (count > 0) logger.info(`  ${model}: ${count} deleted`);
			}
			break;
		}

		case "status": {
			const config = resolveConfig();
			const counts = await withPrisma((prisma) =>
				getDemoStatus(prisma, config),
			);
			logger.info(`Demo data status for company="${config.company}":`);
			for (const [model, count] of Object.entries(counts)) {
				logger.info(`  ${model}: ${count}`);
			}
			break;
		}

		default:
			logger.info(
				"Usage: bun prisma/demo-data/cli.ts <command> [options]\n\n" +
					"Commands:\n" +
					"  load   [--scale=small|medium|large] [--as-of=YYYY-MM-DD]\n" +
					"                                           Load and post due demo data\n" +
					"  clean                                Remove all demo data\n" +
					"  status                               Show record counts\n",
			);
			process.exit(command ? 1 : 0);
	}
}

run().catch((err) => {
	logger.error("Demo data CLI failed:", err);
	process.exit(1);
});
