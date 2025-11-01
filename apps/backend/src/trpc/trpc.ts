import { initTRPC, TRPCError } from '@trpc/server';
import type { TrpcContextType } from './trpc.context';
import { auth } from '../auth/auth.config';

/**
 * Initialize tRPC with Express context
 *
 * @remarks
 * Context type includes Express req/res plus injected services (Prisma)
 * This enables access to cookies, headers, and request state in procedures
 */
const t = initTRPC.context<TrpcContextType>().create();

/**
 * Extended context type with authenticated user
 */
export type ProtectedContext = TrpcContextType & {
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    image?: string | null;
    username?: string | null;
    displayUsername?: string | null;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  };
};

/**
 * Middleware to verify user is authenticated
 */
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  if (!ctx.req) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No request context',
    });
  }

  // Get session from better-auth
  const session = await auth.api.getSession({
    headers: ctx.req.headers as any,
  });

  if (!session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  // Add user and session to context at top level
  return next({
    ctx: {
      user: session.user,
      session: session.session,
    },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const middleware = t.middleware;
