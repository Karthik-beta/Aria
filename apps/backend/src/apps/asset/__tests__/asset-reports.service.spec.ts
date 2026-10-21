import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	setSystemTime,
} from "bun:test";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetReportsService } from "../asset-reports.service";
import type { DepreciationBarrierService } from "../depreciation/depreciation-barrier.service";

const TODAY_ISO = "2026-07-05T10:00:00.000Z";

function createMocks() {
	const prisma = {
		asset: {
			findMany: mock((_args?: unknown) => Promise.resolve([] as unknown[])),
		},
		assetActivity: {
			findMany: mock((_args?: unknown) => Promise.resolve([] as unknown[])),
		},
	};
	const barrier = {
		ensureDepreciationPosted: mock((_scope?: unknown) => Promise.resolve({})),
	};
	const service = new AssetReportsService(
		prisma as unknown as PrismaService,
		barrier as unknown as DepreciationBarrierService,
	);
	const serviceWithoutBarrier = new AssetReportsService(
		prisma as unknown as PrismaService,
	);
	return { prisma, barrier, service, serviceWithoutBarrier };
}

type Mocks = ReturnType<typeof createMocks>;

function endOfDay(value: Date | string) {
	const date = new Date(value);
	date.setHours(23, 59, 59, 999);
	return date;
}

function startOfDay(value: Date | string) {
	const date = new Date(value);
	date.setHours(0, 0, 0, 0);
	return date;
}

function whereOf(fn: { mock: { calls: unknown[][] } }) {
	return (fn.mock.calls[0][0] as { where: Record<string, unknown> }).where;
}

const insensitive = (value: string) => ({
	contains: value,
	mode: "insensitive",
});

const scheduleEntry = (
	id: string,
	sequence: number,
	date: string,
	amount: string,
	accumulated: string,
	bookValue: string,
) => ({
	id,
	sequence,
	scheduleDate: new Date(`${date}T00:00:00.000Z`),
	depreciationAmount: amount,
	accumulatedDepreciationAmount: accumulated,
	bookValueAfterDepreciation: bookValue,
});

