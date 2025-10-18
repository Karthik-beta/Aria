/**
 * tRPC Client Configuration
 *
 * This module exports the tRPC client and provider for use throughout the frontend.
 *
 * Usage:
 * - Import `trpc` to use type-safe hooks in React components
 * - Import `TRPCProvider` to wrap your app in layout.tsx
 *
 * Example:
 * ```tsx
 * import { trpc } from '@/lib/trpc';
 *
 * function MyComponent() {
 *   const { data, isLoading } = trpc.inventory.listItems.useQuery();
 *   // ...
 * }
 * ```
 */

export { trpc, trpcClient } from './client';
export { TRPCProvider } from './provider';
