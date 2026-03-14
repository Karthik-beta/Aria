/**
 * Shared Prisma Client Instance for Prisma ORM v7
 *
 * Prisma v7 introduces a Rust-free architecture with significant changes to how
 * the client is instantiated. This module provides a properly configured singleton
 * instance that can be imported throughout the application.
 *
 * @see https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
 * @see https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                           PRISMA v7 KEY CHANGES                              ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║ 1. DRIVER ADAPTERS (Required)                                                ║
 * ║    - All databases now require explicit driver adapters                      ║
 * ║    - PostgreSQL: @prisma/adapter-pg                                          ║
 * ║    - SQLite: @prisma/adapter-better-sqlite3                                  ║
 * ║    - MySQL: @prisma/adapter-mysql                                            ║
 * ║                                                                              ║
 * ║ 2. IMPORT PATH                                                               ║
 * ║    - Client is no longer in node_modules/@prisma/client                      ║
 * ║    - Must use custom output path defined in schema.prisma generator block    ║
 * ║    - Example: import { PrismaClient } from './generated/prisma/client.js'    ║
 * ║                                                                              ║
 * ║ 3. ENVIRONMENT VARIABLES                                                     ║
 * ║    - Must explicitly load with dotenv (import 'dotenv/config')               ║
 * ║    - Not automatically loaded from .env files                                ║
 * ║                                                                              ║
 * ║ 4. CONNECTION POOLS                                                          ║
 * ║    - Driver adapters use the underlying driver's pool settings               ║
 * ║    - pg driver defaults differ from Prisma v6 (e.g., no connection timeout)  ║
 * ║    - Configure pool settings via adapter options if needed                   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Database connection string from environment.
 * Must be a valid PostgreSQL connection URL.
 * Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error(
		"DATABASE_URL environment variable is not set. " +
			"Please ensure your .env file exists and contains DATABASE_URL.",
	);
}

// ============================================================================
// Driver Adapter Configuration
// ============================================================================

/**
 * PostgreSQL Driver Adapter for Prisma v7
 *
 * The PrismaPg adapter wraps the 'pg' driver and is REQUIRED for all
 * PostgreSQL databases in Prisma v7. Unlike Prisma v6, there is no
 * built-in query engine - the adapter handles all database communication.
 *
 * Connection Pool Settings (inherited from pg driver):
 * - Default max connections: 10
 * - Default connection timeout: unlimited (0) - differs from Prisma v6's 5s!
 * - Idle timeout: 10000ms
 *
 * To customize pool settings, you can pass pg.Pool options:
 * @example
 * const adapter = new PrismaPg({
 *   connectionString,
 *   pool: {
 *     max: 20,                  // Maximum connections
 *     connectionTimeoutMillis: 5000,  // Match v6 behavior
 *     idleTimeoutMillis: 30000,
 *   }
 * });
 */
const adapter = new PrismaPg({ connectionString });

// ============================================================================
// Singleton Pattern for Development
// ============================================================================

/**
 * Global singleton pattern to prevent multiple PrismaClient instances.
 *
 * In development mode, Hot Module Replacement (HMR) can cause this module
 * to be re-executed multiple times, creating new database connections each time.
 * This exhausts the connection pool and causes errors.
 *
 * Solution: Store the client instance on globalThis (Node.js global object)
 * and reuse it across module reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Shared PrismaClient instance.
 *
 * This singleton is used by:
 * - PrismaService (NestJS dependency injection wrapper)
 * - auth.config.ts (Better Auth database adapter)
 * - Any other services requiring direct Prisma access
 *
 * Log Levels:
 * - 'error': Always logged
 * - 'warn': Logged in development for debugging
 * - 'query': Uncomment for query debugging (verbose)
 * - 'info': General information logging
 */
export const prismaClient: PrismaClient =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
		// Uncomment for query debugging:
		// log: ['query', 'error', 'warn', 'info'],
	});

// Preserve instance across HMR in development
if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prismaClient;
}
