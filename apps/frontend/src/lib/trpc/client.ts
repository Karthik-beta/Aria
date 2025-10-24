import { createTRPCClient, httpBatchLink, type TRPCClient } from '@trpc/client';
import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query';
import type { AppRouter } from 'backend';

/**
 * Get the tRPC API URL from environment or default to localhost
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative path or configured backend URL
    return process.env.NEXT_PUBLIC_API_URL || '';
  }
  // SSR should use backend URL
  return process.env.NEXT_PUBLIC_API_URL || `http://localhost:3001`;
}

/**
 * Create tRPC React Query hooks
 * This provides type-safe hooks for queries and mutations
 */
export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

/**
 * Vanilla tRPC client for server-side usage or non-React contexts
 */
export const trpcClient: TRPCClient<AppRouter> = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
    }),
  ],
});
