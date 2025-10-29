'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
  wsLink,
  createWSClient,
} from '@trpc/client';
import type { AppRouter } from 'backend';

// Import trpc from client.ts to avoid circular dependency
// This creates a clean one-way dependency graph:
// client.ts -> provider.tsx -> index.ts
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
 * Get the WebSocket URL for tRPC subscriptions.
 * Note: WebSocket connections cannot be proxied by Next.js rewrites,
 * so we connect directly to the backend WebSocket server.
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
 * TRPCProvider wraps the app with tRPC and TanStack Query providers
 * This enables type-safe API calls throughout the application with real-time WebSocket subscriptions
 *
 * Pattern (Official tRPC documentation): create the client with `useState`
 * so each request gets its own instance (https://trpc.io/docs/client/react/setup)
 * and compose WebSocket subscriptions with `splitLink` + `wsLink`
 * (https://trpc.io/docs/client/links/wsLink).
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const httpUrl = React.useMemo(() => `${getBaseUrl()}/trpc`, []);

  const initialClient = React.useMemo(() => {
    const httpLink = httpBatchLink({
      url: httpUrl,
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          credentials: 'include', // Include cookies for cross-site requests
        });
      },
    });

    if (typeof window === 'undefined') {
      return trpc.createClient({
        links: [httpLink],
      });
    }

    const subscriptionLink = httpSubscriptionLink({ url: httpUrl });

    return trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.type === 'subscription',
          true: subscriptionLink,
          false: httpLink,
        }),
      ],
    });
  }, [httpUrl]);

  const [wsClientValue, setWsClientValue] = React.useState<ReturnType<
    typeof trpc.createClient
  > | null>(null);
  const wsTransportRef = React.useRef<ReturnType<typeof createWSClient> | null>(null);

  const activeClient = wsClientValue ?? initialClient;

  React.useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const wsClient = createWSClient({
      url: getWsUrl(),
      WebSocket: WebSocket as any,
      lazy: { enabled: true, closeMs: 10_000 },

      onClose: (cause) => {
        const code = cause?.code;
        if (code && code !== 1000 && code !== 1001 && process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn('[WebSocket] Disconnected - Code:', code);
        }
      },

      onError: (error) => {
        if (process.env.NODE_ENV === 'development') {
          const hasErrorInfo =
            error &&
            (error instanceof Error ||
              (typeof error === 'object' &&
                (Object.keys(error).length > 0 || error.constructor !== Object)));

          if (hasErrorInfo) {
            // eslint-disable-next-line no-console
            console.error('[WebSocket] Error:', error);
          }
        }
      },
    });

    wsTransportRef.current = wsClient;

    const wsEnabledClient = trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.type === 'subscription',
          true: wsLink<AppRouter>({ client: wsClient }),
          false: httpBatchLink({
            url: httpUrl,
            fetch: (url, options) => {
              return fetch(url, {
                ...options,
                credentials: 'include', // Include cookies for cross-site requests
              });
            },
          }),
        }),
      ],
    });

    setWsClientValue(wsEnabledClient);

    return () => {
      try {
        wsTransportRef.current?.close();
        wsTransportRef.current = null;
      } catch {
        // Ignore errors during cleanup
      }
    };
  }, [httpUrl]);

  return (
    <trpc.Provider client={activeClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
