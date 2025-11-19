import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { InventoryModule } from './apps/inventory/inventory.module';
import { DatabaseModule } from './shared/database.module';
import { TrpcModule } from './trpc/trpc.module';
import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from './authorization/authorization.module';

@Module({
  imports: [
    DatabaseModule,
    AuthorizationModule, // Authorization must be imported before other modules
    InventoryModule,
    TrpcModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
