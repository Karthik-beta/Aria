import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryRouter } from './trpc/inventory.router';

@Module({
  providers: [InventoryService, InventoryRouter],
  exports: [InventoryRouter],
})
export class InventoryModule {}
