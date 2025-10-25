import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

/**
 * Better Auth client for React
 *
 * @remarks
 * Configured with username plugin for username-based authentication.
 * Only active in production environments.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  plugins: [usernameClient()],
});

/**
 * Type-safe hooks and utilities from auth client
 */
export const { useSession, signIn, signOut, signUp } = authClient;
