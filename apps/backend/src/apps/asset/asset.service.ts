/**
 * Asset service facade — keeps the public `AssetService` API stable while the
 * implementation lives in focused sub-services.
 *
 * Every method is a one-line delegate:
 * - `AssetCoreService` — assets (CRUD, submit, cancel)
 * - `AssetValueAdjustmentService` — asset value adjustments
 * - `AssetReportsService` — activity, depreciation ledger and balances reports
 * - `AssetLocationService` — locations and the employee lookup
 * - `AssetFinanceBookService` — finance books
 * - `AssetCategoryService` — asset categories
 * - `AssetMaintenanceTeamService` — maintenance teams
 * - `AssetMaintenanceService` — maintenance schedules and logs
 * - `AssetDashboardSubService` — dashboard metrics
 *
 * New features add their own service and register it in `AssetModule` rather
 * than adding methods here.
 *
 * Follows the ERPNext Asset module business logic.
 *
 * @module AssetService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/asset | ERPNext Asset}
 */
import type { Asset } from "@aria/types";
import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetCategoryService } from "./asset-category.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetCoreService } from "./asset-core.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetDashboardSubService } from "./asset-dashboard.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetFinanceBookService } from "./asset-finance-book.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetLocationService } from "./asset-location.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetMaintenanceService } from "./asset-maintenance.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetMaintenanceTeamService } from "./asset-maintenance-team.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetReportsService } from "./asset-reports.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetValueAdjustmentService } from "./asset-value-adjustment.service";

@Injectable()
export class AssetService {
	constructor(
		private readonly dashboard: AssetDashboardSubService,
		private readonly core: AssetCoreService,
		private readonly valueAdjustment: AssetValueAdjustmentService,
		private readonly reports: AssetReportsService,
		private readonly location: AssetLocationService,
		private readonly financeBook: AssetFinanceBookService,
		private readonly category: AssetCategoryService,
		private readonly maintenanceTeam: AssetMaintenanceTeamService,
		private readonly maintenance: AssetMaintenanceService,
	) {}

	async getDashboardData(): Promise<Asset.AssetDashboardData> {
		return this.dashboard.getDashboardData();
	}

	async getDashboardOverviewData(): Promise<Asset.AssetDashboardOverviewData> {
		return this.dashboard.getDashboardOverviewData();
	}

	async getDashboardTopChartsData(): Promise<Asset.AssetDashboardTopChartsData> {
		return this.dashboard.getDashboardTopChartsData();
	}

	async getDashboardBottomChartsData(): Promise<Asset.AssetDashboardBottomChartsData> {
		return this.dashboard.getDashboardBottomChartsData();
	}

	async findAllAssets(
		params?: Asset.ListAssetsInput,
	): Promise<Asset.AssetListResult> {
		return this.core.findAllAssets(params);
	}

	async findAssetById(id: string): Promise<Asset.AssetItem | null> {
		return this.core.findAssetById(id);
	}

	async findAssetByBarcode(barcode: string): Promise<Asset.AssetItem | null> {
		return this.core.findAssetByBarcode(barcode);
	}

	async createAsset(input: Asset.CreateAssetInput): Promise<Asset.AssetItem> {
		return this.core.createAsset(input);
	}

	async updateAsset(input: Asset.UpdateAssetInput): Promise<Asset.AssetItem> {
		return this.core.updateAsset(input);
	}

	async submitAsset(id: string): Promise<Asset.AssetItem> {
		return this.core.submitAsset(id);
	}

	async cancelAsset(id: string): Promise<Asset.AssetItem> {
		return this.core.cancelAsset(id);
	}

	async deleteAsset(id: string): Promise<{ success: boolean; id: string }> {
		return this.core.deleteAsset(id);
	}

	async deleteManyAssets(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return this.core.deleteManyAssets(ids);
	}

	async findAssetActivityReport(
		input: Asset.ListAssetActivityReportInput,
	): Promise<Asset.AssetActivityReportResult> {
		return this.reports.findAssetActivityReport(input);
	}

	async findAssetDepreciationLedger(
		input: Asset.ListAssetDepreciationLedgerInput,
	): Promise<Asset.AssetDepreciationLedgerResult> {
		return this.reports.findAssetDepreciationLedger(input);
	}

