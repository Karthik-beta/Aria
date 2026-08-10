#!/usr/bin/env bun

/**
 * Release-gate check for demo/runtime verification.
 *
 * This intentionally does not apply migrations. It delegates to Prisma's
 * migration-status command and fails closed when the target database has a
 * pending migration or cannot be reached. Use the migration smoke script to
 * exercise an empty database and a database upgraded from the previous head.
 */

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is required");
}

const backendRoot = resolve(import.meta.dir, "..");
const result = spawnSync(
	process.execPath,
	["x", "--bun", "prisma", "migrate", "status"],
	{
		cwd: backendRoot,
		env: process.env,
		encoding: "utf8",
	},
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);

if (result.error) throw result.error;
if (result.status !== 0) {
	process.exit(result.status ?? 1);
}

if (
	/Following migration[s]? not applied|Database schema is not in sync|have not yet been applied/i.test(
		output,
	)
) {
	process.stderr.write(
		"Migration release gate failed: the database has pending migrations.\n",
	);
	process.exit(1);
}

process.stdout.write(
	"Migration release gate passed: database is up to date.\n",
);
