#!/usr/bin/env bun

import { Client } from "pg";
import { deployMigrations } from "../src/deployment/migration-preflight.js";

async function probePostgreSql(connectionString: string): Promise<void> {
	const client = new Client({
		connectionString,
		connectionTimeoutMillis: 5_000,
	});

	try {
		await client.connect();
		await client.query("SELECT 1");
	} finally {
		await client.end().catch(() => undefined);
	}
}

async function runPrismaMigrations(): Promise<number> {
	const subprocess = Bun.spawn(
		["bun", "prisma", "migrate", "deploy", "--config", "prisma.config.ts"],
		{
			cwd: process.cwd(),
			env: process.env,
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		},
	);

	return subprocess.exited;
}

deployMigrations({
	databaseUrl: process.env.DATABASE_URL,
	connect: probePostgreSql,
	runMigrations: runPrismaMigrations,
}).catch((error: unknown) => {
	const message =
		error instanceof Error ? error.message : "Migration deployment failed.";
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});
