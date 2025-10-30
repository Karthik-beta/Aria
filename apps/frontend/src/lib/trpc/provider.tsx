'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { httpBatchLink, splitLink, wsLink, createWSClient } from '@trpc/client';
import type { AppRouter } from 'backend';
import { trpc } from './client';

/**
 * Get the tRPC API URL from environment or default to localhost
 *
 * For separate domain deployments:
 * - Development: Uses NEXT_PUBLIC_API_URL env var or defaults to localhost:3001
 * - Production: Uses NEXT_PUBLIC_API_URL env var (must be set to backend domain)
 *
 * CRITICAL: Removes trailing slashes to prevent double-slash issues (//trpc/)
 */
function getBaseUrl(): string {
  let baseUrl: string;
  
  if (typeof window !== 'undefined') {
    // Browser: use environment variable or empty string for same-origin requests
    baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  } else {
    // SSR/Server: use environment variable or default to localhost
    baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }
  
  // Remove trailing slash to prevent double-slash in URLs like //trpc/
  return baseUrl.replace(/\/$/, '');
}

/**
 * Get the WebSocket URL for tRPC subscriptions
 *
 * For separate domain deployments:
 * - Must connect directly to backend (cannot be proxied through Next.js)
 * - Converts http(s):// to ws(s):// protocol
 * - Returns proper URL for both development and production
 *
 * Examples:
 * - Dev: process.env.NEXT_PUBLIC_API_URL = "" → ws://localhost:3001/trpc-ws
 * - Dev: process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001" → ws://localhost:3001/trpc-ws
 * - Prod: process.env.NEXT_PUBLIC_API_URL = "https://api.example.com" → wss://api.example.com/trpc-ws
 *
 * CRITICAL: Handles trailing slashes to prevent malformed URLs
 */
function getWsUrl(): string {
  if (typeof window === 'undefined') {
    // SSR context: return dummy URL (WebSocket won't be used server-side)
    return 'ws://localhost:3001/trpc-ws';
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (baseUrl) {
    // Explicit backend URL provided - use it
    // Convert http(s):// to ws(s)://
    const isSecure = baseUrl.startsWith('https://');
    const protocol = isSecure ? 'wss:' : 'ws:';

    // Remove protocol and trailing slash from URL
    const urlWithoutProtocol = baseUrl
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    return `${protocol}//${urlWithoutProtocol}/trpc-ws`;
  }

  // No explicit API URL: use current location (works when proxied through same domain)
  const isSecure = window.location.protocol === 'https:';
  const protocol = isSecure ? 'wss:' : 'ws:';

  return `${protocol}//${window.location.host}/trpc-ws`;
}

/**
 * TRPCProvider wraps the app with tRPC and TanStack Query providers
 *
 * Configuration:
 * - Uses real WebSocket (wsLink) for subscriptions for better performance
 * - Falls back to HTTP batch link for queries and mutations
 * - Graceful fallback to HTTP-only client if WebSocket setup fails
 * - Works with both same-domain and separate-domain deployments
 *
 * Environment Setup (for separate domain deployments):
 * Set NEXT_PUBLIC_API_URL to your backend domain:
 *   Development: http://localhost:3001
 *   Production: https://api.example.com
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

  // Initialize with HTTP-only client (safe for SSR)
  const [trpcClient, setTrpcClient] = React.useState(() => {
    const httpLink = httpBatchLink({
      url: httpUrl,
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          credentials: 'include', // Include cookies for cross-site requests
        });
      },
    });

    // SSR context: only use HTTP link
    if (typeof window === 'undefined') {
      return trpc.createClient({
        links: [httpLink],
      });
    }

    // Browser context: initial client with HTTP only (will be replaced with WebSocket-enabled client)
    return trpc.createClient({
      links: [httpLink],
    });
  });

  // Browser-only: Set up WebSocket support after hydration
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let wsClient: ReturnType<typeof createWSClient> | null = null;
    let isMounted = true;

    const setupWebSocket = async () => {
      try {
        const wsUrl = getWsUrl();

        // Create WebSocket client
        wsClient = createWSClient({
          url: wsUrl,
          WebSocket: WebSocket as any,

          // Lazy loading: only connect when first subscription is made
          lazy: {
            enabled: true,
            closeMs: 10_000, // Close connection after 10 seconds of inactivity
          },

          /**
           * On successful connection
           */
          onOpen: () => {
            if (process.env.NODE_ENV === 'development') {
              // eslint-disable-next-line no-console
              console.log('[tRPC WebSocket] Connected to:', wsUrl);
            }
          },

          /**
           * On connection close
           *
           * Codes:
           * - 1000: Normal closure
           * - 1001: Going away
           * - Other: Error conditions
           */
          onClose: (cause) => {
            if (isMounted && process.env.NODE_ENV === 'development') {
              const code = cause?.code;

              // Don't log normal closures (1000, 1001)
              if (code && ![1000, 1001].includes(code)) {
                // eslint-disable-next-line no-console
                console.warn(`[tRPC WebSocket] Closed - Code: ${code}`);
              }
            }
          },

          /**
           * On WebSocket error
           *
           * Common errors:
           * - Connection refused: Backend not running or incorrect URL
           * - DNS resolution failed: Incorrect domain
           * - CORS/HTTPS mismatch: Protocol or domain issues
           */
          onError: (error) => {
            if (isMounted && process.env.NODE_ENV === 'development') {
              // eslint-disable-next-line no-console
              console.error('[tRPC WebSocket] Error:', error);
            }
          },
        });

        // Create new tRPC client with WebSocket support
        const wsEnabledClient = trpc.createClient({
          links: [
            splitLink({
              // Route subscriptions through WebSocket
              condition: (op) => op.type === 'subscription',

              // Subscriptions use WebSocket
              true: wsLink<AppRouter>({
                client: wsClient,
              }),

              // Queries and mutations use HTTP batch link
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

        // Only update state if component is still mounted
        if (isMounted) {
          setTrpcClient(wsEnabledClient);
        }
      } catch (error) {
        // Log but don't throw - HTTP fallback will still work
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('[tRPC WebSocket] Setup failed, falling back to HTTP:', error);
        }

        // Client already set with HTTP-only links above, so no action needed
      }
    };

    // Setup WebSocket asynchronously
    setupWebSocket();

    // Cleanup on unmount
    return () => {
      isMounted = false;

      // Close WebSocket connection gracefully
      try {
        if (wsClient) {
          wsClient.close();
        }
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [httpUrl]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
