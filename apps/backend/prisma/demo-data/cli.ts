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
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { cleanDemoData, getDemoStatus } from "./cleanup.js";
import type { DemoScale } from "./config.js";
import { resolveConfig } from "./config.js";
import { seedAll } from "./index.js";

// ── Bootstrap Prisma ──────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	logger.error("DATABASE_URL environment variable is not set");
	process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ── Parse CLI arguments ───────────────────────────────────────────
const [command, ...flags] = process.argv.slice(2);

function parseScale(): DemoScale {
	const scaleFlag = flags.find((f) => f.startsWith("--scale="));
	if (!scaleFlag) return "medium";
	const val = scaleFlag.split("=")[1];
	if (val === "small" || val === "medium" || val === "large") return val;
	logger.warn(`Unknown scale "${val}", defaulting to "medium"`);
	return "medium";
}

// ── Commands ──────────────────────────────────────────────────────
async function run() {
	switch (command) {
		case "load": {
			const scale = parseScale();
			const config = resolveConfig({ scale });
			logger.info(
				`Loading demo data (scale=${scale}, company="${config.company}", ` +
					`range=${config.dateRange.from.toISOString().slice(0, 10)} → ` +
					`${config.dateRange.to.toISOString().slice(0, 10)})`,
			);
			const start = Date.now();
			await seedAll(prisma, config);
			const elapsed = ((Date.now() - start) / 1000).toFixed(1);
			logger.info(`Demo data loaded successfully in ${elapsed}s`);
			break;
		}

		case "clean": {
			const config = resolveConfig();
			logger.info(`Cleaning demo data for company="${config.company}"...`);
			const start = Date.now();
			const counts = await cleanDemoData(prisma, config);
			const elapsed = ((Date.now() - start) / 1000).toFixed(1);
			logger.info(`Cleanup complete in ${elapsed}s`);
			for (const [model, count] of Object.entries(counts)) {
				if (count > 0) logger.info(`  ${model}: ${count} deleted`);
			}
			break;
		}

		case "status": {
			const config = resolveConfig();
			const counts = await getDemoStatus(prisma, config);
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
					"  load   [--scale=small|medium|large]  Seed demo data\n" +
					"  clean                                Remove all demo data\n" +
					"  status                               Show record counts\n",
			);
			process.exit(command ? 1 : 0);
	}
}

run()
	.catch((err) => {
		logger.error("Demo data CLI failed:", err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
