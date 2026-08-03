import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetDepreciationLifecycleService } from "./asset-depreciation-lifecycle.service";

describe("AssetDepreciationLifecycleService", () => {
	it("regenerates an empty migrated schedule from its asset finance book", async () => {
		const updateBook = mock(async () => undefined);
		const updateSchedule = mock(async () => undefined);
		const transaction = {
			assetDepreciationJournalEntry: { count: mock(async () => 0) },
			assetDepreciationSchedule: {
				deleteMany: mock(async () => undefined),
				update: updateSchedule,
				create: mock(async () => undefined),
			},
			assetFinanceBook: {
				deleteMany: mock(async () => undefined),
				create: mock(async () => undefined),
				update: updateBook,
				findUnique: mock(async () => ({
					id: "asset-book-1",
					rateOfDepreciation: null,
					schedules: [
						{
							id: "empty-schedule-1",
							revisionNumber: 3,
							_count: { entries: 0 },
						},
					],
				})),
			},
		};
		const prisma = {
			asset: {
				findUniqueOrThrow: mock(async () => ({
					id: "asset-1",
					status: "SUBMITTED",
					calculateDepreciation: true,
					company: "Pivotr Private Limited",
					purchaseDate: new Date("2030-01-01T00:00:00.000Z"),
					availableForUseDate: new Date("2030-01-01T00:00:00.000Z"),
					depreciationStartDate: new Date("2030-12-31T00:00:00.000Z"),
					netPurchaseAmount: 100_000,
					openingAccumulatedDepreciation: 0,
					openingNumberOfBookedDepreciations: 0,
					assetCategory: { financeBookDefaults: [] },
					financeBooks: [
						{
							financeBookId: "finance-book-1",
							depreciationMethod: "WRITTEN_DOWN_VALUE",
							totalNumberOfDepreciations: 3,
							frequencyOfDepreciation: 12,
							depreciationStartDate: new Date("2030-12-31T00:00:00.000Z"),
							dailyProrataBased: false,
							shiftBased: false,
							rateOfDepreciation: null,
							expectedValueAfterUsefulLife: 0,
							openingAccumulatedDepreciation: 0,
							openingNumberOfBookedDepreciations: 0,
						},
					],
				})),
			},
			company: {
				findUnique: mock(async () => ({
					defaultFinanceBookId: "finance-book-1",
				})),
			},
			$transaction: mock(
				async (callback: (tx: typeof transaction) => Promise<void>) =>
					callback(transaction),
			),
		};
		const service = new AssetDepreciationLifecycleService(
			prisma as unknown as PrismaService,
		);

		await service.configureAssetBooks("asset-1");

		expect(updateBook).toHaveBeenCalledTimes(1);
		expect(Number(updateBook.mock.calls[0]?.[0].data.rateOfDepreciation)).toBe(
			100,
		);
		expect(updateSchedule).toHaveBeenCalledTimes(1);
		const scheduleData = updateSchedule.mock.calls[0]?.[0].data;
		expect(scheduleData.revisionNumber).toBe(3);
		expect(scheduleData.rateOfDepreciation).toBe(100);
		expect(scheduleData.entries.create).toHaveLength(1);
	});

	it("discovers books whose only open schedule has no entries", async () => {
		const findMany = mock()
			.mockResolvedValueOnce([{ id: "book-1", assetId: "asset-1" }])
			.mockResolvedValueOnce([]);
		const prisma = { assetFinanceBook: { findMany } };
		const service = new AssetDepreciationLifecycleService(
			prisma as unknown as PrismaService,
		);
		const configureAssetBooks = mock(async () => undefined);
		service.configureAssetBooks = configureAssetBooks;

		await expect(service.ensureSubmittedSchedules()).resolves.toBe(1);

		expect(configureAssetBooks).toHaveBeenCalledWith("asset-1");
		expect(findMany.mock.calls[0]?.[0].where.schedules).toEqual({
			none: {
				status: { in: ["DRAFT", "ACTIVE"] },
				entries: { some: {} },
			},
		});
	});
});
