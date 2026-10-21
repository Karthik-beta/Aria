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
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetLocationService } from "../asset-location.service";

/** Organization roles allowed to change asset records. */
export const ASSET_MANAGER_ROLES = ["owner", "admin"];

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
		private readonly locationService: AssetLocationService,
	) {}

	getRouter() {
		const svc = this.assetService;
		// Reads, exports and completing maintenance logs are open to every org
		// member; anything that creates, changes, submits, cancels or deletes
		// records needs an org owner or admin.
		const assetProcedure = orgProcedure();
		const managerProcedure = orgProcedure(ASSET_MANAGER_ROLES);

		return router({
			// ── Finance Books ──────────────────────────────────────────────────
			listFinanceBooks: assetProcedure
				.input(Asset.listFinanceBooksSchema)
				.query(async ({ input }) => svc.findAllFinanceBooks(input)),

			createFinanceBook: managerProcedure
				.input(Asset.createFinanceBookSchema)
				.mutation(async ({ input }) => svc.createFinanceBook(input)),

			updateFinanceBook: managerProcedure
				.input(Asset.updateFinanceBookSchema)
				.mutation(async ({ input }) => svc.updateFinanceBook(input)),

			deleteFinanceBook: managerProcedure
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

			getAssetById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findAssetById(input.id)),

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

			createAsset: managerProcedure
				.input(Asset.createAssetSchema)
				.mutation(async ({ input }) => {
					const asset = await svc.createAsset(input);
					this.eventEmitter.emit("assetsChanged", {
						type: "created",
						data: asset,
					} satisfies AssetsChangedEvent);
					return asset;
				}),

			updateAsset: managerProcedure
				.input(Asset.updateAssetSchema)
				.mutation(async ({ input }) => {
					const asset = await svc.updateAsset(input);
					this.eventEmitter.emit("assetsChanged", {
						type: "updated",
						data: asset,
					} satisfies AssetsChangedEvent);
					return asset;
				}),

			submitAsset: managerProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const asset = await svc.submitAsset(input.id);
					this.eventEmitter.emit("assetsChanged", {
						type: "updated",
						data: asset,
					} satisfies AssetsChangedEvent);
					return asset;
				}),

			cancelAsset: managerProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const asset = await svc.cancelAsset(input.id);
					this.eventEmitter.emit("assetsChanged", {
						type: "updated",
						data: asset,
					} satisfies AssetsChangedEvent);
					return asset;
				}),

			deleteAsset: managerProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteAsset(input.id);
					this.eventEmitter.emit("assetsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetsChangedEvent);
					return result;
				}),

			deleteManyAssets: managerProcedure
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

			createAssetValueAdjustment: managerProcedure
				.input(Asset.createAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const adjustment = await svc.createAssetValueAdjustment(input);
					this.eventEmitter.emit("assetValueAdjustmentsChanged", {
						type: "created",
						data: adjustment,
					} satisfies AssetValueAdjustmentsChangedEvent);
					return adjustment;
				}),

			updateAssetValueAdjustment: managerProcedure
				.input(Asset.updateAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const adjustment = await svc.updateAssetValueAdjustment(input);
					this.eventEmitter.emit("assetValueAdjustmentsChanged", {
						type: "updated",
						data: adjustment,
					} satisfies AssetValueAdjustmentsChangedEvent);
					return adjustment;
				}),

			submitAssetValueAdjustment: managerProcedure
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

			cancelAssetValueAdjustment: managerProcedure
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

			deleteAssetValueAdjustment: managerProcedure
				.input(Asset.deleteAssetValueAdjustmentSchema)
				.mutation(async ({ input }) => {
					const result = await svc.deleteAssetValueAdjustment(input.id);
					this.eventEmitter.emit("assetValueAdjustmentsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetValueAdjustmentsChangedEvent);
					return result;
				}),

			// ── Employee lookup (asset custodian) ─────────────────────────────
			listEmployees: assetProcedure
				.input(Asset.listEmployeesSchema)
				.query(async ({ input }) => svc.findAllEmployees(input)),

			// ── Location CRUD ─────────────────────────────────────────────────
			listLocations: assetProcedure
				.input(Asset.listLocationsSchema)
				.query(async ({ input }) => svc.findAllLocations(input)),

			getLocationById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input }) => svc.findLocationById(input.id)),

			createLocation: managerProcedure
				.input(Asset.createLocationSchema)
				.mutation(async ({ input }) => {
					const loc = await svc.createLocation(input);
					this.eventEmitter.emit("locationsChanged", {
						type: "created",
						data: loc,
					} satisfies LocationsChangedEvent);
					return loc;
				}),

			updateLocation: managerProcedure
				.input(Asset.updateLocationSchema)
				.mutation(async ({ input }) => {
					const loc = await svc.updateLocation(input);
					this.eventEmitter.emit("locationsChanged", {
						type: "updated",
						data: loc,
					} satisfies LocationsChangedEvent);
					return loc;
				}),

			deleteLocation: managerProcedure
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

			createAssetCategory: managerProcedure
				.input(Asset.createAssetCategorySchema)
				.mutation(async ({ input }) => {
					const cat = await svc.createAssetCategory(input);
					this.eventEmitter.emit("assetCategoriesChanged", {
						type: "created",
						data: cat,
					} satisfies AssetCategoriesChangedEvent);
					return cat;
				}),

			updateAssetCategory: managerProcedure
				.input(Asset.updateAssetCategorySchema)
				.mutation(async ({ input }) => {
					const cat = await svc.updateAssetCategory(input);
					this.eventEmitter.emit("assetCategoriesChanged", {
						type: "updated",
						data: cat,
					} satisfies AssetCategoriesChangedEvent);
					return cat;
				}),

			deleteAssetCategory: managerProcedure
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

			createMaintenanceTeam: managerProcedure
				.input(Asset.createMaintenanceTeamSchema)
				.mutation(async ({ input }) => {
					const team = await svc.createMaintenanceTeam(input);
					this.eventEmitter.emit("maintenanceTeamsChanged", {
						type: "created",
						data: team,
					} satisfies MaintenanceTeamsChangedEvent);
					return team;
				}),

			updateMaintenanceTeam: managerProcedure
				.input(Asset.updateMaintenanceTeamSchema)
				.mutation(async ({ input }) => {
					const team = await svc.updateMaintenanceTeam(input);
					this.eventEmitter.emit("maintenanceTeamsChanged", {
						type: "updated",
						data: team,
					} satisfies MaintenanceTeamsChangedEvent);
					return team;
				}),

			deleteMaintenanceTeam: managerProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteMaintenanceTeam(input.id);
					this.eventEmitter.emit("maintenanceTeamsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies MaintenanceTeamsChangedEvent);
					return result;
				}),

			deleteManyMaintenanceTeams: managerProcedure
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

			cancelAssetMaintenanceLog: managerProcedure
				.input(Asset.cancelAssetMaintenanceLogSchema)
				.mutation(async ({ input }) => {
					const log = await svc.cancelAssetMaintenanceLog(input);
					this.eventEmitter.emit("assetMaintenancesChanged", {
						type: "log_completed",
						data: { id: input.logId },
					} satisfies AssetMaintenancesChangedEvent);
					return log;
				}),

			createAssetMaintenance: managerProcedure
				.input(Asset.createAssetMaintenanceSchema)
				.mutation(async ({ input }) => {
					const record = await svc.createAssetMaintenance(input);
					this.eventEmitter.emit("assetMaintenancesChanged", {
						type: "created",
						data: record,
					} satisfies AssetMaintenancesChangedEvent);
					return record;
				}),

			updateAssetMaintenance: managerProcedure
				.input(Asset.updateAssetMaintenanceSchema)
				.mutation(async ({ input }) => {
					const record = await svc.updateAssetMaintenance(input);
					this.eventEmitter.emit("assetMaintenancesChanged", {
						type: "updated",
						data: record,
					} satisfies AssetMaintenancesChangedEvent);
					return record;
				}),

			deleteAssetMaintenance: managerProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input }) => {
					const result = await svc.deleteAssetMaintenance(input.id);
					this.eventEmitter.emit("assetMaintenancesChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies AssetMaintenancesChangedEvent);
					return result;
				}),

			deleteManyAssetMaintenances: managerProcedure
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

			// ── Location hierarchy ────────────────────────────────────────────
			getLocationTree: assetProcedure
				.input(Asset.locationTreeInputSchema)
				.query(async ({ input }) =>
					this.locationService.getLocationTree(input),
				),

			listLocationChildren: assetProcedure
				.input(Asset.listLocationChildrenInputSchema)
				.query(async ({ input }) =>
					this.locationService.listLocationChildren(input),
				),

			getLocationAncestors: assetProcedure
				.input(Asset.getLocationAncestorsInputSchema)
				.query(async ({ input }) =>
					this.locationService.getLocationAncestors(input.id),
				),
		});
	}
}
