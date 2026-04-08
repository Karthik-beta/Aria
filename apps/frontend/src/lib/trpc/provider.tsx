"use client";

import type { AppRouter } from "@aria/api-contract";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createWSClient,
	httpBatchLink,
	splitLink,
	type WebSocketClientOptions,
	wsLink,
} from "@trpc/client";
import * as React from "react";
import { trpc } from "./client";

type QueryRecoveryClient = Pick<QueryClient, "refetchQueries">;

const RECOVERY_THROTTLE_MS = 1_000;

/**
 * Builds browser event handlers that recover active queries after visibility,
 * focus, or WebSocket reconnect transitions.
 */
export function createRealtimeRecoveryHandlers(
	queryClient: QueryRecoveryClient,
	getNow: () => number = () => Date.now(),
) {
	let hasOpenedSocket = false;
	let lastRecoveryAt = 0;

	const refetchActiveQueries = (force = false) => {
		const now = getNow();

		if (!force && now - lastRecoveryAt < RECOVERY_THROTTLE_MS) {
			return;
		}

		lastRecoveryAt = now;
		void queryClient.refetchQueries({ type: "active" });
	};

	return {
		handleWindowFocus: () => {
			refetchActiveQueries();
		},
		handleVisibilityChange: () => {
			if (document.visibilityState === "visible") {
				refetchActiveQueries();
			}
		},
		handleWsOpen: () => {
			if (!hasOpenedSocket) {
				hasOpenedSocket = true;
				return;
			}

			refetchActiveQueries(true);
		},
	};
}

function createWsClientOptions(
	wsUrl: string,
	queryClient: QueryRecoveryClient,
): WebSocketClientOptions {
	const recovery = createRealtimeRecoveryHandlers(queryClient);

	return {
		url: wsUrl,
		lazy: {
			enabled: true,
			closeMs: 10_000,
		},
		onOpen: recovery.handleWsOpen,
	};
}

/**
 * Create a new QueryClient instance
 *
 * Per official tRPC + React Query SSR pattern:
 * - Server: Always create new instance per request
 * - Browser: Reuse single instance to avoid re-creating on suspense
 */
function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000, // 1 minute
				refetchOnWindowFocus: false,
				refetchOnReconnect: true,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
	if (typeof window === "undefined") {
		// Server: always make a new query client
		return makeQueryClient();
	} else {
		// Browser: make a new query client if we don't already have one
		// This is very important, so we don't re-make a new client if React
		// suspends during the initial render
		if (!browserQueryClient) browserQueryClient = makeQueryClient();
		return browserQueryClient;
	}
}

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

	if (typeof window !== "undefined") {
		// Browser: use environment variable or empty string for same-origin requests
		baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
	} else {
		// SSR/Server: use environment variable or default to localhost
		baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
	}

	// Remove trailing slash to prevent double-slash in URLs like //trpc/
	return baseUrl.replace(/\/$/, "");
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
	if (typeof window === "undefined") {
		// SSR context: return dummy URL (WebSocket won't be used server-side)
		return "ws://localhost:3001/trpc-ws";
	}

	const baseUrl = process.env.NEXT_PUBLIC_API_URL;

	if (baseUrl) {
		// Explicit backend URL provided - use it
		// Convert http(s):// to ws(s)://
		const isSecure = baseUrl.startsWith("https://");
		const protocol = isSecure ? "wss:" : "ws:";

		// Remove protocol and trailing slash from URL
		const urlWithoutProtocol = baseUrl
			.replace(/^https?:\/\//, "")
			.replace(/\/$/, "");

		return `${protocol}//${urlWithoutProtocol}/trpc-ws`;
	}

	// No explicit API URL: use current location (works when proxied through same domain)
	const isSecure = window.location.protocol === "https:";
	const protocol = isSecure ? "wss:" : "ws:";

	return `${protocol}//${window.location.host}/trpc-ws`;
}

/**
 * TRPCProvider wraps the app with tRPC and TanStack Query providers
 *
 * Following official tRPC + React Query SSR pattern:
 * - QueryClient: Singleton in browser, new instance per request on server
 * - tRPC client: Created once in useState, stable for component lifetime
 * - WebSocket: Added client-side only via useEffect after hydration
 *
 * Configuration:
 * - Uses real WebSocket (wsLink) for subscriptions for better performance
 * - Falls back to HTTP batch link for queries and mutations
 * - Works with both same-domain and separate-domain deployments
 *
 * Environment Setup (for separate domain deployments):
 * Set NEXT_PUBLIC_API_URL to your backend domain:
 *   Development: http://localhost:3001
 *   Production: https://api.example.com
 *
 * References:
 * - https://trpc.io/docs/client/tanstack-react-query/setup
 * - https://tanstack.com/query/latest/docs/framework/react/guides/ssr
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
	// Use official SSR-safe QueryClient pattern
	const queryClient = getQueryClient();

	React.useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const recovery = createRealtimeRecoveryHandlers(queryClient);

		window.addEventListener("focus", recovery.handleWindowFocus);
		document.addEventListener(
			"visibilitychange",
			recovery.handleVisibilityChange,
		);

		return () => {
			window.removeEventListener("focus", recovery.handleWindowFocus);
			document.removeEventListener(
				"visibilitychange",
				recovery.handleVisibilityChange,
			);
		};
	}, [queryClient]);

	/**
	 * Initialize tRPC client once with stable configuration
	 *
	 * Per official tRPC SSR pattern:
	 * - Create client in useState for stability across renders
	 * - Use splitLink to route subscriptions vs queries/mutations
	 * - WebSocket client is lazy (only connects when needed)
	 * - SSR-safe: WebSocket only works in browser
	 */
	const [trpcClient] = React.useState(() => {
		const baseUrl = getBaseUrl();
		const httpUrl = `${baseUrl}/trpc`;
		const wsUrl = getWsUrl();

		// Create WebSocket client (lazy, won't connect until first subscription)
		// SSR-safe: typeof window check happens inside wsLink
		const wsClient =
			typeof window !== "undefined"
				? createWSClient(createWsClientOptions(wsUrl, queryClient))
				: null;

		return trpc.createClient({
			links: [
				splitLink({
					// Route subscriptions through WebSocket (if available)
					condition: (op) => op.type === "subscription",
					// Subscriptions: use WebSocket if available, otherwise fall back to HTTP
					true: wsClient
						? wsLink<AppRouter>({ client: wsClient })
						: httpBatchLink({
								url: httpUrl,
								fetch: (url, options) => {
									return fetch(url, {
										...options,
										credentials: "include",
									});
								},
							}),
					// Queries and mutations: always use HTTP batch link
					false: httpBatchLink({
						url: httpUrl,
						fetch: (url, options) => {
							return fetch(url, {
								...options,
								credentials: "include",
							});
						},
					}),
				}),
			],
		});
	});

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>
				{children}
				{process.env.NODE_ENV === "development" && (
					<ReactQueryDevtools initialIsOpen={false} />
				)}
			</QueryClientProvider>
		</trpc.Provider>
	);
}
