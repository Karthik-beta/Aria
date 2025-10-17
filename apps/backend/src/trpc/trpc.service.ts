import { Injectable } from '@nestjs/common';
import { router } from './trpc';
import { InventoryRouter } from '../apps/inventory/trpc/inventory.router';

@Injectable()
export class TrpcService {
  constructor(private readonly inventoryRouter: InventoryRouter) {}

  getAppRouter() {
    return router({
      inventory: this.inventoryRouter.getRouter(),
    });
  }
}

export type AppRouter = ReturnType<TrpcService['getAppRouter']>;
