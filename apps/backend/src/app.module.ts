import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InventoryModule } from './apps/inventory/inventory.module';
import { DatabaseModule } from './shared/database.module';
import { TrpcModule } from './trpc/trpc.module';

@Module({
  imports: [DatabaseModule, InventoryModule, TrpcModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
