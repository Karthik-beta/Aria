import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { AssetDepreciationLifecycleService } from "./asset-depreciation-lifecycle.service";
import {
	depreciationJobOptions,
	depreciationRedisConnection,
} from "./depreciation.config";
import { ASSET_DEPRECIATION_QUEUE } from "./depreciation.constants";
import { DepreciationMetrics } from "./depreciation.metrics";
import { DepreciationProcessor } from "./depreciation.processor";
import { DepreciationBarrierService } from "./depreciation-barrier.service";
import { DepreciationDiscoveryService } from "./depreciation-discovery.service";
import { DepreciationPersistenceService } from "./depreciation-persistence.service";
import {
	type DepreciationQueue,
	DepreciationQueueClient,
} from "./depreciation-queue.client";
import {
	DepreciationQueueEventsListener,
	DepreciationQueueSignal,
} from "./depreciation-queue-events";
import { DepreciationSchedulerService } from "./depreciation-scheduler.service";

/** Durable discovery, queueing, posting, and synchronization for depreciation. */
@Module({
	imports: [
		ScheduleModule.forRoot(),
		BullModule.forRootAsync({
			useFactory: () => ({ connection: depreciationRedisConnection() }),
		}),
		BullModule.registerQueue({
			name: ASSET_DEPRECIATION_QUEUE,
			defaultJobOptions: depreciationJobOptions(),
		}),
	],
	providers: [
		AssetDepreciationLifecycleService,
		{
			provide: DepreciationQueueClient,
			inject: [getQueueToken(ASSET_DEPRECIATION_QUEUE)],
			useFactory: (queue: DepreciationQueue) =>
				new DepreciationQueueClient(queue),
		},
		DepreciationPersistenceService,
		DepreciationMetrics,
		DepreciationQueueSignal,
		DepreciationDiscoveryService,
		DepreciationBarrierService,
		DepreciationSchedulerService,
		DepreciationProcessor,
		DepreciationQueueEventsListener,
	],
	exports: [
		AssetDepreciationLifecycleService,
		DepreciationDiscoveryService,
		DepreciationBarrierService,
	],
})
export class DepreciationProcessingModule {}
