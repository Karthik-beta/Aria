import { initTRPC } from '@trpc/server';
import type { TrpcContextType } from './trpc.context';

/**
 * Initialize tRPC with Express context
 *
 * @remarks
 * Context type includes Express req/res plus injected services (Prisma)
 * This enables access to cookies, headers, and request state in procedures
 */
const t = initTRPC.context<TrpcContextType>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
