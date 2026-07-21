import { afterEach, describe, expect, it } from "bun:test";
import { Test } from "@nestjs/testing";
import { DatabaseModule } from "../../../shared/database.module";
import { DepreciationMetrics } from "./depreciation.metrics";
import { DepreciationProcessor } from "./depreciation.processor";
import { DepreciationPersistenceService } from "./depreciation-persistence.service";
import { DepreciationProcessingModule } from "./depreciation-processing.module";
import { DepreciationQueueClient } from "./depreciation-queue.client";
import { DepreciationQueueEventsListener } from "./depreciation-queue-events";
import { DepreciationSchedulerService } from "./depreciation-scheduler.service";

const originalEnvironment = { ...process.env };

afterEach(() => {
	process.env = { ...originalEnvironment };
});

describe("DepreciationProcessingModule", () => {
	it("emits runtime constructor tokens for the processor", () => {
		expect(
			Reflect.getMetadata("design:paramtypes", DepreciationProcessor),
		).toEqual([DepreciationPersistenceService, DepreciationMetrics]);
	});

	it("resolves the production scheduler, producer, listener, and worker graph", async () => {
		process.env.DATABASE_URL ??=
			"postgresql://postgres:postgres@localhost:5432/aria";
		process.env.REDIS_URL = "redis://localhost:6379";
		process.env.APP_TIME_ZONE = "UTC";

		const module = await Test.createTestingModule({
			imports: [DatabaseModule, DepreciationProcessingModule],
		}).compile();
		await module.init();

		expect(module.get(DepreciationPersistenceService)).toBeDefined();
		expect(module.get(DepreciationMetrics)).toBeDefined();
		expect(module.get(DepreciationQueueClient)).toBeDefined();
		expect(module.get(DepreciationSchedulerService)).toBeDefined();
		expect(module.get(DepreciationQueueEventsListener)).toBeDefined();
		expect(module.get(DepreciationProcessor)).toBeDefined();
		await module.get(DepreciationQueueClient).checkReady();
		await module.get(DepreciationProcessor).checkReady();

		await module.close();
	});
});
