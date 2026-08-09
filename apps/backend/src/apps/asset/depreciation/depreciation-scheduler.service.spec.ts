import { afterEach, describe, expect, it, mock } from "bun:test";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { PrismaService } from "../../../shared/prisma.service";
import type { AssetDepreciationLifecycleService } from "./asset-depreciation-lifecycle.service";
import type { CwipCapitalizationDiscoveryService } from "./cwip-capitalization-discovery.service";
import type { DepreciationMetrics } from "./depreciation.metrics";
import type { DepreciationDiscoveryService } from "./depreciation-discovery.service";
import { DepreciationSchedulerService } from "./depreciation-scheduler.service";

const originalEnvironment = { ...process.env };

afterEach(() => {
	process.env = { ...originalEnvironment };
});

describe("DepreciationSchedulerService", () => {
	const cwipDiscovery = {
		discover: mock(async () => ({
			discovered: 0,
			qualified: 0,
			enqueued: 0,
			duplicateSkipped: 0,
		})),
	} as unknown as CwipCapitalizationDiscoveryService;

	it("uses one idempotent path for startup, cron, and reconciliation, and registers 4 cron jobs", async () => {
		process.env.APP_TIME_ZONE = "UTC";
		process.env.ASSET_DEPRECIATION_RECONCILIATION_INTERVAL_MS = "900000";
		const lifecycle = { ensureSubmittedSchedules: mock(async () => undefined) };
		const discovery = {
			discover: mock(
				async (
					..._args: Parameters<DepreciationDiscoveryService["discover"]>
				) => undefined,
			),
		};
		const metrics = { recordDiscoveryFailure: mock(() => undefined) };
		const registry = new SchedulerRegistry();
		const scheduler = new DepreciationSchedulerService(
			registry,
			lifecycle as unknown as AssetDepreciationLifecycleService,
			discovery as unknown as DepreciationDiscoveryService,
			metrics as unknown as DepreciationMetrics,
			cwipDiscovery,
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
		expect(cwipDiscovery.discover).toHaveBeenCalledWith(expect.any(String));

		// Verify all 4 daily cron jobs were registered
		expect(
			registry.doesExist("cron", "asset-depreciation-daily-discovery"),
		).toBe(true);
		expect(registry.doesExist("cron", "asset-update-maintenance-status")).toBe(
			true,
		);
		expect(registry.doesExist("cron", "asset-post-cwip-capitalization")).toBe(
			true,
		);
		expect(
			registry.doesExist("cron", "asset-update-maintenance-log-status"),
		).toBe(true);

		scheduler.onApplicationShutdown();
		expect(
			registry.doesExist("cron", "asset-depreciation-daily-discovery"),
		).toBe(false);
		expect(registry.doesExist("cron", "asset-update-maintenance-status")).toBe(
			false,
		);
		expect(registry.doesExist("cron", "asset-post-cwip-capitalization")).toBe(
			false,
		);
		expect(
			registry.doesExist("cron", "asset-update-maintenance-log-status"),
		).toBe(false);
	});

	it("meters dependency failure without failing application bootstrap", async () => {
		process.env.APP_TIME_ZONE = "UTC";
		const failure = new Error("redis unavailable");
		const lifecycle = { ensureSubmittedSchedules: mock(async () => undefined) };
		const discovery = {
			discover: mock(
				async (
					..._args: Parameters<DepreciationDiscoveryService["discover"]>
				) => {
					throw failure;
				},
			),
		};
		const metrics = { recordDiscoveryFailure: mock(() => undefined) };
		const registry = new SchedulerRegistry();
		const scheduler = new DepreciationSchedulerService(
			registry,
			lifecycle as unknown as AssetDepreciationLifecycleService,
			discovery as unknown as DepreciationDiscoveryService,
			metrics as unknown as DepreciationMetrics,
			cwipDiscovery,
		);

		await expect(scheduler.onApplicationBootstrap()).resolves.toBeUndefined();
		expect(metrics.recordDiscoveryFailure).toHaveBeenCalledWith("startup");
		scheduler.onApplicationShutdown();
	});

	it("executes updateMaintenanceStatus daily job correctly", async () => {
		const findManyRepairMock = mock(async () => [
			{ assetId: "asset-repair-1" },
		]);
		const updateManyAssetMock = mock(async () => ({ count: 1 }));
		const findManyTaskMock = mock(async () => [
			{ maintenance: { assetId: "asset-task-1" } },
		]);

		const prismaMock = {
			assetRepair: { findMany: findManyRepairMock },
			assetMaintenanceTask: { findMany: findManyTaskMock },
			asset: { updateMany: updateManyAssetMock },
		} as unknown as PrismaService;

		const registry = new SchedulerRegistry();
		const scheduler = new DepreciationSchedulerService(
			registry,
			{} as unknown as AssetDepreciationLifecycleService,
			{} as unknown as DepreciationDiscoveryService,
			{} as unknown as DepreciationMetrics,
			cwipDiscovery,
			prismaMock,
		);

		await scheduler.updateMaintenanceStatus();

		expect(findManyRepairMock).toHaveBeenCalled();
		expect(findManyTaskMock).toHaveBeenCalled();
		expect(updateManyAssetMock).toHaveBeenCalledTimes(2);
	});

	it("discovers CWIP jobs without mutating asset or stock state", async () => {
		const cwipDiscovery = {
			discover: mock(async () => ({
				discovered: 1,
				qualified: 1,
				enqueued: 1,
				duplicateSkipped: 0,
			})),
		};
		const registry = new SchedulerRegistry();
		const scheduler = new DepreciationSchedulerService(
			registry,
			{} as unknown as AssetDepreciationLifecycleService,
			{} as unknown as DepreciationDiscoveryService,
			{} as unknown as DepreciationMetrics,
			cwipDiscovery as unknown as CwipCapitalizationDiscoveryService,
		);

		await scheduler.postCwipCapitalizationGlEntries("2026-08-09");

		expect(cwipDiscovery.discover).toHaveBeenCalledWith("2026-08-09");
	});

	it("executes updateMaintenanceLogStatus daily job correctly", async () => {
		const findManyTaskMock = mock(async () => [{ id: "task-overdue-1" }]);
		const updateManyLogMock = mock(async () => ({ count: 1 }));
		const updateManyTaskMock = mock(async () => ({ count: 1 }));

		const prismaMock = {
			assetMaintenanceTask: {
				findMany: findManyTaskMock,
				updateMany: updateManyTaskMock,
			},
			assetMaintenanceLog: {
				updateMany: updateManyLogMock,
			},
		} as unknown as PrismaService;

		const registry = new SchedulerRegistry();
		const scheduler = new DepreciationSchedulerService(
			registry,
			{} as unknown as AssetDepreciationLifecycleService,
			{} as unknown as DepreciationDiscoveryService,
			{} as unknown as DepreciationMetrics,
			cwipDiscovery,
			prismaMock,
		);

		await scheduler.updateMaintenanceLogStatus();

		expect(findManyTaskMock).toHaveBeenCalled();
		expect(updateManyLogMock).toHaveBeenCalledWith({
			where: {
				taskId: { in: ["task-overdue-1"] },
				maintenanceStatus: "PLANNED",
			},
			data: { maintenanceStatus: "OVERDUE" },
		});
		expect(updateManyTaskMock).toHaveBeenCalledWith({
			where: {
				id: { in: ["task-overdue-1"] },
				maintenanceStatus: "PLANNED",
			},
			data: { maintenanceStatus: "OVERDUE" },
		});
	});
});
