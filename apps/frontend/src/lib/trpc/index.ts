/**
 * tRPC Client Configuration
 *
 * This module exports the main provider component and trpc hooks object.
 *
 * Clean dependency graph (no circular dependencies):
 * 1. client.ts - Creates the trpc object (leaf node, zero dependencies)
 * 2. provider.tsx - Imports trpc from client.ts to create the provider
 * 3. index.ts - Re-exports both from their separate locations
 * 4. Components - Import from index.ts
 *
 * Usage:
 * - Import `TRPCProvider` to wrap your app in layout.tsx
 * - Import `trpc` from '@/lib/trpc' in components to use hooks
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

// Export the trpc object from client.ts
export { trpc } from "./client";
// Export the provider from provider.tsx
export { TRPCProvider } from "./provider";
