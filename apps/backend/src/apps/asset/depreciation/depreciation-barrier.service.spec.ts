import { describe, expect, it, mock } from "bun:test";
import { DepreciationBarrierError } from "./depreciation.types";
import { DepreciationBarrierService } from "./depreciation-barrier.service";
import type { DepreciationDiscoveryService } from "./depreciation-discovery.service";
import type { DepreciationPersistenceService } from "./depreciation-persistence.service";
import type { DepreciationQueueClient } from "./depreciation-queue.client";
import type { DepreciationQueueSignal } from "./depreciation-queue-events";

describe("DepreciationBarrierService", () => {
	it("returns only after database state has no due periods", async () => {
		const service = new DepreciationBarrierService(
			{} as DepreciationQueueClient,
			{
				discover: mock(async () => ({})),
			} as unknown as DepreciationDiscoveryService,
			{
				pendingSnapshot: mock(async () => ({
					periods: [],
					frozen: 0,
					oldestUnpostedDate: null,
				})),
			} as unknown as DepreciationPersistenceService,
			{} as DepreciationQueueSignal,
		);

		await expect(
			service.ensureDepreciationPosted({ throughDate: "2026-07-10" }),
		).resolves.toMatchObject({ throughDate: "2026-07-10", posted: true });
	});

	it("fails closed when a due period is frozen", async () => {
		const service = new DepreciationBarrierService(
			{} as DepreciationQueueClient,
			{
				discover: mock(async () => ({})),
			} as unknown as DepreciationDiscoveryService,
			{
				pendingSnapshot: mock(async () => ({
					periods: [{ scheduleEntryId: "entry-1" }],
					frozen: 1,
					oldestUnpostedDate: null,
				})),
			} as unknown as DepreciationPersistenceService,
			{} as DepreciationQueueSignal,
		);

		try {
			await service.ensureDepreciationPosted({ throughDate: "2026-07-10" });
			throw new Error("Expected the depreciation barrier to fail.");
		} catch (error) {
			expect(error).toBeInstanceOf(DepreciationBarrierError);
			expect((error as DepreciationBarrierError).code).toBe(
				"DEPRECIATION_PERIOD_FROZEN",
			);
		}
	});

	it("fails closed when BullMQ has a terminal worker failure", async () => {
		const period = {
			assetId: "asset-1",
			assetFinanceBookId: "asset-book-1",
			financeBookId: "book-1",
			scheduleId: "schedule-1",
			scheduleEntryId: "entry-1",
			depreciationDate: new Date("2026-07-05T00:00:00.000Z"),
			company: "Aria",
			blockedByFreeze: false,
		};
		const service = new DepreciationBarrierService(
			{
				getJob: mock(async () => ({
					getState: async () => "failed",
					failedReason: "Depreciation accounts are not configured",
				})),
			} as unknown as DepreciationQueueClient,
			{
				discover: mock(async () => ({})),
			} as unknown as DepreciationDiscoveryService,
			{
				pendingSnapshot: mock(async () => ({
					periods: [period],
					frozen: 0,
					oldestUnpostedDate: period.depreciationDate,
				})),
			} as unknown as DepreciationPersistenceService,
			{} as DepreciationQueueSignal,
		);

		try {
			await service.ensureDepreciationPosted({ throughDate: "2026-07-10" });
			throw new Error("Expected the depreciation barrier to fail.");
		} catch (error) {
			expect(error).toBeInstanceOf(DepreciationBarrierError);
			expect((error as DepreciationBarrierError).code).toBe(
				"DEPRECIATION_FAILED",
			);
		}
	});
});
