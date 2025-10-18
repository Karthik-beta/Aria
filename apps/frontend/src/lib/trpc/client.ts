import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../../backend/src/trpc/trpc.service';

/**
 * Get the tRPC API URL from environment or default to localhost
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return '';
  }
  // SSR should use localhost
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Create tRPC React Query hooks
 * This provides type-safe hooks for queries and mutations
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Vanilla tRPC client for server-side usage or non-React contexts
 */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
    }),
  ],
});
