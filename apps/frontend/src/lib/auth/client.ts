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

// Compute baseURL based on environment
const baseURL =
  typeof window !== 'undefined'
    ? process.env.NODE_ENV === 'production'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const authClient = createAuthClient({
  baseURL,
  plugins: [usernameClient()],
  fetchOptions: {
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
