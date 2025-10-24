import { Injectable } from '@nestjs/common';
import { router } from './trpc';
import { InventoryRouter } from '../apps/inventory/trpc/inventory.router';

@Injectable()
export class TrpcService {
  constructor(private readonly inventoryRouter: InventoryRouter) {}

  getAppRouter() {
    const appRouter = router({
      inventory: this.inventoryRouter.getRouter(),
    });
    return appRouter;
  }
}

/**
 * Export AppRouter type for client-side type safety.
 *
 * Following official tRPC pattern: https://trpc.io/docs/server/routers
 * The recommended pattern is: export type AppRouter = typeof appRouter
 *
 * In NestJS with dependency injection, we infer from the router structure
 * returned by the service method.
 */
export type AppRouter = ReturnType<TrpcService['getAppRouter']>;
