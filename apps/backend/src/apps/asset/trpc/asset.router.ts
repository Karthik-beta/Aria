import { ReportTemplateService } from "@aria/report-export";
import { Asset, normalizeDateOnly } from "@aria/types";
import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { orgProcedure, router } from "../../../trpc/trpc";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetService } from "../asset.service";
import {
	createAssetCategoryRealtimeObservable,
	createAssetRealtimeObservable,
	emitAssetCategoryRealtimeEvent,
	emitAssetRealtimeEvent,
} from "../asset-realtime";

type LocationsChangedEvent = {
	type: "created" | "updated" | "deleted";
	data: Asset.Location | { id: string };
};

const fixedAssetRegisterExportColumns = [
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
	{
		key: "accumulatedDepreciation",
		header: "Accumulated Depreciation",
	},
	{ key: "revaluationAmount", header: "Revaluation Amount" },
	{ key: "netBookValue", header: "Net Book Value" },
];

/**
 * Builds the Fixed Asset Register workbook from a trusted report scope.
 * Organization metadata comes from authenticated tRPC context, never input.
 */
export function buildFixedAssetRegisterExcel(
	input: Asset.ListFixedAssetRegisterReportInput,
	result: Asset.FixedAssetRegisterReportResult,
	organization: { id: string; name: string },
): string {
	const reportTemplateService = new ReportTemplateService();
	const filters: Array<{ label: string; value: string }> = [
		{ label: "Organization", value: organization.name },
		{ label: "Organization ID", value: organization.id },
		{ label: "Company", value: result.scope.company },
		{ label: "Company ID", value: result.scope.companyId },
		{
			label: "Finance Book",
			value: result.scope.financeBook ?? "Unassigned / none",
		},
		{
			label: "Finance Book ID",
			value: result.scope.financeBookId ?? "Unassigned / none",
		},
		{ label: "Group By", value: input.groupBy },
		{ label: "Status", value: result.scope.status },
	];

	if (input.assetCategory)
		filters.push({ label: "Category", value: input.assetCategory });
	if (input.location)
		filters.push({ label: "Location", value: input.location });
	if (input.assetId) filters.push({ label: "Asset ID", value: input.assetId });
	filters.push(
		{ label: "From", value: result.scope.fromDate },
		{ label: "To", value: result.scope.toDate },
		{ label: "As Of", value: result.scope.asOfDate },
	);

	return reportTemplateService.buildExcelBuffer(
		{
			title: "Fixed Asset Register Report",
			generatedAt: new Date(),
			filters,
		},
		result.rows as unknown as Record<string, unknown>[],
		fixedAssetRegisterExportColumns,
	);
}

@Injectable()
export class AssetRouter {
	constructor(
		private readonly eventEmitter: EventEmitter2,
		private readonly assetService: AssetService,
	) {}

	getRouter() {
		const svc = this.assetService;
		const assetProcedure = orgProcedure();
		const assetWriteProcedure = orgProcedure(["owner", "admin"]);

		return router({
			// ── Finance Books ──────────────────────────────────────────────────
			listFinanceBooks: assetProcedure
				.input(Asset.listFinanceBooksSchema)
				.query(async ({ input, ctx }) =>
					svc.findAllFinanceBooks(ctx.organization.id, input),
				),

			createFinanceBook: assetWriteProcedure
				.input(Asset.createFinanceBookSchema)
				.mutation(async ({ input, ctx }) =>
					svc.createFinanceBook(input, ctx.organization.id),
				),

			updateFinanceBook: assetWriteProcedure
				.input(Asset.updateFinanceBookSchema)
				.mutation(async ({ input, ctx }) =>
					svc.updateFinanceBook(input, ctx.organization.id),
				),

			deleteFinanceBook: assetWriteProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input, ctx }) =>
					svc.deleteFinanceBook(input.id, ctx.organization.id),
				),

			// ── Asset CRUD ────────────────────────────────────────────────────
			listAssets: assetProcedure
				.input(Asset.listAssetsSchema)
				.query(async ({ input, ctx }) =>
					svc.findAllAssets(ctx.organization.id, input),
				),

			listAssetActivityReport: assetProcedure
				.input(Asset.listAssetActivityReportSchema)
				.query(async ({ input, ctx }) =>
					svc.findAssetActivityReport(input, ctx.organization.id),
				),

