import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves HealthIndicatorService from emitted runtime metadata.
import {
	type HealthIndicatorResult,
	HealthIndicatorService,
} from "@nestjs/terminus";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationMetrics } from "../apps/asset/depreciation/depreciation.metrics";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationProcessor } from "../apps/asset/depreciation/depreciation.processor";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationQueueClient } from "../apps/asset/depreciation/depreciation-queue.client";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { DepreciationQueueEventsListener } from "../apps/asset/depreciation/depreciation-queue-events";
// biome-ignore lint/style/useImportType: Nest resolves this runtime constructor token from decorator metadata.
import { PrismaService } from "../shared/prisma.service";

const HEALTH_DEPENDENCY_TIMEOUT_MS = 3_000;

/** Bounded readiness indicators for the database and depreciation runtime. */
@Injectable()
export class AriaHealthIndicator {
	constructor(
		private readonly indicator: HealthIndicatorService,
		private readonly prisma: PrismaService,
		private readonly queue: DepreciationQueueClient,
		private readonly processor: DepreciationProcessor,
		private readonly queueEvents: DepreciationQueueEventsListener,
		private readonly metrics: DepreciationMetrics,
	) {}

	database(): Promise<HealthIndicatorResult> {
		return this.check("postgres", async () => {
			await this.prisma.client.$queryRawUnsafe("SELECT 1");
		});
	}

	async redisProducer(): Promise<HealthIndicatorResult> {
		const result = await this.check("redis-producer", () =>
			this.queue.checkReady(),
		);
		this.metrics.setQueueReady(result["redis-producer"]?.status === "up");
		return result;
	}

	async worker(): Promise<HealthIndicatorResult> {
		const result = await this.check("depreciation-worker", () =>
			this.processor.checkReady(),
		);
		this.metrics.setWorkerReady(result["depreciation-worker"]?.status === "up");
		return result;
	}

	async queueEventsConnection(): Promise<HealthIndicatorResult> {
		const result = await this.check("depreciation-queue-events", () =>
			this.queueEvents.checkReady(),
		);
		this.metrics.setQueueEventsReady(
			result["depreciation-queue-events"]?.status === "up",
		);
		return result;
	}

	private async check(
		key: string,
		operation: () => Promise<void>,
	): Promise<HealthIndicatorResult> {
		const status = this.indicator.check(key);
		try {
			await this.withTimeout(operation());
			return status.up();
		} catch (error) {
			return status.down({
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private withTimeout<T>(operation: Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const timer = setTimeout(
				() =>
					reject(
						new Error(
							`Health dependency check exceeded ${HEALTH_DEPENDENCY_TIMEOUT_MS}ms.`,
						),
					),
				HEALTH_DEPENDENCY_TIMEOUT_MS,
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
