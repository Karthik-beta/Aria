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
import { businessDate, depreciationTimeZone } from "./depreciation.config";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationDiscoveryService } from "./depreciation-discovery.service";

const DEPRECIATION_DAILY_CRON = "asset-depreciation-daily-discovery";

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
		await this.lifecycle.ensureSubmittedSchedules();
		await this.discovery.discover(
			{ throughDate: businessDate(this.timeZone) },
			"startup",
		);
	}

	onApplicationShutdown(): void {
		if (this.schedulerRegistry.doesExist("cron", DEPRECIATION_DAILY_CRON)) {
			this.schedulerRegistry.deleteCronJob(DEPRECIATION_DAILY_CRON);
		}
	}

	async runDailyDiscovery(): Promise<void> {
		try {
			await this.discovery.discover(
				{ throughDate: businessDate(this.timeZone) },
				"cron",
			);
		} catch (error) {
			this.logger.error({
				event: "asset_depreciation_daily_discovery_failed",
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}
