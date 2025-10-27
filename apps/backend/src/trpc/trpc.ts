import { initTRPC } from '@trpc/server';
import type { TrpcContext } from './trpc.context';
import { TrpcAuthGuard } from '../auth/guards/trpc-auth.guard';

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
export const authedProcedure = t.procedure.use(TrpcAuthGuard);
