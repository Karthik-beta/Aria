import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma.service';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { Request, Response } from 'express';

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
  req?: Request;
  res?: Response;
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
      req: opts.req,
      res: opts.res,
      prisma: this.prisma,
    };
  }
}