	async findAssetDepreciationsAndBalances(
		input: Asset.ListAssetDepreciationsAndBalancesInput,
	): Promise<Asset.AssetDepreciationsAndBalancesResult> {
		return this.reports.findAssetDepreciationsAndBalances(input);
	}

	async findAllAssetValueAdjustments(
		params?: Asset.ListAssetValueAdjustmentsInput,
	): Promise<Asset.AssetValueAdjustmentListResult> {
		return this.valueAdjustment.findAllAssetValueAdjustments(params);
	}

	async findAssetValueAdjustmentById(
		id: string,
	): Promise<Asset.AssetValueAdjustmentItem | null> {
		return this.valueAdjustment.findAssetValueAdjustmentById(id);
	}

	async previewAssetValueAdjustment(
		input: Asset.PreviewAssetValueAdjustmentInput,
	): Promise<Asset.AssetValueAdjustmentPreview> {
		return this.valueAdjustment.previewAssetValueAdjustment(input);
	}

	async createAssetValueAdjustment(
		input: Asset.CreateAssetValueAdjustmentInput,
	): Promise<Asset.AssetValueAdjustmentItem> {
		return this.valueAdjustment.createAssetValueAdjustment(input);
	}

	async updateAssetValueAdjustment(
		input: Asset.UpdateAssetValueAdjustmentInput,
	): Promise<Asset.AssetValueAdjustmentItem> {
		return this.valueAdjustment.updateAssetValueAdjustment(input);
	}

	async submitAssetValueAdjustment(
		input: Asset.SubmitAssetValueAdjustmentInput,
	): Promise<Asset.AssetValueAdjustmentItem> {
		return this.valueAdjustment.submitAssetValueAdjustment(input);
	}

	async cancelAssetValueAdjustment(
		input: Asset.CancelAssetValueAdjustmentInput,
	): Promise<Asset.AssetValueAdjustmentItem> {
		return this.valueAdjustment.cancelAssetValueAdjustment(input);
	}

	async deleteAssetValueAdjustment(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return this.valueAdjustment.deleteAssetValueAdjustment(id);
	}

	async findAllLocations(
		params?: Asset.ListLocationsInput,
	): Promise<Asset.LocationListResult> {
		return this.location.findAllLocations(params);
	}

	async findAllEmployees(
		params?: Asset.ListEmployeesInput,
	): Promise<Asset.EmployeeListResult> {
		return this.location.findAllEmployees(params);
	}

	async findLocationById(id: string): Promise<Asset.Location | null> {
		return this.location.findLocationById(id);
	}

	async createLocation(
		input: Asset.CreateLocationInput,
	): Promise<Asset.Location> {
		return this.location.createLocation(input);
	}

	async updateLocation(
		input: Asset.UpdateLocationInput,
	): Promise<Asset.Location> {
		return this.location.updateLocation(input);
	}

	async deleteLocation(id: string): Promise<{ success: boolean; id: string }> {
		return this.location.deleteLocation(id);
	}

	async findAllFinanceBooks(params?: {
		skip?: number;
		take?: number;
		search?: string;
	}): Promise<Asset.FinanceBookListResult> {
		return this.financeBook.findAllFinanceBooks(params);
	}

	async createFinanceBook(input: { name: string }): Promise<Asset.FinanceBook> {
		return this.financeBook.createFinanceBook(input);
	}

	async updateFinanceBook(input: {
		id: string;
		name: string;
	}): Promise<Asset.FinanceBook> {
		return this.financeBook.updateFinanceBook(input);
	}

	async deleteFinanceBook(id: string): Promise<{ success: true; id: string }> {
		return this.financeBook.deleteFinanceBook(id);
	}

	async findAllAssetCategories(
		params?: Asset.ListAssetCategoriesInput,
	): Promise<Asset.AssetCategoryListResult> {
		return this.category.findAllAssetCategories(params);
	}

	async findAssetCategoryById(id: string): Promise<Asset.AssetCategory | null> {
		return this.category.findAssetCategoryById(id);
	}

	async createAssetCategory(
		input: Asset.CreateAssetCategoryInput,
	): Promise<Asset.AssetCategory> {
		return this.category.createAssetCategory(input);
	}

