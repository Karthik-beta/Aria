import { afterAll, beforeAll, expect, it } from "bun:test";
import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

let app: INestApplicationContext;

beforeAll(async () => {
	process.env.NODE_ENV = "test";
	process.env.APP_TIME_ZONE ??= "UTC";
	process.env.REDIS_URL ??= "redis://localhost:6379";
	process.env.BETTER_AUTH_SECRET ??= "integration-test-secret";
	process.env.BETTER_AUTH_URL ??= "http://localhost:3001";
	process.env.FRONTEND_URL ??= "http://localhost:3000";

	const { AppModule } = await import("../../../app.module");
	app = await NestFactory.createApplicationContext(AppModule, {
		logger: ["error", "warn"],
	});
});

afterAll(async () => {
	await app.close();
});

it("boots PostgreSQL, Redis, queue events, and the depreciation worker", async () => {
	const { AriaHealthIndicator } = await import(
		"../../../health/health-indicator.service"
	);
	const { DepreciationProcessor } = await import("./depreciation.processor");
	const { DepreciationQueueClient } = await import(
		"./depreciation-queue.client"
	);

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
	const status = await queue.status();
	expect(processor.isRunning()).toBe(true);
	expect(status.workers).toBeGreaterThanOrEqual(1);
}, 30_000);
