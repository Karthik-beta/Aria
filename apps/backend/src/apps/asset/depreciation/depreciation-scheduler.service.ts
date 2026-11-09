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

/** Registers midnight discovery and runs the identical path on every startup. */
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
	) {}

	async onApplicationBootstrap(): Promise<void> {
		this.timeZone = depreciationTimeZone();
		const job = CronJob.from({
			cronTime: "0 0 * * *",
			onTick: () => this.runDailyDiscovery(),
			start: false,
			timeZone: this.timeZone,
			waitForCompletion: true,
		});
		this.schedulerRegistry.addCronJob(DEPRECIATION_DAILY_CRON, job);
		job.start();
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
}
