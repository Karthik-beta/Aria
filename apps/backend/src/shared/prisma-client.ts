/**
 * Shared Prisma Client Instance for Prisma 7
 * 
 * This module provides a singleton PrismaClient instance that can be imported
 * by both the PrismaService (for NestJS DI) and auth.config.ts (for Better Auth).
 * 
 * Prisma 7 requires:
 * - Explicit environment variable loading (dotenv/config)
 * - Driver adapters (PrismaPg for PostgreSQL)
 * - Custom output path for generated client
 * 
 * @see https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
 */
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// Get connection string from environment (loaded by dotenv/config)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
}

// Create the PostgreSQL adapter as required by Prisma 7
const adapter = new PrismaPg({ connectionString });

// Global singleton pattern to prevent multiple connections in development
// (Hot Module Replacement can cause multiple PrismaClient instances)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Shared PrismaClient instance
 * 
 * Uses the global singleton pattern to ensure only one connection pool
 * is maintained across the application lifecycle.
 */
export const prismaClient: PrismaClient =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

// Cache in global for development hot reload
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaClient;
}
