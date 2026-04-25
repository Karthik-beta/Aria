import { EventEmitter } from "node:events";
import { ReportTemplateService } from "@aria/report-export";
import { Asset } from "@aria/types";
import { Injectable } from "@nestjs/common";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { protectedProcedure, router } from "../../../trpc/trpc";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetService } from "../asset.service";

// Global event emitter for real-time asset subscriptions
const assetEvents = new EventEmitter({ captureRejections: true });
assetEvents.setMaxListeners(50);

type AssetsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.AssetItem | { id: string };
};

type LocationsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.Location | { id: string };
};

type AssetCategoriesChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.AssetCategory | { id: string };
};

type AssetValueAdjustmentsChangedEvent = {
	type: "created" | "updated" | "submitted" | "cancelled" | "deleted";
	data: Asset.AssetValueAdjustmentItem | { id: string };
};

type MaintenanceTeamsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.AssetMaintenanceTeam | { id: string };
};

type AssetMaintenancesChangedEvent = {
	type: "created" | "updated" | "deleted" | "log_completed";
	data: Asset.AssetMaintenanceRecord | { id: string };
};

@Injectable()
export class AssetRouter {
	constructor(private readonly assetService: AssetService) {}

	getRouter() {
		const svc = this.assetService;

		return router({
			// ── Asset CRUD ────────────────────────────────────────────────────
			listAssets: protectedProcedure
				.input(Asset.listAssetsSchema)
				.query(async ({ input }) => svc.findAllAssets(input)),

			listAssetActivityReport: protectedProcedure
				.input(Asset.listAssetActivityReportSchema)
				.query(async ({ input }) => svc.findAssetActivityReport(input)),

			listAssetDepreciationLedger: protectedProcedure
				.input(Asset.listAssetDepreciationLedgerSchema)
				.query(async ({ input }) => svc.findAssetDepreciationLedger(input)),

			listAssetDepreciationsAndBalances: protectedProcedure
				.input(Asset.listAssetDepreciationsAndBalancesSchema)
				.query(async ({ input }) =>
					svc.findAssetDepreciationsAndBalances(input),
				),

			getAssetById: protectedProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findAssetById(input.id)),

			createAsset: protectedProcedure
				.input(Asset.createAssetSchema)
				.mutation(async ({ input }) => {
					const asset = await svc.createAsset(input);
					assetEvents.emit("assetsChanged", {
						type: "created",
						data: asset,
					} satisfies AssetsChangedEvent);
					return asset;
				}),

			updateAsset: protectedProcedure
				.input(Asset.updateAssetSchema)
				.mutation(async ({ input }) => {
					const asset = await svc.updateAsset(input);
					assetEvents.emit("assetsChanged", {
						type: "updated",
						data: asset,
					} satisfies AssetsChangedEvent);
					return asset;
				}),

			deleteAsset: protectedProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteAsset(input.id);
					assetEvents.emit("assetsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetsChangedEvent);
					return result;
				}),

			deleteManyAssets: protectedProcedure
				.input(Asset.bulkDeleteAssetsSchema)
				.mutation(async ({ input }) => {
					const result = await svc.deleteManyAssets(input.ids);
					for (const id of input.ids) {
						assetEvents.emit("assetsChanged", {
							type: "deleted",
							data: { id },
						} satisfies AssetsChangedEvent);
					}
					return result;
				}),

			// ── Asset Value Adjustment ───────────────────────────────────────
			listAssetValueAdjustments: protectedProcedure
				.input(Asset.listAssetValueAdjustmentsSchema.optional())
				.query(async ({ input }) => svc.findAllAssetValueAdjustments(input)),

			getAssetValueAdjustmentById: protectedProcedure
				.input(Asset.getAssetValueAdjustmentSchema)
				.query(async ({ input }) => svc.findAssetValueAdjustmentById(input.id)),

			previewAssetValueAdjustment: protectedProcedure
				.input(Asset.previewAssetValueAdjustmentSchema)
				.query(async ({ input }) => svc.previewAssetValueAdjustment(input)),

			createAssetValueAdjustment: protectedProcedure
				.input(Asset.createAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const adjustment = await svc.createAssetValueAdjustment(input);
					assetEvents.emit("assetValueAdjustmentsChanged", {
						type: "created",
						data: adjustment,
					} satisfies AssetValueAdjustmentsChangedEvent);
					return adjustment;
				}),

