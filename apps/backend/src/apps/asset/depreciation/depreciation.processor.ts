import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { DelayedError, type Job, UnrecoverableError } from "bullmq";
import { depreciationWorkerConcurrency } from "./depreciation.config";
import {
	ASSET_DEPRECIATION_QUEUE,
	DEPRECIATION_JOB_ATTEMPTS,
	DEPRECIATION_JOB_VERSION,
	DEPRECIATION_OUT_OF_ORDER_DELAY_MS,
	DEPRECIATION_OUT_OF_ORDER_MAX_STARTS,
	POST_ASSET_DEPRECIATION_JOB,
} from "./depreciation.constants";
import type { DepreciationMetrics } from "./depreciation.metrics";
import type {
	DepreciationJobData,
	DepreciationJobName,
	DepreciationJobResult,
} from "./depreciation.types";
import {
	type DepreciationPersistenceService,
	DepreciationPostingValidationError,
} from "./depreciation-persistence.service";

type DepreciationJob = Job<
	DepreciationJobData,
	DepreciationJobResult,
	DepreciationJobName
>;

/** Posts one due schedule period atomically and idempotently. */
@Processor(ASSET_DEPRECIATION_QUEUE, {
	concurrency: depreciationWorkerConcurrency(),
})
export class DepreciationProcessor extends WorkerHost {
	private readonly logger = new Logger(DepreciationProcessor.name);

	constructor(
		private readonly persistence: DepreciationPersistenceService,
		private readonly metrics: DepreciationMetrics,
	) {
		super();
	}

	isRunning(): boolean {
		return this.worker.isRunning();
	}

	async checkReady(): Promise<void> {
		if (!this.worker.isRunning()) {
			throw new Error("Depreciation worker is not running.");
		}
		await this.worker.client.then((client) => client.info());
	}

	async process(job: DepreciationJob): Promise<DepreciationJobResult> {
		const startedAt = performance.now();
		let resultLabel = "failed";
		try {
			if (
				job.name !== POST_ASSET_DEPRECIATION_JOB ||
				job.data.version !== DEPRECIATION_JOB_VERSION
			) {
				throw new UnrecoverableError(
					`Unsupported depreciation job ${job.name} version ${job.data.version}.`,
				);
			}

			const result = await this.persistence.post(job.data);
			if (result.status === "out-of-order") {
				this.metrics.recordBlocked();
				resultLabel = "blocked";
				if (job.attemptsStarted >= DEPRECIATION_OUT_OF_ORDER_MAX_STARTS) {
					throw new UnrecoverableError(
						`Depreciation period is blocked by schedule entry ${result.earlierScheduleEntryId}.`,
					);
				}
				if (!job.token) {
					throw new Error(
						"BullMQ did not provide a worker token for deferral.",
					);
				}
				await job.moveToDelayed(
					Date.now() + DEPRECIATION_OUT_OF_ORDER_DELAY_MS,
					job.token,
				);
				throw new DelayedError();
			}

			resultLabel = result.status;
			return result;
		} catch (error) {
			if (error instanceof DepreciationPostingValidationError) {
				throw new UnrecoverableError(error.message);
			}
			throw error;
		} finally {
			this.metrics.recordDuration(
				resultLabel,
				(performance.now() - startedAt) / 1000,
			);
		}
	}

	@OnWorkerEvent("completed")
	onCompleted(job: DepreciationJob, result: DepreciationJobResult): void {
		this.metrics.recordCompleted(result.status);
		this.logger.log({
			event: "asset_depreciation_job_completed",
			jobId: job.id,
			assetId: job.data.assetId,
			scheduleEntryId: job.data.scheduleEntryId,
			result: result.status,
		});
	}

	@OnWorkerEvent("failed")
	onFailed(job: DepreciationJob | undefined, error: Error): void {
		const terminal =
			error.name === "UnrecoverableError" ||
			(job?.attemptsMade ?? DEPRECIATION_JOB_ATTEMPTS) >=
				(job?.opts.attempts ?? DEPRECIATION_JOB_ATTEMPTS);
		this.metrics.recordFailed(terminal);
		this.logger.error({
			event: terminal
				? "asset_depreciation_job_failed"
				: "asset_depreciation_job_retrying",
			jobId: job?.id,
			assetId: job?.data.assetId,
			scheduleEntryId: job?.data.scheduleEntryId,
			attemptsMade: job?.attemptsMade,
			error: error.message,
		});
	}

	@OnWorkerEvent("stalled")
	onStalled(jobId: string, previousState: string): void {
		this.metrics.recordStalled();
		this.logger.warn({
			event: "asset_depreciation_job_stalled",
			jobId,
			previousState,
		});
	}

	@OnWorkerEvent("error")
	onError(error: Error): void {
		this.metrics.recordWorkerError();
		this.logger.error({
			event: "asset_depreciation_worker_error",
			error: error.message,
		});
	}
}
