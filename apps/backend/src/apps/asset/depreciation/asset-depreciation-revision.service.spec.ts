import { describe, expect, it, mock } from "bun:test";
import type { Prisma } from "../../../generated/prisma/client";
import {
	AssetDepreciationRevisionError,
	AssetDepreciationRevisionService,
} from "./asset-depreciation-revision.service";

const effectiveDate = new Date("2026-02-01T00:00:00.000Z");
const ORGANIZATION_ID = "organization-1";

function book(
	id: string,
	financeBookId: string,
	overrides: Record<string, unknown> = {},
) {
	return {
		id,
		financeBookId,
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 5,
		increaseInAssetLife: 0,
		frequencyOfDepreciation: 12,
		dailyProrataBased: false,
		shiftBased: false,
		rateOfDepreciation: null,
		expectedValueAfterUsefulLife: 100,
		openingAccumulatedDepreciation: 0,
		openingNumberOfBookedDepreciations: 0,
		valueAfterDepreciation: 800,
		totalNumberOfBookedDepreciations: 1,
		lastPostedDepreciationDate: new Date("2026-01-31T00:00:00.000Z"),
		schedules: [{ id: `schedule-${id}`, revisionNumber: 2 }],
		...overrides,
	};
}

function revisionTransaction(
	books: ReturnType<typeof book>[],
	postedEntries: Array<{
		scheduleDate: Date;
		accumulatedDepreciationAmount: number;
	} | null>,
) {
	const findMany = mock(
		async (_args: Prisma.AssetFinanceBookFindManyArgs) =>
			[] as Array<{ id: string } | ReturnType<typeof book>>,
	)
		.mockResolvedValueOnce(books.map(({ id }) => ({ id })))
		.mockResolvedValueOnce(books);
	const findFirst = mock(
		async (
			_args: Record<string, unknown>,
		): Promise<{
			scheduleDate: Date;
			accumulatedDepreciationAmount: number;
		} | null> => null,
	);
	for (const entry of postedEntries) findFirst.mockResolvedValueOnce(entry);
	const countEntries = mock(async (_args: Record<string, unknown>) => 1);
	const lock = mock(async (_query: unknown) => []);
	const updateSchedule = mock(
		async (_args: { where: { id: string }; data: Record<string, unknown> }) =>
			undefined,
	);
	const updateBook = mock(
		async (_args: { where: { id: string }; data: Record<string, unknown> }) =>
			undefined,
	);
	type ScheduleCreateArgs = {
		data: {
			assetFinanceBookId: string;
			entries?: { create?: unknown[] };
			[key: string]: unknown;
		};
	};
	const createScheduleCalls: ScheduleCreateArgs[] = [];
	const createSchedule = mock(async (args: ScheduleCreateArgs) => {
		createScheduleCalls.push(args);
		return {
			id: `revision-${args.data.assetFinanceBookId}`,
		};
	});
	const updateMany = mock(
		async (_args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}) => ({ count: 1 }),
	);
	const updateBookMany = mock(
		async (_args: {
			where: Record<string, unknown>;
			data: Record<string, unknown>;
		}) => ({ count: 1 }),
	);
	const findSchedule = mock(
		async (_args: Record<string, unknown>): Promise<unknown> => null,
	);
	const findFirstSchedule = mock(
		async (_args: Record<string, unknown>): Promise<unknown> => null,
	);

	return {
		transaction: {
			$queryRaw: lock,
			assetFinanceBook: {
				findMany,
				update: updateBook,
				updateMany: updateBookMany,
			},
			assetDepreciationScheduleEntry: { findFirst, count: countEntries },
			assetDepreciationSchedule: {
				update: updateSchedule,
				create: createSchedule,
				updateMany,
				findUnique: findSchedule,
				findFirst: findFirstSchedule,
			},
		},
		findMany,
		findFirst,
		countEntries,
		lock,
		updateSchedule,
		updateBook,
		createSchedule,
		updateMany,
		updateBookMany,
		findSchedule,
		findFirstSchedule,
		createScheduleCalls,
	};
}

