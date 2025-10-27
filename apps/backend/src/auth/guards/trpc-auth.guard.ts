import { TRPCError } from '@trpc/server';
import { auth } from '../auth.config';
import { middleware } from '../../trpc/trpc';

/**
 * tRPC middleware for protecting procedures
 *
 * @remarks
 * Verifies the user's session using better-auth and attaches the session to the context.
 * Throws a TRPCError with code 'UNAUTHORIZED' if the session is invalid.
 *
 * @returns The next middleware in the chain with the user's session attached to the context.
 */
export const TrpcAuthGuard = middleware(async ({ ctx, next }) => {
  // Get session from better-auth
  const session = await auth.getSession({
    headers: {
      cookie: ctx.req.headers.cookie,
    },
  });

  // Throw an error if the session is invalid
  if (!session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Attach the session to the context
  return next({
    ctx: {
      ...ctx,
      session,
    },
  });
});
