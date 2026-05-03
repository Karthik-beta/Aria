import { Module } from "@nestjs/common";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AssetModule } from "./apps/asset/asset.module";
import { CompanyModule } from "./apps/company/company.module";
import { InventoryModule } from "./apps/inventory/inventory.module";
import { AuthModule } from "./auth/auth.module";
import { AuthorizationModule } from "./authorization/authorization.module";
import { DatabaseModule } from "./shared/database.module";
import { FiscalYearModule } from "./shared/fiscal-year/fiscal-year.module";
import { TrpcModule } from "./trpc/trpc.module";

@Module({
	imports: [
		DatabaseModule,
		FiscalYearModule,
		AuthModule,
		AuthorizationModule,
		InventoryModule,
		CompanyModule,
		AssetModule,
		TrpcModule,
		PrometheusModule.register(),
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
