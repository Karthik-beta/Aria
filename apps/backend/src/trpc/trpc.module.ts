import { Module } from '@nestjs/common';
import { TrpcContext } from './trpc.context';
import { TrpcService } from './trpc.service';
import { InventoryModule } from '../apps/inventory/inventory.module';
import { AdminRouter } from './routers/admin-router.service';

@Module({
  imports: [InventoryModule],
  providers: [TrpcContext, TrpcService, AdminRouter],
  exports: [TrpcContext, TrpcService],
})
export class TrpcModule {}
