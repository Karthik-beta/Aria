import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

/**
 * Better Auth client for React
 *
 * Configured with username plugin for username-based authentication.
 *
 * Environment-aware base URL:
 * - Development: Direct backend connection (localhost:3001)
 * - Production: Same origin (reverse proxy handles /api/auth/* routing)
 */

/**
 * Better Auth client base URL configuration
 *
 * Environment-aware base URL:
 * - Production (separate domain): NEXT_PUBLIC_API_URL points to backend domain
 * - Production (Docker Compose): NEXT_PUBLIC_API_URL is same domain (Caddy routes /api/auth/*)
 * - Development: Falls back to http://localhost:3001
 *
 * CRITICAL: Removes trailing slashes to prevent double-slash issues in auth URLs
 */
const baseURL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export const authClient = createAuthClient({
  baseURL,
  plugins: [usernameClient()],
  fetchOptions: {
    credentials: 'include', // Include cookies for cross-site requests
    onError(context) {
      // Silent error handling - AuthGuard will manage redirects
      // Only log server errors in development
      if (process.env.NODE_ENV === 'development' && context.response?.status >= 500) {
        // eslint-disable-next-line no-console
        console.error('[Auth] Server error:', context.response?.status);
      }
    },
  },
});

/**
 * Type-safe hooks and utilities from auth client
 */
export const { useSession, signIn, signOut, signUp } = authClient;
