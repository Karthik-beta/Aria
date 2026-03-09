"use client";

import type { AppRouter } from "@aria/api-contract";
import { createTRPCReact } from "@trpc/react-query";

/**
 * Create tRPC React hooks
 *
 * This is the central 'trpc' object that provides all the
 * type-safe hooks for your components.
 *
 * This file is intentionally separate from provider.tsx to avoid
 * circular dependency issues. It should be imported by provider.tsx
 * and any components that need to use tRPC hooks.
 */
export const trpc = createTRPCReact<AppRouter>();