describe("AssetReportsService", () => {
	let mocks: Mocks;
	let savedTimeZone: string | undefined;

	beforeEach(() => {
		mocks = createMocks();
		savedTimeZone = process.env.APP_TIME_ZONE;
		process.env.APP_TIME_ZONE = "UTC";
		setSystemTime(new Date(TODAY_ISO));
	});

	afterEach(() => {
		setSystemTime();
		if (savedTimeZone === undefined) delete process.env.APP_TIME_ZONE;
		else process.env.APP_TIME_ZONE = savedTimeZone;
	});

	describe("findAssetActivityReport", () => {
		it("filters only by date range when no other filter is given", async () => {
			const input = {
				fromDate: new Date("2026-04-01T12:00:00.000Z"),
				toDate: new Date("2026-04-30T12:00:00.000Z"),
			};
			const result = await mocks.service.findAssetActivityReport(input);

			expect(whereOf(mocks.prisma.assetActivity.findMany)).toEqual({
				createdAt: {
					gte: startOfDay(input.fromDate),
					lte: endOfDay(input.toDate),
				},
			});
			expect(result.rows).toEqual([]);
			expect(result.summary.rowCount).toBe(0);
		});

		it("adds only the asset-side filters that are supplied", async () => {
			await mocks.service.findAssetActivityReport({
				fromDate: new Date("2026-04-01T12:00:00.000Z"),
				toDate: new Date("2026-04-30T12:00:00.000Z"),
				company: "ACME",
			});
			const where = whereOf(mocks.prisma.assetActivity.findMany);
			expect(where.asset).toEqual({ is: { company: insensitive("ACME") } });
			expect(where).not.toHaveProperty("activity");
		});

		it("does not call the depreciation barrier", async () => {
			await mocks.service.findAssetActivityReport({
				fromDate: new Date("2026-04-01T12:00:00.000Z"),
				toDate: new Date("2026-04-30T12:00:00.000Z"),
			});
			expect(mocks.barrier.ensureDepreciationPosted).not.toHaveBeenCalled();
		});
	});

	describe("findAssetDepreciationLedger", () => {
		const range = {
			fromDate: new Date("2026-01-01T12:00:00.000Z"),
			toDate: new Date("2026-03-15T12:00:00.000Z"),
		};

		it("queries all assets with no filters and empty rows give the empty shape", async () => {
			const result = await mocks.service.findAssetDepreciationLedger(range);
			expect(whereOf(mocks.prisma.asset.findMany)).toEqual({});
			expect(result).toEqual({
				rows: [],
				summary: {
					matchedAssetCount: 0,
					assetsWithLedgerCount: 0,
					assetsWithoutLedgerCount: 0,
					rowCount: 0,
					totalDepreciationAmount: 0,
					closingValueTotal: 0,
				},
			});
		});

		it("composes company, asset, category and cost center filters", async () => {
			await mocks.service.findAssetDepreciationLedger({
				...range,
				company: "ACME",
				asset: "Pump",
				assetCategory: "Mach",
				costCenter: "Plant",
			});
			const call = mocks.prisma.asset.findMany.mock.calls[0][0] as {
				where: Record<string, unknown>;
				select: { valueAdjustments: { where: Record<string, unknown> } };
			};
			const toDate = endOfDay(range.toDate);
			expect(call.where).toEqual({
				company: insensitive("ACME"),
				OR: [
					{ series: insensitive("Pump") },
					{ assetName: insensitive("Pump") },
				],
				assetCategory: { is: { name: insensitive("Mach") } },
				valueAdjustments: {
					some: {
						status: "SUBMITTED",
						adjustmentDate: { lte: toDate },
						costCenter: insensitive("Plant"),
					},
				},
			});
			expect(call.select.valueAdjustments.where).toEqual({
				status: "SUBMITTED",
				adjustmentDate: { lte: toDate },
				costCenter: insensitive("Plant"),
			});
		});

		it("omits the cost center clause from the nested adjustment filter when unset", async () => {
			await mocks.service.findAssetDepreciationLedger({
				...range,
				company: "A",
			});
			const call = mocks.prisma.asset.findMany.mock.calls[0][0] as {
				where: Record<string, unknown>;
				select: { valueAdjustments: { where: Record<string, unknown> } };
			};
			expect(call.where).toEqual({ company: insensitive("A") });
			expect(call.select.valueAdjustments.where).toEqual({
				status: "SUBMITTED",
				adjustmentDate: { lte: endOfDay(range.toDate) },
			});
		});

		it("asks the barrier for min(toDate, today) with the company", async () => {
			// Past end date: the (end-of-day) toDate wins.
			await mocks.service.findAssetDepreciationLedger({
				...range,
				company: "ACME",
			});
			expect(mocks.barrier.ensureDepreciationPosted).toHaveBeenLastCalledWith({
				throughDate: endOfDay(range.toDate),
				company: "ACME",
			});

			// Future end date: today (date-only UTC) wins; no company means no key.
			await mocks.service.findAssetDepreciationLedger({
				fromDate: range.fromDate,
				toDate: new Date("2099-01-01T12:00:00.000Z"),
			});
			expect(mocks.barrier.ensureDepreciationPosted).toHaveBeenLastCalledWith({
				throughDate: new Date("2026-07-05T00:00:00.000Z"),
			});
		});

		it("runs without a barrier", async () => {
			const result =
				await mocks.serviceWithoutBarrier.findAssetDepreciationLedger(range);
			expect(result.rows).toEqual([]);
		});

		it("passes loaded rows through the builder", async () => {
			const assetRow = (
				id: string,
				series: string,
				category: { id: string; name: string },
				purchase: string,
				entries: ReturnType<typeof scheduleEntry>[],
			) => ({
				id,
				series,
				assetName: `${series} name`,
				company: "ACME",
				purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
				netPurchaseAmount: purchase,
				status: "PARTIALLY_DEPRECIATED",
				assetCategory: category,
				valueAdjustments: [],
				depreciationSchedules: [
					{
						id: `sched-${id}`,
						revisionNumber: 1,
						startDate: new Date("2026-01-01T00:00:00.000Z"),
						depreciationMethod: "STRAIGHT_LINE",
						openingAccumulatedDepreciation: "0",
						adjustment: null,
						entries,
					},
				],
			});
			mocks.prisma.asset.findMany.mockResolvedValueOnce([
				assetRow("a1", "AST-1", { id: "cat-1", name: "Machinery" }, "10000", [
					scheduleEntry("e1", 1, "2026-01-31", "1000", "1000", "9000"),
					scheduleEntry("e2", 2, "2026-02-28", "1000", "2000", "8000"),
				]),
				assetRow("a2", "AST-2", { id: "cat-2", name: "Vehicles" }, "5000", [
					scheduleEntry("e3", 1, "2026-02-28", "500", "500", "4500"),
				]),
			]);

			const result = await mocks.service.findAssetDepreciationLedger(range);

			// Rows sort by date desc, then series asc:
			//   2026-02-28 AST-1 (dep 1000, acc 2000, value 8000, opening 1000)
			//   2026-02-28 AST-2 (dep 500, acc 500, value 4500, opening 0)
			//   2026-01-31 AST-1 (dep 1000, acc 1000, value 9000, opening 0)
			expect(
				result.rows.map((row) => [
					row.assetSeries,
					row.depreciationDate.toISOString().slice(0, 10),
					row.openingAccumulatedDepreciation,
					row.depreciationAmount,
					row.valueAfterDepreciation,
				]),
			).toEqual([
				["AST-1", "2026-02-28", 1000, 1000, 8000],
				["AST-2", "2026-02-28", 0, 500, 4500],
				["AST-1", "2026-01-31", 0, 1000, 9000],
			]);
			expect(result.rows[0]).toMatchObject({
				assetCategoryName: "Machinery",
				purchaseAmount: 10000,
				adjustmentSeries: "DEP-SCHEDULE-1",
				costCenter: null,
			});
			// Total depreciation = 1000 + 1000 + 500 = 2500.
			// Closing value = latest row per asset = 8000 + 4500 = 12500.
			expect(result.summary).toEqual({
				matchedAssetCount: 2,
				assetsWithLedgerCount: 2,
				assetsWithoutLedgerCount: 0,
				rowCount: 3,
				totalDepreciationAmount: 2500,
				closingValueTotal: 12500,
			});
		});
	});

	describe("findAssetDepreciationsAndBalances", () => {
		const range = {
			fromDate: new Date("2026-02-01T12:00:00.000Z"),
			toDate: new Date("2026-03-31T12:00:00.000Z"),
			groupBy: "ASSET_CATEGORY" as const,
		};

		it("limits to assets purchased by toDate when no filter is given", async () => {
			await mocks.service.findAssetDepreciationsAndBalances(range);
			expect(whereOf(mocks.prisma.asset.findMany)).toEqual({
				purchaseDate: { lte: endOfDay(range.toDate) },
			});
		});

		it("composes company, asset and category filters and ignores unknown ones", async () => {
			await mocks.service.findAssetDepreciationsAndBalances({
				...range,
				company: "ACME",
				asset: "Pump",
				assetCategory: "Mach",
				costCenter: "Plant",
			} as never);
			expect(whereOf(mocks.prisma.asset.findMany)).toEqual({
				purchaseDate: { lte: endOfDay(range.toDate) },
				company: insensitive("ACME"),
				OR: [
					{ series: insensitive("Pump") },
					{ assetName: insensitive("Pump") },
				],
				assetCategory: { is: { name: insensitive("Mach") } },
			});
		});

		it("filters nested adjustments to submitted ones up to toDate", async () => {
			await mocks.service.findAssetDepreciationsAndBalances(range);
			const call = mocks.prisma.asset.findMany.mock.calls[0][0] as {
				select: { valueAdjustments: { where: unknown } };
			};
			expect(call.select.valueAdjustments.where).toEqual({
				status: "SUBMITTED",
				adjustmentDate: { lte: endOfDay(range.toDate) },
			});
		});

		it("asks the barrier for min(toDate, today) with the company", async () => {
			await mocks.service.findAssetDepreciationsAndBalances({
				...range,
				company: "ACME",
			});
			expect(mocks.barrier.ensureDepreciationPosted).toHaveBeenLastCalledWith({
				throughDate: endOfDay(range.toDate),
				company: "ACME",
			});

			await mocks.service.findAssetDepreciationsAndBalances({
				...range,
				toDate: new Date("2099-01-01T12:00:00.000Z"),
			});
			expect(mocks.barrier.ensureDepreciationPosted).toHaveBeenLastCalledWith({
				throughDate: new Date("2026-07-05T00:00:00.000Z"),
			});
		});

		it("runs without a barrier", async () => {
			const result =
				await mocks.serviceWithoutBarrier.findAssetDepreciationsAndBalances(
					range,
				);
			expect(result.rows).toEqual([]);
		});

		it("returns the empty builder shape for no assets", async () => {
			const result =
				await mocks.service.findAssetDepreciationsAndBalances(range);
			expect(result).toEqual({
				rows: [],
				summary: {
					matchedAssetCount: 0,
					rowCount: 0,
					totalValueAsOnFromDate: 0,
					totalValueAsOnToDate: 0,
					totalNetAssetValueAsOnFromDate: 0,
					totalNetAssetValueAsOnToDate: 0,
					totalDepreciationAmountDuringPeriod: 0,
					totalValueAdjustmentDuringPeriod: 0,
				},
			});
		});

		it("passes loaded rows through the builder grouped by category", async () => {
			const category1 = { id: "cat-1", name: "Machinery" };
			const category2 = { id: "cat-2", name: "Vehicles" };
			const base = {
				company: "ACME",
				disposalDate: null,
				openingAccumulatedDepreciation: "0",
				status: "PARTIALLY_DEPRECIATED",
			};
			mocks.prisma.asset.findMany.mockResolvedValueOnce([
				{
					...base,
					id: "a1",
					series: "AST-1",
					assetName: "Pump",
					purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
					netPurchaseAmount: "10000",
					assetCategory: category1,
					valueAdjustments: [],
					depreciationSchedules: [
						{
							id: "s1",
							revisionNumber: 1,
							startDate: new Date("2026-01-01T00:00:00.000Z"),
							openingAccumulatedDepreciation: "0",
							entries: [
								scheduleEntry("e1", 1, "2026-01-31", "1000", "1000", "9000"),
								scheduleEntry("e2", 2, "2026-02-28", "1000", "2000", "8000"),
								scheduleEntry("e3", 3, "2026-03-31", "1000", "3000", "7000"),
							],
						},
					],
				},
				{
					...base,
					id: "a2",
					series: "AST-2",
					assetName: "Van",
					purchaseDate: new Date("2026-02-15T00:00:00.000Z"),
					netPurchaseAmount: "5000",
					assetCategory: category2,
					valueAdjustments: [
						{
							id: "adj-1",
							adjustmentDate: new Date("2026-03-01T00:00:00.000Z"),
							differenceAmount: "200",
							depreciationSchedule: null,
						},
					],
					depreciationSchedules: [
						{
							id: "s2",
							revisionNumber: 1,
							startDate: new Date("2026-02-15T00:00:00.000Z"),
							openingAccumulatedDepreciation: "0",
							entries: [
								scheduleEntry("e4", 1, "2026-02-28", "500", "500", "4500"),
								scheduleEntry("e5", 2, "2026-03-31", "500", "1000", "4000"),
							],
						},
					],
				},
			]);

			const result =
				await mocks.service.findAssetDepreciationsAndBalances(range);

			// Machinery (AST-1, bought before the range, 10000):
			//   value from 10000, to 10000 (no purchase, no adjustment)
			//   accumulated at 2026-01-31 (day before range) = 1000
			//   depreciation in range = 1000 (Feb) + 1000 (Mar) = 2000
			//   accumulated to = 1000 + 2000 = 3000
			//   net from = 10000 - 1000 = 9000, net to = 10000 - 3000 = 7000
			// Vehicles (AST-2, bought 2026-02-15 for 5000, +200 adjustment on 03-01):
			//   value from 0, new purchase 5000, adjustment 200, to = 5200
			//   depreciation in range = 500 + 500 = 1000, accumulated to = 1000
			//   net from = 0, net to = 5200 - 1000 = 4200
			expect(result.rows.map((row) => row.groupingLabel)).toEqual([
				"Machinery",
				"Vehicles",
			]);
			expect(result.rows[0]).toMatchObject({
				assetCount: 1,
				valueAsOnFromDate: 10000,
				valueOfNewPurchase: 0,
				valueAsOnToDate: 10000,
				accumulatedDepreciationAsOnFromDate: 1000,
				depreciationAmountDuringPeriod: 2000,
				accumulatedDepreciationAsOnToDate: 3000,
				netAssetValueAsOnFromDate: 9000,
				netAssetValueAsOnToDate: 7000,
			});
			expect(result.rows[1]).toMatchObject({
				assetCount: 1,
				valueAsOnFromDate: 0,
				valueOfNewPurchase: 5000,
				valueAdjustmentDuringPeriod: 200,
				valueAsOnToDate: 5200,
				depreciationAmountDuringPeriod: 1000,
				accumulatedDepreciationAsOnToDate: 1000,
				netAssetValueAsOnFromDate: 0,
				netAssetValueAsOnToDate: 4200,
			});
			// Totals: value to 10000 + 5200 = 15200; net to 7000 + 4200 = 11200.
			expect(result.summary).toEqual({
				matchedAssetCount: 2,
				rowCount: 2,
				totalValueAsOnFromDate: 10000,
				totalValueAsOnToDate: 15200,
				totalNetAssetValueAsOnFromDate: 9000,
				totalNetAssetValueAsOnToDate: 11200,
				totalDepreciationAmountDuringPeriod: 3000,
				totalValueAdjustmentDuringPeriod: 200,
			});
		});
	});
});
