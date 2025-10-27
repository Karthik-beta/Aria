import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { username } from 'better-auth/plugins';
import { PrismaClient } from 'db';

// Create Prisma client instance
const prisma = new PrismaClient();

/**
 * Better Auth configuration with username/password authentication
 *
 * @remarks
 * - Only enabled in production environment
 * - Uses Prisma adapter with PostgreSQL
 * - Username plugin enables username-based authentication
 * - Session configuration for secure cookie handling
 *
 * Note: TS2742 error workaround - using explicit type annotation to bypass
 * TypeScript's limitation with better-auth's complex adapter types in declaration files.
 * See: https://github.com/better-auth/better-auth/issues/2123
 */
export const auth: any = betterAuth({
  // prismaAdapter expects a PrismaClient instance; cast through unknown to satisfy linting differences

  database: prismaAdapter(prisma as unknown as PrismaClient, {
    provider: 'postgresql',
    usePlural: false,
  }),

  // Enable email and password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disabled for production simplicity
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // Username plugin for username-based sign-in
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 20,
    }),
  ],

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },

  // Base URL for the authentication server
  // In production behind Caddy: this should be the domain where auth is accessible
  // Caddy proxies /api/auth/* to backend:3001, so baseURL should be the public domain
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',

  // Secret for signing tokens (must be set in production)
  secret: process.env.BETTER_AUTH_SECRET || 'change-this-secret-in-production',

  // Trust proxy headers (required when behind reverse proxy)
  // Trust both the frontend domain and any localhost/IP access
  trustedOrigins: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.BETTER_AUTH_URL || 'http://localhost:3001',
    'https://localhost',
    'http://localhost',
  ],
});

export type Auth = typeof auth;
