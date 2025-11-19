import { createAuthClient } from 'better-auth/react';
import { customSessionClient, usernameClient } from 'better-auth/client/plugins';

/**
 * Better Auth client for React
 *
 * Configured with username plugin for username-based authentication.
 * Environment-aware base URL configuration with credentials inclusion.
 */
const baseURL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export const authClient = createAuthClient({
  baseURL,
  plugins: [usernameClient(), customSessionClient()],
  fetchOptions: {
    credentials: 'include', // Include cookies for cross-site requests
    onError(context) {
      // Silent error handling - AuthGuard will manage redirects
      // Only log server errors in development
      if (process.env.NODE_ENV === 'development' && context.response?.status >= 500) {
        console.error('[Auth] Server error:', context.response?.status);
      }
    },
  },
});

/**
 * Type-safe hooks and utilities from auth client
 */
export const { useSession, signIn, signOut, signUp } = authClient;
