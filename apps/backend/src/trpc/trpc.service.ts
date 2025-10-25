import { Injectable, OnModuleInit } from '@nestjs/common';
import { router } from './trpc';
import { InventoryRouter } from '../apps/inventory/trpc/inventory.router';

/**
 * TrpcService is responsible for creating and managing the main tRPC router.
 *
 * Following official NestJS tRPC pattern from nestjs-trpc documentation.
 * The appRouter is created after dependency injection completes.
 */
@Injectable()
export class TrpcService implements OnModuleInit {
  public appRouter: ReturnType<typeof this.createAppRouter> | null = null;

  constructor(private readonly inventoryRouter: InventoryRouter) {}

  onModuleInit() {
    // Create the router after all dependencies are resolved
    this.appRouter = this.createAppRouter();
  }

  /**
   * Factory method to create the app router.
   * This is the single source of truth for the router structure.
   */
  createAppRouter() {
    return router({
      inventory: this.inventoryRouter.getRouter(),
    });
  }

  /**
   * Retrieve the initialized appRouter.
   * Throws if called before onModuleInit completes.
   */
  getAppRouter() {
    if (!this.appRouter) {
      throw new Error(
        'AppRouter not initialized. Make sure the module has been initialized.',
      );
    }
    return this.appRouter;
  }
}

/**
 * Export AppRouter type for client-side type safety.
 *
 * This uses ReturnType on the instance method to properly infer the router structure.
 * The type will be available in generated .d.ts files for frontend consumption.
 */
export type AppRouter = ReturnType<TrpcService['createAppRouter']>;
