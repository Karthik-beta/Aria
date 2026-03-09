import { Injectable } from "@nestjs/common";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { PrismaService } from "../shared/prisma.service";

export type TrpcRequestLike = {
	headers: Record<string, string | string[] | undefined>;
	[key: string]: unknown;
};

export type TrpcResponseLike = Record<string, unknown>;

/**
 * tRPC Context for Express adapter
 *
 * @remarks
 * Following official tRPC Express adapter pattern: context receives req and res
 * from CreateExpressContextOptions. This enables per-request context including
 * cookies, headers, and authentication state.
 *
 * Per official docs: createContext is called for each incoming request
 * See: https://trpc.io/docs/server/adapters/express
 */
export interface TrpcContextType {
	req?: TrpcRequestLike;
	res?: TrpcResponseLike;
	prisma: PrismaService;
}

@Injectable()
export class TrpcContext {
	constructor(public readonly prisma: PrismaService) {}

	/**
	 * Create context for tRPC Express adapter
	 *
	 * @param opts - Express request and response objects from tRPC adapter
	 * @returns Context object with req, res, and injected services
	 */
	create(opts: CreateExpressContextOptions): TrpcContextType {
		return {
			req: opts.req as unknown as TrpcRequestLike,
			res: opts.res as unknown as TrpcResponseLike,
			prisma: this.prisma,
		};
	}
}
