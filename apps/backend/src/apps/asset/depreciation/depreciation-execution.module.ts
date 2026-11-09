import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { PrismaService } from "../../../shared/prisma.service";
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
import { DepreciationQueueClient } from "./depreciation-queue.client";
import {
	DepreciationQueueEventsListener,
	DepreciationQueueSignal,
} from "./depreciation-queue-events";

/** Queue-backed depreciation execution without automatic scheduling. */
@Module({
	imports: [
		BullModule.forRootAsync({
			useFactory: () => ({ connection: depreciationRedisConnection() }),
		}),
		BullModule.registerQueue({
			name: ASSET_DEPRECIATION_QUEUE,
			defaultJobOptions: depreciationJobOptions(),
		}),
	],
	providers: [
		DepreciationQueueClient,
		DepreciationMetrics,
		DepreciationQueueSignal,
		{
			provide: AssetDepreciationLifecycleService,
			inject: [PrismaService],
			useFactory: (prisma: PrismaService) =>
				new AssetDepreciationLifecycleService(prisma),
		},
		{
			provide: DepreciationPersistenceService,
			inject: [PrismaService],
			useFactory: (prisma: PrismaService) =>
				new DepreciationPersistenceService(prisma),
		},
		{
			provide: DepreciationDiscoveryService,
			inject: [
				DepreciationQueueClient,
				DepreciationPersistenceService,
				DepreciationMetrics,
			],
			useFactory: (
				queue: DepreciationQueueClient,
				persistence: DepreciationPersistenceService,
				metrics: DepreciationMetrics,
			) => new DepreciationDiscoveryService(queue, persistence, metrics),
		},
		{
			provide: DepreciationBarrierService,
			inject: [
				DepreciationQueueClient,
				DepreciationDiscoveryService,
				DepreciationPersistenceService,
				DepreciationQueueSignal,
			],
			useFactory: (
				queue: DepreciationQueueClient,
				discovery: DepreciationDiscoveryService,
				persistence: DepreciationPersistenceService,
				signal: DepreciationQueueSignal,
			) =>
				new DepreciationBarrierService(queue, discovery, persistence, signal),
		},
		{
			provide: DepreciationProcessor,
			inject: [DepreciationPersistenceService, DepreciationMetrics],
			useFactory: (
				persistence: DepreciationPersistenceService,
				metrics: DepreciationMetrics,
			) => new DepreciationProcessor(persistence, metrics),
		},
		{
			provide: DepreciationQueueEventsListener,
			inject: [DepreciationQueueSignal],
			useFactory: (signal: DepreciationQueueSignal) =>
				new DepreciationQueueEventsListener(signal),
		},
	],
	exports: [
		AssetDepreciationLifecycleService,
		DepreciationDiscoveryService,
		DepreciationBarrierService,
		DepreciationMetrics,
		DepreciationQueueClient,
		DepreciationProcessor,
		DepreciationQueueEventsListener,
	],
})
export class DepreciationExecutionModule {}