describe("AssetDepreciationRevisionService", () => {
	it("revises every finance book, preserves the predecessor chain, and applies value and life deltas", async () => {
		const firstBook = book("book-a", "finance-a");
		const secondBook = book("book-b", "finance-b", {
			valueAfterDepreciation: 600,
			totalNumberOfBookedDepreciations: 0,
			lastPostedDepreciationDate: null,
			schedules: [{ id: "schedule-book-b", revisionNumber: 4 }],
		});
		const mocked = revisionTransaction(
			[firstBook, secondBook],
			[
				{
					scheduleDate: new Date("2026-01-31T00:00:00.000Z"),
					accumulatedDepreciationAmount: 200,
				},
				null,
			],
		);
		const service = new AssetDepreciationRevisionService();

		const revisions = await service.revise(
			mocked.transaction as unknown as Prisma.TransactionClient,
			ORGANIZATION_ID,
			{
				assetId: "asset-1",
				effectiveDate,
				valueDelta: 100,
				usefulLifeDeltaMonths: 24,
				notes: "Capital improvement",
			},
		);

		expect(mocked.lock).toHaveBeenCalledTimes(4);
		expect(mocked.updateMany.mock.calls).toHaveLength(2);
		expect(mocked.updateMany.mock.calls[0]?.[0]).toMatchObject({
			where: { id: "schedule-book-a" },
			data: { status: "CANCELLED" },
		});
		expect(mocked.updateMany.mock.calls[1]?.[0]).toMatchObject({
			where: { id: "schedule-book-b" },
			data: { status: "CANCELLED" },
		});
		expect(mocked.updateBookMany.mock.calls).toHaveLength(2);
		expect(mocked.updateBookMany.mock.calls[0]?.[0]).toMatchObject({
			where: { id: "book-a" },
			data: {
				increaseInAssetLife: 24,
				valueAfterDepreciation: 900,
				postingStatus: "PARTIALLY_DEPRECIATED",
			},
		});
		expect(mocked.updateBookMany.mock.calls[1]?.[0]).toMatchObject({
			where: { id: "book-b" },
			data: {
				increaseInAssetLife: 24,
				valueAfterDepreciation: 700,
				postingStatus: "PENDING",
			},
		});
		expect(mocked.createScheduleCalls[0]?.data).toMatchObject({
			assetFinanceBookId: "book-a",
			previousScheduleId: "schedule-book-a",
			revisionNumber: 3,
			bookedDepreciations: 1,
			baseAssetValue: 900,
			openingAccumulatedDepreciation: 200,
			notes: "Capital improvement",
		});
		const firstCreate = mocked.createScheduleCalls.at(0);
		expect(firstCreate).toBeDefined();
		if (!firstCreate) throw new Error("Expected a successor schedule.");
		expect(firstCreate.data.entries?.create).not.toHaveLength(0);
		expect(revisions).toEqual([
			expect.objectContaining({
				assetFinanceBookId: "book-a",
				previousScheduleId: "schedule-book-a",
				carryingValue: 900,
				totalNumberOfDepreciations: 5,
			}),
			expect.objectContaining({
				assetFinanceBookId: "book-b",
				previousScheduleId: "schedule-book-b",
				carryingValue: 700,
				totalNumberOfDepreciations: 5,
			}),
		]);
	});

	it("revises DDB from original life and keeps the stored cadence anchor", async () => {
		const revisionBook = book("book-ddb", "finance-ddb", {
			depreciationMethod: "DOUBLE_DECLINING_BALANCE",
			totalNumberOfDepreciations: 10,
			frequencyOfDepreciation: 12,
			expectedValueAfterUsefulLife: 100,
			valueAfterDepreciation: 800,
			totalNumberOfBookedDepreciations: 2,
			lastPostedDepreciationDate: new Date("2022-01-31T00:00:00.000Z"),
			depreciationStartDate: new Date("2020-01-31T00:00:00.000Z"),
			asset: {
				availableForUseDate: new Date("2020-01-01T00:00:00.000Z"),
				purchaseDate: new Date("2020-01-01T00:00:00.000Z"),
			},
		});
		const mocked = revisionTransaction(
			[revisionBook],
			[
				{
					scheduleDate: new Date("2022-01-31T00:00:00.000Z"),
					accumulatedDepreciationAmount: 200,
				},
			],
		);

		await new AssetDepreciationRevisionService().revise(
			mocked.transaction as unknown as Prisma.TransactionClient,
			ORGANIZATION_ID,
			{
				assetId: "asset-1",
				financeBookId: "finance-ddb",
				effectiveDate: new Date("2022-02-01T00:00:00.000Z"),
				valueDelta: 0,
				usefulLifeDeltaMonths: 0,
			},
		);

		const created = mocked.createScheduleCalls[0]?.data;
		expect(created).toMatchObject({
			startDate: new Date("2020-01-31T00:00:00.000Z"),
			totalNumberOfDepreciations: 10,
			rateOfDepreciation: 20,
			bookedDepreciations: 2,
		});
		expect(created?.entries?.create?.[0]).toMatchObject({
			sequence: 3,
			scheduleDate: new Date("2022-01-31T00:00:00.000Z"),
		});
		expect(created?.entries?.create?.at(-1)).toMatchObject({
			sequence: 11,
			scheduleDate: new Date("2029-12-31T00:00:00.000Z"),
		});
	});

	it("recalculates revised WDV from the current book basis and exact month extension", async () => {
		const revisionBook = book("book-wdv", "finance-wdv", {
			depreciationMethod: "WRITTEN_DOWN_VALUE",
			totalNumberOfDepreciations: 5,
			frequencyOfDepreciation: 12,
			rateOfDepreciation: 50,
			expectedValueAfterUsefulLife: 100,
			valueAfterDepreciation: 1_000,
			totalNumberOfBookedDepreciations: 2,
			lastPostedDepreciationDate: new Date("2022-01-31T00:00:00.000Z"),
			depreciationStartDate: new Date("2020-01-31T00:00:00.000Z"),
			asset: {
				availableForUseDate: new Date("2020-01-01T00:00:00.000Z"),
				purchaseDate: new Date("2020-01-01T00:00:00.000Z"),
			},
		});
		const mocked = revisionTransaction(
			[revisionBook],
			[
				{
					scheduleDate: new Date("2022-01-31T00:00:00.000Z"),
					accumulatedDepreciationAmount: 0,
				},
			],
		);

		await new AssetDepreciationRevisionService().revise(
			mocked.transaction as unknown as Prisma.TransactionClient,
			ORGANIZATION_ID,
			{
				assetId: "asset-1",
				financeBookId: "finance-wdv",
				effectiveDate: new Date("2022-02-01T00:00:00.000Z"),
				valueDelta: 0,
				usefulLifeDeltaMonths: 2,
			},
		);

		const created = mocked.createScheduleCalls[0]?.data;
		const expectedRate = Number(
			(100 * (1 - (100 / 1_000) ** (1 / (((5 - 2) * 12 + 2) / 12)))).toFixed(2),
		);
		expect(created).toMatchObject({
			totalNumberOfDepreciations: 5,
			rateOfDepreciation: expectedRate,
		});
		expect(created?.entries?.create?.at(-1)).toMatchObject({
			sequence: 6,
			scheduleDate: new Date("2025-02-28T00:00:00.000Z"),
		});
	});

	it("rejects an effective date before a posted depreciation without cancelling the active schedule", async () => {
		const mocked = revisionTransaction(
			[book("book-a", "finance-a", { lastPostedDepreciationDate: null })],
			[
				{
					scheduleDate: new Date("2026-03-31T00:00:00.000Z"),
					accumulatedDepreciationAmount: 300,
				},
			],
		);
		const service = new AssetDepreciationRevisionService();

		await expect(
			service.revise(
				mocked.transaction as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				{
					assetId: "asset-1",
					effectiveDate,
					valueDelta: 0,
					usefulLifeDeltaMonths: 0,
				},
			),
		).rejects.toThrow(AssetDepreciationRevisionError);

		expect(mocked.updateMany).not.toHaveBeenCalled();
		expect(mocked.createSchedule).not.toHaveBeenCalled();
	});

	it("rejects a useful-life reduction that leaves no remaining period", async () => {
		const mocked = revisionTransaction(
			[
				book("book-a", "finance-a", {
					totalNumberOfDepreciations: 3,
					totalNumberOfBookedDepreciations: 3,
					depreciationStartDate: new Date("2026-12-31T00:00:00.000Z"),
					asset: {
						availableForUseDate: new Date("2026-01-01T00:00:00.000Z"),
						purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
					},
				}),
			],
			[null],
		);
		const service = new AssetDepreciationRevisionService();

		await expect(
			service.revise(
				mocked.transaction as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				{
					assetId: "asset-1",
					effectiveDate,
					valueDelta: 0,
					usefulLifeDeltaMonths: 0,
				},
			),
		).rejects.toThrow("must leave at least one unbooked period");

		expect(mocked.updateMany).not.toHaveBeenCalled();
	});

	it("rejects a carrying-value reduction below salvage before cancelling the active schedule", async () => {
		const mocked = revisionTransaction(
			[
				book("book-a", "finance-a", {
					valueAfterDepreciation: 150,
					expectedValueAfterUsefulLife: 100,
				}),
			],
			[null],
		);
		const service = new AssetDepreciationRevisionService();

		await expect(
			service.revise(
				mocked.transaction as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				{
					assetId: "asset-1",
					effectiveDate,
					valueDelta: -51,
					usefulLifeDeltaMonths: 0,
				},
			),
		).rejects.toThrow("cannot be below salvage value");

		expect(mocked.updateMany).not.toHaveBeenCalled();
	});

	it("revises only the explicitly selected finance book and adjusts salvage proportionally", async () => {
		const selected = book("book-b", "finance-b", {
			expectedValueAfterUsefulLife: 50,
			valueAfterDepreciation: 600,
		});
		const mocked = revisionTransaction([selected], [null]);
		const service = new AssetDepreciationRevisionService();

		await service.revise(
			mocked.transaction as unknown as Prisma.TransactionClient,
			ORGANIZATION_ID,
			{
				assetId: "asset-1",
				financeBookId: "finance-b",
				effectiveDate,
				valueDelta: -120,
				salvageValueDelta: -10,
				usefulLifeDeltaMonths: 0,
				adjustmentId: "adjustment-1",
			},
		);

		expect(mocked.findMany.mock.calls[0]?.[0]).toMatchObject({
			where: { assetId: "asset-1", financeBookId: "finance-b" },
		});
		expect(mocked.updateBookMany.mock.calls[0]?.[0]).toMatchObject({
			where: { id: "book-b" },
			data: {
				valueAfterDepreciation: 480,
				expectedValueAfterUsefulLife: 40,
			},
		});
		expect(mocked.createScheduleCalls[0]?.data).toMatchObject({
			adjustmentId: "adjustment-1",
			assetFinanceBookId: "book-b",
			expectedValueAfterUsefulLife: 40,
		});
	});

	it("restores only an unposted active successor and its finance-book cursor", async () => {
		const selected = book("book-a", "finance-a");
		const mocked = revisionTransaction([selected], []);
		mocked.findFirstSchedule.mockResolvedValue({
			id: "revision-book-a",
			assetId: "asset-1",
			assetFinanceBookId: "book-a",
			status: "ACTIVE",
			previousScheduleId: "schedule-book-a",
			entries: [],
			nextSchedules: [],
			previousSchedule: {
				id: "schedule-book-a",
				status: "CANCELLED",
				startDate: new Date("2025-01-01T00:00:00.000Z"),
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 5,
				frequencyOfDepreciation: 12,
				dailyProrataBased: false,
				shiftBased: false,
				rateOfDepreciation: null,
				expectedValueAfterUsefulLife: 100,
				bookedDepreciations: 1,
				remainingDepreciations: 4,
				baseAssetValue: 800,
			},
		});
		const service = new AssetDepreciationRevisionService();

		await service.restoreRevision(
			mocked.transaction as unknown as Prisma.TransactionClient,
			ORGANIZATION_ID,
			{
				assetId: "asset-1",
				financeBookId: "finance-a",
				scheduleId: "revision-book-a",
				previousValueAfterDepreciation: 725,
			},
		);

		expect(mocked.updateMany.mock.calls).toHaveLength(2);
		expect(mocked.updateMany.mock.calls[0]?.[0]).toMatchObject({
			where: { id: "revision-book-a" },
			data: { status: "CANCELLED" },
		});
		expect(mocked.updateMany.mock.calls[1]?.[0]).toMatchObject({
			where: { id: "schedule-book-a" },
			data: { status: "ACTIVE" },
		});
		expect(mocked.updateBookMany.mock.calls[0]?.[0]).toMatchObject({
			where: { id: "book-a" },
			data: {
				valueAfterDepreciation: 725,
				expectedValueAfterUsefulLife: 100,
				postingStatus: "PARTIALLY_DEPRECIATED",
			},
		});
		expect(mocked.countEntries.mock.calls[0]?.[0]).toMatchObject({
			where: { scheduleId: "schedule-book-a", postingId: null },
		});
	});

	it("closes active schedules under the same per-book advisory locks without deleting history", async () => {
		const firstBook = book("book-a", "finance-a");
		const secondBook = book("book-b", "finance-b");
		const mocked = revisionTransaction([firstBook, secondBook], []);
		mocked.updateMany
			.mockResolvedValueOnce({ count: 1 })
			.mockResolvedValueOnce({ count: 2 });
		const service = new AssetDepreciationRevisionService();

		await expect(
			service.closeOpenSchedules(
				mocked.transaction as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				"asset-1",
			),
		).resolves.toBe(3);

		expect(mocked.lock).toHaveBeenCalledTimes(4);
		expect(mocked.updateMany.mock.calls[0]?.[0]).toMatchObject({
			where: { assetFinanceBookId: "book-a", status: "ACTIVE" },
			data: { status: "CANCELLED" },
		});
		expect(mocked.updateMany.mock.calls[1]?.[0]).toMatchObject({
			where: { assetFinanceBookId: "book-b", status: "ACTIVE" },
			data: { status: "CANCELLED" },
		});
	});

	it("reactivates the latest closed schedule when no active or newer successor exists", async () => {
		const mocked = revisionTransaction(
			[book("book-a", "finance-a", { schedules: [] })],
			[],
		);
		mocked.findFirstSchedule
			.mockResolvedValueOnce({ id: "schedule-book-a", revisionNumber: 3 })
			.mockResolvedValueOnce(null);
		const service = new AssetDepreciationRevisionService();

		await expect(
			service.reactivateLatestClosedSchedules(
				mocked.transaction as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				"asset-1",
			),
		).resolves.toBe(1);

		expect(mocked.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "schedule-book-a", asset: expect.anything() },
				data: { status: "ACTIVE" },
			}),
		);
	});
});
