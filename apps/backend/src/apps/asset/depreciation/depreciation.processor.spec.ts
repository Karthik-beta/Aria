import { describe, expect, it, mock } from "bun:test";
import { DelayedError, UnrecoverableError } from "bullmq";
import type { DepreciationMetrics } from "./depreciation.metrics";
import { DepreciationProcessor } from "./depreciation.processor";
import {
	type DepreciationPersistenceService,
	DepreciationPostingValidationError,
} from "./depreciation-persistence.service";

const jobData = {
	version: 1 as const,
	organizationId: "org-1",
	assetId: "asset-1",
	assetFinanceBookId: "asset-book-1",
	scheduleId: "schedule-1",
	scheduleEntryId: "entry-1",
	depreciationDate: "2026-07-05",
};

function metricsMock(): DepreciationMetrics {
	return {
		recordBlocked: mock(() => undefined),
		recordDuration: mock(() => undefined),
		recordCompleted: mock(() => undefined),
		recordFailed: mock(() => undefined),
	} as unknown as DepreciationMetrics;
}

function jobMock(overrides: Record<string, unknown> = {}) {
	return {
		id: "asset-depreciation-entry-1",
		name: "post-asset-depreciation",
		data: jobData,
		attemptsStarted: 1,
		attemptsMade: 0,
		token: "worker-token",
		opts: { attempts: 5 },
		...overrides,
	} as unknown as Parameters<DepreciationProcessor["process"]>[0];
}

describe("DepreciationProcessor", () => {
	it("treats an idempotent database hit as a successful job", async () => {
		const persistence = {
			post: mock(async () => ({
				status: "already-posted" as const,
				postingId: "posting-1",
			})),
		} as unknown as DepreciationPersistenceService;
		const processor = new DepreciationProcessor(persistence, metricsMock());

		await expect(processor.process(jobMock())).resolves.toEqual({
			status: "already-posted",
			postingId: "posting-1",
		});
	});

	it("defers an out-of-order period without consuming a normal retry", async () => {
		const moveToDelayed = mock(async () => undefined);
		const persistence = {
			post: mock(async () => ({
				status: "out-of-order" as const,
				earlierScheduleEntryId: "entry-0",
			})),
		} as unknown as DepreciationPersistenceService;
		const processor = new DepreciationProcessor(persistence, metricsMock());

		await expect(
			processor.process(jobMock({ moveToDelayed })),
		).rejects.toBeInstanceOf(DelayedError);
		expect(moveToDelayed).toHaveBeenCalledWith(
			expect.any(Number),
			"worker-token",
		);
	});

	it("marks permanent business validation failures as unrecoverable", async () => {
		const persistence = {
			post: mock(async () => {
				throw new DepreciationPostingValidationError("Accounts are missing.");
			}),
		} as unknown as DepreciationPersistenceService;
		const processor = new DepreciationProcessor(persistence, metricsMock());

		await expect(processor.process(jobMock())).rejects.toBeInstanceOf(
			UnrecoverableError,
		);
	});
});
