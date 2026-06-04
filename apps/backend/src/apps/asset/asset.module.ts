import { Module } from "@nestjs/common";
import { AssetService } from "./asset.service";
import { AssetDashboardSubService } from "./asset-dashboard.service";
import { AssetRouter } from "./trpc/asset.router";

@Module({
	providers: [AssetService, AssetDashboardSubService, AssetRouter],
	exports: [AssetRouter],
})
export class AssetModule {}
