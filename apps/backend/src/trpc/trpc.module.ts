import { Module } from "@nestjs/common";
import { AssetModule } from "../apps/asset/asset.module";
import { CompanyModule } from "../apps/company/company.module";
import { InventoryModule } from "../apps/inventory/inventory.module";
import { TrpcContext } from "./trpc.context";
import { TrpcService } from "./trpc.service";

@Module({
	imports: [InventoryModule, AssetModule, CompanyModule],
	providers: [TrpcContext, TrpcService],
	exports: [TrpcContext, TrpcService],
})
export class TrpcModule {}
