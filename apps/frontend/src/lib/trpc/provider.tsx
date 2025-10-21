'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { httpBatchLink, httpSubscriptionLink, splitLink } from '@trpc/client';
import { useState } from 'react';
import { trpc } from './client';

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
 * TRPCProvider wraps the app with tRPC and TanStack Query providers
 * This enables type-safe API calls throughout the application with real-time subscriptions
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // With SSR, we usually want to set some default staleTime
            // above 0 to avoid refetching immediately on the client
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          // Use httpSubscriptionLink for subscriptions (SSE-based)
          condition: (op) => op.type === 'subscription',
          true: httpSubscriptionLink({
            url: `${getBaseUrl()}/trpc`,
          }),
          // Use httpBatchLink for queries and mutations
          false: httpBatchLink({
            url: `${getBaseUrl()}/trpc`,
            // You can add headers here for authentication
            // headers() {
            //   return {
            //     authorization: getAuthToken(),
            //   };
            // },
          }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        {/* Show React Query devtools in development */}
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
