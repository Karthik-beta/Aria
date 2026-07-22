import { resolve } from "node:path";
import type { PrismaConfig } from "prisma";
import { env } from "prisma/config";

const migrationsPath = process.env.PRISMA_MIGRATIONS_PATH;
if (!migrationsPath) {
	throw new Error("PRISMA_MIGRATIONS_PATH is required for migration tests.");
}

export default {
	schema: resolve(__dirname, "schema.prisma"),
	migrations: {
		path: resolve(migrationsPath),
	},
	datasource: {
		url: env("DATABASE_URL"),
	},
} satisfies PrismaConfig;
