import {
	OnQueueEvent,
	QueueEventsHost,
	QueueEventsListener,
} from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { ASSET_DEPRECIATION_QUEUE } from "./depreciation.constants";

/** In-process wake-up signal; database state remains the barrier authority. */
@Injectable()
export class DepreciationQueueSignal {
	private readonly waiters = new Set<() => void>();

	notify(): void {
		for (const resolve of this.waiters) resolve();
		this.waiters.clear();
	}

	wait(timeoutMs: number): Promise<void> {
		return new Promise((resolve) => {
			let timer: ReturnType<typeof setTimeout>;
			const finish = () => {
				clearTimeout(timer);
				this.waiters.delete(finish);
				resolve();
			};
			timer = setTimeout(finish, timeoutMs);
			this.waiters.add(finish);
		});
	}
}

/** Wakes report/close barriers on queue transitions without trusting Redis state. */
@QueueEventsListener(ASSET_DEPRECIATION_QUEUE)
export class DepreciationQueueEventsListener extends QueueEventsHost {
	constructor(private readonly signal: DepreciationQueueSignal) {
		super();
	}

	async checkReady(): Promise<void> {
		await this.queueEvents.client.then((client) => client.info());
	}

	@OnQueueEvent("completed")
	onCompleted(): void {
		this.signal.notify();
	}

	@OnQueueEvent("failed")
	onFailed(): void {
		this.signal.notify();
	}
}
