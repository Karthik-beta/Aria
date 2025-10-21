import { Injectable } from '@nestjs/common';
import { Inventory } from '@aria/types';
import { publicProcedure, router } from '../../../trpc/trpc';
import { InventoryService } from '../inventory.service';
import { z } from 'zod';
import { EventEmitter } from 'events';
import { observable } from '@trpc/server/observable';

// Global event emitter for real-time subscriptions
const inventoryEvents = new EventEmitter();

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
          const item = await this.inventoryService.create(input);
          // Emit event for subscriptions
          inventoryEvents.emit('itemCreated', item);
          return item;
        }),

      updateItem: publicProcedure
        .input(Inventory.updateSchema)
        .mutation(async ({ input }) => {
          const item = await this.inventoryService.update(
            input as Inventory.UpdateInput,
          );
          // Emit event for subscriptions
          inventoryEvents.emit('itemUpdated', item);
          return item;
        }),

      deleteItem: publicProcedure
        .input(z.object({ id: z.string().min(1) }))
        .mutation(async ({ input }) => {
          await this.inventoryService.delete(input.id);
          // Emit event for subscriptions
          inventoryEvents.emit('itemDeleted', { id: input.id });
          return { success: true, id: input.id };
        }),

      // Subscription: Listen for item creation
      onItemCreated: publicProcedure.subscription(() => {
        return observable<Inventory.Item>((emit) => {
          const onCreated = (data: Inventory.Item) => {
            emit.next(data);
          };

          inventoryEvents.on('itemCreated', onCreated);

          // Cleanup on unsubscribe
          return () => {
            inventoryEvents.off('itemCreated', onCreated);
          };
        });
      }),

      // Subscription: Listen for item updates
      onItemUpdated: publicProcedure.subscription(() => {
        return observable<Inventory.Item>((emit) => {
          const onUpdated = (data: Inventory.Item) => {
            emit.next(data);
          };

          inventoryEvents.on('itemUpdated', onUpdated);

          return () => {
            inventoryEvents.off('itemUpdated', onUpdated);
          };
        });
      }),

      // Subscription: Listen for item deletion
      onItemDeleted: publicProcedure.subscription(() => {
        return observable<{ id: string }>((emit) => {
          const onDeleted = (data: { id: string }) => {
            emit.next(data);
          };

          inventoryEvents.on('itemDeleted', onDeleted);

          return () => {
            inventoryEvents.off('itemDeleted', onDeleted);
          };
        });
      }),

      // Combined subscription for all CRUD events
      onItemsChanged: publicProcedure.subscription(() => {
        return observable<{
          type: 'created' | 'updated' | 'deleted';
          data: Inventory.Item | { id: string };
        }>((emit) => {
          const onCreated = (data: Inventory.Item) => {
            emit.next({ type: 'created', data });
          };

          const onUpdated = (data: Inventory.Item) => {
            emit.next({ type: 'updated', data });
          };

          const onDeleted = (data: { id: string }) => {
            emit.next({ type: 'deleted', data });
          };

          inventoryEvents.on('itemCreated', onCreated);
          inventoryEvents.on('itemUpdated', onUpdated);
          inventoryEvents.on('itemDeleted', onDeleted);

          return () => {
            inventoryEvents.off('itemCreated', onCreated);
            inventoryEvents.off('itemUpdated', onUpdated);
            inventoryEvents.off('itemDeleted', onDeleted);
          };
        });
      }),
    });
  }
}
