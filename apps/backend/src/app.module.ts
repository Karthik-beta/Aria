import { Module } from "@nestjs/common";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AssetModule } from "./apps/asset/asset.module";
import { InventoryModule } from "./apps/inventory/inventory.module";
// import { AuthModule } from './auth/auth.module';
import { AuthorizationModule } from "./authorization/authorization.module";
import { DatabaseModule } from "./shared/database.module";
import { TrpcModule } from "./trpc/trpc.module";

@Module({
	imports: [
		DatabaseModule,
		AuthorizationModule, // Authorization must be imported before other modules
		InventoryModule,
		AssetModule,
		TrpcModule,
		// AuthModule,
		PrometheusModule.register(),
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
