import { Module } from "@nestjs/common";
import { AssetService } from "./asset.service";
import { AssetAccountingService } from "./asset-accounting.service";
import { AssetDashboardSubService } from "./asset-dashboard.service";
import { AssetStockPostingService } from "./asset-stock-posting.service";
import { DepreciationProcessingModule } from "./depreciation/depreciation-processing.module";
import { FixedAssetRegisterReportService } from "./fixed-asset-register-report";
import { AssetRouter } from "./trpc/asset.router";

@Module({
	imports: [DepreciationProcessingModule],
	providers: [
		AssetService,
		AssetAccountingService,
		AssetStockPostingService,
		AssetDashboardSubService,
		FixedAssetRegisterReportService,
		AssetRouter,
	],
	exports: [AssetRouter],
})
export class AssetModule {}
