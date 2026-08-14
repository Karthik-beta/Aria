import type { Prisma } from "../../../generated/prisma/client";
import { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { AssetAccountingService } from "../asset-accounting.service";
import { AssetDashboardSubService } from "../asset-dashboard.service";
import { lockAssetAndFinanceBooks } from "../asset-locking";
import { AssetStockPostingService } from "../asset-stock-posting.service";
import { AssetDepreciationLifecycleService } from "../depreciation/asset-depreciation-lifecycle.service";
import { AssetDepreciationRevisionService } from "../depreciation/asset-depreciation-revision.service";
import type {
	DepreciationScope,
	EnsureDepreciationPostedResult,
} from "../depreciation/depreciation.types";
import type { DepreciationBarrierService } from "../depreciation/depreciation-barrier.service";
import { DepreciationPersistenceService } from "../depreciation/depreciation-persistence.service";

type AssetBookBalance = {
	financeBookId: string | null;
	assetFinanceBookId: string | null;
	grossValue: number;
	carryingValue: number;
	accumulatedDepreciation: number;
};

type AssetBalanceReader = {
	getAssetBookBalance(
		tx: Prisma.TransactionClient,
		organizationId: string,
		assetId: string,
		asOfDate: Date,
		requestedFinanceBookId?: string | null,
	): Promise<AssetBookBalance>;
};

type BarrierStub = {
	calls: DepreciationScope[];
	ensureDepreciationPosted(
		scope: DepreciationScope,
	): Promise<EnsureDepreciationPostedResult>;
};

type Deferred<T> = {
	promise: Promise<T>;
	resolve(value: T): void;
};

const deferred = <T>(): Deferred<T> => {
	let resolvePromise!: (value: T) => void;
	const promise = new Promise<T>((resolve) => {
		resolvePromise = resolve;
	});
	return { promise, resolve: resolvePromise };
};

/**
 * Runs the five R-005 targeted corrections against a disposable PostgreSQL
 * schema. The suite intentionally uses public Asset workflows for book
 * selection, capitalization, disposal, lifecycle submission, and worker
 * posting, while the concurrency case holds the same production advisory
 * locks around a deterministic worker/adjustment interleaving.
 */
describe("R-005 targeted corrections integration", () => {
	let prisma: PrismaService;
	let service: AssetService;
	let lifecycle: AssetDepreciationLifecycleService;
	let worker: DepreciationPersistenceService;
	let organizationId: string;
	let companyId: string;
	let singletonCompanyId: string;
	let categoryId: string;
	let defaultFinanceBookId: string;
	let secondaryFinanceBookId: string;
	let singletonFinanceBookId: string;
	let barrier: BarrierStub;
	let suffix: string;

	const balanceReader = (): AssetBalanceReader =>
		service as unknown as AssetBalanceReader;

	const readBalance = async (
		assetId: string,
		financeBookId?: string,
	): Promise<AssetBookBalance> =>
		prisma.client.$transaction((tx) =>
			balanceReader().getAssetBookBalance(
				tx,
				organizationId,
				assetId,
				new Date("2026-08-10T23:59:59.999Z"),
				financeBookId,
			),
		);

	const createSchedule = async (
		assetId: string,
		assetBookId: string,
		bookValue: number,
	): Promise<string> => {
		const schedule = await prisma.client.assetDepreciationSchedule.create({
			data: {
				assetId,
				assetFinanceBookId: assetBookId,
				revisionNumber: 1,
				status: "ACTIVE",
				startDate: new Date("2026-01-01T00:00:00.000Z"),
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 2,
				frequencyOfDepreciation: 1,
				dailyProrataBased: false,
				shiftBased: false,
				rateOfDepreciation: null,
				expectedValueAfterUsefulLife: 0,
				bookedDepreciations: 0,
				remainingDepreciations: 2,
				openingAccumulatedDepreciation: 0,
				baseAssetValue: bookValue,
				entries: {
					create: [
						{
							sequence: 1,
							scheduleDate: new Date("2026-08-01T00:00:00.000Z"),
							depreciationAmount: 10,
							accumulatedDepreciationAmount: 10,
							bookValueAfterDepreciation: Math.max(bookValue - 10, 0),
						},
						{
							sequence: 2,
							scheduleDate: new Date("2026-09-01T00:00:00.000Z"),
							depreciationAmount: 10,
							accumulatedDepreciationAmount: 20,
							bookValueAfterDepreciation: Math.max(bookValue - 20, 0),
						},
					],
				},
			},
		});
		return schedule.id;
	};

	const createTwoBookAsset = async (
		label: string,
		options: {
			rootValue: number;
			secondaryValue: number;
			withSchedules?: boolean;
		},
	): Promise<{
		assetId: string;
		defaultAssetFinanceBookId: string;
		secondaryAssetFinanceBookId: string;
	}> => {
		const asset = await prisma.client.asset.create({
			data: {
				series: `R005-${label}-${suffix}`,
				assetName: `R-005 ${label}`,
				itemCode: `R005-${label}`,
				assetCategoryId: categoryId,
				companyId,
				purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
				availableForUseDate: new Date("2026-01-01T00:00:00.000Z"),
				netPurchaseAmount: options.rootValue,
				calculateDepreciation: true,
				valueAfterDepreciation: options.rootValue,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 2,
				frequencyOfDepreciation: 1,
				depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
				status: "PARTIALLY_DEPRECIATED",
			},
		});
		const [defaultBook, secondaryBook] = await Promise.all([
			prisma.client.assetFinanceBook.create({
				data: {
					assetId: asset.id,
					financeBookId: defaultFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 2,
					frequencyOfDepreciation: 1,
					depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
					openingAccumulatedDepreciation: 0,
					valueAfterDepreciation: options.rootValue,
					postingStatus: "PARTIALLY_DEPRECIATED",
				},
			}),
			prisma.client.assetFinanceBook.create({
				data: {
					assetId: asset.id,
					financeBookId: secondaryFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 2,
					frequencyOfDepreciation: 1,
					depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
					openingAccumulatedDepreciation:
						options.rootValue - options.secondaryValue,
					valueAfterDepreciation: options.secondaryValue,
					postingStatus: "PARTIALLY_DEPRECIATED",
				},
			}),
		]);
		if (options.withSchedules !== false) {
			await Promise.all([
				createSchedule(asset.id, defaultBook.id, options.rootValue),
				createSchedule(asset.id, secondaryBook.id, options.secondaryValue),
			]);
		}
		return {
			assetId: asset.id,
			defaultAssetFinanceBookId: defaultBook.id,
			secondaryAssetFinanceBookId: secondaryBook.id,
		};
	};

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();
		suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const organization = await prisma.organization.create({
			data: {
				name: `R-005 Targeted ${suffix}`,
				slug: `r005-targeted-${suffix}`,
			},
		});
		organizationId = organization.id;

		const [defaultBook, secondaryBook, singletonBook] = await Promise.all([
			prisma.financeBook.create({ data: { name: `R-005 Default ${suffix}` } }),
			prisma.financeBook.create({
				data: { name: `R-005 Secondary ${suffix}` },
			}),
			prisma.financeBook.create({
				data: { name: `R-005 Singleton ${suffix}` },
			}),
		]);
		defaultFinanceBookId = defaultBook.id;
		secondaryFinanceBookId = secondaryBook.id;
		singletonFinanceBookId = singletonBook.id;

		const [company, singletonCompany] = await Promise.all([
			prisma.company.create({
				data: {
					organizationId,
					name: `R-005 Main ${suffix}`,
					defaultFinanceBookId,
					defaultCostCenter: `R-005 Cost Center ${suffix}`,
					accumulatedDepreciationAccount: `R-005 Accumulated ${suffix}`,
					depreciationExpenseAccount: `R-005 Depreciation ${suffix}`,
				},
			}),
			prisma.company.create({
				data: {
					organizationId,
					name: `R-005 Singleton Company ${suffix}`,
					defaultFinanceBookId: null,
					defaultCostCenter: `R-005 Singleton Cost Center ${suffix}`,
					accumulatedDepreciationAccount: `R-005 Singleton Accumulated ${suffix}`,
					depreciationExpenseAccount: `R-005 Singleton Depreciation ${suffix}`,
				},
			}),
		]);
		companyId = company.id;
		singletonCompanyId = singletonCompany.id;

		const category = await prisma.assetCategory.create({
			data: {
				name: `R-005 Machinery ${suffix}`,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 2,
				frequencyOfDepreciation: 1,
				expectedValueAfterUsefulLife: 0,
			},
		});
		categoryId = category.id;
		await Promise.all([
			prisma.assetCategoryAccount.create({
				data: {
					assetCategoryId: categoryId,
					companyId,
					fixedAssetAccount: `R-005 Fixed Asset ${suffix}`,
					accumulatedDepreciationAccount: `R-005 Accumulated ${suffix}`,
					depreciationExpenseAccount: `R-005 Depreciation ${suffix}`,
				},
			}),
			prisma.assetCategoryAccount.create({
				data: {
					assetCategoryId: categoryId,
					companyId: singletonCompanyId,
					fixedAssetAccount: `R-005 Singleton Fixed Asset ${suffix}`,
					accumulatedDepreciationAccount: `R-005 Singleton Accumulated ${suffix}`,
					depreciationExpenseAccount: `R-005 Singleton Depreciation ${suffix}`,
				},
			}),
		]);

		barrier = {
			calls: [],
			ensureDepreciationPosted: async (scope) => {
				barrier.calls.push(scope);
				return {
					throughDate:
						typeof scope.throughDate === "string"
							? scope.throughDate
							: scope.throughDate.toISOString().slice(0, 10),
					posted: true,
					waitedMs: 0,
				};
			},
		};
		lifecycle = new AssetDepreciationLifecycleService(prisma);
		service = new AssetService(
			prisma,
			new AssetDashboardSubService(prisma),
			new FiscalYearService(prisma),
			lifecycle,
			barrier as unknown as DepreciationBarrierService,
			undefined,
			new AssetAccountingService(),
			new AssetStockPostingService(),
			new AssetDepreciationRevisionService(),
		);
		worker = new DepreciationPersistenceService(prisma);
	});

	afterAll(async () => {
		if (!prisma) return;
		try {
			const assetRows = await prisma.client.asset.findMany({
				where: { companyId: { in: [companyId, singletonCompanyId] } },
				select: { id: true },
			});
			const assetIds = assetRows.map((asset) => asset.id);
			await prisma.client.assetDepreciationSchedule.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetRevaluationEntry.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetValueAdjustment.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetDisposal.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			const capitalizationRows =
				await prisma.client.assetCapitalization.findMany({
					where: { companyId: { in: [companyId, singletonCompanyId] } },
					select: { id: true },
				});
			const capitalizationIds = capitalizationRows.map((cap) => cap.id);
			await prisma.client.assetCapitalizationAssetItem.deleteMany({
				where: { capitalizationId: { in: capitalizationIds } },
			});
			await prisma.client.assetCapitalization.deleteMany({
				where: { id: { in: capitalizationIds } },
			});
			await prisma.client.assetAccountingEntry.deleteMany({
				where: { companyId: { in: [companyId, singletonCompanyId] } },
			});
			await prisma.client.assetDepreciationJournalEntry.deleteMany({
				where: { companyId: { in: [companyId, singletonCompanyId] } },
			});
			await prisma.client.assetActivity.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetFinanceBook.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.asset.deleteMany({ where: { id: { in: assetIds } } });
			await prisma.client.assetCategoryAccount.deleteMany({
				where: { assetCategoryId: categoryId },
			});
			await prisma.client.assetCategory.deleteMany({
				where: { id: categoryId },
			});
			await prisma.client.company.updateMany({
				where: { id: { in: [companyId, singletonCompanyId] } },
				data: { defaultFinanceBookId: null },
			});
			await prisma.client.company.deleteMany({
				where: { id: { in: [companyId, singletonCompanyId] } },
			});
			await prisma.client.financeBook.deleteMany({
				where: {
					id: {
						in: [
							defaultFinanceBookId,
							secondaryFinanceBookId,
							singletonFinanceBookId,
						].filter((id): id is string => Boolean(id)),
					},
				},
			});
			await prisma.client.organization.delete({
				where: { id: organizationId },
			});
		} finally {
			await prisma.onModuleDestroy();
		}
	});

	it("keeps secondary-book capitalization independent and exactly reversible", async () => {
		const source = await createTwoBookAsset("CAP-SOURCE", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const target = await prisma.client.asset.create({
			data: {
				series: `R005-CAP-TARGET-${suffix}`,
				assetName: "R-005 Composite Target",
				itemCode: `R005-CAP-TARGET-${suffix}`,
				assetType: "COMPOSITE_ASSET",
				assetCategoryId: categoryId,
				companyId,
				purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
				availableForUseDate: new Date("2026-01-01T00:00:00.000Z"),
				netPurchaseAmount: 0,
				valueAfterDepreciation: 0,
				calculateDepreciation: false,
				status: "DRAFT",
			},
		});
		barrier.calls.length = 0;

		const draft = await service.createAssetCapitalization(
			{
				companyId,
				financeBookId: secondaryFinanceBookId,
				postingDate: "2026-08-10",
				targetType: "EXISTING_ASSET",
				targetAssetId: target.id,
				stockItems: [],
				assetItems: [{ assetId: source.assetId, assetValue: 1 }],
				serviceItems: [
					{ expenseAccount: `R-005 Service ${suffix}`, amount: 20 },
				],
			},
			organizationId,
		);
		const submitted = await service.submitAssetCapitalization(
			{ id: draft.id },
			organizationId,
		);

		expect(barrier.calls).toEqual([
			expect.objectContaining({
				assetIds: [source.assetId],
				financeBookId: secondaryFinanceBookId,
			}),
		]);
		expect(submitted.status).toBe("SUBMITTED");
		expect(submitted.financeBookId).toBe(secondaryFinanceBookId);

		const [sourceState, targetState, itemState, accounting] = await Promise.all(
			[
				prisma.client.asset.findUniqueOrThrow({
					where: { id: source.assetId },
					select: {
						status: true,
						valueAfterDepreciation: true,
						financeBooks: {
							select: {
								financeBookId: true,
								valueAfterDepreciation: true,
								schedules: { select: { status: true } },
							},
							orderBy: { financeBookId: "asc" },
						},
					},
				}),
				prisma.client.asset.findUniqueOrThrow({
					where: { id: target.id },
					select: {
						status: true,
						calculateDepreciation: true,
						netPurchaseAmount: true,
						valueAfterDepreciation: true,
						financeBooks: {
							select: {
								financeBookId: true,
								valueAfterDepreciation: true,
								schedules: { select: { status: true } },
							},
						},
					},
				}),
				prisma.client.assetCapitalizationAssetItem.findFirstOrThrow({
					where: { capitalizationId: draft.id },
					select: { financeBookId: true, assetValue: true },
				}),
				prisma.client.assetAccountingEntry.findFirstOrThrow({
					where: { sourceType: "CAPITALIZATION", sourceId: draft.id },
					select: { financeBookId: true },
				}),
			],
		);
		const sourceDefault = sourceState.financeBooks.find(
			(book) => book.financeBookId === defaultFinanceBookId,
		);
		const sourceSecondary = sourceState.financeBooks.find(
			(book) => book.financeBookId === secondaryFinanceBookId,
		);
		expect(sourceState.status).toBe("CAPITALIZED");
		expect(Number(sourceState.valueAfterDepreciation)).toBe(120);
		expect(Number(sourceDefault?.valueAfterDepreciation)).toBe(120);
		expect(sourceDefault?.schedules[0]?.status).toBe("ACTIVE");
		expect(sourceSecondary?.schedules[0]?.status).toBe("CANCELLED");
		expect(targetState.status).toBe("SUBMITTED");
		expect(targetState.calculateDepreciation).toBe(true);
		expect(Number(targetState.netPurchaseAmount)).toBe(0);
		expect(Number(targetState.valueAfterDepreciation)).toBe(0);
		expect(targetState.financeBooks).toHaveLength(1);
		expect(targetState.financeBooks[0]?.financeBookId).toBe(
			secondaryFinanceBookId,
		);
		expect(Number(targetState.financeBooks[0]?.valueAfterDepreciation)).toBe(
			120,
		);
		expect(targetState.financeBooks[0]?.schedules[0]?.status).toBe("ACTIVE");
		expect(itemState.financeBookId).toBe(secondaryFinanceBookId);
		expect(Number(itemState.assetValue)).toBe(100);
		expect(accounting.financeBookId).toBe(secondaryFinanceBookId);

		const cancelled = await service.cancelAssetCapitalization(
			{ id: draft.id },
			organizationId,
		);
		expect(cancelled.status).toBe("CANCELLED");
		const [restoredSource, restoredTarget, targetBooks] = await Promise.all([
			prisma.client.asset.findUniqueOrThrow({
				where: { id: source.assetId },
				select: {
					status: true,
					valueAfterDepreciation: true,
					financeBooks: {
						select: {
							financeBookId: true,
							valueAfterDepreciation: true,
							schedules: { select: { status: true } },
						},
						orderBy: { financeBookId: "asc" },
					},
				},
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: target.id },
				select: {
					status: true,
					calculateDepreciation: true,
					netPurchaseAmount: true,
					valueAfterDepreciation: true,
				},
			}),
			prisma.client.assetFinanceBook.findMany({
				where: { assetId: target.id },
				select: { financeBookId: true },
			}),
		]);
		const restoredSecondary = restoredSource.financeBooks.find(
			(book) => book.financeBookId === secondaryFinanceBookId,
		);
		expect(restoredSource.status).toBe("PARTIALLY_DEPRECIATED");
		expect(Number(restoredSource.valueAfterDepreciation)).toBe(120);
		expect(restoredSecondary?.schedules[0]?.status).toBe("ACTIVE");
		expect(restoredTarget.status).toBe("DRAFT");
		expect(restoredTarget.calculateDepreciation).toBe(false);
		expect(Number(restoredTarget.netPurchaseAmount)).toBe(0);
		expect(Number(restoredTarget.valueAfterDepreciation)).toBe(0);
		expect(targetBooks).toEqual([]);
	});

	it("resolves the selected disposal book before the barrier and restores only that book", async () => {
		const fixture = await createTwoBookAsset("DISPOSAL", {
			rootValue: 100,
			secondaryValue: 80,
		});
		barrier.calls.length = 0;
		const disposal = await service.sellAsset(
			{
				assetId: fixture.assetId,
				financeBookId: secondaryFinanceBookId,
				disposalDate: "2026-08-10",
				salesAmount: 80,
				proceedsAccount: `R-005 Bank ${suffix}`,
				gainLossAccount: `R-005 Gain ${suffix}`,
			},
			organizationId,
		);
		expect(barrier.calls).toEqual([
			expect.objectContaining({
				assetIds: [fixture.assetId],
				financeBookId: secondaryFinanceBookId,
			}),
		]);
		expect(disposal.financeBookId).toBe(secondaryFinanceBookId);

		const postedAccounting =
			await prisma.client.assetAccountingEntry.findFirstOrThrow({
				where: { sourceType: "DISPOSAL", sourceId: disposal.id },
				select: { financeBookId: true },
			});
		expect(postedAccounting.financeBookId).toBe(secondaryFinanceBookId);
		const postedState = await prisma.client.asset.findUniqueOrThrow({
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
		expect(postedState.status).toBe("SOLD");
		expect(Number(postedState.valueAfterDepreciation)).toBe(100);
		expect(
			postedState.financeBooks.find(
				(book) => book.financeBookId === defaultFinanceBookId,
			)?.schedules[0]?.status,
		).toBe("ACTIVE");
		expect(
			postedState.financeBooks.find(
				(book) => book.financeBookId === secondaryFinanceBookId,
			)?.schedules[0]?.status,
		).toBe("CANCELLED");

		await service.restoreAsset({ assetId: fixture.assetId }, organizationId);
		const restored = await prisma.client.asset.findUniqueOrThrow({
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
		expect(restored.status).toBe("PARTIALLY_DEPRECIATED");
		expect(Number(restored.valueAfterDepreciation)).toBe(100);
		expect(
			restored.financeBooks.find(
				(book) => book.financeBookId === secondaryFinanceBookId,
			)?.schedules[0]?.status,
		).toBe("ACTIVE");
		const restoredAccounting =
			await prisma.client.assetAccountingEntry.findMany({
				where: { assetId: fixture.assetId },
				select: { financeBookId: true, status: true },
			});
		expect(
			restoredAccounting.every(
				(entry) => entry.financeBookId === secondaryFinanceBookId,
			),
		).toBe(true);
	});

	it("serializes worker W before adjustment A and preserves the default root projection", async () => {
		const fixture = await createTwoBookAsset("CONCURRENCY", {
			rootValue: 100,
			secondaryValue: 100,
		});
		const secondarySchedule =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: { assetFinanceBookId: fixture.secondaryAssetFinanceBookId },
				include: { entries: { orderBy: { sequence: "asc" } } },
			});
		const workerHasLock = deferred<void>();
		const adjustmentRequested = deferred<void>();
		let observedByAdjustment = -1;

		const workerTransaction = prisma.client.$transaction(async (tx) => {
			await lockAssetAndFinanceBooks(
				tx,
				[fixture.assetId],
				[fixture.secondaryAssetFinanceBookId],
			);
			workerHasLock.resolve();
			await adjustmentRequested.promise;
			const posting = await tx.assetDepreciationJournalEntry.create({
				data: {
					series: `R005-CONC-DEP-${suffix}`,
					assetId: fixture.assetId,
					assetFinanceBookId: fixture.secondaryAssetFinanceBookId,
					companyId,
					financeBookName: `R-005 Secondary ${suffix}`,
					postingDate:
						secondarySchedule.entries[0]?.scheduleDate ??
						new Date("2026-08-01"),
					depreciationAmount: 15,
					status: "POSTED",
				},
			});
			const linked = await tx.assetDepreciationScheduleEntry.updateMany({
				where: { id: secondarySchedule.entries[0]?.id },
				data: { postingId: posting.id, postedAt: new Date() },
			});
			expect(linked.count).toBe(1);
			await tx.assetFinanceBook.update({
				where: { id: fixture.secondaryAssetFinanceBookId },
				data: {
					valueAfterDepreciation: 85,
					totalNumberOfBookedDepreciations: 1,
					postingStatus: "PARTIALLY_DEPRECIATED",
					lastPostedDepreciationDate: posting.postingDate,
				},
			});
		});

		await workerHasLock.promise;
		const adjustmentTransaction = prisma.client.$transaction(async (tx) => {
			adjustmentRequested.resolve();
			await lockAssetAndFinanceBooks(
				tx,
				[fixture.assetId],
				[fixture.secondaryAssetFinanceBookId],
			);
			const currentBook = await tx.assetFinanceBook.findUniqueOrThrow({
				where: { id: fixture.secondaryAssetFinanceBookId },
				select: { valueAfterDepreciation: true },
			});
			observedByAdjustment = Number(currentBook.valueAfterDepreciation);
			const adjustment = await tx.assetValueAdjustment.create({
				data: {
					series: `R005-CONC-AVA-${suffix}`,
					assetId: fixture.assetId,
					financeBookId: secondaryFinanceBookId,
					assetCategorySnapshot: `R-005 Machinery ${suffix}`,
					adjustmentDate: new Date("2026-08-10T00:00:00.000Z"),
					currentAssetValue: 85,
					newAssetValue: 100,
					differenceAmount: 15,
					differenceAccount: `R-005 Revaluation ${suffix}`,
					fixedAssetAccount: `R-005 Fixed Asset ${suffix}`,
					status: "SUBMITTED",
					direction: "INCREASE",
					previousAssetStatus: "PARTIALLY_DEPRECIATED",
					previousAssetValueAfterDepreciation: 100,
				},
			});
			const revision = await new AssetDepreciationRevisionService().revise(
				tx,
				organizationId,
				{
					assetId: fixture.assetId,
					financeBookId: secondaryFinanceBookId,
					effectiveDate: new Date("2026-08-10T00:00:00.000Z"),
					valueDelta: 15,
					usefulLifeDeltaMonths: 0,
					adjustmentId: adjustment.id,
				},
			);
			expect(revision).toHaveLength(1);
			await tx.assetRevaluationEntry.create({
				data: {
					series: `R005-CONC-REV-${suffix}`,
					adjustmentId: adjustment.id,
					assetId: fixture.assetId,
					companyId,
					financeBookId: secondaryFinanceBookId,
					postingDate: new Date("2026-08-10T00:00:00.000Z"),
					remarks: "R-005 deterministic concurrent adjustment",
					lines: {
						create: [
							{
								lineType: "DEBIT",
								account: `R-005 Fixed Asset ${suffix}`,
								debitAmount: 15,
								creditAmount: 0,
							},
							{
								lineType: "CREDIT",
								account: `R-005 Revaluation ${suffix}`,
								debitAmount: 0,
								creditAmount: 15,
							},
						],
					},
				},
			});
			await tx.assetAccountingEntry.create({
				data: {
					series: `R005-CONC-ACC-${suffix}`,
					companyId,
					assetId: fixture.assetId,
					financeBookId: secondaryFinanceBookId,
					sourceType: "REPAIR",
					sourceId: `R005-CONC-SOURCE-${suffix}`,
					postingDate: new Date("2026-08-10T00:00:00.000Z"),
					remarks: "R-005 deterministic concurrent accounting",
					lines: {
						create: [
							{
								lineType: "DEBIT",
								account: `R-005 Fixed Asset ${suffix}`,
								debitAmount: 15,
								creditAmount: 0,
							},
							{
								lineType: "CREDIT",
								account: `R-005 Revaluation ${suffix}`,
								debitAmount: 0,
								creditAmount: 15,
							},
						],
					},
				},
			});
		});

		await Promise.all([workerTransaction, adjustmentTransaction]);
		expect(observedByAdjustment).toBe(85);
		const finalState = await prisma.client.asset.findUniqueOrThrow({
			where: { id: fixture.assetId },
			select: {
				valueAfterDepreciation: true,
				financeBooks: {
					select: {
						financeBookId: true,
						valueAfterDepreciation: true,
						schedules: {
							select: {
								status: true,
								adjustmentId: true,
								previousScheduleId: true,
							},
						},
					},
				},
			},
		});
		const finalSecondary = finalState.financeBooks.find(
			(book) => book.financeBookId === secondaryFinanceBookId,
		);
		expect(Number(finalState.valueAfterDepreciation)).toBe(100);
		expect(Number(finalSecondary?.valueAfterDepreciation)).toBe(100);
		expect(finalSecondary?.schedules).toHaveLength(2);
		expect(
			finalSecondary?.schedules.filter(
				(schedule) => schedule.status === "CANCELLED",
			),
		).toHaveLength(1);
		expect(
			finalSecondary?.schedules.filter(
				(schedule) => schedule.status === "ACTIVE",
			),
		).toHaveLength(1);
		expect(
			finalSecondary?.schedules.find((schedule) => schedule.status === "ACTIVE")
				?.adjustmentId,
		).not.toBeNull();
		const [journal, revaluation, accounting] = await Promise.all([
			prisma.client.assetDepreciationJournalEntry.findFirstOrThrow({
				where: { assetId: fixture.assetId },
				select: { depreciationAmount: true, assetFinanceBookId: true },
			}),
			prisma.client.assetRevaluationEntry.findFirstOrThrow({
				where: { assetId: fixture.assetId },
				select: { financeBookId: true },
			}),
			prisma.client.assetAccountingEntry.findFirstOrThrow({
				where: { assetId: fixture.assetId, sourceType: "REPAIR" },
				select: { financeBookId: true },
			}),
		]);
		expect(Number(journal.depreciationAmount)).toBe(15);
		expect(journal.assetFinanceBookId).toBe(
			fixture.secondaryAssetFinanceBookId,
		);
		expect(revaluation.financeBookId).toBe(secondaryFinanceBookId);
		expect(accounting.financeBookId).toBe(secondaryFinanceBookId);
	});

	it("uses the sole book as the effective projection when Company has no default", async () => {
		const asset = await prisma.client.asset.create({
			data: {
				series: `R005-SINGLETON-${suffix}`,
				assetName: "R-005 Singleton Asset",
				itemCode: `R005-SINGLETON-${suffix}`,
				assetCategoryId: categoryId,
				companyId: singletonCompanyId,
				purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
				availableForUseDate: new Date("2026-01-01T00:00:00.000Z"),
				netPurchaseAmount: 100,
				calculateDepreciation: true,
				valueAfterDepreciation: 100,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 2,
				frequencyOfDepreciation: 1,
				depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
				status: "DRAFT",
			},
		});
		const soleBook = await prisma.client.assetFinanceBook.create({
			data: {
				assetId: asset.id,
				financeBookId: singletonFinanceBookId,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 2,
				frequencyOfDepreciation: 1,
				depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
				valueAfterDepreciation: 100,
				postingStatus: "PENDING",
			},
		});

		await lifecycle.submitAsset(asset.id, organizationId);
		const submitted = await prisma.client.asset.findUniqueOrThrow({
			where: { id: asset.id },
			select: { status: true, valueAfterDepreciation: true },
		});
		expect(submitted.status).toBe("SUBMITTED");
		expect(Number(submitted.valueAfterDepreciation)).toBe(100);
		const submittedBalance = await readBalance(asset.id);
		expect(submittedBalance.financeBookId).toBe(singletonFinanceBookId);
		expect(submittedBalance.carryingValue).toBe(100);

		const schedule =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: { assetFinanceBookId: soleBook.id, status: "ACTIVE" },
				include: { entries: { orderBy: { sequence: "asc" } } },
			});
		const firstEntry = schedule.entries[0];
		if (!firstEntry) throw new Error("Expected a singleton depreciation entry");
		await worker.post({
			version: 1,
			organizationId,
			assetId: asset.id,
			assetFinanceBookId: soleBook.id,
			scheduleId: schedule.id,
			scheduleEntryId: firstEntry.id,
			depreciationDate: firstEntry.scheduleDate.toISOString().slice(0, 10),
		});
		const afterWorker = await service.findAssetById(asset.id, organizationId);
		if (!afterWorker)
			throw new Error("Singleton asset disappeared after worker post");
		const workerBook = await prisma.client.assetFinanceBook.findUniqueOrThrow({
			where: { id: soleBook.id },
			select: { valueAfterDepreciation: true },
		});
		const workerValue = Number(workerBook.valueAfterDepreciation);
		expect(afterWorker.valueAfterDepreciation).toBeCloseTo(workerValue);

		const adjustedValue = workerValue + 10;
		const adjustment = await service.createAssetValueAdjustment(
			{
				assetId: asset.id,
				adjustmentDate: "2026-08-10",
				newAssetValue: adjustedValue,
				differenceAccount: `R-005 Singleton Revaluation ${suffix}`,
			},
			organizationId,
		);
		const submittedAdjustment = await service.submitAssetValueAdjustment(
			{ id: adjustment.id },
			organizationId,
		);
		expect(submittedAdjustment.financeBookId).toBe(singletonFinanceBookId);
		const afterAdjustment = await service.findAssetById(
			asset.id,
			organizationId,
		);
		if (!afterAdjustment)
			throw new Error("Singleton asset disappeared after adjustment");
		expect(afterAdjustment.valueAfterDepreciation).toBeCloseTo(adjustedValue);
		const adjustedBalance = await readBalance(asset.id);
		expect(adjustedBalance.financeBookId).toBe(singletonFinanceBookId);
		expect(adjustedBalance.carryingValue).toBeCloseTo(adjustedValue);

		await service.cancelAssetValueAdjustment(
			{ id: adjustment.id },
			organizationId,
		);
		const afterCancellation = await service.findAssetById(
			asset.id,
			organizationId,
		);
		if (!afterCancellation)
			throw new Error("Singleton asset disappeared after cancellation");
		expect(afterCancellation.valueAfterDepreciation).toBeCloseTo(workerValue);

		const ambiguous = await prisma.client.asset.create({
			data: {
				series: `R005-AMBIGUOUS-${suffix}`,
				assetName: "R-005 Ambiguous Asset",
				itemCode: `R005-AMBIGUOUS-${suffix}`,
				assetCategoryId: categoryId,
				companyId: singletonCompanyId,
				purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
				netPurchaseAmount: 100,
				calculateDepreciation: true,
				valueAfterDepreciation: 100,
				status: "SUBMITTED",
			},
		});
		await Promise.all([
			prisma.client.assetFinanceBook.create({
				data: {
					assetId: ambiguous.id,
					financeBookId: defaultFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 2,
					frequencyOfDepreciation: 1,
					depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
					valueAfterDepreciation: 50,
				},
			}),
			prisma.client.assetFinanceBook.create({
				data: {
					assetId: ambiguous.id,
					financeBookId: secondaryFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 2,
					frequencyOfDepreciation: 1,
					depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
					valueAfterDepreciation: 50,
				},
			}),
		]);
		await expect(readBalance(ambiguous.id)).rejects.toThrow(
			/explicit finance book|Company default/,
		);
	});

	it("rejects deletion while current or historical Asset-domain lineage remains", async () => {
		const lineageBook = await prisma.client.financeBook.create({
			data: { name: `R-005 Historical Lineage ${suffix}` },
		});
		const asset = await prisma.client.asset.create({
			data: {
				series: `R005-LINEAGE-${suffix}`,
				assetName: "R-005 Historical Asset",
				itemCode: `R005-LINEAGE-${suffix}`,
				assetCategoryId: categoryId,
				companyId,
				purchaseDate: new Date("2026-01-01T00:00:00.000Z"),
				netPurchaseAmount: 1,
				valueAfterDepreciation: 1,
				status: "SUBMITTED",
			},
		});
		const adjustment = await prisma.client.assetValueAdjustment.create({
			data: {
				series: `R005-LINEAGE-AVA-${suffix}`,
				assetId: asset.id,
				financeBookId: lineageBook.id,
				adjustmentDate: new Date("2026-02-01T00:00:00.000Z"),
				currentAssetValue: 1,
				newAssetValue: 1,
				differenceAmount: 0,
				differenceAccount: `R-005 Historical Reserve ${suffix}`,
				fixedAssetAccount: `R-005 Fixed ${suffix}`,
				status: "CANCELLED",
				direction: "INCREASE",
				previousAssetStatus: "SUBMITTED",
			},
		});
		await prisma.client.assetRevaluationEntry.create({
			data: {
				series: `R005-LINEAGE-REV-${suffix}`,
				adjustmentId: adjustment.id,
				assetId: asset.id,
				companyId,
				financeBookId: lineageBook.id,
				postingDate: new Date("2026-02-01T00:00:00.000Z"),
				remarks: "Historical R-005 revaluation",
				status: "REVERSED",
			},
		});
		const accounting = await prisma.client.assetAccountingEntry.create({
			data: {
				series: `R005-LINEAGE-ACC-${suffix}`,
				companyId,
				assetId: asset.id,
				financeBookId: lineageBook.id,
				sourceType: "REPAIR",
				sourceId: `R005-LINEAGE-SOURCE-${suffix}`,
				postingDate: new Date("2026-02-01T00:00:00.000Z"),
				remarks: "Historical R-005 accounting",
				status: "REVERSED",
			},
		});
		const capitalization = await prisma.client.assetCapitalization.create({
			data: {
				series: `R005-LINEAGE-CAP-${suffix}`,
				companyId,
				financeBookId: lineageBook.id,
				postingDate: new Date("2026-02-01T00:00:00.000Z"),
				status: "CANCELLED",
				totalValue: 1,
			},
		});
		await prisma.client.assetCapitalizationAssetItem.create({
			data: {
				capitalizationId: capitalization.id,
				assetId: asset.id,
				financeBookId: lineageBook.id,
				assetValue: 1,
			},
		});
		const disposal = await prisma.client.assetDisposal.create({
			data: {
				series: `R005-LINEAGE-DISP-${suffix}`,
				assetId: asset.id,
				companyId,
				financeBookId: lineageBook.id,
				disposalDate: new Date("2026-02-01T00:00:00.000Z"),
				disposalType: "SCRAP",
				gainLossAmount: 0,
				status: "CANCELLED",
				accountingEntryId: accounting.id,
			},
		});

		await expect(
			service.deleteFinanceBook(lineageBook.id, organizationId),
		).rejects.toThrow("in use");
		const references = await Promise.all([
			prisma.client.assetValueAdjustment.findUniqueOrThrow({
				where: { id: adjustment.id },
				select: { financeBookId: true },
			}),
			prisma.client.assetRevaluationEntry.findFirstOrThrow({
				where: { adjustmentId: adjustment.id },
				select: { financeBookId: true },
			}),
			prisma.client.assetAccountingEntry.findUniqueOrThrow({
				where: { id: accounting.id },
				select: { financeBookId: true },
			}),
			prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: capitalization.id },
				select: { financeBookId: true },
			}),
			prisma.client.assetCapitalizationAssetItem.findFirstOrThrow({
				where: { capitalizationId: capitalization.id },
				select: { financeBookId: true },
			}),
			prisma.client.assetDisposal.findUniqueOrThrow({
				where: { id: disposal.id },
				select: { financeBookId: true },
			}),
		]);
		expect(
			references.every(
				(reference) => reference.financeBookId === lineageBook.id,
			),
		).toBe(true);

		await prisma.client.assetRevaluationEntry.deleteMany({
			where: { adjustmentId: adjustment.id },
		});
		await prisma.client.assetValueAdjustment.delete({
			where: { id: adjustment.id },
		});
		await prisma.client.assetCapitalizationAssetItem.deleteMany({
			where: { capitalizationId: capitalization.id },
		});
		await prisma.client.assetCapitalization.delete({
			where: { id: capitalization.id },
		});
		await prisma.client.assetDisposal.delete({ where: { id: disposal.id } });
		await prisma.client.assetAccountingEntry.delete({
			where: { id: accounting.id },
		});
		await expect(
			service.deleteFinanceBook(lineageBook.id, organizationId),
		).resolves.toEqual({ success: true, id: lineageBook.id });
	});
});
