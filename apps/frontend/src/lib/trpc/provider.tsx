'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { httpBatchLink, splitLink, wsLink, createWSClient, type TRPCLink } from '@trpc/client';
import { useState } from 'react';
import type { AppRouter } from 'backend';
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
 * Get the WebSocket URL for tRPC subscriptions
 * Only call this in browser environment
 *
 * Note: WebSocket connections cannot be proxied by Next.js rewrites,
 * so we connect directly to the backend WebSocket server
 */
function getWsUrl(): string {
  // Use NEXT_PUBLIC_API_URL if explicitly set
  if (process.env.NEXT_PUBLIC_API_URL) {
    // Correctly determine protocol and strip http(s):// prefix
    const protocol = process.env.NEXT_PUBLIC_API_URL.startsWith('https') ? 'wss://' : 'ws://';
    const url = process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, '');
    return `${protocol}${url}/trpc-ws`;
  }

  // Default: use current host (works with Caddy proxy or direct access)
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${window.location.host}/trpc-ws`;
}

/**
 * Create WebSocket client following official tRPC documentation
 * https://trpc.io/docs/client/links/wsLink
 *
 * This function creates a new WebSocket client instance.
 * It should be called ONCE per tRPC client lifecycle (not during render).
 */
function createWsClient() {
  if (typeof window === 'undefined') {
    throw new Error('WebSocket client can only be created in browser');
  }

  const wsUrl = getWsUrl();

  // Create WebSocket client following official minimal pattern
  // https://trpc.io/docs/client/links/wsLink
  const wsClient = createWSClient({
    url: wsUrl,
    WebSocket: WebSocket as any,

    // Optional callbacks for logging
    onOpen: () => {
      console.log('[WebSocket] ✅ Connected to', wsUrl);
    },

    onClose: (cause) => {
      const code = cause?.code;
      console.warn('[WebSocket] ❌ Disconnected - Code:', code);
    },

    onError: (error) => {
      console.error('[WebSocket] 🔴 Error:', error);
    },
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('[WebSocket] Client created for', wsUrl);
  }

  return wsClient;
}

/**
 * Create tRPC links following official documentation
 * https://trpc.io/docs/client/links/splitLink
 *
 * Uses splitLink to route:
 * - subscriptions → WebSocket (wsLink)
 * - queries & mutations → HTTP (httpBatchLink)
 *
 * SSR-safe: During SSR, only HTTP link is used (WebSocket client cannot be created)
 *
 * IMPORTANT: This function is called ONCE during tRPC client initialization,
 * NOT during every render. The wsClient is created here and reused for the
 * lifetime of the tRPC client.
 *
 * Pattern verified against official example:
 * https://github.com/trpc/examples-next-prisma-websockets-starter/blob/main/src/utils/trpc.ts#L22-L53
 */
function createLinks(): TRPCLink<AppRouter>[] {
  const httpLink = httpBatchLink({
    url: `${getBaseUrl()}/trpc`,
  });

  // During SSR, only use HTTP
  if (typeof window === 'undefined') {
    return [httpLink];
  }

  // In browser, create WebSocket client and use splitLink for routing
  // Following official pattern: https://trpc.io/docs/client/links/splitLink
  // The wsClient is created once here, not on every render
  const wsClient = createWsClient();

  return [
    splitLink({
      // Route based on operation type
      condition: (op) => op.type === 'subscription',

      // Subscriptions use WebSocket
      true: wsLink<AppRouter>({
        client: wsClient,
      }),

      // Queries and mutations use HTTP with batching
      false: httpLink,
    }),
  ];
}

/**
 * TRPCProvider wraps the app with tRPC and TanStack Query providers
 * This enables type-safe API calls throughout the application with real-time WebSocket subscriptions
 *
 * Pattern verified against official tRPC Next.js WebSocket example:
 * https://github.com/trpc/examples-next-prisma-websockets-starter
 *
 * Key differences from Pages Router:
 * - App Router uses 'use client' provider with useState for client initialization
 * - QueryClient and tRPC client are created ONCE using useState initializer
 * - No SSR/hydration recreation needed - client is stable across renders
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  // Create QueryClient once using useState initializer
  // This ensures it's created only once, not on every render
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

  // Create tRPC client once using useState initializer
  // createLinks() is called ONCE here during initialization, not during render
  // This follows the official pattern for App Router providers
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: createLinks(),
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
