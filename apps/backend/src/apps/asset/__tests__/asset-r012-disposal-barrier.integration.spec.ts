import type { Prisma } from "../../../generated/prisma/client";
import { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { AssetAccountingService } from "../asset-accounting.service";
import { AssetDashboardSubService } from "../asset-dashboard.service";
import { AssetStockPostingService } from "../asset-stock-posting.service";
import { AssetDepreciationLifecycleService } from "../depreciation/asset-depreciation-lifecycle.service";
import { AssetDepreciationRevisionService } from "../depreciation/asset-depreciation-revision.service";
import {
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
	normalizeDateOnly,
} from "../depreciation/depreciation.config";
import type {
	DepreciationJobData,
	DepreciationScope,
	EnsureDepreciationPostedResult,
} from "../depreciation/depreciation.types";
import type { DepreciationBarrierService } from "../depreciation/depreciation-barrier.service";
import {
	DepreciationPersistenceService,
	type PostDepreciationResult,
} from "../depreciation/depreciation-persistence.service";

type BarrierStub = {
	ensureDepreciationPosted(
		scope: DepreciationScope,
	): Promise<EnsureDepreciationPostedResult>;
	postDisposalBarrier(
		tx: Prisma.TransactionClient,
		job: DepreciationJobData,
	): Promise<PostDepreciationResult>;
};

type DisposalFixture = {
	assetId: string;
	rootAssetFinanceBookId: string;
	secondaryAssetFinanceBookId: string;
	rootScheduleId: string;
	secondaryScheduleId: string;
};

const utcDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

/**
 * Exercises the disposal barrier against real Prisma rows and the production
 * worker persistence path. The barrier stub only supplies the queue boundary;
 * all schedule, journal, finance-book, and Asset mutations remain production
 * code inside PostgreSQL transactions.
 */
describe("R-012 disposal barrier integration", () => {
	let prisma: PrismaService;
	let service: AssetService;
	let worker: DepreciationPersistenceService;
	let organizationId: string;
	let companyId: string;
	let categoryId: string;
	let rootFinanceBookId: string;
	let secondaryFinanceBookId: string;
	let rootFinanceBookName: string;
	let secondaryFinanceBookName: string;
	let suffix: string;
	const originalTimeZone = process.env.APP_TIME_ZONE;

	const createSchedule = async (
		assetId: string,
		assetFinanceBookId: string,
		startDate: string,
		scheduleDates: readonly string[],
	): Promise<string> => {
		const schedule = await prisma.client.assetDepreciationSchedule.create({
			data: {
				assetId,
				assetFinanceBookId,
				revisionNumber: 1,
				status: "ACTIVE",
				startDate: utcDate(startDate),
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: scheduleDates.length,
				frequencyOfDepreciation: 1,
				dailyProrataBased: false,
				shiftBased: false,
				precision: 2,
				ratePrecision: 2,
				calculateUsingTotalDays: false,
				expectedValueAfterUsefulLife: 0,
				bookedDepreciations: 0,
				remainingDepreciations: scheduleDates.length,
				openingAccumulatedDepreciation: 0,
				baseAssetValue: 100,
				entries: {
					create: scheduleDates.map((scheduleDate, index) => ({
						sequence: index + 1,
						scheduleDate: utcDate(scheduleDate),
						depreciationAmount: 10,
						accumulatedDepreciationAmount: 10 * (index + 1),
						bookValueAfterDepreciation: 100 - 10 * (index + 1),
					})),
				},
			},
		});
		return schedule.id;
	};

	const createFixture = async (
		label: string,
		startDate = "2026-07-01",
		scheduleDates: readonly string[] = [
			"2026-07-01",
			"2026-08-01",
			"2026-09-01",
		],
	): Promise<DisposalFixture> => {
		const asset = await prisma.client.asset.create({
			data: {
				series: `R012-${label}-${suffix}`,
				assetName: `R-012 ${label}`,
				itemCode: `R012-${label}-${suffix}`,
				assetCategoryId: categoryId,
				companyId,
				purchaseDate: utcDate(startDate),
				availableForUseDate: utcDate(startDate),
				netPurchaseAmount: 100,
				calculateDepreciation: true,
				valueAfterDepreciation: 100,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: scheduleDates.length,
				frequencyOfDepreciation: 1,
				depreciationStartDate: utcDate(startDate),
				status: "PARTIALLY_DEPRECIATED",
			},
		});
		const [rootBook, secondaryBook] = await Promise.all([
			prisma.client.assetFinanceBook.create({
				data: {
					assetId: asset.id,
					financeBookId: rootFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: scheduleDates.length,
					frequencyOfDepreciation: 1,
					depreciationStartDate: utcDate(startDate),
					precision: 2,
					ratePrecision: 2,
					calculateUsingTotalDays: false,
					openingAccumulatedDepreciation: 0,
					valueAfterDepreciation: 100,
					postingStatus: "PARTIALLY_DEPRECIATED",
				},
			}),
			prisma.client.assetFinanceBook.create({
				data: {
					assetId: asset.id,
					financeBookId: secondaryFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: scheduleDates.length,
					frequencyOfDepreciation: 1,
					depreciationStartDate: utcDate(startDate),
					precision: 2,
					ratePrecision: 2,
					calculateUsingTotalDays: false,
					openingAccumulatedDepreciation: 0,
					valueAfterDepreciation: 100,
					postingStatus: "PARTIALLY_DEPRECIATED",
				},
			}),
		]);
		const [rootScheduleId, secondaryScheduleId] = await Promise.all([
			createSchedule(asset.id, rootBook.id, startDate, scheduleDates),
			createSchedule(asset.id, secondaryBook.id, startDate, scheduleDates),
		]);
		return {
			assetId: asset.id,
			rootAssetFinanceBookId: rootBook.id,
			secondaryAssetFinanceBookId: secondaryBook.id,
			rootScheduleId,
			secondaryScheduleId,
		};
	};

	const sellMidPeriod = (fixture: DisposalFixture) =>
		service.sellAsset(
			{
				assetId: fixture.assetId,
				financeBookId: secondaryFinanceBookId,
				disposalDate: "2026-07-10",
				salesAmount: 87.1,
				proceedsAccount: `R012 Bank ${suffix}`,
				gainLossAccount: `R012 Gain ${suffix}`,
			},
			organizationId,
		);

	const barrierJob = (
		fixture: DisposalFixture,
		disposalId: string,
		scheduleEntryId: string,
	): DepreciationJobData => ({
		version: 1,
		organizationId,
		sourceDisposalId: disposalId,
		assetId: fixture.assetId,
		assetFinanceBookId: fixture.secondaryAssetFinanceBookId,
		scheduleId: fixture.secondaryScheduleId,
		scheduleEntryId,
		depreciationDate: "2026-07-10",
	});

	beforeAll(async () => {
		process.env.APP_TIME_ZONE = "UTC";
		prisma = new PrismaService();
		await prisma.onModuleInit();
		suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const organization = await prisma.organization.create({
			data: {
				name: `R-012 Organization ${suffix}`,
				slug: `r012-${suffix}`,
			},
		});
		organizationId = organization.id;
		const [rootBook, secondaryBook] = await Promise.all([
			prisma.financeBook.create({ data: { name: `R012 Root ${suffix}` } }),
			prisma.financeBook.create({
				data: { name: `R012 Secondary ${suffix}` },
			}),
		]);
		rootFinanceBookId = rootBook.id;
		secondaryFinanceBookId = secondaryBook.id;
		rootFinanceBookName = rootBook.name;
		secondaryFinanceBookName = secondaryBook.name;
		const company = await prisma.company.create({
			data: {
				organizationId,
				name: `R012 Company ${suffix}`,
				defaultFinanceBookId: rootFinanceBookId,
				defaultCostCenter: `R012 Cost Center ${suffix}`,
				accumulatedDepreciationAccount: `R012 Accumulated ${suffix}`,
				depreciationExpenseAccount: `R012 Depreciation ${suffix}`,
			},
		});
		companyId = company.id;
		const category = await prisma.assetCategory.create({
			data: {
				name: `R012 Category ${suffix}`,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 1,
				expectedValueAfterUsefulLife: 0,
			},
		});
		categoryId = category.id;
		await prisma.assetCategoryAccount.create({
			data: {
				assetCategoryId: categoryId,
				companyId,
				fixedAssetAccount: `R012 Fixed Asset ${suffix}`,
				accumulatedDepreciationAccount: `R012 Accumulated ${suffix}`,
				depreciationExpenseAccount: `R012 Depreciation ${suffix}`,
			},
		});

		worker = new DepreciationPersistenceService(prisma);
		const barrier: BarrierStub = {
			ensureDepreciationPosted: async (scope) => {
				const scopeOrganizationId =
					scope.kind === "organization" ? scope.organizationId : organizationId;
				const throughDate =
					typeof scope.throughDate === "string"
						? normalizeDateOnly(scope.throughDate)
						: dateOnlyFromPersistedDateTime(scope.throughDate);
				const entries =
					await prisma.client.assetDepreciationScheduleEntry.findMany({
						where: {
							postingId: null,
							scheduleDate: { lte: dateOnlyUtc(throughDate) },
							schedule: {
								status: "ACTIVE",
								...(scope.assetIds?.length
									? { assetId: { in: [...scope.assetIds] } }
									: {}),
								...(scope.financeBookId
									? {
											assetFinanceBook: {
												financeBookId: scope.financeBookId,
											},
										}
									: {}),
								asset: { company: { organizationId: scopeOrganizationId } },
							},
						},
						select: {
							id: true,
							scheduleId: true,
							scheduleDate: true,
							schedule: {
								select: { assetId: true, assetFinanceBookId: true },
							},
						},
						orderBy: [{ scheduleDate: "asc" }, { id: "asc" }],
					});
				for (const entry of entries) {
					await worker.post({
						version: 1,
						organizationId: scopeOrganizationId,
						assetId: entry.schedule.assetId,
						assetFinanceBookId: entry.schedule.assetFinanceBookId,
						scheduleId: entry.scheduleId,
						scheduleEntryId: entry.id,
						depreciationDate: dateOnlyFromPersistedDateTime(entry.scheduleDate),
					});
				}
				return { throughDate, posted: true, waitedMs: 0 };
			},
			postDisposalBarrier: (tx, job) => worker.postDisposalBarrier(tx, job),
		};
		service = new AssetService(
			prisma,
			new AssetDashboardSubService(prisma),
			new FiscalYearService(prisma),
			new AssetDepreciationLifecycleService(prisma),
			barrier as unknown as DepreciationBarrierService,
			undefined,
			new AssetAccountingService(),
			new AssetStockPostingService(),
			new AssetDepreciationRevisionService(),
		);
	});

	afterAll(async () => {
		if (!prisma) return;
		try {
			const assets = await prisma.client.asset.findMany({
				where: { companyId },
				select: { id: true },
			});
			const assetIds = assets.map((asset) => asset.id);
			await prisma.client.assetDepreciationJournalEntry.deleteMany({
				where: { companyId },
			});
			await prisma.client.assetAccountingEntry.deleteMany({
				where: { companyId },
			});
			await prisma.client.assetDepreciationSchedule.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetDisposal.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetActivity.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetFinanceBook.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.asset.deleteMany({
				where: { id: { in: assetIds } },
			});
			await prisma.client.assetCategoryAccount.deleteMany({
				where: { assetCategoryId: categoryId },
			});
			await prisma.client.assetCategory.delete({ where: { id: categoryId } });
			await prisma.client.company.delete({ where: { id: companyId } });
			await prisma.client.financeBook.deleteMany({
				where: { id: { in: [rootFinanceBookId, secondaryFinanceBookId] } },
			});
			await prisma.client.organization.delete({
				where: { id: organizationId },
			});
		} finally {
			await prisma.onModuleDestroy();
			if (originalTimeZone === undefined) delete process.env.APP_TIME_ZONE;
			else process.env.APP_TIME_ZONE = originalTimeZone;
		}
	});

	it("reverses a linked mid-period barrier and preserves the other book", async () => {
		const fixture = await createFixture("MID");
		const disposal = await sellMidPeriod(fixture);
		const barrierJournal =
			await prisma.client.assetDepreciationJournalEntry.findFirstOrThrow({
				where: { sourceDisposalId: disposal.id },
				include: { scheduleEntry: true },
			});
		expect(barrierJournal.scheduleEntry?.sequence).toBe(4);
		expect(Number(barrierJournal.depreciationAmount)).toBe(2.9);
		const posted = await prisma.client.asset.findUniqueOrThrow({
			where: { id: fixture.assetId },
			select: {
				status: true,
				valueAfterDepreciation: true,
				financeBooks: {
					select: {
						financeBookId: true,
						valueAfterDepreciation: true,
						schedules: { select: { status: true } },
					},
				},
			},
		});
		expect(posted.status).toBe("SOLD");
		expect(Number(posted.valueAfterDepreciation)).toBe(100);
		expect(
			Number(
				posted.financeBooks.find(
					(book) => book.financeBookId === secondaryFinanceBookId,
				)?.valueAfterDepreciation,
			),
		).toBe(87.1);
		expect(
			posted.financeBooks.find(
				(book) => book.financeBookId === rootFinanceBookId,
			)?.schedules[0]?.status,
		).toBe("ACTIVE");

		await service.restoreAsset({ assetId: fixture.assetId }, organizationId);
		const [restored, restoredJournal, restoredEntry, restoredAccounting] =
			await Promise.all([
				prisma.client.asset.findUniqueOrThrow({
					where: { id: fixture.assetId },
					select: {
						status: true,
						valueAfterDepreciation: true,
						financeBooks: {
							select: {
								financeBookId: true,
								valueAfterDepreciation: true,
								totalNumberOfBookedDepreciations: true,
								schedules: {
									select: { status: true, closedByDisposalId: true },
								},
							},
						},
					},
				}),
				prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
					where: { id: barrierJournal.id },
					select: { status: true, sourceDisposalId: true },
				}),
				prisma.client.assetDepreciationScheduleEntry.findFirst({
					where: { postingId: barrierJournal.id },
				}),
				prisma.client.assetAccountingEntry.findFirstOrThrow({
					where: { sourceType: "DISPOSAL", sourceId: disposal.id },
					select: { status: true },
				}),
			]);
		expect(restored.status).toBe("PARTIALLY_DEPRECIATED");
		expect(Number(restored.valueAfterDepreciation)).toBe(100);
		const restoredSecondary = restored.financeBooks.find(
			(book) => book.financeBookId === secondaryFinanceBookId,
		);
		expect(Number(restoredSecondary?.valueAfterDepreciation)).toBe(90);
		expect(restoredSecondary?.totalNumberOfBookedDepreciations).toBe(1);
		expect(restoredSecondary?.schedules[0]?.status).toBe("ACTIVE");
		expect(restoredJournal.status).toBe("REVERSED");
		expect(restoredJournal.sourceDisposalId).toBe(disposal.id);
		expect(restoredEntry).toBeNull();
		expect(restoredAccounting.status).toBe("REVERSED");
	});

	it("validates persisted lineage before accepting an already-posted barrier retry", async () => {
		const fixture = await createFixture("IDEMPOTENT");
		const disposal = await sellMidPeriod(fixture);
		const barrierJournal =
			await prisma.client.assetDepreciationJournalEntry.findFirstOrThrow({
				where: { sourceDisposalId: disposal.id },
				include: { scheduleEntry: true },
			});
		const scheduleEntry = barrierJournal.scheduleEntry;
		if (!scheduleEntry) throw new Error("barrier schedule entry is required");
		const job = barrierJob(fixture, disposal.id, scheduleEntry.id);

		await expect(worker.post(job)).resolves.toEqual({
			status: "already-posted",
			postingId: barrierJournal.id,
		});
		await prisma.client.assetDepreciationJournalEntry.update({
			where: { id: barrierJournal.id },
			data: { sourceDisposalId: null },
		});
		const beforeRetry = await Promise.all([
			prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: barrierJournal.id },
				select: { status: true, sourceDisposalId: true },
			}),
			prisma.client.assetDepreciationScheduleEntry.findUniqueOrThrow({
				where: { id: scheduleEntry.id },
				select: { postingId: true },
			}),
			prisma.client.assetDisposal.findUniqueOrThrow({
				where: { id: disposal.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: fixture.assetId },
				select: { status: true, valueAfterDepreciation: true },
			}),
			prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: { id: fixture.secondaryAssetFinanceBookId },
				select: {
					valueAfterDepreciation: true,
					totalNumberOfBookedDepreciations: true,
					stateVersion: true,
				},
			}),
		]);

		await expect(worker.post(job)).rejects.toThrow(
			/incomplete persisted lineage/,
		);
		const afterRetry = await Promise.all([
			prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: barrierJournal.id },
				select: { status: true, sourceDisposalId: true },
			}),
			prisma.client.assetDepreciationScheduleEntry.findUniqueOrThrow({
				where: { id: scheduleEntry.id },
				select: { postingId: true },
			}),
			prisma.client.assetDisposal.findUniqueOrThrow({
				where: { id: disposal.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: fixture.assetId },
				select: { status: true, valueAfterDepreciation: true },
			}),
			prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: { id: fixture.secondaryAssetFinanceBookId },
				select: {
					valueAfterDepreciation: true,
					totalNumberOfBookedDepreciations: true,
					stateVersion: true,
				},
			}),
		]);
		expect(afterRetry).toEqual(beforeRetry);
	});

	it("rejects an already-posted barrier owned by another disposal", async () => {
		const fixture = await createFixture("WRONG-DISPOSAL");
		const disposal = await sellMidPeriod(fixture);
		const otherDisposal = await prisma.client.assetDisposal.create({
			data: {
				series: `R012-WRONG-DISPOSAL-${suffix}`,
				assetId: fixture.assetId,
				companyId,
				financeBookId: secondaryFinanceBookId,
				disposalDate: utcDate("2026-07-10"),
				disposalType: "SELL",
				salesAmount: 87.1,
				gainLossAmount: 0,
				previousAssetStatus: "PARTIALLY_DEPRECIATED",
				previousIsFullyDepreciated: false,
				status: "CANCELLED",
			},
		});
		const barrierJournal =
			await prisma.client.assetDepreciationJournalEntry.findFirstOrThrow({
				where: { sourceDisposalId: disposal.id },
				include: { scheduleEntry: true },
			});
		const scheduleEntry = barrierJournal.scheduleEntry;
		if (!scheduleEntry) throw new Error("barrier schedule entry is required");
		await prisma.client.assetDepreciationJournalEntry.update({
			where: { id: barrierJournal.id },
			data: { sourceDisposalId: otherDisposal.id },
		});
		const beforeRetry = await Promise.all([
			prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: barrierJournal.id },
				select: { status: true, sourceDisposalId: true },
			}),
			prisma.client.assetDepreciationScheduleEntry.findUniqueOrThrow({
				where: { id: scheduleEntry.id },
				select: { postingId: true },
			}),
			prisma.client.assetDisposal.findUniqueOrThrow({
				where: { id: disposal.id },
				select: { status: true },
			}),
		]);

		await expect(
			worker.post(barrierJob(fixture, disposal.id, scheduleEntry.id)),
		).rejects.toThrow(/incomplete persisted lineage/);
		const afterRetry = await Promise.all([
			prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: barrierJournal.id },
				select: { status: true, sourceDisposalId: true },
			}),
			prisma.client.assetDepreciationScheduleEntry.findUniqueOrThrow({
				where: { id: scheduleEntry.id },
				select: { postingId: true },
			}),
			prisma.client.assetDisposal.findUniqueOrThrow({
				where: { id: disposal.id },
				select: { status: true },
			}),
		]);
		expect(afterRetry).toEqual(beforeRetry);
	});

	it("preserves the original schedule-date depreciation exception", async () => {
		const fixture = await createFixture("ORIGINAL");
		const disposal = await service.sellAsset(
			{
				assetId: fixture.assetId,
				financeBookId: secondaryFinanceBookId,
				disposalDate: "2026-08-01",
				salesAmount: 80,
				proceedsAccount: `R012 Bank ${suffix}`,
				gainLossAccount: `R012 Gain ${suffix}`,
			},
			organizationId,
		);
		const originalJournal =
			await prisma.client.assetDepreciationJournalEntry.findFirstOrThrow({
				where: {
					assetId: fixture.assetId,
					assetFinanceBookId: fixture.secondaryAssetFinanceBookId,
					postingDate: utcDate("2026-08-01"),
				},
				include: { scheduleEntry: true },
			});
		expect(originalJournal.sourceDisposalId).toBeNull();
		expect(originalJournal.scheduleEntry?.sequence).toBe(2);

		await service.restoreAsset({ assetId: fixture.assetId }, organizationId);
		const [journal, schedule, book, accounting] = await Promise.all([
			prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: originalJournal.id },
				select: { status: true, sourceDisposalId: true },
			}),
			prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
				where: { id: fixture.secondaryScheduleId },
				select: { status: true, closedByDisposalId: true },
			}),
			prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: { id: fixture.secondaryAssetFinanceBookId },
				select: {
					valueAfterDepreciation: true,
					totalNumberOfBookedDepreciations: true,
				},
			}),
			prisma.client.assetAccountingEntry.findFirstOrThrow({
				where: { sourceType: "DISPOSAL", sourceId: disposal.id },
				select: { status: true },
			}),
		]);
		expect(journal).toEqual({ status: "POSTED", sourceDisposalId: null });
		expect(schedule.status).toBe("ACTIVE");
		expect(schedule.closedByDisposalId).toBe(disposal.id);
		expect(Number(book.valueAfterDepreciation)).toBe(80);
		expect(book.totalNumberOfBookedDepreciations).toBe(2);
		expect(accounting.status).toBe("REVERSED");
	});

	it("preserves a legacy journal-only disposal and fails closed on restore", async () => {
		const fixture = await createFixture("LEGACY-JOURNAL");
		await prisma.client.assetDepreciationSchedule.deleteMany({
			where: { assetId: fixture.assetId },
		});
		const legacyJournal =
			await prisma.client.assetDepreciationJournalEntry.create({
				data: {
					series: `R012-LEGACY-DEP-${suffix}`,
					assetId: fixture.assetId,
					assetFinanceBookId: fixture.secondaryAssetFinanceBookId,
					companyId,
					financeBookName: secondaryFinanceBookName,
					postingDate: utcDate("2026-07-10"),
					depreciationAmount: 10,
					status: "POSTED",
				},
			});
		const disposal = await service.sellAsset(
			{
				assetId: fixture.assetId,
				financeBookId: secondaryFinanceBookId,
				disposalDate: "2026-07-10",
				salesAmount: 80,
				proceedsAccount: `R012 Legacy Bank ${suffix}`,
				gainLossAccount: `R012 Legacy Gain ${suffix}`,
			},
			organizationId,
		);
		expect(disposal.financeBookId).toBe(secondaryFinanceBookId);
		expect(
			await prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: legacyJournal.id },
				select: { status: true, sourceDisposalId: true },
			}),
		).toEqual({ status: "POSTED", sourceDisposalId: null });
		expect(
			await prisma.client.assetDepreciationSchedule.count({
				where: { assetId: fixture.assetId },
			}),
		).toBe(0);

		await expect(
			service.restoreAsset({ assetId: fixture.assetId }, organizationId),
		).rejects.toThrow(/schedule lineage|source lineage/);
		expect(
			await prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: legacyJournal.id },
				select: { status: true, sourceDisposalId: true },
			}),
		).toEqual({ status: "POSTED", sourceDisposalId: null });
		expect(
			await prisma.client.assetDisposal.findUniqueOrThrow({
				where: { id: disposal.id },
				select: { status: true },
			}),
		).toEqual({ status: "POSTED" });
	});

	it("reverses a future linked barrier according to the future-date rule", async () => {
		const fixture = await createFixture("FUTURE", "2026-08-01", [
			"2026-08-01",
			"2026-09-01",
			"2026-10-01",
		]);
		const futureDate = utcDate("2026-09-01");
		const futureEntry =
			await prisma.client.assetDepreciationScheduleEntry.findFirstOrThrow({
				where: { scheduleId: fixture.rootScheduleId, sequence: 2 },
			});
		const priorEntry =
			await prisma.client.assetDepreciationScheduleEntry.findFirstOrThrow({
				where: { scheduleId: fixture.rootScheduleId, sequence: 1 },
			});
		await worker.post({
			version: 1,
			organizationId,
			assetId: fixture.assetId,
			assetFinanceBookId: fixture.rootAssetFinanceBookId,
			scheduleId: fixture.rootScheduleId,
			scheduleEntryId: priorEntry.id,
			depreciationDate: "2026-08-01",
		});
		await prisma.client.assetFinanceBook.update({
			where: { id: fixture.rootAssetFinanceBookId },
			data: {
				valueAfterDepreciation: 80,
				totalNumberOfBookedDepreciations: 2,
				postingStatus: "PARTIALLY_DEPRECIATED",
				lastPostedDepreciationDate: futureDate,
				stateVersion: { increment: 1 },
			},
		});
		await prisma.client.asset.update({
			where: { id: fixture.assetId },
			data: {
				status: "SCRAPPED",
				disposalDate: futureDate,
				valueAfterDepreciation: 80,
			},
		});
		const disposal = await prisma.client.assetDisposal.create({
			data: {
				series: `R012-FUT-DISP-${suffix}`,
				assetId: fixture.assetId,
				companyId,
				financeBookId: rootFinanceBookId,
				disposalDate: futureDate,
				disposalType: "SCRAP",
				salesAmount: 0,
				gainLossAmount: 0,
				previousAssetStatus: "PARTIALLY_DEPRECIATED",
				previousIsFullyDepreciated: false,
				submittedFinanceBookStateVersion: 2,
				status: "POSTED",
			},
		});
		await prisma.client.assetDepreciationSchedule.update({
			where: { id: fixture.rootScheduleId },
			data: { status: "CANCELLED", closedByDisposalId: disposal.id },
		});
		const journal = await prisma.client.assetDepreciationJournalEntry.create({
			data: {
				series: `R012-FUT-DEP-${suffix}`,
				sourceDisposalId: disposal.id,
				assetId: fixture.assetId,
				assetFinanceBookId: fixture.rootAssetFinanceBookId,
				companyId,
				financeBookName: rootFinanceBookName,
				postingDate: futureDate,
				depreciationAmount: 10,
				status: "POSTED",
			},
		});
		await prisma.client.assetDepreciationScheduleEntry.update({
			where: { id: futureEntry.id },
			data: { postingId: journal.id, postedAt: futureDate },
		});
		await service.restoreAsset({ assetId: fixture.assetId }, organizationId);
		const [restoredJournal, restoredBook, restoredAsset, restoredEntry] =
			await Promise.all([
				prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
					where: { id: journal.id },
					select: { status: true, sourceDisposalId: true },
				}),
				prisma.client.assetFinanceBook.findUniqueOrThrow({
					where: { id: fixture.rootAssetFinanceBookId },
					select: {
						valueAfterDepreciation: true,
						totalNumberOfBookedDepreciations: true,
					},
				}),
				prisma.client.asset.findUniqueOrThrow({
					where: { id: fixture.assetId },
					select: { status: true, valueAfterDepreciation: true },
				}),
				prisma.client.assetDepreciationScheduleEntry.findFirst({
					where: { postingId: journal.id },
				}),
			]);
		expect(restoredJournal).toEqual({
			status: "REVERSED",
			sourceDisposalId: disposal.id,
		});
		expect(Number(restoredBook.valueAfterDepreciation)).toBe(90);
		expect(restoredBook.totalNumberOfBookedDepreciations).toBe(1);
		expect(restoredAsset.status).toBe("PARTIALLY_DEPRECIATED");
		expect(Number(restoredAsset.valueAfterDepreciation)).toBe(90);
		expect(restoredEntry).toBeNull();
	});

	it("fails closed when the mid-period barrier loses its persisted source", async () => {
		const fixture = await createFixture("MISSING");
		const disposal = await sellMidPeriod(fixture);
		const barrierJournal =
			await prisma.client.assetDepreciationJournalEntry.findFirstOrThrow({
				where: { sourceDisposalId: disposal.id },
				select: { id: true },
			});
		await prisma.client.assetDepreciationJournalEntry.update({
			where: { id: barrierJournal.id },
			data: { sourceDisposalId: null },
		});

		await expect(
			service.restoreAsset({ assetId: fixture.assetId }, organizationId),
		).rejects.toThrow(/missing source lineage/);
		const [unchangedDisposal, unchangedJournal, unchangedSchedule] =
			await Promise.all([
				prisma.client.assetDisposal.findFirstOrThrow({
					where: { id: disposal.id },
					select: { status: true },
				}),
				prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
					where: { id: barrierJournal.id },
					select: { status: true, sourceDisposalId: true },
				}),
				prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
					where: { id: fixture.secondaryScheduleId },
					select: { status: true },
				}),
			]);
		expect(unchangedDisposal.status).toBe("POSTED");
		expect(unchangedJournal).toEqual({
			status: "POSTED",
			sourceDisposalId: null,
		});
		expect(unchangedSchedule.status).toBe("CANCELLED");
	});

	it("blocks later depreciation and accounting without changing disposal state", async () => {
		const depreciationFixture = await createFixture("LATER-DEP");
		const depreciationDisposal = await sellMidPeriod(depreciationFixture);
		const laterDepreciation =
			await prisma.client.assetDepreciationJournalEntry.create({
				data: {
					series: `R012-LATER-DEP-${suffix}`,
					assetId: depreciationFixture.assetId,
					assetFinanceBookId: depreciationFixture.secondaryAssetFinanceBookId,
					companyId,
					financeBookName: secondaryFinanceBookName,
					postingDate: utcDate("2026-07-11"),
					depreciationAmount: 1,
					status: "POSTED",
				},
			});
		await expect(
			service.restoreAsset(
				{ assetId: depreciationFixture.assetId },
				organizationId,
			),
		).rejects.toThrow(/later depreciation/);
		const unchangedDepreciationDisposal =
			await prisma.client.assetDisposal.findFirstOrThrow({
				where: { id: depreciationDisposal.id },
				select: { status: true },
			});
		expect(unchangedDepreciationDisposal.status).toBe("POSTED");
		expect(
			await prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: laterDepreciation.id },
				select: { status: true },
			}),
		).toEqual({ status: "POSTED" });

		const accountingFixture = await createFixture("LATER-ACC");
		const accountingDisposal = await sellMidPeriod(accountingFixture);
		const laterAccounting = await prisma.client.assetAccountingEntry.create({
			data: {
				series: `R012-LATER-ACC-${suffix}`,
				companyId,
				assetId: accountingFixture.assetId,
				financeBookId: secondaryFinanceBookId,
				sourceType: "REPAIR",
				sourceId: `R012-LATER-ACC-SOURCE-${suffix}`,
				postingDate: utcDate("2026-07-11"),
				remarks: `R-012 later accounting ${suffix}`,
				status: "POSTED",
			},
		});
		await expect(
			service.restoreAsset(
				{ assetId: accountingFixture.assetId },
				organizationId,
			),
		).rejects.toThrow(/later accounting/);
		expect(
			await prisma.client.assetDisposal.findFirstOrThrow({
				where: { id: accountingDisposal.id },
				select: { status: true },
			}),
		).toEqual({ status: "POSTED" });
		expect(
			await prisma.client.assetAccountingEntry.findUniqueOrThrow({
				where: { id: laterAccounting.id },
				select: { status: true },
			}),
		).toEqual({ status: "POSTED" });
	});

	it("blocks later ambiguous accounting without changing any linked state", async () => {
		const fixture = await createFixture("LATER-NULL-ACC");
		const disposal = await sellMidPeriod(fixture);
		const barrierJournal =
			await prisma.client.assetDepreciationJournalEntry.findFirstOrThrow({
				where: { sourceDisposalId: disposal.id },
				select: { id: true },
			});
		const laterAccounting = await prisma.client.assetAccountingEntry.create({
			data: {
				series: `R012-LATER-NULL-ACC-${suffix}`,
				companyId,
				assetId: fixture.assetId,
				financeBookId: null,
				sourceType: "REPAIR",
				sourceId: `R012-LATER-NULL-ACC-SOURCE-${suffix}`,
				postingDate: utcDate("2026-07-11"),
				remarks: `R-012 later ambiguous accounting ${suffix}`,
				status: "POSTED",
			},
		});
		const disposalAccounting =
			await prisma.client.assetAccountingEntry.findFirstOrThrow({
				where: { sourceType: "DISPOSAL", sourceId: disposal.id },
				select: { id: true },
			});
		const before = await Promise.all([
			prisma.client.assetDisposal.findUniqueOrThrow({
				where: { id: disposal.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: fixture.assetId },
				select: { status: true, valueAfterDepreciation: true },
			}),
			prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: { id: fixture.secondaryAssetFinanceBookId },
				select: {
					valueAfterDepreciation: true,
					totalNumberOfBookedDepreciations: true,
					stateVersion: true,
				},
			}),
			prisma.client.assetAccountingEntry.findUniqueOrThrow({
				where: { id: disposalAccounting.id },
				select: { status: true },
			}),
			prisma.client.assetAccountingEntry.findUniqueOrThrow({
				where: { id: laterAccounting.id },
				select: { status: true, financeBookId: true },
			}),
			prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: barrierJournal.id },
				select: { status: true, sourceDisposalId: true },
			}),
			prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
				where: { id: fixture.secondaryScheduleId },
				select: { status: true, closedByDisposalId: true },
			}),
			prisma.client.assetActivity.count({
				where: { assetId: fixture.assetId },
			}),
		]);

		await expect(
			service.restoreAsset({ assetId: fixture.assetId }, organizationId),
		).rejects.toThrow(/later accounting/);
		const after = await Promise.all([
			prisma.client.assetDisposal.findUniqueOrThrow({
				where: { id: disposal.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: fixture.assetId },
				select: { status: true, valueAfterDepreciation: true },
			}),
			prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: { id: fixture.secondaryAssetFinanceBookId },
				select: {
					valueAfterDepreciation: true,
					totalNumberOfBookedDepreciations: true,
					stateVersion: true,
				},
			}),
			prisma.client.assetAccountingEntry.findUniqueOrThrow({
				where: { id: disposalAccounting.id },
				select: { status: true },
			}),
			prisma.client.assetAccountingEntry.findUniqueOrThrow({
				where: { id: laterAccounting.id },
				select: { status: true, financeBookId: true },
			}),
			prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: barrierJournal.id },
				select: { status: true, sourceDisposalId: true },
			}),
			prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
				where: { id: fixture.secondaryScheduleId },
				select: { status: true, closedByDisposalId: true },
			}),
			prisma.client.assetActivity.count({
				where: { assetId: fixture.assetId },
			}),
		]);
		expect(after).toEqual(before);
	});

	it("serializes concurrent repeated restores so only one can commit", async () => {
		const fixture = await createFixture("CONCURRENT");
		const disposal = await sellMidPeriod(fixture);
		const results = await Promise.allSettled([
			service.restoreAsset({ assetId: fixture.assetId }, organizationId),
			service.restoreAsset({ assetId: fixture.assetId }, organizationId),
		]);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		expect(
			await prisma.client.assetDisposal.findUniqueOrThrow({
				where: { id: disposal.id },
				select: { status: true },
			}),
		).toEqual({ status: "CANCELLED" });
		expect(
			await prisma.client.asset.findUniqueOrThrow({
				where: { id: fixture.assetId },
				select: { status: true },
			}),
		).toEqual({ status: "PARTIALLY_DEPRECIATED" });
	});
});