	async updateAssetCategory(
		input: Asset.UpdateAssetCategoryInput,
	): Promise<Asset.AssetCategory> {
		return this.category.updateAssetCategory(input);
	}

	async deleteAssetCategory(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return this.category.deleteAssetCategory(id);
	}

	async findAllMaintenanceTeams(
		params?: Asset.ListMaintenanceTeamsInput,
	): Promise<Asset.AssetMaintenanceTeamListResult> {
		return this.maintenanceTeam.findAllMaintenanceTeams(params);
	}

	async findMaintenanceTeamById(
		id: string,
	): Promise<Asset.AssetMaintenanceTeam | null> {
		return this.maintenanceTeam.findMaintenanceTeamById(id);
	}

	async createMaintenanceTeam(
		input: Asset.CreateAssetMaintenanceTeamInput,
	): Promise<Asset.AssetMaintenanceTeam> {
		return this.maintenanceTeam.createMaintenanceTeam(input);
	}

	async updateMaintenanceTeam(
		input: Asset.UpdateAssetMaintenanceTeamInput,
	): Promise<Asset.AssetMaintenanceTeam> {
		return this.maintenanceTeam.updateMaintenanceTeam(input);
	}

	async deleteMaintenanceTeam(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return this.maintenanceTeam.deleteMaintenanceTeam(id);
	}

	async deleteManyMaintenanceTeams(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return this.maintenanceTeam.deleteManyMaintenanceTeams(ids);
	}

	calculateNextDueDate(
		periodicity: Asset.AssetMaintenancePeriodicity,
		startDate: Date,
		endDate: Date | null | undefined,
		lastCompletionDate: Date | null | undefined,
	): Date | null {
		return this.maintenance.calculateNextDueDate(
			periodicity,
			startDate,
			endDate,
			lastCompletionDate,
		);
	}

	async findAllAssetMaintenances(
		params?: Asset.ListAssetMaintenancesInput,
	): Promise<Asset.AssetMaintenanceListResult> {
		return this.maintenance.findAllAssetMaintenances(params);
	}

	async findAssetMaintenanceById(
		id: string,
	): Promise<Asset.AssetMaintenanceRecord | null> {
		return this.maintenance.findAssetMaintenanceById(id);
	}

	async findAssetMaintenanceByAssetId(
		assetId: string,
	): Promise<Asset.AssetMaintenanceRecord | null> {
		return this.maintenance.findAssetMaintenanceByAssetId(assetId);
	}

	async findAssetMaintenanceLogs(
		maintenanceId: string,
	): Promise<Asset.AssetMaintenanceLogItem[]> {
		return this.maintenance.findAssetMaintenanceLogs(maintenanceId);
	}

	async findAllAssetMaintenanceLogs(
		params?: Asset.ListAssetMaintenanceLogsInput,
	): Promise<Asset.AssetMaintenanceLogListResult> {
		return this.maintenance.findAllAssetMaintenanceLogs(params);
	}

	async cancelAssetMaintenanceLog(
		input: Asset.CancelAssetMaintenanceLogInput,
	): Promise<Asset.AssetMaintenanceLogItem> {
		return this.maintenance.cancelAssetMaintenanceLog(input);
	}

	async createAssetMaintenance(
		input: Asset.CreateAssetMaintenanceInput,
	): Promise<Asset.AssetMaintenanceRecord> {
		return this.maintenance.createAssetMaintenance(input);
	}

	async updateAssetMaintenance(
		input: Asset.UpdateAssetMaintenanceInput,
	): Promise<Asset.AssetMaintenanceRecord> {
		return this.maintenance.updateAssetMaintenance(input);
	}

	async deleteAssetMaintenance(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		return this.maintenance.deleteAssetMaintenance(id);
	}

	async deleteManyAssetMaintenances(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		return this.maintenance.deleteManyAssetMaintenances(ids);
	}

	async completeAssetMaintenanceLog(
		input: Asset.CompleteAssetMaintenanceLogInput,
	): Promise<Asset.AssetMaintenanceLogItem> {
		return this.maintenance.completeAssetMaintenanceLog(input);
	}
}
