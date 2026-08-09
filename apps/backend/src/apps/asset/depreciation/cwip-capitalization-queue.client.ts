import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { type Job, Queue } from "bullmq";
import { ASSET_CWIP_CAPITALIZATION_QUEUE } from "./cwip-capitalization.constants";
import type {
	CwipCapitalizationJobData,
	CwipCapitalizationJobName,
	CwipCapitalizationJobResult,
} from "./cwip-capitalization.types";
import {
	depreciationJobOptions,
	depreciationProducerRedisConnection,
	depreciationQueueOperationTimeoutMs,
} from "./depreciation.config";

export type CwipCapitalizationJob = Job<
	CwipCapitalizationJobData,
	CwipCapitalizationJobResult,
	CwipCapitalizationJobName
>;

type CwipCapitalizationQueue = Queue<
	CwipCapitalizationJobData,
	CwipCapitalizationJobResult,
	CwipCapitalizationJobName
>;

export interface CwipCapitalizationBulkJob {
	name: CwipCapitalizationJobName;
	data: CwipCapitalizationJobData;
	opts: { jobId: string };
}

/** Owns the bounded producer connection used by CWIP discovery. */
@Injectable()
export class CwipCapitalizationQueueClient implements OnApplicationShutdown {
	private readonly queue: CwipCapitalizationQueue;
	private readonly operationTimeoutMs: number;

	constructor() {
		this.operationTimeoutMs = depreciationQueueOperationTimeoutMs();
		this.queue = new Queue<
			CwipCapitalizationJobData,
			CwipCapitalizationJobResult,
			CwipCapitalizationJobName
		>(ASSET_CWIP_CAPITALIZATION_QUEUE, {
			connection: depreciationProducerRedisConnection(),
			defaultJobOptions: depreciationJobOptions(),
		});
	}

	getJob(jobId: string): Promise<CwipCapitalizationJob | undefined> {
		return this.withTimeout(this.queue.getJob(jobId), "get job");
	}

	async addBulk(jobs: CwipCapitalizationBulkJob[]): Promise<void> {
		await this.withTimeout(this.queue.addBulk(jobs), "add jobs");
	}

	async checkReady(): Promise<void> {
		await this.withTimeout(
			this.queue.getJobCounts("waiting").then(() => undefined),
			"Redis readiness",
		);
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
							`CWIP capitalization queue ${label} timed out after ${this.operationTimeoutMs}ms.`,
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
