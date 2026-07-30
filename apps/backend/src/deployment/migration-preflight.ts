const DEFAULT_POSTGRES_PORT = "5432";

export const DEFAULT_DATABASE_READY_ATTEMPTS = 12;
export const DEFAULT_DATABASE_READY_DELAY_MS = 5_000;

/** A validated database connection string and its credential-free log label. */
export interface DatabaseTarget {
	connectionString: string;
	displayName: string;
}

/** Injectable migration dependencies used by the CLI and focused unit tests. */
export interface MigrationDeploymentOptions {
	databaseUrl?: string;
	connect: (connectionString: string) => Promise<void>;
	runMigrations: () => Promise<number>;
	sleep?: (milliseconds: number) => Promise<void>;
	log?: (message: string) => void;
	attempts?: number;
	delayMs?: number;
}

function writeLog(message: string): void {
	process.stdout.write(`${message}\n`);
}

/**
 * Validates a PostgreSQL URL and returns a target label without credentials or
 * query parameters. This label is safe to include in deployment logs.
 */
export function resolveDatabaseTarget(
	databaseUrl: string | undefined,
): DatabaseTarget {
	const connectionString = databaseUrl?.trim();
	if (!connectionString) {
		throw new Error("DATABASE_URL is required for migration deployment.");
	}

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(connectionString);
	} catch {
		throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
	}

	if (
		parsedUrl.protocol !== "postgres:" &&
		parsedUrl.protocol !== "postgresql:"
	) {
		throw new Error(
			"DATABASE_URL must use the postgres or postgresql protocol.",
		);
	}

	if (!parsedUrl.hostname) {
		throw new Error("DATABASE_URL must include a database host.");
	}

	const databaseName = decodeURIComponent(
		parsedUrl.pathname.replace(/^\/+/, ""),
	);
	if (!databaseName) {
		throw new Error("DATABASE_URL must include a database name.");
	}

	return {
		connectionString,
		displayName: `${parsedUrl.hostname}:${parsedUrl.port || DEFAULT_POSTGRES_PORT}/${databaseName}`,
	};
}

function errorIdentifier(error: unknown): string {
	if (typeof error === "object" && error !== null && "code" in error) {
		const code = (error as { code?: unknown }).code;
		if (typeof code === "string" && code.length > 0) {
			return code;
		}
	}

	return error instanceof Error ? error.name : "unknown-error";
}

/**
 * Waits for PostgreSQL readiness, then runs Prisma migrations exactly once.
 * Connectivity failures are retried; migration-history and SQL failures are not.
 */
export async function deployMigrations({
	databaseUrl,
	connect,
	runMigrations,
	sleep = (milliseconds) => Bun.sleep(milliseconds),
	log = writeLog,
	attempts = DEFAULT_DATABASE_READY_ATTEMPTS,
	delayMs = DEFAULT_DATABASE_READY_DELAY_MS,
}: MigrationDeploymentOptions): Promise<void> {
	if (!Number.isInteger(attempts) || attempts < 1) {
		throw new Error("Database readiness attempts must be a positive integer.");
	}
	if (!Number.isFinite(delayMs) || delayMs < 0) {
		throw new Error("Database readiness delay must be a non-negative number.");
	}

	const target = resolveDatabaseTarget(databaseUrl);
	log(`Database migration target: ${target.displayName}`);

	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			await connect(target.connectionString);
			log(`PostgreSQL is ready at ${target.displayName}.`);
			break;
		} catch (error) {
			if (attempt === attempts) {
				throw new Error(
					`PostgreSQL did not become ready at ${target.displayName} after ${attempts} attempts.`,
				);
			}

			log(
				`PostgreSQL is not ready (${errorIdentifier(error)}); retrying ${attempt}/${attempts}.`,
			);
			await sleep(delayMs);
		}
	}

	log("Running Prisma migrate deploy...");
	const exitCode = await runMigrations();
	if (exitCode !== 0) {
		throw new Error(`Prisma migrate deploy failed with exit code ${exitCode}.`);
	}

	log("Prisma migrate deploy completed successfully.");
}
