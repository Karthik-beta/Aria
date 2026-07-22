import { describe, expect, it, mock } from "bun:test";
import type { DepreciationMetrics } from "./depreciation.metrics";
import { DepreciationDiscoveryService } from "./depreciation-discovery.service";
import type { DepreciationPersistenceService } from "./depreciation-persistence.service";
import type { DepreciationQueueClient } from "./depreciation-queue.client";

describe("DepreciationDiscoveryService", () => {
	it("enqueues only unfrozen periods with deterministic ids", async () => {
		const addBulk = mock(async () => undefined);
		const queue = {
			getJob: mock(async () => undefined),
			addBulk,
		} as unknown as DepreciationQueueClient;
		const persistence = {
			pendingPage: mock(async () => [
				{
					assetId: "asset-1",
					assetFinanceBookId: "asset-book-1",
					financeBookId: "book-1",
					scheduleId: "schedule-1",
					scheduleEntryId: "entry-1",
					depreciationDate: new Date("2026-07-05T00:00:00.000Z"),
					company: "Aria",
					blockedByFreeze: false,
				},
				{
					assetId: "asset-2",
					assetFinanceBookId: "asset-book-2",
					financeBookId: "book-1",
					scheduleId: "schedule-2",
					scheduleEntryId: "entry-2",
					depreciationDate: new Date("2026-07-05T00:00:00.000Z"),
					company: "Aria",
					blockedByFreeze: true,
				},
			]),
		} as unknown as DepreciationPersistenceService;
		const metrics = {
			recordDiscovery: mock(() => undefined),
			recordDuplicateSkipped: mock(() => undefined),
			setOldestUnposted: mock(() => undefined),
		} as unknown as DepreciationMetrics;

		const result = await new DepreciationDiscoveryService(
			queue,
			persistence,
			metrics,
		).discover({ throughDate: "2026-07-10" }, "startup");

		expect(result).toMatchObject({
			discovered: 2,
			enqueued: 1,
			duplicateSkipped: 0,
			frozen: 1,
		});
		expect(addBulk).toHaveBeenCalledWith([
			{
				name: "post-asset-depreciation",
				data: {
					version: 1,
					assetId: "asset-1",
					assetFinanceBookId: "asset-book-1",
					scheduleId: "schedule-1",
					scheduleEntryId: "entry-1",
					depreciationDate: "2026-07-05",
				},
				opts: { jobId: "asset-depreciation-entry-1" },
			},
		]);
	});

	it("skips a period whose deterministic job already exists", async () => {
		const queue = {
			getJob: mock(async () => ({
				getState: async () => "waiting",
			})),
			addBulk: mock(async () => undefined),
		} as unknown as DepreciationQueueClient;
		const persistence = {
			pendingPage: mock(async () => [
				{
					assetId: "asset-1",
					assetFinanceBookId: "asset-book-1",
					financeBookId: "book-1",
					scheduleId: "schedule-1",
					scheduleEntryId: "entry-1",
					depreciationDate: new Date("2026-07-05T00:00:00.000Z"),
					company: "Aria",
					blockedByFreeze: false,
				},
			]),
		} as unknown as DepreciationPersistenceService;
		const metrics = {
			recordDiscovery: mock(() => undefined),
			recordDuplicateSkipped: mock(() => undefined),
			setOldestUnposted: mock(() => undefined),
		} as unknown as DepreciationMetrics;

		const result = await new DepreciationDiscoveryService(
			queue,
			persistence,
			metrics,
		).discover({ throughDate: "2026-07-10" });

		expect(result.enqueued).toBe(0);
		expect(result.duplicateSkipped).toBe(1);
	});

	it("queues only the earliest due period for each asset finance book", async () => {
		const addBulk = mock(async () => undefined);
		const queue = {
			getJob: mock(async () => undefined),
			addBulk,
		} as unknown as DepreciationQueueClient;
		const persistence = {
			pendingPage: mock(async () => [
				{
					assetId: "asset-1",
					assetFinanceBookId: "asset-book-1",
					financeBookId: "book-1",
					scheduleId: "schedule-1",
					scheduleEntryId: "entry-1",
					depreciationDate: new Date("2026-06-30T00:00:00.000Z"),
					company: "Aria",
					blockedByFreeze: false,
				},
				{
					assetId: "asset-1",
					assetFinanceBookId: "asset-book-1",
					financeBookId: "book-1",
					scheduleId: "schedule-1",
					scheduleEntryId: "entry-2",
					depreciationDate: new Date("2026-07-31T00:00:00.000Z"),
					company: "Aria",
					blockedByFreeze: false,
				},
			]),
		} as unknown as DepreciationPersistenceService;
		const metrics = {
			recordDiscovery: mock(() => undefined),
			recordDuplicateSkipped: mock(() => undefined),
			setOldestUnposted: mock(() => undefined),
		} as unknown as DepreciationMetrics;

		const result = await new DepreciationDiscoveryService(
			queue,
			persistence,
			metrics,
		).discover({ throughDate: "2026-07-31" });

		expect(result.discovered).toBe(2);
		expect(result.enqueued).toBe(1);
		expect(addBulk).toHaveBeenCalledWith([
			expect.objectContaining({
				data: expect.objectContaining({ scheduleEntryId: "entry-1" }),
			}),
		]);
	});

	it("does not automatically retry a terminal failed accounting job", async () => {
		const remove = mock(async () => undefined);
		const queue = {
			getJob: mock(async () => ({
				getState: async () => "failed",
				finishedOn: Date.now() - 86_400_000,
				timestamp: Date.now() - 86_400_000,
				remove,
			})),
			addBulk: mock(async () => undefined),
		} as unknown as DepreciationQueueClient;
		const persistence = {
			pendingPage: mock(async () => [
				{
					assetId: "asset-1",
					assetFinanceBookId: "asset-book-1",
					financeBookId: "book-1",
					scheduleId: "schedule-1",
					scheduleEntryId: "entry-1",
					depreciationDate: new Date("2026-07-05T00:00:00.000Z"),
					company: "Aria",
					blockedByFreeze: false,
				},
			]),
		} as unknown as DepreciationPersistenceService;
		const metrics = {
			recordDiscovery: mock(() => undefined),
			recordDuplicateSkipped: mock(() => undefined),
			setOldestUnposted: mock(() => undefined),
		} as unknown as DepreciationMetrics;

		const result = await new DepreciationDiscoveryService(
			queue,
			persistence,
			metrics,
		).discover({ throughDate: "2026-07-10" }, "reconciliation");

		expect(result.enqueued).toBe(0);
		expect(remove).not.toHaveBeenCalled();
	});
});
