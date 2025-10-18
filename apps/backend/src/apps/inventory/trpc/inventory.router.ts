import { Injectable } from '@nestjs/common';
import { Inventory } from '@aria/types';
import { publicProcedure, router } from '../../../trpc/trpc';
import { InventoryService } from '../inventory.service';

@Injectable()
export class InventoryRouter {
  constructor(private readonly inventoryService: InventoryService) {}

  getRouter() {
    return router({
      listItems: publicProcedure
        .output(Inventory.itemSchema.array())
        .query(async () => {
          return this.inventoryService.findAll();
        }),

      createItem: publicProcedure
        .input(Inventory.createInputSchema)
        .output(Inventory.itemSchema)
        .mutation(async ({ input }) => {
          return this.inventoryService.create(input);
        }),
    });
  }
}
