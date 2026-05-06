/**
 * Prisma 7 Configuration File
 *
 * This file configures the Prisma CLI and replaces several settings that were
 * previously defined in schema.prisma or as environment variables.
 *
 * @see https://www.prisma.io/docs/orm/reference/prisma-config-reference
 * @see https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
 *
 * Key Changes from Prisma v6:
 * - The `url` and `shadowDatabaseUrl` fields in the `datasource` block
 *   of schema.prisma are configured here.
 * - The `seed` script is now defined in this config file, not package.json.
 * - Environment variables come from the container/runtime, not .env files.
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaConfig } from "prisma";
import { env } from "prisma/config";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require("dotenv");

// In Railway/Docker, env vars are passed directly to the container.
// Only load .env files if they exist (for local development only).
const workspaceRoot = resolve(__dirname, "..", "..");
const rootEnv = resolve(workspaceRoot, ".env");
const devEnv = resolve(workspaceRoot, ".env.development");

if (existsSync(rootEnv)) {
	dotenv.config({ path: rootEnv });
}

if (existsSync(devEnv)) {
	dotenv.config({ path: devEnv, override: true });
}

export default {
	/**
	 * Path to the main Prisma schema file.
	 * Relative to the project root (where package.json and this file reside).
	 */
	schema: "prisma/schema.prisma",

	/**
	 * Migration configuration.
	 * - `path`: Directory where migration files are stored.
	 * - `seed`: (optional) Command to run for `prisma db seed`.
	 *           Example: 'tsx prisma/seed.ts' or 'bun run prisma/seed.ts'
	 */
	migrations: {
		path: "prisma/migrations",
	},

	/**
	 * Database connection configuration.
	 *
	 * Uses env() helper which reads from process.env at runtime.
	 * In Railway/Docker, DATABASE_URL is set by the container environment.
	 */
	datasource: {
		url: env("DATABASE_URL"),
		// shadowDatabaseUrl: env('SHADOW_DB_URL'), // Uncomment for shadow database
	},
} satisfies PrismaConfig;
