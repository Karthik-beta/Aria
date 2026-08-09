import { afterEach, describe, expect, it } from "bun:test";
import { Test } from "@nestjs/testing";
import { DatabaseModule } from "../../../shared/database.module";
import { CwipCapitalizationProcessor } from "./cwip-capitalization.processor";
import { CwipCapitalizationDiscoveryService } from "./cwip-capitalization-discovery.service";
import { CwipCapitalizationExecutionModule } from "./cwip-capitalization-execution.module";
import { CwipCapitalizationPersistenceService } from "./cwip-capitalization-persistence.service";
import { CwipCapitalizationQueueClient } from "./cwip-capitalization-queue.client";
import {
	DemoDepreciationModule,
	runWithDemoDepreciationApplication,
} from "./demo-data-runner";
import { DepreciationMetrics } from "./depreciation.metrics";
import { DepreciationProcessor } from "./depreciation.processor";
import { DepreciationBarrierService } from "./depreciation-barrier.service";
import { DepreciationExecutionModule } from "./depreciation-execution.module";
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
		expect(module.get(CwipCapitalizationDiscoveryService)).toBeDefined();
		expect(module.get(CwipCapitalizationPersistenceService)).toBeDefined();
		expect(module.get(CwipCapitalizationQueueClient)).toBeDefined();
		expect(module.get(CwipCapitalizationProcessor)).toBeDefined();
		expect(module.get(DepreciationMetrics)).toBeDefined();
		expect(module.get(DepreciationQueueClient)).toBeDefined();
		expect(module.get(DepreciationSchedulerService)).toBeDefined();
		expect(module.get(DepreciationQueueEventsListener)).toBeDefined();
		expect(module.get(DepreciationProcessor)).toBeDefined();
		await module.get(DepreciationQueueClient).checkReady();
		await module.get(DepreciationProcessor).checkReady();
		await module.get(CwipCapitalizationQueueClient).checkReady();
		await module.get(CwipCapitalizationProcessor).checkReady();

		await module.close();
	});

	it("builds the demo execution graph without an automatic scheduler", () => {
		const imports = Reflect.getMetadata("imports", DemoDepreciationModule);
		expect(imports).toContain(DepreciationExecutionModule);
		expect(imports).not.toContain(CwipCapitalizationExecutionModule);
		expect(imports).not.toContain(DepreciationProcessingModule);
	});

	it("propagates barrier failures and closes the demo application", async () => {
		let closed = false;
		const application = {
			get(token: unknown) {
				if (token === DepreciationBarrierService) {
					return {
						ensureDepreciationPosted: async () => {
							throw new Error("worker failed");
						},
					};
				}
				return {};
			},
			async close() {
				closed = true;
			},
		};

		await expect(
			runWithDemoDepreciationApplication(
				application as never,
				async (_prisma, depreciation) => {
					await depreciation.ensurePosted({
						throughDate: new Date("2026-07-22T00:00:00.000Z"),
					});
				},
			),
		).rejects.toThrow("worker failed");
		expect(closed).toBe(true);
	});
});
