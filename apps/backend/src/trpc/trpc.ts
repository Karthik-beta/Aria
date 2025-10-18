import { initTRPC } from '@trpc/server';
import type { TrpcContext } from './trpc.context';

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
