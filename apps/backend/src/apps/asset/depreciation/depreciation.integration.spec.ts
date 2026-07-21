import { afterAll, beforeAll, expect, it } from "bun:test";
import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../../app.module";
import { AriaHealthIndicator } from "../../../health/health-indicator.service";
import { businessDate, depreciationTimeZone } from "./depreciation.config";
import { DepreciationProcessor } from "./depreciation.processor";
import { DepreciationBarrierService } from "./depreciation-barrier.service";
import { DepreciationQueueClient } from "./depreciation-queue.client";

let app: INestApplicationContext;

beforeAll(async () => {
	process.env.NODE_ENV = "test";
	process.env.APP_TIME_ZONE ??= "UTC";
	process.env.REDIS_URL ??= "redis://localhost:6379";
	process.env.BETTER_AUTH_SECRET ??= "integration-test-secret";
	process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
	process.env.FRONTEND_URL ??= "http://localhost:3000";

	app = await NestFactory.createApplicationContext(AppModule, {
		logger: ["error", "warn"],
	});
});

afterAll(async () => {
	await app.close();
});

it("boots PostgreSQL, Redis, queue events, and the depreciation worker", async () => {
	const health = app.get(AriaHealthIndicator);
	const checks = await Promise.all([
		health.database(),
		health.redisProducer(),
		health.worker(),
		health.queueEventsConnection(),
	]);
	expect(
		checks.every((check) => Object.values(check)[0]?.status === "up"),
	).toBe(true);

	const processor = app.get(DepreciationProcessor);
	const queue = app.get(DepreciationQueueClient);
	const barrier = app.get(DepreciationBarrierService);
	const status = await queue.status();
	expect(processor.isRunning()).toBe(true);
	expect(status.workers).toBeGreaterThanOrEqual(1);
	await expect(
		barrier.ensureDepreciationPosted({
			throughDate: businessDate(depreciationTimeZone()),
		}),
	).resolves.toMatchObject({ posted: true });
}, 30_000);
