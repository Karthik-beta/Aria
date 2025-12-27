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
  // Development bypass - Allow access without session if DISABLE_AUTH is set
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.DISABLE_AUTH === 'true'
  ) {
    // Attempt to find the default admin user for a more realistic development experience
    // otherwise fallback to a generic mock user
    return next({
      ctx: {
        ...ctx,
        user: {
          id: 'dev-admin-id',
          email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@aria.local',
          emailVerified: true,
          name: process.env.DEFAULT_ADMIN_NAME || 'System Administrator',
          createdAt: new Date(),
          updatedAt: new Date(),
          username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
          displayUsername: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
        },
        session: {
          id: 'dev-session-id',
          userId: 'dev-admin-id',
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
        },
      },
    });
  }

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
      ...ctx,
      user: session.user,
      session: session.session,
    },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const middleware = t.middleware;
