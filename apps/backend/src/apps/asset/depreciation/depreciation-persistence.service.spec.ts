import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	DepreciationPersistenceService,
	DepreciationPostingValidationError,
} from "./depreciation-persistence.service";

const scheduleDate = new Date("2026-01-31T00:00:00.000Z");

const job = {
	version: 1 as const,
	assetId: "asset-1",
	assetFinanceBookId: "asset-book-1",
	scheduleId: "schedule-1",
	scheduleEntryId: "entry-1",
	depreciationDate: "2026-01-31",
};

function createService(existingEntry: { id: string; status: string } | null) {
	const updateScheduleEntry = mock(async () => undefined);
	const createJournalEntry = mock(async () => ({ id: "new-posting" }));
	const tx = {
		$queryRaw: mock(async () => [{ locked: true }]),
		assetDepreciationScheduleEntry: {
			findUnique: mock(async () => ({
				id: "entry-1",
				scheduleId: "schedule-1",
				scheduleDate,
				depreciationAmount: 10_000,
				bookValueAfterDepreciation: 90_000,
				postingId: null,
				schedule: {
					id: "schedule-1",
					status: "ACTIVE",
					assetId: "asset-1",
					assetFinanceBookId: "asset-book-1",
					asset: {
						id: "asset-1",
						series: "AST-2026-00001",
						company: "ACME",
						calculateDepreciation: true,
						status: "SUBMITTED",
					},
					assetFinanceBook: {
						id: "asset-book-1",
						financeBookId: "fb-1",
						financeBook: { name: "Statutory" },
					},
				},
			})),
			update: updateScheduleEntry,
		},
		assetDepreciationJournalEntry: {
			findUnique: mock(async () => existingEntry),
			create: createJournalEntry,
		},
	};
	const prisma = {
		client: {
			$transaction: async (callback: (t: typeof tx) => Promise<unknown>) =>
				callback(tx),
		},
	};
	return {
		service: new DepreciationPersistenceService(
			prisma as unknown as PrismaService,
		),
		updateScheduleEntry,
		createJournalEntry,
	};
}

describe("DepreciationPersistenceService.post", () => {
	it("does not treat a reversed journal entry as already posted", async () => {
		const { service, updateScheduleEntry, createJournalEntry } = createService({
			id: "reversed-posting",
			status: "REVERSED",
		});

		const error = await service.post(job).catch((e) => e);

		expect(error).toBeInstanceOf(DepreciationPostingValidationError);
		expect((error as Error).message).toContain("2026-01-31");
		expect((error as Error).message).toContain("reversed");
		expect(updateScheduleEntry).not.toHaveBeenCalled();
		expect(createJournalEntry).not.toHaveBeenCalled();
	});

	it("still links an existing posted journal entry as already posted", async () => {
		const { service, updateScheduleEntry } = createService({
			id: "posted-1",
			status: "POSTED",
		});

		await expect(service.post(job)).resolves.toEqual({
			status: "already-posted",
			postingId: "posted-1",
		});
		expect(updateScheduleEntry).toHaveBeenCalledTimes(1);
	});
});
