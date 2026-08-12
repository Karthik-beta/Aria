import { afterAll, beforeAll, expect, it } from "bun:test";
import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../../app.module";
import { AriaHealthIndicator } from "../../../health/health-indicator.service";
import { AssetService } from "../asset.service";
import { FixedAssetRegisterReportService } from "../fixed-asset-register-report";
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
	expect(app.get(AssetService)).toBeDefined();
	const reportService = app.get(FixedAssetRegisterReportService);
	expect(reportService).toBeDefined();

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
			kind: "system",
			throughDate: businessDate(depreciationTimeZone()),
		}),
	).resolves.toMatchObject({ posted: true });
	const report = await reportService.generateReport(
		{
			fromDate: new Date("2026-01-01T00:00:00.000Z"),
			toDate: new Date("2026-12-31T00:00:00.000Z"),
			groupBy: "ASSET_CATEGORY",
		},
		"org-1",
	);
	expect(report.summary.totalAssets).toBeGreaterThanOrEqual(0);
}, 30_000);
