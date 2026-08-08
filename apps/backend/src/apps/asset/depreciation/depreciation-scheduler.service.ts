import {
	Injectable,
	Logger,
	type OnApplicationBootstrap,
	type OnApplicationShutdown,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob } from "cron";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { PrismaService } from "../../../shared/prisma.service";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { AssetDepreciationLifecycleService } from "./asset-depreciation-lifecycle.service";
import {
	businessDate,
	depreciationReconciliationIntervalMs,
	depreciationTimeZone,
} from "./depreciation.config";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationMetrics } from "./depreciation.metrics";
import type { DepreciationDiscoveryTrigger } from "./depreciation-discovery.service";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationDiscoveryService } from "./depreciation-discovery.service";

const DEPRECIATION_DAILY_CRON = "asset-depreciation-daily-discovery";
const DEPRECIATION_RECONCILIATION_INTERVAL =
	"asset-depreciation-reconciliation";
const UPDATE_MAINTENANCE_STATUS_CRON = "asset-update-maintenance-status";
const POST_CWIP_CAPITALIZATION_CRON = "asset-post-cwip-capitalization";
const UPDATE_MAINTENANCE_LOG_STATUS_CRON =
	"asset-update-maintenance-log-status";

/** Registers midnight discovery and 3 daily background jobs. */
@Injectable()
export class DepreciationSchedulerService
	implements OnApplicationBootstrap, OnApplicationShutdown
{
	private readonly logger = new Logger(DepreciationSchedulerService.name);
	private timeZone = "";

	constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly lifecycle: AssetDepreciationLifecycleService,
		private readonly discovery: DepreciationDiscoveryService,
		private readonly metrics: DepreciationMetrics,
		private readonly prisma?: PrismaService,
	) {}

	async onApplicationBootstrap(): Promise<void> {
		this.timeZone = depreciationTimeZone();

		// Midnight depreciation discovery
		const job = CronJob.from({
			cronTime: "0 0 * * *",
			onTick: () => this.runDailyDiscovery(),
			start: false,
			timeZone: this.timeZone,
			waitForCompletion: true,
		});
		this.schedulerRegistry.addCronJob(DEPRECIATION_DAILY_CRON, job);
		job.start();

		// 1) Update Maintenance Status (00:05)
		const updateMaintJob = CronJob.from({
			cronTime: "5 0 * * *",
			onTick: () => void this.updateMaintenanceStatus(),
			start: false,
			timeZone: this.timeZone,
			waitForCompletion: true,
		});
		this.schedulerRegistry.addCronJob(
			UPDATE_MAINTENANCE_STATUS_CRON,
			updateMaintJob,
		);
		updateMaintJob.start();

		// 2) Post CWIP Capitalization GL Entries (00:10)
		const postCwipJob = CronJob.from({
			cronTime: "10 0 * * *",
			onTick: () => void this.postCwipCapitalizationGlEntries(),
			start: false,
			timeZone: this.timeZone,
			waitForCompletion: true,
		});
		this.schedulerRegistry.addCronJob(
			POST_CWIP_CAPITALIZATION_CRON,
			postCwipJob,
		);
		postCwipJob.start();

		// 3) Update Maintenance Log Status (00:15)
		const updateMaintLogJob = CronJob.from({
			cronTime: "15 0 * * *",
			onTick: () => void this.updateMaintenanceLogStatus(),
			start: false,
			timeZone: this.timeZone,
			waitForCompletion: true,
		});
		this.schedulerRegistry.addCronJob(
			UPDATE_MAINTENANCE_LOG_STATUS_CRON,
			updateMaintLogJob,
		);
		updateMaintLogJob.start();

		const reconciliation = setInterval(
			() => void this.runDiscovery("reconciliation"),
			depreciationReconciliationIntervalMs(),
		);
		this.schedulerRegistry.addInterval(
			DEPRECIATION_RECONCILIATION_INTERVAL,
			reconciliation,
		);

		await this.runDiscovery("startup");
	}

	onApplicationShutdown(): void {
		if (this.schedulerRegistry.doesExist("cron", DEPRECIATION_DAILY_CRON)) {
			this.schedulerRegistry.deleteCronJob(DEPRECIATION_DAILY_CRON);
		}
		if (
			this.schedulerRegistry.doesExist("cron", UPDATE_MAINTENANCE_STATUS_CRON)
		) {
			this.schedulerRegistry.deleteCronJob(UPDATE_MAINTENANCE_STATUS_CRON);
		}
		if (
			this.schedulerRegistry.doesExist("cron", POST_CWIP_CAPITALIZATION_CRON)
		) {
			this.schedulerRegistry.deleteCronJob(POST_CWIP_CAPITALIZATION_CRON);
		}
		if (
			this.schedulerRegistry.doesExist(
				"cron",
				UPDATE_MAINTENANCE_LOG_STATUS_CRON,
			)
		) {
			this.schedulerRegistry.deleteCronJob(UPDATE_MAINTENANCE_LOG_STATUS_CRON);
		}
		if (
			this.schedulerRegistry.doesExist(
				"interval",
				DEPRECIATION_RECONCILIATION_INTERVAL,
			)
		) {
			this.schedulerRegistry.deleteInterval(
				DEPRECIATION_RECONCILIATION_INTERVAL,
			);
		}
	}

	async runDailyDiscovery(): Promise<void> {
		await this.runDiscovery("cron");
	}

	async runDiscovery(trigger: DepreciationDiscoveryTrigger): Promise<void> {
		try {
			await this.lifecycle.ensureSubmittedSchedules();
			await this.discovery.discover(
				{ throughDate: businessDate(this.timeZone) },
				trigger,
			);
		} catch (error) {
			this.metrics.recordDiscoveryFailure(trigger);
			this.logger.error({
				event: "asset_depreciation_discovery_failed",
				trigger,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Daily cron job (00:05) that updates asset status to OUT_OF_ORDER or IN_MAINTENANCE.
	 */
	async updateMaintenanceStatus(): Promise<void> {
		if (!this.prisma) return;
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		try {
			// Assets with open/pending repairs -> OUT_OF_ORDER
			const pendingRepairs = await this.prisma.assetRepair.findMany({
				where: { repairStatus: "PENDING" },
				select: { assetId: true },
			});
			const outOfOrderAssetIds = [
				...new Set(pendingRepairs.map((r) => r.assetId)),
			];

			if (outOfOrderAssetIds.length > 0) {
				await this.prisma.asset.updateMany({
					where: {
						id: { in: outOfOrderAssetIds },
						status: { not: "OUT_OF_ORDER" },
					},
					data: { status: "OUT_OF_ORDER" },
				});
			}

			// Assets with active maintenance tasks due/overdue -> IN_MAINTENANCE
			const activeTasks = await this.prisma.assetMaintenanceTask.findMany({
				where: {
					maintenanceStatus: { in: ["OVERDUE", "PLANNED"] },
					nextDueDate: { lte: today },
				},
				select: { maintenance: { select: { assetId: true } } },
			});
			const inMaintenanceAssetIds = [
				...new Set(
					activeTasks
						.map((t) => t.maintenance?.assetId)
						.filter(
							(id): id is string =>
								Boolean(id) && !outOfOrderAssetIds.includes(id),
						),
				),
			];

			if (inMaintenanceAssetIds.length > 0) {
				await this.prisma.asset.updateMany({
					where: {
						id: { in: inMaintenanceAssetIds },
						status: { not: "IN_MAINTENANCE" },
					},
					data: { status: "IN_MAINTENANCE" },
				});
			}

			this.logger.log(
				`[updateMaintenanceStatus] Updated ${outOfOrderAssetIds.length} assets to OUT_OF_ORDER and ${inMaintenanceAssetIds.length} assets to IN_MAINTENANCE.`,
			);
		} catch (error) {
			this.logger.error({
				event: "update_maintenance_status_failed",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Daily cron job (00:10) that capitalizes CWIP assets reaching availableForUseDate <= today().
	 */
	async postCwipCapitalizationGlEntries(): Promise<void> {
		if (!this.prisma) return;
		const today = new Date();
		today.setHours(23, 59, 59, 999);

		try {
			const cwipAssets = await this.prisma.asset.findMany({
				where: {
					status: "DRAFT",
					availableForUseDate: { lte: today },
				},
				select: { id: true, assetName: true },
			});

			for (const asset of cwipAssets) {
				await this.prisma.asset.update({
					where: { id: asset.id },
					data: { status: "SUBMITTED" },
				});
			}

			this.logger.log(
				`[postCwipCapitalizationGlEntries] Capitalized ${cwipAssets.length} CWIP assets.`,
			);
		} catch (error) {
			this.logger.error({
				event: "post_cwip_capitalization_gl_entries_failed",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Daily cron job (00:15) that marks planned maintenance logs past due date to OVERDUE.
	 */
	async updateMaintenanceLogStatus(): Promise<void> {
		if (!this.prisma) return;
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		try {
			const overdueTasks = await this.prisma.assetMaintenanceTask.findMany({
				where: { nextDueDate: { lt: today } },
				select: { id: true },
			});
			const overdueTaskIds = overdueTasks.map((t) => t.id);

			if (overdueTaskIds.length > 0) {
				const result = await this.prisma.assetMaintenanceLog.updateMany({
					where: {
						taskId: { in: overdueTaskIds },
						maintenanceStatus: "PLANNED",
					},
					data: { maintenanceStatus: "OVERDUE" },
				});

				await this.prisma.assetMaintenanceTask.updateMany({
					where: { id: { in: overdueTaskIds }, maintenanceStatus: "PLANNED" },
					data: { maintenanceStatus: "OVERDUE" },
				});

				this.logger.log(
					`[updateMaintenanceLogStatus] Marked ${result.count} planned maintenance logs as OVERDUE.`,
				);
			}
		} catch (error) {
			this.logger.error({
				event: "update_maintenance_log_status_failed",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
