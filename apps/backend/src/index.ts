/**
 * Backend Package Exports
 *
 * This file exports types that can be imported by other applications in the monorepo,
 * particularly the frontend for tRPC type safety.
 *
 * Usage in frontend:
 * ```typescript
 * import type { AppRouter } from 'backend';
 * ```
 */

export type { AppRouter } from './trpc/trpc.service';
