import { afterEach, describe, expect, it, mock } from "bun:test";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { AssetDepreciationLifecycleService } from "./asset-depreciation-lifecycle.service";
import type { DepreciationMetrics } from "./depreciation.metrics";
import type { DepreciationDiscoveryService } from "./depreciation-discovery.service";
import { DepreciationSchedulerService } from "./depreciation-scheduler.service";

const originalEnvironment = { ...process.env };

afterEach(() => {
	process.env = { ...originalEnvironment };
});

describe("DepreciationSchedulerService", () => {
	it("uses one idempotent path for startup, cron, and reconciliation", async () => {
		process.env.APP_TIME_ZONE = "UTC";
		process.env.ASSET_DEPRECIATION_RECONCILIATION_INTERVAL_MS = "900000";
		const lifecycle = { ensureSubmittedSchedules: mock(async () => undefined) };
		const discovery = { discover: mock(async () => undefined) };
		const metrics = { recordDiscoveryFailure: mock(() => undefined) };
		const registry = new SchedulerRegistry();
		const scheduler = new DepreciationSchedulerService(
			registry,
			lifecycle as unknown as AssetDepreciationLifecycleService,
			discovery as unknown as DepreciationDiscoveryService,
			metrics as unknown as DepreciationMetrics,
		);

		await scheduler.onApplicationBootstrap();
		await scheduler.runDailyDiscovery();
		await scheduler.runDiscovery("reconciliation");

		expect(lifecycle.ensureSubmittedSchedules).toHaveBeenCalledTimes(3);
		expect(discovery.discover).toHaveBeenCalledTimes(3);
		expect(discovery.discover.mock.calls.map((call) => call[1])).toEqual([
			"startup",
			"cron",
			"reconciliation",
		]);
		scheduler.onApplicationShutdown();
	});

	it("meters dependency failure without failing application bootstrap", async () => {
		process.env.APP_TIME_ZONE = "UTC";
		const failure = new Error("redis unavailable");
		const lifecycle = { ensureSubmittedSchedules: mock(async () => undefined) };
		const discovery = {
			discover: mock(async () => {
				throw failure;
			}),
		};
		const metrics = { recordDiscoveryFailure: mock(() => undefined) };
		const registry = new SchedulerRegistry();
		const scheduler = new DepreciationSchedulerService(
			registry,
			lifecycle as unknown as AssetDepreciationLifecycleService,
			discovery as unknown as DepreciationDiscoveryService,
			metrics as unknown as DepreciationMetrics,
		);

		await expect(scheduler.onApplicationBootstrap()).resolves.toBeUndefined();
		expect(metrics.recordDiscoveryFailure).toHaveBeenCalledWith("startup");
		scheduler.onApplicationShutdown();
	});
});
