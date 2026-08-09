import { ReportTemplateService } from "@aria/report-export";
import { Asset } from "@aria/types";
import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { orgProcedure, router } from "../../../trpc/trpc";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetService } from "../asset.service";

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
	constructor(
		private readonly eventEmitter: EventEmitter2,
		private readonly assetService: AssetService,
	) {}

	getRouter() {
		const svc = this.assetService;
		const assetProcedure = orgProcedure();

		return router({
			// ── Finance Books ──────────────────────────────────────────────────
			listFinanceBooks: assetProcedure
				.input(Asset.listFinanceBooksSchema)
				.query(async ({ input }) => svc.findAllFinanceBooks(input)),

			createFinanceBook: assetProcedure
				.input(Asset.createFinanceBookSchema)
				.mutation(async ({ input }) => svc.createFinanceBook(input)),

			updateFinanceBook: assetProcedure
				.input(Asset.updateFinanceBookSchema)
				.mutation(async ({ input }) => svc.updateFinanceBook(input)),

			deleteFinanceBook: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => svc.deleteFinanceBook(input.id)),

			// ── Asset CRUD ────────────────────────────────────────────────────
			listAssets: assetProcedure
				.input(Asset.listAssetsSchema)
				.query(async ({ input }) => svc.findAllAssets(input)),

			listAssetActivityReport: assetProcedure
				.input(Asset.listAssetActivityReportSchema)
				.query(async ({ input }) => svc.findAssetActivityReport(input)),

			listAssetDepreciationLedger: assetProcedure
				.input(Asset.listAssetDepreciationLedgerSchema)
				.query(async ({ input }) => svc.findAssetDepreciationLedger(input)),

			listAssetDepreciationsAndBalances: assetProcedure
				.input(Asset.listAssetDepreciationsAndBalancesSchema)
				.query(async ({ input }) =>
					svc.findAssetDepreciationsAndBalances(input),
				),

			listFixedAssetRegisterReport: assetProcedure
				.input(Asset.listFixedAssetRegisterReportSchema)
				.query(async ({ input }) => svc.findFixedAssetRegisterReport(input)),

			getAssetById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findAssetById(input.id)),

			getAssetDepreciationSchedules: assetProcedure
				.input(Asset.getAssetDepreciationSchedulesSchema)
				.query(async ({ input }) =>
					svc.listAssetDepreciationSchedules(input.assetId),
				),

			getAssetByBarcode: assetProcedure
				.input(z.object({ barcode: z.string().min(1) }))
				.query(async ({ input }) => {
					const asset = await svc.findAssetByBarcode(input.barcode);
					if (!asset) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Asset with barcode "${input.barcode}" not found`,
						});
					}
					return asset;
				}),

			createAsset: assetProcedure
				.input(Asset.createAssetSchema)
				.mutation(async ({ input }) => {
					const asset = await svc.createAsset(input);
					this.eventEmitter.emit("assetsChanged", {
						type: "created",
						data: asset,
					} satisfies AssetsChangedEvent);
					return asset;
				}),

			updateAsset: assetProcedure
				.input(Asset.updateAssetSchema)
				.mutation(async ({ input }) => {
					const asset = await svc.updateAsset(input);
					this.eventEmitter.emit("assetsChanged", {
						type: "updated",
						data: asset,
					} satisfies AssetsChangedEvent);
					return asset;
				}),

			submitAsset: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const asset = await svc.submitAsset(input.id);
					this.eventEmitter.emit("assetsChanged", {
						type: "updated",
						data: asset,
					} satisfies AssetsChangedEvent);
					return asset;
				}),

			cancelAsset: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const asset = await svc.cancelAsset(input.id);
					this.eventEmitter.emit("assetsChanged", {
						type: "updated",
						data: asset,
					} satisfies AssetsChangedEvent);
					return asset;
				}),

			deleteAsset: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteAsset(input.id);
					this.eventEmitter.emit("assetsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetsChangedEvent);
					return result;
				}),

			deleteManyAssets: assetProcedure
				.input(Asset.bulkDeleteAssetsSchema)
				.mutation(async ({ input }) => {
					const result = await svc.deleteManyAssets(input.ids);
					for (const id of input.ids) {
						this.eventEmitter.emit("assetsChanged", {
							type: "deleted",
							data: { id },
						} satisfies AssetsChangedEvent);
					}
					return result;
				}),

			// ── Asset Value Adjustment ───────────────────────────────────────
			listAssetValueAdjustments: assetProcedure
				.input(Asset.listAssetValueAdjustmentsSchema.optional())
				.query(async ({ input }) => svc.findAllAssetValueAdjustments(input)),

			getAssetValueAdjustmentById: assetProcedure
				.input(Asset.getAssetValueAdjustmentSchema)
				.query(async ({ input }) => svc.findAssetValueAdjustmentById(input.id)),

			previewAssetValueAdjustment: assetProcedure
				.input(Asset.previewAssetValueAdjustmentSchema)
				.query(async ({ input }) => svc.previewAssetValueAdjustment(input)),

			createAssetValueAdjustment: assetProcedure
				.input(Asset.createAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const adjustment = await svc.createAssetValueAdjustment(input);
					this.eventEmitter.emit("assetValueAdjustmentsChanged", {
						type: "created",
						data: adjustment,
					} satisfies AssetValueAdjustmentsChangedEvent);
					return adjustment;
				}),

			updateAssetValueAdjustment: assetProcedure
				.input(Asset.updateAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const adjustment = await svc.updateAssetValueAdjustment(input);
					this.eventEmitter.emit("assetValueAdjustmentsChanged", {
						type: "updated",
						data: adjustment,
					} satisfies AssetValueAdjustmentsChangedEvent);
					return adjustment;
				}),

			submitAssetValueAdjustment: assetProcedure
				.input(Asset.submitAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const adjustment = await svc.submitAssetValueAdjustment(input);
					this.eventEmitter.emit("assetValueAdjustmentsChanged", {
						type: "submitted",
						data: adjustment,
					} satisfies AssetValueAdjustmentsChangedEvent);
					this.eventEmitter.emit("assetsChanged", {
						type: "updated",
						data: await svc.findAssetById(adjustment.assetId).then((asset) => {
							if (!asset) {
								throw new TRPCError({
									code: "NOT_FOUND",
									message: `Asset ${adjustment.assetId} not found after submitting adjustment`,
								});
							}
							return asset;
						}),
					} satisfies AssetsChangedEvent);
					return adjustment;
				}),

			cancelAssetValueAdjustment: assetProcedure
				.input(Asset.cancelAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const adjustment = await svc.cancelAssetValueAdjustment(input);
					this.eventEmitter.emit("assetValueAdjustmentsChanged", {
						type: "cancelled",
						data: adjustment,
					} satisfies AssetValueAdjustmentsChangedEvent);
					this.eventEmitter.emit("assetsChanged", {
						type: "updated",
						data: await svc.findAssetById(adjustment.assetId).then((asset) => {
							if (!asset) {
								throw new TRPCError({
									code: "NOT_FOUND",
									message: `Asset ${adjustment.assetId} not found after cancelling adjustment`,
								});
							}
							return asset;
						}),
					} satisfies AssetsChangedEvent);
					return adjustment;
				}),

			deleteAssetValueAdjustment: assetProcedure
				.input(Asset.deleteAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const result = await svc.deleteAssetValueAdjustment(input.id);
					this.eventEmitter.emit("assetValueAdjustmentsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetValueAdjustmentsChangedEvent);
					return result;
				}),

			// ── Location CRUD ─────────────────────────────────────────────────
			listLocations: assetProcedure
				.input(Asset.listLocationsSchema)
				.query(async ({ input }) => svc.findAllLocations(input)),

			getLocationById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findLocationById(input.id)),

			createLocation: assetProcedure
				.input(Asset.createLocationSchema)
				.mutation(async ({ input }) => {
					const loc = await svc.createLocation(input);
					this.eventEmitter.emit("locationsChanged", {
						type: "created",
						data: loc,
					} satisfies LocationsChangedEvent);
					return loc;
				}),

			updateLocation: assetProcedure
				.input(Asset.updateLocationSchema)
				.mutation(async ({ input }) => {
					const loc = await svc.updateLocation(input);
					this.eventEmitter.emit("locationsChanged", {
						type: "updated",
						data: loc,
					} satisfies LocationsChangedEvent);
					return loc;
				}),

			deleteLocation: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteLocation(input.id);
					this.eventEmitter.emit("locationsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies LocationsChangedEvent);
					return result;
				}),

			// ── Asset Category CRUD ───────────────────────────────────────────
			listAssetCategories: assetProcedure
				.input(Asset.listAssetCategoriesSchema)
				.query(async ({ input }) => svc.findAllAssetCategories(input)),

			getAssetCategoryById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findAssetCategoryById(input.id)),

			createAssetCategory: assetProcedure
				.input(Asset.createAssetCategorySchema)
				.mutation(async ({ input }) => {
					const cat = await svc.createAssetCategory(input);
					this.eventEmitter.emit("assetCategoriesChanged", {
						type: "created",
						data: cat,
					} satisfies AssetCategoriesChangedEvent);
					return cat;
				}),

			updateAssetCategory: assetProcedure
				.input(Asset.updateAssetCategorySchema)
				.mutation(async ({ input }) => {
					const cat = await svc.updateAssetCategory(input);
					this.eventEmitter.emit("assetCategoriesChanged", {
						type: "updated",
						data: cat,
					} satisfies AssetCategoriesChangedEvent);
					return cat;
				}),

			deleteAssetCategory: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteAssetCategory(input.id);
					this.eventEmitter.emit("assetCategoriesChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetCategoriesChangedEvent);
					return result;
				}),

			// ── Dashboard ─────────────────────────────────────────────────────
			getDashboardData: assetProcedure.query(async () =>
				svc.getDashboardData(),
			),
			getDashboardOverviewData: assetProcedure.query(async () =>
				svc.getDashboardOverviewData(),
			),
			getDashboardTopChartsData: assetProcedure.query(async () =>
				svc.getDashboardTopChartsData(),
			),
			getDashboardBottomChartsData: assetProcedure.query(async () =>
				svc.getDashboardBottomChartsData(),
			),

			// ── Subscriptions ─────────────────────────────────────────────────
			onAssetsChanged: assetProcedure.subscription(() =>
				observable<AssetsChangedEvent>((emit) => {
					const handler = (event: AssetsChangedEvent) => emit.next(event);
					this.eventEmitter.on("assetsChanged", handler);
					return () => this.eventEmitter.off("assetsChanged", handler);
				}),
			),

			onLocationsChanged: assetProcedure.subscription(() =>
				observable<LocationsChangedEvent>((emit) => {
					const handler = (event: LocationsChangedEvent) => emit.next(event);
					this.eventEmitter.on("locationsChanged", handler);
					return () => this.eventEmitter.off("locationsChanged", handler);
				}),
			),

			onAssetCategoriesChanged: assetProcedure.subscription(() =>
				observable<AssetCategoriesChangedEvent>((emit) => {
					const handler = (event: AssetCategoriesChangedEvent) =>
						emit.next(event);
					this.eventEmitter.on("assetCategoriesChanged", handler);
					return () => this.eventEmitter.off("assetCategoriesChanged", handler);
				}),
			),

			onAssetValueAdjustmentsChanged: assetProcedure.subscription(() =>
				observable<AssetValueAdjustmentsChangedEvent>((emit) => {
					const handler = (event: AssetValueAdjustmentsChangedEvent) =>
						emit.next(event);
					this.eventEmitter.on("assetValueAdjustmentsChanged", handler);
					return () =>
						this.eventEmitter.off("assetValueAdjustmentsChanged", handler);
				}),
			),

			// ── Asset Maintenance Team CRUD ───────────────────────────────────
			listMaintenanceTeams: assetProcedure
				.input(Asset.listMaintenanceTeamsSchema)
				.query(async ({ input }) => svc.findAllMaintenanceTeams(input)),

			getMaintenanceTeamById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findMaintenanceTeamById(input.id)),

			createMaintenanceTeam: assetProcedure
				.input(Asset.createMaintenanceTeamSchema)
				.mutation(async ({ input }) => {
					const team = await svc.createMaintenanceTeam(input);
					this.eventEmitter.emit("maintenanceTeamsChanged", {
						type: "created",
						data: team,
					} satisfies MaintenanceTeamsChangedEvent);
					return team;
				}),

			updateMaintenanceTeam: assetProcedure
				.input(Asset.updateMaintenanceTeamSchema)
				.mutation(async ({ input }) => {
					const team = await svc.updateMaintenanceTeam(input);
					this.eventEmitter.emit("maintenanceTeamsChanged", {
						type: "updated",
						data: team,
					} satisfies MaintenanceTeamsChangedEvent);
					return team;
				}),

			deleteMaintenanceTeam: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteMaintenanceTeam(input.id);
					this.eventEmitter.emit("maintenanceTeamsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies MaintenanceTeamsChangedEvent);
					return result;
				}),

			deleteManyMaintenanceTeams: assetProcedure
				.input(Asset.bulkDeleteMaintenanceTeamsSchema)
				.mutation(async ({ input }) => {
					const result = await svc.deleteManyMaintenanceTeams(input.ids);
					for (const id of input.ids) {
						this.eventEmitter.emit("maintenanceTeamsChanged", {
							type: "deleted",
							data: { id },
						} satisfies MaintenanceTeamsChangedEvent);
					}
					return result;
				}),

			onMaintenanceTeamsChanged: assetProcedure.subscription(() =>
				observable<MaintenanceTeamsChangedEvent>((emit) => {
					const handler = (event: MaintenanceTeamsChangedEvent) =>
						emit.next(event);
					this.eventEmitter.on("maintenanceTeamsChanged", handler);
					return () =>
						this.eventEmitter.off("maintenanceTeamsChanged", handler);
				}),
			),

			// ── Asset Maintenance CRUD ─────────────────────────────────────────
			listAssetMaintenances: assetProcedure
				.input(Asset.listAssetMaintenancesSchema)
				.query(async ({ input }) => svc.findAllAssetMaintenances(input)),

			getAssetMaintenanceById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findAssetMaintenanceById(input.id)),

			getAssetMaintenanceByAssetId: assetProcedure
				.input(z.object({ assetId: z.string().cuid() }))
				.query(async ({ input }) =>
					svc.findAssetMaintenanceByAssetId(input.assetId),
				),

			getAssetMaintenanceLogs: assetProcedure
				.input(z.object({ maintenanceId: z.string().cuid() }))
				.query(async ({ input }) =>
					svc.findAssetMaintenanceLogs(input.maintenanceId),
				),

			listAssetMaintenanceLogs: assetProcedure
				.input(Asset.listAssetMaintenanceLogsSchema.optional())
				.query(async ({ input }) => svc.findAllAssetMaintenanceLogs(input)),

			cancelAssetMaintenanceLog: assetProcedure
				.input(Asset.cancelAssetMaintenanceLogSchema)
				.mutation(async ({ input }) => {
					const log = await svc.cancelAssetMaintenanceLog(input);
					this.eventEmitter.emit("assetMaintenancesChanged", {
						type: "log_completed",
						data: { id: input.logId },
					} satisfies AssetMaintenancesChangedEvent);
					return log;
				}),

			createAssetMaintenance: assetProcedure
				.input(Asset.createAssetMaintenanceSchema)
				.mutation(async ({ input }) => {
					const record = await svc.createAssetMaintenance(input);
					this.eventEmitter.emit("assetMaintenancesChanged", {
						type: "created",
						data: record,
					} satisfies AssetMaintenancesChangedEvent);
					return record;
				}),

			updateAssetMaintenance: assetProcedure
				.input(Asset.updateAssetMaintenanceSchema)
				.mutation(async ({ input }) => {
					const record = await svc.updateAssetMaintenance(input);
					this.eventEmitter.emit("assetMaintenancesChanged", {
						type: "updated",
						data: record,
					} satisfies AssetMaintenancesChangedEvent);
					return record;
				}),

			deleteAssetMaintenance: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteAssetMaintenance(input.id);
					this.eventEmitter.emit("assetMaintenancesChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetMaintenancesChangedEvent);
					return result;
				}),

			deleteManyAssetMaintenances: assetProcedure
				.input(Asset.bulkDeleteAssetMaintenancesSchema)
				.mutation(async ({ input }) => {
					const result = await svc.deleteManyAssetMaintenances(input.ids);
					for (const id of input.ids) {
						this.eventEmitter.emit("assetMaintenancesChanged", {
							type: "deleted",
							data: { id },
						} satisfies AssetMaintenancesChangedEvent);
					}
					return result;
				}),

			completeAssetMaintenanceLog: assetProcedure
				.input(Asset.completeAssetMaintenanceLogSchema)
				.mutation(async ({ input }) => {
					const log = await svc.completeAssetMaintenanceLog(input);
					this.eventEmitter.emit("assetMaintenancesChanged", {
						type: "log_completed",
						data: { id: input.logId },
					} satisfies AssetMaintenancesChangedEvent);
					return log;
				}),

			onAssetMaintenancesChanged: assetProcedure.subscription(() =>
				observable<AssetMaintenancesChangedEvent>((emit) => {
					const handler = (event: AssetMaintenancesChangedEvent) =>
						emit.next(event);
					this.eventEmitter.on("assetMaintenancesChanged", handler);
					return () =>
						this.eventEmitter.off("assetMaintenancesChanged", handler);
				}),
			),

			// ── Excel Export Procedures ──────────────────────────────────────
			exportAssetDepreciationsAndBalancesExcel: assetProcedure
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

			exportAssetDepreciationLedgerExcel: assetProcedure
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

			exportAssetActivityExcel: assetProcedure
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

			exportFixedAssetRegisterExcel: assetProcedure
				.input(Asset.listFixedAssetRegisterReportSchema)
				.mutation(async ({ input }) => {
					const reportTemplateService = new ReportTemplateService();
					const result = await svc.findFixedAssetRegisterReport(input);

					const columns = [
						{ key: "groupingLabel", header: "Group" },
						{ key: "assetSeries", header: "Asset Series" },
						{ key: "assetName", header: "Asset Name" },
						{ key: "assetCategoryName", header: "Category" },
						{ key: "locationName", header: "Location" },
						{ key: "company", header: "Company" },
						{ key: "purchaseDate", header: "Purchase Date" },
						{ key: "status", header: "Status" },
						{ key: "netPurchaseAmount", header: "Purchase Amount" },
						{
							key: "openingAccumulatedDepreciation",
							header: "Opening Depreciation",
						},
						{ key: "depreciatedAmount", header: "Depreciated Amount" },
						{ key: "revaluationAmount", header: "Revaluation Amount" },
						{ key: "netBookValue", header: "Net Book Value" },
					];

					const filters: Array<{ label: string; value: string }> = [];
					if (input.company)
						filters.push({ label: "Company", value: input.company });
					if (input.groupBy)
						filters.push({ label: "Group By", value: input.groupBy });
					if (input.assetCategory)
						filters.push({ label: "Category", value: input.assetCategory });
					if (input.location)
						filters.push({ label: "Location", value: input.location });
					filters.push({
						label: "From",
						value: input.fromDate.toLocaleDateString("en-IN"),
					});
					filters.push({
						label: "To",
						value: input.toDate.toLocaleDateString("en-IN"),
					});

					const metadata = {
						title: "Fixed Asset Register Report",
						generatedAt: new Date(),
						filters,
					};

					return reportTemplateService.buildExcelBuffer(
						metadata,
						result.rows as unknown as Record<string, unknown>[],
						columns,
					);
				}),

			// ── Phase 2 Lifecycle Procedures ─────────────────────────────────

			scrapAsset: assetProcedure
				.input(Asset.scrapAssetSchema)
				.mutation(async ({ input, ctx }) => svc.scrapAsset(input, ctx.user.id)),

			sellAsset: assetProcedure
				.input(Asset.sellAssetSchema)
				.mutation(async ({ input, ctx }) => svc.sellAsset(input, ctx.user.id)),

			restoreAsset: assetProcedure
				.input(Asset.restoreAssetSchema)
				.mutation(async ({ input, ctx }) =>
					svc.restoreAsset(input, ctx.user.id),
				),

			createAssetMovement: assetProcedure
				.input(Asset.createAssetMovementSchema)
				.mutation(async ({ input }) => svc.createAssetMovement(input)),

			submitAssetMovement: assetProcedure
				.input(Asset.submitAssetMovementSchema)
				.mutation(async ({ input, ctx }) =>
					svc.submitAssetMovement(input, ctx.user.id),
				),

			cancelAssetMovement: assetProcedure
				.input(Asset.cancelAssetMovementSchema)
				.mutation(async ({ input, ctx }) =>
					svc.cancelAssetMovement(input, ctx.user.id),
				),

			getAssetMovementById: assetProcedure
				.input(Asset.getAssetMovementSchema)
				.query(async ({ input }) => svc.findMovementById(input.id)),

			listAssetMovements: assetProcedure
				.input(Asset.listAssetMovementsSchema)
				.query(async ({ input }) => svc.listMovements(input)),

			createAssetRepair: assetProcedure
				.input(Asset.createAssetRepairSchema)
				.mutation(async ({ input, ctx }) =>
					svc.createAssetRepair(input, ctx.user.id),
				),

			submitAssetRepair: assetProcedure
				.input(Asset.submitAssetRepairSchema)
				.mutation(async ({ input, ctx }) =>
					svc.submitAssetRepair(input, ctx.user.id),
				),

			cancelAssetRepair: assetProcedure
				.input(Asset.cancelAssetRepairSchema)
				.mutation(async ({ input, ctx }) =>
					svc.cancelAssetRepair(input, ctx.user.id),
				),

			getAssetRepairById: assetProcedure
				.input(Asset.getAssetRepairSchema)
				.query(async ({ input }) => svc.findRepairById(input.id)),

			listAssetRepairs: assetProcedure
				.input(Asset.listAssetRepairsSchema)
				.query(async ({ input }) => svc.listRepairs(input)),

			createAssetCapitalization: assetProcedure
				.input(Asset.createAssetCapitalizationSchema)
				.mutation(async ({ input }) => svc.createAssetCapitalization(input)),

			submitAssetCapitalization: assetProcedure
				.input(Asset.submitAssetCapitalizationSchema)
				.mutation(async ({ input, ctx }) =>
					svc.submitAssetCapitalization(input, ctx.user.id),
				),

			cancelAssetCapitalization: assetProcedure
				.input(Asset.cancelAssetCapitalizationSchema)
				.mutation(async ({ input, ctx }) =>
					svc.cancelAssetCapitalization(input, ctx.user.id),
				),

			getAssetCapitalizationById: assetProcedure
				.input(Asset.getAssetCapitalizationSchema)
				.query(async ({ input }) => svc.findCapitalizationById(input.id)),

			listAssetCapitalizations: assetProcedure
				.input(Asset.listAssetCapitalizationsSchema)
				.query(async ({ input }) => svc.listCapitalizations(input)),

			getAssetDisposalById: assetProcedure
				.input(Asset.getAssetDisposalSchema)
				.query(async ({ input }) => svc.findDisposalById(input.id)),

			listAssetDisposals: assetProcedure
				.input(Asset.listAssetDisposalsSchema)
				.query(async ({ input }) => svc.listDisposals(input)),
		});
	}
}
