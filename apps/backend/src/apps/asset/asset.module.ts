import { Module } from "@nestjs/common";
import { AssetService } from "./asset.service";
import { AssetCategoryService } from "./asset-category.service";
import { AssetCoreService } from "./asset-core.service";
import { AssetDashboardSubService } from "./asset-dashboard.service";
import { AssetFinanceBookService } from "./asset-finance-book.service";
import { AssetLocationService } from "./asset-location.service";
import { AssetMaintenanceService } from "./asset-maintenance.service";
import { AssetMaintenanceTeamService } from "./asset-maintenance-team.service";
import { AssetReportsService } from "./asset-reports.service";
import { AssetStatusService } from "./asset-status.service";
import { AssetValueAdjustmentService } from "./asset-value-adjustment.service";
import { DepreciationProcessingModule } from "./depreciation/depreciation-processing.module";
import { AssetRouter } from "./trpc/asset.router";

@Module({
	imports: [DepreciationProcessingModule],
	providers: [
		AssetService,
		AssetCoreService,
		AssetValueAdjustmentService,
		AssetReportsService,
		AssetLocationService,
		AssetFinanceBookService,
		AssetCategoryService,
		AssetMaintenanceTeamService,
		AssetMaintenanceService,
		AssetDashboardSubService,
		AssetStatusService,
		AssetRouter,
	],
	exports: [AssetRouter],
})
export class AssetModule {}