			updateAssetValueAdjustment: protectedProcedure
				.input(Asset.updateAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const adjustment = await svc.updateAssetValueAdjustment(input);
					assetEvents.emit("assetValueAdjustmentsChanged", {
						type: "updated",
						data: adjustment,
					} satisfies AssetValueAdjustmentsChangedEvent);
					return adjustment;
				}),

			submitAssetValueAdjustment: protectedProcedure
				.input(Asset.submitAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const adjustment = await svc.submitAssetValueAdjustment(input);
					assetEvents.emit("assetValueAdjustmentsChanged", {
						type: "submitted",
						data: adjustment,
					} satisfies AssetValueAdjustmentsChangedEvent);
					assetEvents.emit("assetsChanged", {
						type: "updated",
						data: await svc.findAssetById(adjustment.assetId).then((asset) => {
							if (!asset) {
								throw new Error(
									`Asset ${adjustment.assetId} not found after submitting adjustment`,
								);
							}
							return asset;
						}),
					} satisfies AssetsChangedEvent);
					return adjustment;
				}),

			cancelAssetValueAdjustment: protectedProcedure
				.input(Asset.cancelAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const adjustment = await svc.cancelAssetValueAdjustment(input);
					assetEvents.emit("assetValueAdjustmentsChanged", {
						type: "cancelled",
						data: adjustment,
					} satisfies AssetValueAdjustmentsChangedEvent);
					assetEvents.emit("assetsChanged", {
						type: "updated",
						data: await svc.findAssetById(adjustment.assetId).then((asset) => {
							if (!asset) {
								throw new Error(
									`Asset ${adjustment.assetId} not found after cancelling adjustment`,
								);
							}
							return asset;
						}),
					} satisfies AssetsChangedEvent);
					return adjustment;
				}),

			deleteAssetValueAdjustment: protectedProcedure
				.input(Asset.deleteAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const result = await svc.deleteAssetValueAdjustment(input.id);
					assetEvents.emit("assetValueAdjustmentsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetValueAdjustmentsChangedEvent);
					return result;
				}),

			// ── Location CRUD ─────────────────────────────────────────────────
			listLocations: protectedProcedure
				.input(Asset.listLocationsSchema)
				.query(async ({ input }) => svc.findAllLocations(input)),

			getLocationById: protectedProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findLocationById(input.id)),

			createLocation: protectedProcedure
				.input(Asset.createLocationSchema)
				.mutation(async ({ input }) => {
					const loc = await svc.createLocation(input);
					assetEvents.emit("locationsChanged", {
						type: "created",
						data: loc,
					} satisfies LocationsChangedEvent);
					return loc;
				}),

			updateLocation: protectedProcedure
				.input(Asset.updateLocationSchema)
				.mutation(async ({ input }) => {
					const loc = await svc.updateLocation(input);
					assetEvents.emit("locationsChanged", {
						type: "updated",
						data: loc,
					} satisfies LocationsChangedEvent);
					return loc;
				}),

			deleteLocation: protectedProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteLocation(input.id);
					assetEvents.emit("locationsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies LocationsChangedEvent);
					return result;
				}),

			// ── Asset Category CRUD ───────────────────────────────────────────
			listAssetCategories: protectedProcedure
				.input(Asset.listAssetCategoriesSchema)
				.query(async ({ input }) => svc.findAllAssetCategories(input)),

			getAssetCategoryById: protectedProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findAssetCategoryById(input.id)),

			createAssetCategory: protectedProcedure
				.input(Asset.createAssetCategorySchema)
				.mutation(async ({ input }) => {
					const cat = await svc.createAssetCategory(input);
					assetEvents.emit("assetCategoriesChanged", {
						type: "created",
						data: cat,
					} satisfies AssetCategoriesChangedEvent);
					return cat;
				}),

			updateAssetCategory: protectedProcedure
				.input(Asset.updateAssetCategorySchema)
				.mutation(async ({ input }) => {
					const cat = await svc.updateAssetCategory(input);
					assetEvents.emit("assetCategoriesChanged", {
						type: "updated",
						data: cat,
					} satisfies AssetCategoriesChangedEvent);
					return cat;
				}),

			deleteAssetCategory: protectedProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteAssetCategory(input.id);
					assetEvents.emit("assetCategoriesChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetCategoriesChangedEvent);
					return result;
				}),

			// ── Dashboard ─────────────────────────────────────────────────────
			getDashboardData: protectedProcedure.query(async () =>
				svc.getDashboardData(),
			),
			getDashboardOverviewData: protectedProcedure.query(async () =>
				svc.getDashboardOverviewData(),
			),
			getDashboardTopChartsData: protectedProcedure.query(async () =>
				svc.getDashboardTopChartsData(),
			),
			getDashboardBottomChartsData: protectedProcedure.query(async () =>
				svc.getDashboardBottomChartsData(),
			),

			// ── Subscriptions ─────────────────────────────────────────────────
			onAssetsChanged: protectedProcedure.subscription(() =>
				observable<AssetsChangedEvent>((emit) => {
					const handler = (event: AssetsChangedEvent) => emit.next(event);
					assetEvents.on("assetsChanged", handler);
					return () => assetEvents.off("assetsChanged", handler);
				}),
			),

			onLocationsChanged: protectedProcedure.subscription(() =>
				observable<LocationsChangedEvent>((emit) => {
					const handler = (event: LocationsChangedEvent) => emit.next(event);
					assetEvents.on("locationsChanged", handler);
					return () => assetEvents.off("locationsChanged", handler);
				}),
			),

			onAssetCategoriesChanged: protectedProcedure.subscription(() =>
				observable<AssetCategoriesChangedEvent>((emit) => {
					const handler = (event: AssetCategoriesChangedEvent) =>
						emit.next(event);
					assetEvents.on("assetCategoriesChanged", handler);
					return () => assetEvents.off("assetCategoriesChanged", handler);
				}),
			),

			onAssetValueAdjustmentsChanged: protectedProcedure.subscription(() =>
				observable<AssetValueAdjustmentsChangedEvent>((emit) => {
					const handler = (event: AssetValueAdjustmentsChangedEvent) =>
						emit.next(event);
					assetEvents.on("assetValueAdjustmentsChanged", handler);
					return () => assetEvents.off("assetValueAdjustmentsChanged", handler);
				}),
			),

			// ── Asset Maintenance Team CRUD ───────────────────────────────────
			listMaintenanceTeams: protectedProcedure
				.input(Asset.listMaintenanceTeamsSchema)
				.query(async ({ input }) => svc.findAllMaintenanceTeams(input)),

			getMaintenanceTeamById: protectedProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findMaintenanceTeamById(input.id)),

			createMaintenanceTeam: protectedProcedure
				.input(Asset.createMaintenanceTeamSchema)
				.mutation(async ({ input }) => {
					const team = await svc.createMaintenanceTeam(input);
					assetEvents.emit("maintenanceTeamsChanged", {
						type: "created",
						data: team,
					} satisfies MaintenanceTeamsChangedEvent);
					return team;
				}),

			updateMaintenanceTeam: protectedProcedure
				.input(Asset.updateMaintenanceTeamSchema)
				.mutation(async ({ input }) => {
					const team = await svc.updateMaintenanceTeam(input);
					assetEvents.emit("maintenanceTeamsChanged", {
						type: "updated",
						data: team,
					} satisfies MaintenanceTeamsChangedEvent);
					return team;
				}),

			deleteMaintenanceTeam: protectedProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteMaintenanceTeam(input.id);
					assetEvents.emit("maintenanceTeamsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies MaintenanceTeamsChangedEvent);
					return result;
				}),

			deleteManyMaintenanceTeams: protectedProcedure
				.input(Asset.bulkDeleteMaintenanceTeamsSchema)
				.mutation(async ({ input }) => {
					const result = await svc.deleteManyMaintenanceTeams(input.ids);
					for (const id of input.ids) {
						assetEvents.emit("maintenanceTeamsChanged", {
							type: "deleted",
							data: { id },
						} satisfies MaintenanceTeamsChangedEvent);
					}
					return result;
				}),

			onMaintenanceTeamsChanged: protectedProcedure.subscription(() =>
				observable<MaintenanceTeamsChangedEvent>((emit) => {
					const handler = (event: MaintenanceTeamsChangedEvent) =>
						emit.next(event);
					assetEvents.on("maintenanceTeamsChanged", handler);
					return () => assetEvents.off("maintenanceTeamsChanged", handler);
				}),
			),

			// ── Asset Maintenance CRUD ─────────────────────────────────────────
			listAssetMaintenances: protectedProcedure
				.input(Asset.listAssetMaintenancesSchema)
				.query(async ({ input }) => svc.findAllAssetMaintenances(input)),

			getAssetMaintenanceById: protectedProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findAssetMaintenanceById(input.id)),

			getAssetMaintenanceByAssetId: protectedProcedure
				.input(z.object({ assetId: z.string().cuid() }))
				.query(async ({ input }) =>
					svc.findAssetMaintenanceByAssetId(input.assetId),
				),

			getAssetMaintenanceLogs: protectedProcedure
				.input(z.object({ maintenanceId: z.string().cuid() }))
				.query(async ({ input }) =>
					svc.findAssetMaintenanceLogs(input.maintenanceId),
				),

			listAssetMaintenanceLogs: protectedProcedure
				.input(Asset.listAssetMaintenanceLogsSchema.optional())
				.query(async ({ input }) => svc.findAllAssetMaintenanceLogs(input)),

			cancelAssetMaintenanceLog: protectedProcedure
				.input(Asset.cancelAssetMaintenanceLogSchema)
				.mutation(async ({ input }) => {
					const log = await svc.cancelAssetMaintenanceLog(input);
					assetEvents.emit("assetMaintenancesChanged", {
						type: "log_completed",
						data: { id: input.logId },
					} satisfies AssetMaintenancesChangedEvent);
					return log;
				}),

			createAssetMaintenance: protectedProcedure
				.input(Asset.createAssetMaintenanceSchema)
				.mutation(async ({ input }) => {
					const record = await svc.createAssetMaintenance(input);
					assetEvents.emit("assetMaintenancesChanged", {
						type: "created",
						data: record,
					} satisfies AssetMaintenancesChangedEvent);
					return record;
				}),

			updateAssetMaintenance: protectedProcedure
				.input(Asset.updateAssetMaintenanceSchema)
				.mutation(async ({ input }) => {
					const record = await svc.updateAssetMaintenance(input);
					assetEvents.emit("assetMaintenancesChanged", {
						type: "updated",
						data: record,
					} satisfies AssetMaintenancesChangedEvent);
					return record;
				}),

			deleteAssetMaintenance: protectedProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteAssetMaintenance(input.id);
					assetEvents.emit("assetMaintenancesChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetMaintenancesChangedEvent);
					return result;
				}),

			deleteManyAssetMaintenances: protectedProcedure
				.input(Asset.bulkDeleteAssetMaintenancesSchema)
				.mutation(async ({ input }) => {
					const result = await svc.deleteManyAssetMaintenances(input.ids);
					for (const id of input.ids) {
						assetEvents.emit("assetMaintenancesChanged", {
							type: "deleted",
							data: { id },
						} satisfies AssetMaintenancesChangedEvent);
					}
					return result;
				}),

			completeAssetMaintenanceLog: protectedProcedure
				.input(Asset.completeAssetMaintenanceLogSchema)
				.mutation(async ({ input }) => {
					const log = await svc.completeAssetMaintenanceLog(input);
					assetEvents.emit("assetMaintenancesChanged", {
						type: "log_completed",
						data: { id: input.logId },
					} satisfies AssetMaintenancesChangedEvent);
					return log;
				}),

			onAssetMaintenancesChanged: protectedProcedure.subscription(() =>
				observable<AssetMaintenancesChangedEvent>((emit) => {
					const handler = (event: AssetMaintenancesChangedEvent) =>
						emit.next(event);
					assetEvents.on("assetMaintenancesChanged", handler);
					return () => assetEvents.off("assetMaintenancesChanged", handler);
				}),
			),

			// ── Excel Export Procedures ──────────────────────────────────────
			exportAssetDepreciationsAndBalancesExcel: protectedProcedure
				.input(Asset.listAssetDepreciationsAndBalancesSchema)
				.mutation(async ({ input }) => {
					const reportTemplateService = new ReportTemplateService();
					const result = await svc.findAssetDepreciationsAndBalances(input);

					const columns = [
						{ key: "groupingLabel", header: "Group" },
						{ key: "company", header: "Company" },
						{ key: "assetSeries", header: "Asset Series" },
						{ key: "assetName", header: "Asset Name" },
						{ key: "assetCategoryName", header: "Category" },
						{ key: "valueAsOnFromDate", header: "Opening Value" },
						{ key: "valueOfNewPurchase", header: "New Purchase" },
						{ key: "valueOfSoldAsset", header: "Sold Value" },
						{ key: "valueOfScrappedAsset", header: "Scrapped Value" },
						{ key: "valueAdjustmentDuringPeriod", header: "Adjustment" },
						{ key: "depreciationAmountDuringPeriod", header: "Depreciation" },
						{ key: "valueAsOnToDate", header: "Closing Value" },
						{
							key: "accumulatedDepreciationAsOnToDate",
							header: "Accumulated Depreciation",
						},
						{ key: "netAssetValueAsOnToDate", header: "Net Value" },
					];

					const filters: Array<{ label: string; value: string }> = [];
					if (input.company)
						filters.push({ label: "Company", value: input.company });
					if (input.asset) filters.push({ label: "Asset", value: input.asset });
					if (input.assetCategory)
						filters.push({ label: "Category", value: input.assetCategory });
					filters.push({
						label: "From",
						value: input.fromDate.toLocaleDateString("en-IN"),
					});
					filters.push({
						label: "To",
						value: input.toDate.toLocaleDateString("en-IN"),
					});

					const metadata = {
						title: "Asset Depreciations and Balances Report",
						generatedAt: new Date(),
						filters,
					};

					return reportTemplateService.buildExcelBuffer(
						metadata,
						result.rows as unknown as Record<string, unknown>[],
						columns,
					);
				}),

			exportAssetDepreciationLedgerExcel: protectedProcedure
				.input(Asset.listAssetDepreciationLedgerSchema)
				.mutation(async ({ input }) => {
					const reportTemplateService = new ReportTemplateService();
					const result = await svc.findAssetDepreciationLedger(input);

					const columns = [
						{ key: "assetSeries", header: "Asset Series" },
						{ key: "assetName", header: "Asset Name" },
						{ key: "assetCategoryName", header: "Category" },
						{ key: "company", header: "Company" },
						{ key: "purchaseDate", header: "Purchase Date" },
						{ key: "depreciationDate", header: "Depreciation Date" },
						{
							key: "openingAccumulatedDepreciation",
							header: "Opening Accumulated Depreciation",
						},
						{ key: "depreciationAmount", header: "Depreciation Amount" },
						{
							key: "accumulatedDepreciationAmount",
							header: "Accumulated Depreciation",
						},
						{
							key: "valueAfterDepreciation",
							header: "Value After Depreciation",
						},
						{ key: "adjustmentSeries", header: "Adjustment Series" },
						{ key: "depreciationMethod", header: "Depreciation Method" },
						{ key: "assetStatus", header: "Status" },
					];

					const filters: Array<{ label: string; value: string }> = [];
					if (input.company)
						filters.push({ label: "Company", value: input.company });
					if (input.asset) filters.push({ label: "Asset", value: input.asset });
					if (input.assetCategory)
						filters.push({ label: "Category", value: input.assetCategory });
					if (input.costCenter)
						filters.push({ label: "Cost Center", value: input.costCenter });
					filters.push({
						label: "From",
						value: input.fromDate.toLocaleDateString("en-IN"),
					});
					filters.push({
						label: "To",
						value: input.toDate.toLocaleDateString("en-IN"),
					});

					const metadata = {
						title: "Asset Depreciation Ledger Report",
						generatedAt: new Date(),
						filters,
					};

					return reportTemplateService.buildExcelBuffer(
						metadata,
						result.rows as unknown as Record<string, unknown>[],
						columns,
					);
				}),

			exportAssetActivityExcel: protectedProcedure
				.input(Asset.listAssetActivityReportSchema)
				.mutation(async ({ input }) => {
					const reportTemplateService = new ReportTemplateService();
					const result = await svc.findAssetActivityReport(input);

					const columns = [
						{ key: "assetSeries", header: "Asset Series" },
						{ key: "assetName", header: "Asset Name" },
						{ key: "assetCategoryName", header: "Category" },
						{ key: "company", header: "Company" },
						{ key: "assetStatus", header: "Status" },
						{ key: "activity", header: "Activity" },
						{ key: "createdAt", header: "Date" },
					];

					const filters: Array<{ label: string; value: string }> = [];
					if (input.company)
						filters.push({ label: "Company", value: input.company });
					if (input.asset) filters.push({ label: "Asset", value: input.asset });
					if (input.assetCategory)
						filters.push({ label: "Category", value: input.assetCategory });
					if (input.activity)
						filters.push({ label: "Activity", value: input.activity });
					filters.push({
						label: "From",
						value: input.fromDate.toLocaleDateString("en-IN"),
					});
					filters.push({
						label: "To",
						value: input.toDate.toLocaleDateString("en-IN"),
					});

					const metadata = {
						title: "Asset Activity Report",
						generatedAt: new Date(),
						filters,
					};

					return reportTemplateService.buildExcelBuffer(
						metadata,
						result.rows as unknown as Record<string, unknown>[],
						columns,
					);
				}),
		});
	}
}
