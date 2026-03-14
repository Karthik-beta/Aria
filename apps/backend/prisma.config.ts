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
 * - The `url`, `directUrl`, and `shadowDatabaseUrl` fields in the `datasource` block
 *   of schema.prisma are deprecated. Configure them here instead.
 * - The `seed` script is now defined in this config file, not package.json.
 * - Environment variables must be explicitly loaded (dotenv/config).
 */
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
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
		// seed: 'bun run prisma/seed.ts', // Uncomment when seed script is created
	},

	/**
	 * Database connection configuration.
	 *
	 * The `env()` helper is type-safe and reads from process.env.
	 * It does NOT replace the need for dotenv - you must still load
	 * environment variables explicitly with `import 'dotenv/config'`.
	 *
	 * Available options:
	 * - `url`: Primary database connection string (required)
	 * - `directUrl`: (optional) Direct connection URL for migrations (bypasses poolers)
	 * - `shadowDatabaseUrl`: (optional) URL for shadow database used during migrations
	 */
	datasource: {
		url: env("DATABASE_URL"),
		// directUrl: env('DIRECT_URL'),           // Uncomment for connection pooler setups
		// shadowDatabaseUrl: env('SHADOW_DB_URL'), // Uncomment for shadow database
	},
});
