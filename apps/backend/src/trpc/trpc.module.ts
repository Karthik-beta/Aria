import { Module } from "@nestjs/common";
import { AssetModule } from "../apps/asset/asset.module";
import { InventoryModule } from "../apps/inventory/inventory.module";
import { AdminRouter } from "./routers/admin-router.service";
import { TrpcContext } from "./trpc.context";
import { TrpcService } from "./trpc.service";

@Module({
	imports: [InventoryModule, AssetModule],
	providers: [TrpcContext, TrpcService, AdminRouter],
	exports: [TrpcContext, TrpcService],
})
export class TrpcModule {}
