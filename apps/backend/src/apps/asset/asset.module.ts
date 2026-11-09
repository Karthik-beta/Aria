import { Module } from "@nestjs/common";
import { AssetService } from "./asset.service";
import { AssetDashboardSubService } from "./asset-dashboard.service";
import { DepreciationProcessingModule } from "./depreciation/depreciation-processing.module";
import { AssetRouter } from "./trpc/asset.router";

@Module({
	imports: [DepreciationProcessingModule],
	providers: [AssetService, AssetDashboardSubService, AssetRouter],
	exports: [AssetRouter],
})
export class AssetModule {}
