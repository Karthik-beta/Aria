import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetDepreciationLifecycleService } from "./asset-depreciation-lifecycle.service";

describe("AssetDepreciationLifecycleService", () => {
	it("attributes submit and cancel activity to the authenticated actor", async () => {
		const activities: Array<Record<string, unknown>> = [];
		const transaction = {
			$queryRaw: mock(async () => [{ locked: true }]),
			asset: {
				findFirst: mock(async () => ({
					status: "DRAFT",
					calculateDepreciation: false,
					_count: { financeBooks: 0 },
				})),
				updateMany: mock(async () => ({ count: 1 })),
			},
			assetDepreciationSchedule: {
				updateMany: mock(async () => undefined),
			},
			assetDepreciationJournalEntry: {
				count: mock(async () => 0),
			},
			assetFinanceBook: {
				findMany: mock(async () => []),
			},
			assetActivity: {
				create: mock(async ({ data }: { data: Record<string, unknown> }) => {
					activities.push(data);
				}),
			},
		};
		const prisma = {
			$transaction: mock(
				async (callback: (tx: typeof transaction) => Promise<void>) =>
					callback(transaction),
			),
		};
		const service = new AssetDepreciationLifecycleService(
			prisma as unknown as PrismaService,
		);
		service.configureAssetBooks = mock(async () => undefined);

		await service.submitAsset("asset-1", "org-1", "actor-1");
		await service.cancelAsset("asset-1", "org-1", "actor-2");

		expect(activities).toEqual([
			{
				assetId: "asset-1",
				activity: "Asset submitted for depreciation",
				userId: "actor-1",
			},
			{
				assetId: "asset-1",
				activity: "Asset cancelled",
				userId: "actor-2",
			},
		]);
	});

	it("regenerates an empty migrated schedule from its asset finance book", async () => {
		type UpdateArgs = {
			where: { id: string };
			data: Record<string, unknown>;
		};
		const updateBookCalls: UpdateArgs[] = [];
		const updateBook = mock(async (args: UpdateArgs) => {
			updateBookCalls.push(args);
			return { count: 1 };
		});
		const updateScheduleCalls: UpdateArgs[] = [];
		const updateSchedule = mock(async (args: UpdateArgs) => {
			updateScheduleCalls.push(args);
		});
		const transaction = {
			$queryRaw: mock(async () => [{ locked: true }]),
			asset: {
				findFirst: mock(async () => ({
					id: "asset-1",
					status: "SUBMITTED",
					calculateDepreciation: true,
					company: { defaultFinanceBookId: "finance-book-1" },
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
				updateMany: mock(async () => ({ count: 1 })),
			},
			assetDepreciationJournalEntry: { count: mock(async () => 0) },
			assetDepreciationSchedule: {
				deleteMany: mock(async () => undefined),
				update: updateSchedule,
				create: mock(async () => undefined),
			},
			assetFinanceBook: {
				deleteMany: mock(async () => undefined),
				create: mock(async () => undefined),
				updateMany: updateBook,
				findMany: mock(async () => [{ id: "asset-book-1" }]),
				findFirst: mock(async () => ({
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
				findFirst: mock(async () => ({
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

		await service.configureAssetBooks("asset-1", undefined, "org-1");

		expect(updateBook).toHaveBeenCalledTimes(1);
		const firstBookCall = updateBookCalls.at(0);
		expect(firstBookCall).toBeDefined();
		if (!firstBookCall) throw new Error("Expected a finance-book update.");
		expect(Number(firstBookCall.data.rateOfDepreciation)).toBe(100);
		expect(updateSchedule).toHaveBeenCalledTimes(1);
		const firstScheduleCall = updateScheduleCalls.at(0);
		expect(firstScheduleCall).toBeDefined();
		if (!firstScheduleCall) throw new Error("Expected a schedule update.");
		const scheduleData = firstScheduleCall.data as Record<string, unknown>;
		expect(scheduleData.revisionNumber).toBe(3);
		expect(scheduleData.rateOfDepreciation).toBe(100);
		expect(
			(scheduleData.entries as Record<string, unknown>).create,
		).toHaveLength(1);
	});

	it("discovers books whose only open schedule has no entries", async () => {
		type FindManyArgs = {
			where: {
				schedules?: { none?: Record<string, unknown> };
				[key: string]: unknown;
			};
		};
		const findManyCalls: FindManyArgs[] = [];
		const findManyResults: Array<
			Array<{
				id: string;
				assetId: string;
				asset: { company: { organizationId: string } };
			}>
		> = [
			[
				{
					id: "book-1",
					assetId: "asset-1",
					asset: { company: { organizationId: "org-1" } },
				},
			],
			[],
		];
		let findManyCallIndex = 0;
		const findMany = mock(async (args: FindManyArgs) => {
			findManyCalls.push(args);
			return findManyResults[findManyCallIndex++] ?? [];
		});
		const prisma = { assetFinanceBook: { findMany } };
		const service = new AssetDepreciationLifecycleService(
			prisma as unknown as PrismaService,
		);
		const configureAssetBooks = mock(async () => undefined);
		service.configureAssetBooks = configureAssetBooks;

		await expect(service.ensureSubmittedSchedules()).resolves.toBe(1);

		expect(configureAssetBooks).toHaveBeenCalledWith(
			"asset-1",
			undefined,
			"org-1",
		);
		expect(findManyCalls[0]?.where.schedules).toEqual({
			none: {
				status: { in: ["DRAFT", "ACTIVE"] },
				entries: { some: {} },
			},
		});
	});
});
