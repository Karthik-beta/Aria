import type { Job, Queue } from "bullmq";
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

/** Typed queue facade supplied by the Nest module's BullMQ factory provider. */
export class DepreciationQueueClient {
	constructor(private readonly queue: DepreciationQueue) {}

	getJob(jobId: string): Promise<DepreciationJob | undefined> {
		return this.queue.getJob(jobId);
	}

	async addBulk(jobs: DepreciationBulkJob[]): Promise<void> {
		await this.queue.addBulk(jobs);
	}
}
