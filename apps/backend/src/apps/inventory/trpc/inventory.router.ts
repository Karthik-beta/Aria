import { Injectable } from '@nestjs/common';
import { Inventory } from '@aria/types';
import { publicProcedure, router } from '../../../trpc/trpc';
import { InventoryService } from '../inventory.service';
import { z } from 'zod';

@Injectable()
export class InventoryRouter {
  constructor(private readonly inventoryService: InventoryService) {}

  getRouter() {
    return router({
      listItems: publicProcedure.query(async () => {
        return this.inventoryService.findAll();
      }),

      createItem: publicProcedure
        .input(Inventory.createSchema)
        .mutation(async ({ input }: { input: Inventory.CreateInput }) => {
          return this.inventoryService.create(input);
        }),

      updateItem: publicProcedure
        .input(Inventory.updateSchema)
        .mutation(async ({ input }) => {
          return this.inventoryService.update(input as Inventory.UpdateInput);
        }),

      deleteItem: publicProcedure
        .input(z.object({ id: z.cuid() }))
        .mutation(async ({ input }) => {
          return this.inventoryService.delete(input.id);
        }),
    });
  }
}
