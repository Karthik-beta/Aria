import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { type Job, UnrecoverableError } from "bullmq";
import {
	ASSET_CWIP_CAPITALIZATION_QUEUE,
	CWIP_CAPITALIZATION_JOB_VERSION,
	POST_ASSET_CWIP_CAPITALIZATION_JOB,
} from "./cwip-capitalization.constants";
import type {
	CwipCapitalizationJobData,
	CwipCapitalizationJobName,
	CwipCapitalizationJobResult,
} from "./cwip-capitalization.types";
import {
	type CwipCapitalizationPersistenceService,
	CwipCapitalizationValidationError,
} from "./cwip-capitalization-persistence.service";
import { depreciationWorkerConcurrency } from "./depreciation.config";

type CwipCapitalizationJob = Job<
	CwipCapitalizationJobData,
	CwipCapitalizationJobResult,
	CwipCapitalizationJobName
>;

/** Executes one qualified CWIP capitalization inside the database boundary. */
@Processor(ASSET_CWIP_CAPITALIZATION_QUEUE, {
	concurrency: depreciationWorkerConcurrency(),
})
export class CwipCapitalizationProcessor extends WorkerHost {
	private readonly logger = new Logger(CwipCapitalizationProcessor.name);

	constructor(
		private readonly persistence: CwipCapitalizationPersistenceService,
	) {
		super();
	}

	isRunning(): boolean {
		return this.worker.isRunning();
	}

	async checkReady(): Promise<void> {
		if (!this.worker.isRunning()) {
			throw new Error("CWIP capitalization worker is not running.");
		}
		await this.worker.client.then((client) => client.info());
	}

	async process(
		job: CwipCapitalizationJob,
	): Promise<CwipCapitalizationJobResult> {
		try {
			if (
				job.name !== POST_ASSET_CWIP_CAPITALIZATION_JOB ||
				job.data.version !== CWIP_CAPITALIZATION_JOB_VERSION
			) {
				throw new UnrecoverableError(
					`Unsupported CWIP capitalization job ${job.name} version ${job.data.version}.`,
				);
			}
			return await this.persistence.post(job.data);
		} catch (error) {
			if (error instanceof CwipCapitalizationValidationError) {
				throw new UnrecoverableError(error.message);
			}
			throw error;
		}
	}

	@OnWorkerEvent("completed")
	onCompleted(
		job: CwipCapitalizationJob,
		result: CwipCapitalizationJobResult,
	): void {
		this.logger.log({
			event: "asset_cwip_capitalization_job_completed",
			jobId: job.id,
			assetId: job.data.assetId,
			result: result.status,
		});
	}

	@OnWorkerEvent("failed")
	onFailed(job: CwipCapitalizationJob | undefined, error: Error): void {
		this.logger.error({
			event: "asset_cwip_capitalization_job_failed",
			jobId: job?.id,
			assetId: job?.data.assetId,
			attemptsMade: job?.attemptsMade,
			error: error.message,
		});
	}
}
