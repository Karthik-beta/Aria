import { describe, expect, it, mock } from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetDepreciationLifecycleService } from "./asset-depreciation-lifecycle.service";

function createLifecycleContext(options?: {
	asset?: Record<string, unknown>;
	activeCapitalization?: boolean;
	counts?: Partial<Record<string, number>>;
}) {
	let currentAsset: Record<string, unknown> = {
		id: "asset-1",
		series: "AST-2026-00001",
		status: "DRAFT",
		assetType: "EXISTING_ASSET",
		calculateDepreciation: false,
		purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
		availableForUseDate: new Date("2026-01-02T00:00:00.000Z"),
		company: { defaultFinanceBookId: null },
		assetCategory: { financeBookDefaults: [] },
		financeBooks: [],
		depreciationSchedules: [],
		...options?.asset,
	};
	const activities: Array<Record<string, unknown>> = [];
	const count = (name: string) =>
		mock(async () => options?.counts?.[name] ?? 0);
	const transaction = {
		$queryRaw: mock(async () => [{ locked: true }]),
		asset: {
			findFirst: mock(async () => currentAsset),
			updateMany: mock(async ({ data }: { data: Record<string, unknown> }) => {
				currentAsset = { ...currentAsset, ...data };
				return { count: 1 };
			}),
		},
		assetDepreciationSchedule: {
			updateMany: mock(async () => undefined),
			deleteMany: mock(async () => undefined),
		},
		assetDepreciationJournalEntry: { count: count("depreciation") },
		assetFinanceBook: {
			findMany: mock(async () => []),
			findFirst: mock(async () => null),
			deleteMany: mock(async () => undefined),
		},
		assetRepair: { count: count("repair") },
		assetMaintenanceTask: { count: count("maintenance") },
		assetMovement: { count: count("movement") },
		assetCapitalization: {
			count: count("capitalization"),
			findFirst: mock(async () =>
				options?.activeCapitalization ? { id: "capitalization-1" } : null,
			),
		},
		assetDisposal: { count: count("disposal") },
		assetValueAdjustment: { count: count("adjustment") },
		assetRevaluationEntry: { count: count("revaluation") },
		assetAccountingEntry: { count: count("accounting") },
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
	return {
		service: new AssetDepreciationLifecycleService(
			prisma as unknown as PrismaService,
		),
		transaction,
		activities,
	};
}

describe("AssetDepreciationLifecycleService", () => {
	it("runs submit/cancel atomically and makes successful retries no-ops", async () => {
		const activities: Array<Record<string, unknown>> = [];
		let status: "DRAFT" | "SUBMITTED" | "CANCELLED" = "DRAFT";
		const transaction = {
			$queryRaw: mock(async () => [{ locked: true }]),
			asset: {
				findFirst: mock(async () => ({
					id: "asset-1",
					series: "AST-2026-00001",
					status,
					assetType: "EXISTING_ASSET",
					calculateDepreciation: false,
					purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
					availableForUseDate: new Date("2026-01-02T00:00:00.000Z"),
					company: { defaultFinanceBookId: null },
					assetCategory: { financeBookDefaults: [] },
					financeBooks: [],
					depreciationSchedules: [],
				})),
				updateMany: mock(
					async ({ data }: { data: { status: typeof status } }) => {
						status = data.status;
						return { count: 1 };
					},
				),
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
			assetRepair: { count: mock(async () => 0) },
			assetMaintenanceTask: { count: mock(async () => 0) },
			assetMovement: { count: mock(async () => 0) },
			assetCapitalization: {
				count: mock(async () => 0),
				findFirst: mock(async () => null),
			},
			assetDisposal: { count: mock(async () => 0) },
			assetValueAdjustment: { count: mock(async () => 0) },
			assetRevaluationEntry: { count: mock(async () => 0) },
			assetAccountingEntry: { count: mock(async () => 0) },
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

		await service.submitAsset("asset-1", "org-1", "actor-1");
		await service.submitAsset("asset-1", "org-1", "actor-1");
		await service.cancelAsset("asset-1", "org-1", "actor-2");
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

	it("rejects composite submission without an active capitalization", async () => {
		const { service, transaction } = createLifecycleContext({
			asset: { assetType: "COMPOSITE_ASSET" },
		});

		await expect(
			service.submitAsset("asset-1", "org-1", "actor-1"),
		).rejects.toThrow("Please capitalize this asset before submitting it");
		expect(transaction.asset.updateMany).not.toHaveBeenCalled();
	});

	it("rejects an ordinary submission without an available-for-use date", async () => {
		const { service, transaction } = createLifecycleContext({
			asset: { availableForUseDate: null },
		});

		await expect(
			service.submitAsset("asset-1", "org-1", "actor-1"),
		).rejects.toThrow("Available-for-use date is required");
		expect(transaction.asset.updateMany).not.toHaveBeenCalled();
	});

	it("rejects a depreciation start date before available-for-use", async () => {
		const { service, transaction } = createLifecycleContext({
			asset: {
				calculateDepreciation: true,
				netPurchaseAmount: 1_000,
			},
		});

		await expect(
			service.configureAssetBooks(
				"asset-1",
				[
					{
						financeBookId: "finance-book-1",
						depreciationMethod: "STRAIGHT_LINE",
						totalNumberOfDepreciations: 12,
						frequencyOfDepreciation: 1,
						depreciationStartDate: "2026-01-01",
					},
				],
				"org-1",
			),
		).rejects.toThrow("cannot be before available-for-use date");
		expect(transaction.assetFinanceBook.deleteMany).not.toHaveBeenCalled();
	});

	it("blocks cancellation when a linked posted effect remains", async () => {
		const { service, transaction } = createLifecycleContext({
			asset: { status: "SUBMITTED" },
			counts: { depreciation: 1 },
		});

		await expect(
			service.cancelAsset("asset-1", "org-1", "actor-1"),
		).rejects.toThrow("Posted depreciation must be reversed");
		expect(transaction.asset.updateMany).not.toHaveBeenCalled();
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
			assetFinanceBookShiftAllocation: {
				deleteMany: mock(async () => undefined),
				createMany: mock(async () => undefined),
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
