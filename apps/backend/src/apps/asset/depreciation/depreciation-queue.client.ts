import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { type Job, Queue } from "bullmq";
import {
	depreciationJobOptions,
	depreciationProducerRedisConnection,
	depreciationQueueOperationTimeoutMs,
} from "./depreciation.config";
import { ASSET_DEPRECIATION_QUEUE } from "./depreciation.constants";
import type {
	DepreciationJobData,
	DepreciationJobName,
	DepreciationJobResult,
} from "./depreciation.types";

export type DepreciationJob = Job<
	DepreciationJobData,
	DepreciationJobResult,
	DepreciationJobName
>;

export type DepreciationQueue = Queue<
	DepreciationJobData,
	DepreciationJobResult,
	DepreciationJobName
>;

export type DepreciationBulkJob = {
	name: DepreciationJobName;
	data: DepreciationJobData;
	opts: { jobId: string };
};

export interface DepreciationQueueStatus {
	paused: boolean;
	workers: number;
	counts: Record<string, number>;
}

/** Owns the bounded, fail-fast producer connection used by discovery. */
@Injectable()
export class DepreciationQueueClient implements OnApplicationShutdown {
	private readonly queue: DepreciationQueue;
	private readonly operationTimeoutMs: number;

	constructor() {
		this.operationTimeoutMs = depreciationQueueOperationTimeoutMs();
		this.queue = new Queue<
			DepreciationJobData,
			DepreciationJobResult,
			DepreciationJobName
		>(ASSET_DEPRECIATION_QUEUE, {
			connection: depreciationProducerRedisConnection(),
			defaultJobOptions: depreciationJobOptions(),
		});
	}

	getJob(jobId: string): Promise<DepreciationJob | undefined> {
		return this.withTimeout(this.queue.getJob(jobId), "get job");
	}

	async addBulk(jobs: DepreciationBulkJob[]): Promise<void> {
		await this.withTimeout(this.queue.addBulk(jobs), "add jobs");
	}

	async checkReady(): Promise<void> {
		await this.withTimeout(
			this.queue.getJobCounts("waiting").then(() => undefined),
			"Redis readiness",
		);
	}

	async status(): Promise<DepreciationQueueStatus> {
		const [paused, workers, counts] = await this.withTimeout(
			Promise.all([
				this.queue.isPaused(),
				this.queue.getWorkersCount(),
				this.queue.getJobCounts(
					"active",
					"completed",
					"delayed",
					"failed",
					"paused",
					"prioritized",
					"waiting",
					"waiting-children",
				),
			]),
			"read queue status",
		);
		return { paused, workers, counts };
	}

	async pause(): Promise<void> {
		await this.withTimeout(this.queue.pause(), "pause queue");
	}

	async resume(): Promise<void> {
		await this.withTimeout(this.queue.resume(), "resume queue");
	}

	async onApplicationShutdown(): Promise<void> {
		await this.queue.close();
	}

	private withTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(
				() =>
					reject(
						new Error(
							`Depreciation queue ${label} timed out after ${this.operationTimeoutMs}ms.`,
						),
					),
				this.operationTimeoutMs,
			);
			operation.then(
				(value) => {
					clearTimeout(timer);
					resolve(value);
				},
				(error) => {
					clearTimeout(timer);
					reject(error);
				},
			);
		});
	}
}