			listAssetDepreciationLedger: assetProcedure
				.input(Asset.listAssetDepreciationLedgerSchema)
				.query(async ({ input, ctx }) =>
					svc.findAssetDepreciationLedger(input, ctx.organization.id),
				),

			listAssetDepreciationsAndBalances: assetProcedure
				.input(Asset.listAssetDepreciationsAndBalancesSchema)
				.query(async ({ input, ctx }) =>
					svc.findAssetDepreciationsAndBalances(input, ctx.organization.id),
				),

			listFixedAssetRegisterReport: assetProcedure
				.input(Asset.listFixedAssetRegisterReportSchema)
				.query(async ({ input, ctx }) =>
					svc.findFixedAssetRegisterReport(input, ctx.organization.id),
				),

			getAssetById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input, ctx }) =>
					svc.findAssetById(input.id, ctx.organization.id),
				),

			getAssetDepreciationSchedules: assetProcedure
				.input(Asset.getAssetDepreciationSchedulesSchema)
				.query(async ({ input, ctx }) =>
					svc.listAssetDepreciationSchedules(
						input.assetId,
						ctx.organization.id,
					),
				),

			getAssetByBarcode: assetProcedure
				.input(z.object({ barcode: z.string().min(1) }))
				.query(async ({ input, ctx }) => {
					const asset = await svc.findAssetByBarcode(
						input.barcode,
						ctx.organization.id,
					);
					if (!asset) {
						throw new TRPCError({
							code: "NOT_FOUND",
							message: `Asset with barcode "${input.barcode}" not found`,
						});
					}
					return asset;
				}),

			createAsset: assetWriteProcedure
				.input(Asset.createAssetSchema)
				.mutation(async ({ input, ctx }) => {
					const asset = await svc.createAsset(
						input,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"assets",
						"created",
						asset.id,
					);
					return asset;
				}),

			updateAsset: assetWriteProcedure
				.input(Asset.updateAssetSchema)
				.mutation(async ({ input, ctx }) => {
					const asset = await svc.updateAsset(
						input,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"assets",
						"updated",
						asset.id,
					);
					return asset;
				}),

			submitAsset: assetWriteProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input, ctx }) => {
					const asset = await svc.submitAsset(
						input.id,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"assets",
						"updated",
						asset.id,
					);
					return asset;
				}),

			cancelAsset: assetWriteProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input, ctx }) => {
					const asset = await svc.cancelAsset(
						input.id,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"assets",
						"updated",
						asset.id,
					);
					return asset;
				}),

			deleteAsset: assetWriteProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteAsset(input.id, ctx.organization.id);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"assets",
						"deleted",
						result.id,
					);
					return result;
				}),

			deleteManyAssets: assetWriteProcedure
				.input(Asset.bulkDeleteAssetsSchema)
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteManyAssets(
						input.ids,
						ctx.organization.id,
					);
					for (const id of result.ids) {
						emitAssetRealtimeEvent(
							this.eventEmitter,
							ctx.organization.id,
							"assets",
							"deleted",
							id,
						);
					}
					return result;
				}),

			// ── Asset Value Adjustment ───────────────────────────────────────
			listAssetValueAdjustments: assetProcedure
				.input(Asset.listAssetValueAdjustmentsSchema.optional())
				.query(async ({ input, ctx }) =>
					svc.findAllAssetValueAdjustments(ctx.organization.id, input),
				),

			getAssetValueAdjustmentById: assetProcedure
				.input(Asset.getAssetValueAdjustmentSchema)
				.query(async ({ input, ctx }) =>
					svc.findAssetValueAdjustmentById(input.id, ctx.organization.id),
				),

			previewAssetValueAdjustment: assetProcedure
				.input(Asset.previewAssetValueAdjustmentSchema)
				.query(async ({ input, ctx }) =>
					svc.previewAssetValueAdjustment(input, ctx.organization.id),
				),

			createAssetValueAdjustment: assetWriteProcedure
				.input(Asset.createAssetValueAdjustmentSchema)
				.mutation(async ({ input, ctx }) => {
					const adjustment = await svc.createAssetValueAdjustment(
						input,
						ctx.organization.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"valueAdjustments",
						"created",
						adjustment.id,
					);
					return adjustment;
				}),

			updateAssetValueAdjustment: assetWriteProcedure
				.input(Asset.updateAssetValueAdjustmentSchema)
				.mutation(async ({ input, ctx }) => {
					const adjustment = await svc.updateAssetValueAdjustment(
						input,
						ctx.organization.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"valueAdjustments",
						"updated",
						adjustment.id,
					);
					return adjustment;
				}),

			submitAssetValueAdjustment: assetWriteProcedure
				.input(Asset.submitAssetValueAdjustmentSchema)
				.mutation(async ({ input, ctx }) => {
					const adjustment = await svc.submitAssetValueAdjustment(
						input,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"valueAdjustments",
						"submitted",
						adjustment.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"assets",
						"updated",
						adjustment.assetId,
					);
					return adjustment;
				}),

			cancelAssetValueAdjustment: assetWriteProcedure
				.input(Asset.cancelAssetValueAdjustmentSchema)
				.mutation(async ({ input, ctx }) => {
					const adjustment = await svc.cancelAssetValueAdjustment(
						input,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"valueAdjustments",
						"cancelled",
						adjustment.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"assets",
						"updated",
						adjustment.assetId,
					);
					return adjustment;
				}),

			deleteAssetValueAdjustment: assetWriteProcedure
				.input(Asset.deleteAssetValueAdjustmentSchema)
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteAssetValueAdjustment(
						input.id,
						ctx.organization.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"valueAdjustments",
						"deleted",
						result.id,
					);
					return result;
				}),

			// ── Location CRUD ─────────────────────────────────────────────────
			listLocations: assetProcedure
				.input(Asset.listLocationsSchema)
				.query(async ({ input, ctx }) =>
					svc.findAllLocations(ctx.organization.id, input),
				),

			getLocationById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input, ctx }) =>
					svc.findLocationById(input.id, ctx.organization.id),
				),

			createLocation: assetWriteProcedure
				.input(Asset.createLocationSchema)
				.mutation(async ({ input, ctx }) => {
					const loc = await svc.createLocation(input, ctx.organization.id);
					this.eventEmitter.emit("locationsChanged", {
						type: "created",
						data: loc,
					} satisfies LocationsChangedEvent);
					return loc;
				}),

			updateLocation: assetWriteProcedure
				.input(Asset.updateLocationSchema)
				.mutation(async ({ input, ctx }) => {
					const loc = await svc.updateLocation(input, ctx.organization.id);
					this.eventEmitter.emit("locationsChanged", {
						type: "updated",
						data: loc,
					} satisfies LocationsChangedEvent);
					return loc;
				}),

			deleteLocation: assetWriteProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteLocation(
						input.id,
						ctx.organization.id,
					);
					this.eventEmitter.emit("locationsChanged", {
						type: "deleted",
						data: { id: input.id },
					} satisfies LocationsChangedEvent);
					return result;
				}),

			// ── Asset Category CRUD ───────────────────────────────────────────
			listAssetCategories: assetProcedure
				.input(Asset.listAssetCategoriesSchema)
				.query(async ({ input, ctx }) =>
					svc.findAllAssetCategories(ctx.organization.id, input),
				),

			getAssetCategoryById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input, ctx }) =>
					svc.findAssetCategoryById(input.id, ctx.organization.id),
				),

			createAssetCategory: assetWriteProcedure
				.input(Asset.createAssetCategorySchema)
				.mutation(async ({ input, ctx }) => {
					const cat = await svc.createAssetCategory(input, ctx.organization.id);
					emitAssetCategoryRealtimeEvent(this.eventEmitter, "created", cat.id);
					return cat;
				}),

			updateAssetCategory: assetWriteProcedure
				.input(Asset.updateAssetCategorySchema)
				.mutation(async ({ input, ctx }) => {
					const cat = await svc.updateAssetCategory(input, ctx.organization.id);
					emitAssetCategoryRealtimeEvent(this.eventEmitter, "updated", cat.id);
					return cat;
				}),

			deleteAssetCategory: assetWriteProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteAssetCategory(
						input.id,
						ctx.organization.id,
					);
					emitAssetCategoryRealtimeEvent(
						this.eventEmitter,
						"deleted",
						result.id,
					);
					return result;
				}),

			// ── Dashboard ─────────────────────────────────────────────────────
			getDashboardData: assetProcedure.query(async ({ ctx }) =>
				svc.getDashboardData(ctx.organization.id),
			),
			getDashboardOverviewData: assetProcedure.query(async ({ ctx }) =>
				svc.getDashboardOverviewData(ctx.organization.id),
			),
			getDashboardTopChartsData: assetProcedure.query(async ({ ctx }) =>
				svc.getDashboardTopChartsData(ctx.organization.id),
			),
			getDashboardBottomChartsData: assetProcedure.query(async ({ ctx }) =>
				svc.getDashboardBottomChartsData(ctx.organization.id),
			),

			// ── Subscriptions ─────────────────────────────────────────────────
			onAssetsChanged: assetProcedure.subscription(({ ctx }) =>
				createAssetRealtimeObservable(
					this.eventEmitter,
					ctx.organization.id,
					"assets",
				),
			),

			onLocationsChanged: assetProcedure.subscription(() =>
				observable<LocationsChangedEvent>((emit) => {
					const handler = (event: LocationsChangedEvent) => emit.next(event);
					this.eventEmitter.on("locationsChanged", handler);
					return () => this.eventEmitter.off("locationsChanged", handler);
				}),
			),

			onAssetCategoriesChanged: assetProcedure.subscription(() =>
				createAssetCategoryRealtimeObservable(this.eventEmitter),
			),

			onAssetValueAdjustmentsChanged: assetProcedure.subscription(({ ctx }) =>
				createAssetRealtimeObservable(
					this.eventEmitter,
					ctx.organization.id,
					"valueAdjustments",
				),
			),

			// ── Asset Maintenance Team CRUD ───────────────────────────────────
			listMaintenanceTeams: assetProcedure
				.input(Asset.listMaintenanceTeamsSchema)
				.query(async ({ input, ctx }) =>
					svc.findAllMaintenanceTeams(ctx.organization.id, input),
				),

			getMaintenanceTeamById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input, ctx }) =>
					svc.findMaintenanceTeamById(input.id, ctx.organization.id),
				),

			createMaintenanceTeam: assetWriteProcedure
				.input(Asset.createMaintenanceTeamSchema)
				.mutation(async ({ input, ctx }) => {
					const team = await svc.createMaintenanceTeam(
						input,
						ctx.organization.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"maintenanceTeams",
						"created",
						team.id,
					);
					return team;
				}),

			updateMaintenanceTeam: assetWriteProcedure
				.input(Asset.updateMaintenanceTeamSchema)
				.mutation(async ({ input, ctx }) => {
					const team = await svc.updateMaintenanceTeam(
						input,
						ctx.organization.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"maintenanceTeams",
						"updated",
						team.id,
					);
					return team;
				}),

			deleteMaintenanceTeam: assetWriteProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteMaintenanceTeam(
						input.id,
						ctx.organization.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"maintenanceTeams",
						"deleted",
						result.id,
					);
					return result;
				}),

			deleteManyMaintenanceTeams: assetWriteProcedure
				.input(Asset.bulkDeleteMaintenanceTeamsSchema)
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteManyMaintenanceTeams(
						input.ids,
						ctx.organization.id,
					);
					for (const id of result.ids) {
						emitAssetRealtimeEvent(
							this.eventEmitter,
							ctx.organization.id,
							"maintenanceTeams",
							"deleted",
							id,
						);
					}
					return result;
				}),

			onMaintenanceTeamsChanged: assetProcedure.subscription(({ ctx }) =>
				createAssetRealtimeObservable(
					this.eventEmitter,
					ctx.organization.id,
					"maintenanceTeams",
				),
			),

			// ── Asset Maintenance CRUD ─────────────────────────────────────────
			listAssetMaintenances: assetProcedure
				.input(Asset.listAssetMaintenancesSchema)
				.query(async ({ input, ctx }) =>
					svc.findAllAssetMaintenances(ctx.organization.id, input),
				),

			getAssetMaintenanceById: assetProcedure
				.input(z.object({ id: z.string().cuid() }))
				.query(async ({ input, ctx }) =>
					svc.findAssetMaintenanceById(input.id, ctx.organization.id),
				),

			getAssetMaintenanceByAssetId: assetProcedure
				.input(z.object({ assetId: z.string().cuid() }))
				.query(async ({ input, ctx }) =>
					svc.findAssetMaintenanceByAssetId(input.assetId, ctx.organization.id),
				),

			getAssetMaintenanceLogs: assetProcedure
				.input(z.object({ maintenanceId: z.string().cuid() }))
				.query(async ({ input, ctx }) =>
					svc.findAssetMaintenanceLogs(
						input.maintenanceId,
						ctx.organization.id,
					),
				),

			listAssetMaintenanceLogs: assetProcedure
				.input(Asset.listAssetMaintenanceLogsSchema.optional())
				.query(async ({ input, ctx }) =>
					svc.findAllAssetMaintenanceLogs(ctx.organization.id, input),
				),

			cancelAssetMaintenanceLog: assetWriteProcedure
				.input(Asset.cancelAssetMaintenanceLogSchema)
				.mutation(async ({ input, ctx }) => {
					const log = await svc.cancelAssetMaintenanceLog(
						input,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"maintenances",
						"log_completed",
						input.logId,
					);
					return log;
				}),

			createAssetMaintenance: assetWriteProcedure
				.input(Asset.createAssetMaintenanceSchema)
				.mutation(async ({ input, ctx }) => {
					const record = await svc.createAssetMaintenance(
						input,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"maintenances",
						"created",
						record.id,
					);
					return record;
				}),

			updateAssetMaintenance: assetWriteProcedure
				.input(Asset.updateAssetMaintenanceSchema)
				.mutation(async ({ input, ctx }) => {
					const record = await svc.updateAssetMaintenance(
						input,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"maintenances",
						"updated",
						record.id,
					);
					return record;
				}),

			deleteAssetMaintenance: assetWriteProcedure
				.input(z.object({ id: z.string().cuid() }))
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteAssetMaintenance(
						input.id,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"maintenances",
						"deleted",
						result.id,
					);
					return result;
				}),

			deleteManyAssetMaintenances: assetWriteProcedure
				.input(Asset.bulkDeleteAssetMaintenancesSchema)
				.mutation(async ({ input, ctx }) => {
					const result = await svc.deleteManyAssetMaintenances(
						input.ids,
						ctx.organization.id,
						ctx.user.id,
					);
					for (const id of result.ids) {
						emitAssetRealtimeEvent(
							this.eventEmitter,
							ctx.organization.id,
							"maintenances",
							"deleted",
							id,
						);
					}
					return result;
				}),

			completeAssetMaintenanceLog: assetWriteProcedure
				.input(Asset.completeAssetMaintenanceLogSchema)
				.mutation(async ({ input, ctx }) => {
					const log = await svc.completeAssetMaintenanceLog(
						input,
						ctx.organization.id,
						ctx.user.id,
					);
					emitAssetRealtimeEvent(
						this.eventEmitter,
						ctx.organization.id,
						"maintenances",
						"log_completed",
						input.logId,
					);
					return log;
				}),

			onAssetMaintenancesChanged: assetProcedure.subscription(({ ctx }) =>
				createAssetRealtimeObservable(
					this.eventEmitter,
					ctx.organization.id,
					"maintenances",
				),
			),

			// ── Excel Export Procedures ──────────────────────────────────────
			exportAssetDepreciationsAndBalancesExcel: assetProcedure
				.input(Asset.listAssetDepreciationsAndBalancesSchema)
				.mutation(async ({ input, ctx }) => {
					const reportTemplateService = new ReportTemplateService();
					const result = await svc.findAssetDepreciationsAndBalances(
						input,
						ctx.organization.id,
					);

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
						value: normalizeDateOnly(input.fromDate),
					});
					filters.push({
						label: "To",
						value: normalizeDateOnly(input.toDate),
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
				.mutation(async ({ input, ctx }) => {
					const reportTemplateService = new ReportTemplateService();
					const result = await svc.findAssetDepreciationLedger(
						input,
						ctx.organization.id,
					);

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
						value: normalizeDateOnly(input.fromDate),
					});
					filters.push({
						label: "To",
						value: normalizeDateOnly(input.toDate),
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
				.mutation(async ({ input, ctx }) => {
					const reportTemplateService = new ReportTemplateService();
					const result = await svc.findAssetActivityReport(
						input,
						ctx.organization.id,
					);

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
						value: normalizeDateOnly(input.fromDate),
					});
					filters.push({
						label: "To",
						value: normalizeDateOnly(input.toDate),
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
				.mutation(async ({ input, ctx }) => {
					const result = await svc.findFixedAssetRegisterReport(
						input,
						ctx.organization.id,
					);
					return buildFixedAssetRegisterExcel(input, result, ctx.organization);
				}),

			// ── Phase 2 Lifecycle Procedures ─────────────────────────────────

			scrapAsset: assetWriteProcedure
				.input(Asset.scrapAssetSchema)
				.mutation(async ({ input, ctx }) =>
					svc.scrapAsset(input, ctx.organization.id, ctx.user.id),
				),

			sellAsset: assetWriteProcedure
				.input(Asset.sellAssetSchema)
				.mutation(async ({ input, ctx }) =>
					svc.sellAsset(input, ctx.organization.id, ctx.user.id),
				),

			restoreAsset: assetWriteProcedure
				.input(Asset.restoreAssetSchema)
				.mutation(async ({ input, ctx }) =>
					svc.restoreAsset(input, ctx.organization.id, ctx.user.id),
				),

			createAssetMovement: assetWriteProcedure
				.input(Asset.createAssetMovementSchema)
				.mutation(async ({ input, ctx }) =>
					svc.createAssetMovement(input, ctx.organization.id, ctx.user.id),
				),

			submitAssetMovement: assetWriteProcedure
				.input(Asset.submitAssetMovementSchema)
				.mutation(async ({ input, ctx }) =>
					svc.submitAssetMovement(input, ctx.organization.id, ctx.user.id),
				),

			cancelAssetMovement: assetWriteProcedure
				.input(Asset.cancelAssetMovementSchema)
				.mutation(async ({ input, ctx }) =>
					svc.cancelAssetMovement(input, ctx.organization.id, ctx.user.id),
				),

			getAssetMovementById: assetProcedure
				.input(Asset.getAssetMovementSchema)
				.query(async ({ input, ctx }) =>
					svc.findMovementById(input.id, ctx.organization.id),
				),

			listAssetMovements: assetProcedure
				.input(Asset.listAssetMovementsSchema)
				.query(async ({ input, ctx }) =>
					svc.listMovements(input, ctx.organization.id),
				),

			createAssetRepair: assetWriteProcedure
				.input(Asset.createAssetRepairSchema)
				.mutation(async ({ input, ctx }) =>
					svc.createAssetRepair(input, ctx.organization.id, ctx.user.id),
				),

			submitAssetRepair: assetWriteProcedure
				.input(Asset.submitAssetRepairSchema)
				.mutation(async ({ input, ctx }) =>
					svc.submitAssetRepair(input, ctx.organization.id, ctx.user.id),
				),

			cancelAssetRepair: assetWriteProcedure
				.input(Asset.cancelAssetRepairSchema)
				.mutation(async ({ input, ctx }) =>
					svc.cancelAssetRepair(input, ctx.organization.id, ctx.user.id),
				),

			getAssetRepairById: assetProcedure
				.input(Asset.getAssetRepairSchema)
				.query(async ({ input, ctx }) =>
					svc.findRepairById(input.id, ctx.organization.id),
				),

			listAssetRepairs: assetProcedure
				.input(Asset.listAssetRepairsSchema)
				.query(async ({ input, ctx }) =>
					svc.listRepairs(input, ctx.organization.id),
				),

			createAssetCapitalization: assetWriteProcedure
				.input(Asset.createAssetCapitalizationSchema)
				.mutation(async ({ input, ctx }) =>
					svc.createAssetCapitalization(
						input,
						ctx.organization.id,
						ctx.user.id,
					),
				),

			submitAssetCapitalization: assetWriteProcedure
				.input(Asset.submitAssetCapitalizationSchema)
				.mutation(async ({ input, ctx }) =>
					svc.submitAssetCapitalization(
						input,
						ctx.organization.id,
						ctx.user.id,
					),
				),

			cancelAssetCapitalization: assetWriteProcedure
				.input(Asset.cancelAssetCapitalizationSchema)
				.mutation(async ({ input, ctx }) =>
					svc.cancelAssetCapitalization(
						input,
						ctx.organization.id,
						ctx.user.id,
					),
				),

			getAssetCapitalizationById: assetProcedure
				.input(Asset.getAssetCapitalizationSchema)
				.query(async ({ input, ctx }) =>
					svc.findCapitalizationById(input.id, ctx.organization.id),
				),

			listAssetCapitalizations: assetProcedure
				.input(Asset.listAssetCapitalizationsSchema)
				.query(async ({ input, ctx }) =>
					svc.listCapitalizations(input, ctx.organization.id),
				),

			getAssetDisposalById: assetProcedure
				.input(Asset.getAssetDisposalSchema)
				.query(async ({ input, ctx }) =>
					svc.findDisposalById(input.id, ctx.organization.id),
				),

			listAssetDisposals: assetProcedure
				.input(Asset.listAssetDisposalsSchema)
				.query(async ({ input, ctx }) =>
					svc.listDisposals(input, ctx.organization.id),
				),
		});
	}
}
