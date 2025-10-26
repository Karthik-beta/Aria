import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

/**
 * Better Auth client for React
 *
 * @remarks
 * Configured with username plugin for username-based authentication.
 *
 * In development: Points directly to backend (localhost:3001)
 * In production: Uses same origin (Caddy proxies /api/auth/* to backend)
 *
 * CRITICAL: Added extensive error logging to debug fetch issues.
 * According to Better Auth docs, fetchOptions can include onError and onSuccess handlers.
 */

// Compute baseURL based on environment
// Development: Direct backend connection (localhost:3001)
// Production: Same origin (Caddy/Traefik proxy handles routing)
const baseURL =
  typeof window !== 'undefined'
    ? process.env.NODE_ENV === 'production'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Log the configuration on client-side only
if (typeof window !== 'undefined') {
  console.log('[BetterAuth Client] Configuration:', {
    baseURL,
    windowOrigin: window.location.origin,
    env: process.env.NODE_ENV,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
  });
}

export const authClient = createAuthClient({
  baseURL,
  plugins: [usernameClient()],

  // Add global fetch options for debugging
  fetchOptions: {
    onError(context) {
      console.error('[BetterAuth] Fetch error:', {
        error: context.error,
        response: context.response,
        status: context.response?.status,
      });
    },
    onSuccess(context) {
      console.log('[BetterAuth] Fetch success:', {
        status: context.response.status,
        data: context.data,
      });
    },
  },
});

/**
 * Type-safe hooks and utilities from auth client
 */
export const { useSession, signIn, signOut, signUp } = authClient;
