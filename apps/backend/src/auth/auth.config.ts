import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { username } from 'better-auth/plugins';
import { PrismaClient } from '../../generated/prisma';

// Create Prisma client instance
const prisma = new PrismaClient();

// 1. Get the comma-separated string from the .env file
const frontendUrlsRaw = process.env.FRONTEND_URL || 'http://localhost:3000';

// 2. Split the string into a proper array and remove trailing slashes
const frontendUrlsArray = frontendUrlsRaw
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''));

// 3. Get the backend URL and remove trailing slash
const backendUrl = (
  process.env.BETTER_AUTH_URL || 'http://localhost:3001'
).replace(/\/$/, '');

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

  // Session configuration with cross-site cookie support
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },

  // Base URL for the authentication server
  // In production behind Caddy: this should be the domain where auth is accessible
  // Caddy proxies /api/auth/* to backend:3001, so baseURL should be the public domain
  baseURL: backendUrl,

  // Secret for signing tokens (must be set in production)
  secret: process.env.BETTER_AUTH_SECRET || 'change-this-secret-in-production',

  // Trust proxy headers (required when behind reverse proxy)
  // Trust both the frontend domain and any localhost/IP access
  trustedOrigins: [
    ...frontendUrlsArray, // This will add all your frontend URLs
    backendUrl, // Add your backend URL
    'https://localhost',
    'http://localhost',
  ],

  // Advanced configuration for cross-site cookie support
  // Following official Better Auth patterns for cross-domain scenarios
  // See: https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/integrations/hono.mdx
  advanced: {
    // Force secure cookies in production (HTTPS required)
    // In development, allow non-secure cookies for localhost testing
    useSecureCookies: process.env.NODE_ENV === 'production',

    // Global cookie attributes for cross-site cookies
    // Required when frontend and backend are on different domains
    // In production: SameSite=None with Secure for separate domains
    // In development: Can use Lax if on same domain (e.g., localhost)
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true, // Prevent JavaScript access to the cookie (XSS protection)
      path: '/', // Cookie available to all routes
    },

    // Customize individual cookie attributes if needed
    // Use __Secure- prefix only in production (requires HTTPS)
    cookies: {
      sessionToken: {
        name:
          process.env.NODE_ENV === 'production'
            ? '__Secure-better-auth.session_token'
            : 'better-auth.session_token',
        attributes: {
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true, // XSS protection
          partitioned: process.env.NODE_ENV === 'production', // CHIPS only in production
        },
      },
      sessionData: {
        name:
          process.env.NODE_ENV === 'production'
            ? '__Secure-better-auth.session_data'
            : 'better-auth.session_data',
        attributes: {
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true, // XSS protection
          partitioned: process.env.NODE_ENV === 'production', // CHIPS
        },
      },
      dontRememberMe: {
        name:
          process.env.NODE_ENV === 'production'
            ? '__Secure-better-auth.dont_remember'
            : 'better-auth.dont_remember',
        attributes: {
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true, // XSS protection
          partitioned: process.env.NODE_ENV === 'production', // CHIPS
        },
      },
    },
  },
});

export type Auth = typeof auth;
