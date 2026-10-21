import { describe, expect, it, mock } from "bun:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../shared/prisma.service";
import {
	createCancellationPrisma,
	createPostedDepreciationState,
	snapshotState,
} from "./__tests__/cancellation-fixture";
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
		const firstBookCall = (
			updateBook.mock.calls as unknown as Array<
				[{ data: Record<string, unknown> }]
			>
		)[0];
		expect(Number(firstBookCall[0].data.rateOfDepreciation)).toBe(100);
		expect(updateSchedule).toHaveBeenCalledTimes(1);
		const firstScheduleCall = (
			updateSchedule.mock.calls as unknown as Array<
				[{ data: Record<string, unknown> }]
			>
		)[0];
		const scheduleData = firstScheduleCall[0].data;
		expect(scheduleData.revisionNumber).toBe(3);
		expect(scheduleData.rateOfDepreciation).toBe(100);
		expect(
			(scheduleData.entries as Record<string, unknown>).create,
		).toHaveLength(1);
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

	describe("cancelAsset", () => {
		const build = (
			overrides: Parameters<typeof createPostedDepreciationState>[0] = {},
		) => {
			const state = createPostedDepreciationState(overrides);
			const service = new AssetDepreciationLifecycleService(
				createCancellationPrisma(state),
			);
			return { state, service };
		};

		it("reverses posted entries on two finance books and cancels the asset", async () => {
			const { state, service } = build();

			await service.cancelAsset("asset-1");

			expect(state.entries.map((entry) => entry.status)).toEqual([
				"REVERSED",
				"REVERSED",
				"REVERSED",
			]);
			for (const entry of state.entries) {
				expect(entry.reversedAt).toBeInstanceOf(Date);
			}
			for (const book of state.books) {
				expect(book.valueAfterDepreciation.toString()).toBe("100000");
				expect(book.totalNumberOfBookedDepreciations).toBe(0);
				expect(book.postingStatus).toBe("PENDING");
				expect(book.lastPostedDepreciationDate).toBeNull();
			}
			expect(state.asset.valueAfterDepreciation.toString()).toBe("100000");
			expect(state.asset.isFullyDepreciated).toBe(false);
			expect(state.asset.status).toBe("CANCELLED");
			expect(state.schedules.map((row) => row.status)).toEqual([
				"CANCELLED",
				"CANCELLED",
			]);
			expect(state.activities.map((row) => row.activity)).toEqual([
				"Depreciation DEP-2026-00001 reversed for 2026-01-31 in Statutory.",
				"Depreciation DEP-2026-00003 reversed for 2026-01-31 in Tax.",
				"Depreciation DEP-2026-00002 reversed for 2026-02-28 in Statutory.",
				"Asset cancelled",
			]);
		});

		it("takes the posting worker's advisory lock for every finance book", async () => {
			const { state, service } = build();

			await service.cancelAsset("asset-1");

			expect(state.locks).toEqual(["book-1", "book-2"]);
		});

		it("restores the opening value of a depreciable asset with opening depreciation", async () => {
			const { state, service } = build();
			state.asset.openingAccumulatedDepreciation = new Prisma.Decimal(25_000);
			for (const book of state.books) {
				book.openingAccumulatedDepreciation =
					state.asset.openingAccumulatedDepreciation;
				book.openingNumberOfBookedDepreciations = 2;
			}

			await service.cancelAsset("asset-1");

			expect(state.asset.valueAfterDepreciation.toString()).toBe("75000");
			expect(state.books[0]?.valueAfterDepreciation.toString()).toBe("75000");
			expect(state.books[0]?.totalNumberOfBookedDepreciations).toBe(2);
		});

		it("blocks the whole cancellation when any entry is in a frozen period", async () => {
			const { state, service } = build();
			state.companies[0] = {
				name: "ACME",
				accountsFrozenThrough: new Date("2026-01-31T00:00:00.000Z"),
			};
			const before = snapshotState(state);

			const error = await service.cancelAsset("asset-1").catch((e) => e);

			expect(error).toBeInstanceOf(BadRequestException);
			expect((error as Error).message).toBe(
				"Accounting is frozen through 2026-01-31 for ACME. Depreciation posted on or before that date cannot be reversed, so asset AST-2026-00001 cannot be cancelled.",
			);
			expect(snapshotState(state)).toBe(before);
		});

		for (const status of [
			"DRAFT",
			"CANCELLED",
			"SCRAPPED",
			"SOLD",
			"IN_MAINTENANCE",
			"OUT_OF_ORDER",
		]) {
			it(`rejects an asset in status ${status}`, async () => {
				const { state, service } = build({ status });
				const before = snapshotState(state);

				const error = await service.cancelAsset("asset-1").catch((e) => e);

				expect(error).toBeInstanceOf(BadRequestException);
				expect((error as Error).message).toBe(
					status === "IN_MAINTENANCE" || status === "OUT_OF_ORDER"
						? "There are active maintenance or repairs against the asset. You must complete all of them before cancelling the asset."
						: `Asset cannot be cancelled, as it is already ${status
								.split("_")
								.map((w) => w.charAt(0) + w.slice(1).toLowerCase())
								.join(" ")}`,
				);
				expect(snapshotState(state)).toBe(before);
			});
		}

		for (const status of [
			"SUBMITTED",
			"PARTIALLY_DEPRECIATED",
			"FULLY_DEPRECIATED",
		]) {
			it(`allows an asset in status ${status}`, async () => {
				const { state, service } = build({ status });

				await service.cancelAsset("asset-1");

				expect(state.asset.status).toBe("CANCELLED");
			});
		}

		it("is blocked by a submitted value adjustment", async () => {
			const { state, service } = build();
			state.adjustments.push({ assetId: "asset-1", status: "SUBMITTED" });
			const before = snapshotState(state);

			await expect(service.cancelAsset("asset-1")).rejects.toThrow(
				"Cancel the submitted asset value adjustments first",
			);
			expect(snapshotState(state)).toBe(before);
		});

		it("ignores value adjustments that are not submitted", async () => {
			const { state, service } = build();
			state.adjustments.push(
				{ assetId: "asset-1", status: "CANCELLED" },
				{ assetId: "asset-1", status: "DRAFT" },
			);

			await service.cancelAsset("asset-1");

			expect(state.asset.status).toBe("CANCELLED");
		});

		it("throws NotFoundException for an unknown asset", async () => {
			const { service } = build();

			await expect(service.cancelAsset("missing")).rejects.toBeInstanceOf(
				NotFoundException,
			);
		});

		it("cancels an asset without posted entries like before", async () => {
			const { state, service } = build({ status: "SUBMITTED" });
			state.entries.length = 0;
			const before = JSON.stringify(state.books);

			await service.cancelAsset("asset-1");

			expect(state.asset.status).toBe("CANCELLED");
			expect(state.asset.valueAfterDepreciation.toString()).toBe("80000");
			expect(JSON.stringify(state.books)).toBe(before);
			expect(state.schedules.every((row) => row.status === "CANCELLED")).toBe(
				true,
			);
			expect(state.activities).toEqual([
				{ assetId: "asset-1", activity: "Asset cancelled" },
			]);
		});

		it("ignores entries that are already reversed", async () => {
			const { state, service } = build();
			for (const entry of state.entries) entry.status = "REVERSED";

			await service.cancelAsset("asset-1");

			expect(state.activities).toEqual([
				{ assetId: "asset-1", activity: "Asset cancelled" },
			]);
		});
	});
});
