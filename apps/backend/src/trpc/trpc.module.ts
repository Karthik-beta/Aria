import { Module } from '@nestjs/common';
import { TrpcContext } from './trpc.context';
import { TrpcService } from './trpc.service';
import { InventoryModule } from '../apps/inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  providers: [TrpcContext, TrpcService],
  exports: [TrpcContext, TrpcService],
})
export class TrpcModule {}
