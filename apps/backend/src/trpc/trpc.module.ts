import { Module } from '@nestjs/common';
import { TrpcContext } from './trpc.context';
import { TrpcService } from './trpc.service';
import { InventoryModule } from '../apps/inventory/inventory.module';
import { InventoryRouter } from '../apps/inventory/trpc/inventory.router';

@Module({
  imports: [InventoryModule],
  providers: [TrpcContext, TrpcService, InventoryRouter],
  exports: [TrpcContext, TrpcService],
})
export class TrpcModule {}
