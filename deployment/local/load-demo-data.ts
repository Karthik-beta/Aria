#!/usr/bin/env bun
/**
 * One-shot demo-data loader for the local Docker stack (docker-compose.local.yml).
 *
 * Mounted into the backend runner image at /app/apps/backend/scripts/ and run
 * by the `demo-data` service after migrations and before the backend starts,
 * so the backend scheduler never races the loader.
 *
 * A marker stored as the database comment records a completed load, which
 * keeps restarts fast and leaves the Prisma schema untouched. A failed load
 * writes no marker, so the next start retries (the CLI cleans partial data).
 *
 * Environment:
 *   DATABASE_URL       required
 *   DEMO_DATA_ENABLED  "false" skips loading (default "true")
 *   DEMO_DATA_SCALE    small | medium | large (default "small")
 *   DEMO_DATA_FORCE    "true" reloads even when the marker is present
 */

import { resolve } from "node:path";
import { Client } from "pg";

const MARKER_PREFIX = "aria-local-demo-data:";
// The script runs from apps/backend/scripts/ inside the backend image.
const BACKEND_DIR = resolve(import.meta.dir, "..");

const enabled = process.env.DEMO_DATA_ENABLED?.trim().toLowerCase() !== "false";
const force = process.env.DEMO_DATA_FORCE?.trim().toLowerCase() === "true";
const scale = process.env.DEMO_DATA_SCALE?.trim() || "small";

function log(message: string): void {
	process.stdout.write(`[demo-data] ${message}\n`);
}

function quoteIdentifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

async function withClient<T>(callback: (client: Client) => Promise<T>) {
	const client = new Client({ connectionString: process.env.DATABASE_URL });
	await client.connect();
	try {
		return await callback(client);
	} finally {
		await client.end().catch(() => undefined);
	}
}

async function readMarker(): Promise<string | null> {
	return withClient(async (client) => {
		const result = await client.query<{ comment: string | null }>(
			`SELECT shobj_description(oid, 'pg_database') AS comment
			 FROM pg_database WHERE datname = current_database()`,
		);
		const comment = result.rows[0]?.comment ?? null;
		return comment?.startsWith(MARKER_PREFIX) ? comment : null;
	});
}

async function writeMarker(value: string | null): Promise<void> {
	await withClient(async (client) => {
		const result = await client.query<{ name: string }>(
			"SELECT current_database() AS name",
		);
		const database = quoteIdentifier(result.rows[0]?.name ?? "");
		const comment = value === null ? "NULL" : quoteLiteral(value);
		await client.query(`COMMENT ON DATABASE ${database} IS ${comment}`);
	});
}

async function main(): Promise<number> {
	if (!process.env.DATABASE_URL) {
		log("DATABASE_URL is not set.");
		return 1;
	}

	if (!enabled) {
		log("DEMO_DATA_ENABLED=false, skipping demo data.");
		return 0;
	}

	const marker = await readMarker();
	if (marker && !force) {
		log(`Demo data already loaded (${marker.slice(MARKER_PREFIX.length)}).`);
		return 0;
	}

	if (marker) {
		await writeMarker(null);
	}

	log(`Loading demo data (scale=${scale}). This can take several minutes...`);
	const loader = Bun.spawn(
		["bun", "prisma/demo-data/cli.ts", "load", `--scale=${scale}`],
		{
			cwd: BACKEND_DIR,
			env: process.env,
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		},
	);
	const exitCode = await loader.exited;
	if (exitCode !== 0) {
		log(`Demo data load failed with exit code ${exitCode}.`);
		return exitCode;
	}

	await writeMarker(`${MARKER_PREFIX}${scale}@${new Date().toISOString()}`);
	log("Demo data loaded.");
	return 0;
}

main()
	.then((code) => {
		process.exitCode = code;
	})
	.catch((error: unknown) => {
		log(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
