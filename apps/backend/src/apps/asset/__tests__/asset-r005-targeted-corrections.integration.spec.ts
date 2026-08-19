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
	DepreciationJobData,
	DepreciationScope,
	EnsureDepreciationPostedResult,
} from "../depreciation/depreciation.types";
import type { DepreciationBarrierService } from "../depreciation/depreciation-barrier.service";
import {
	DepreciationPersistenceService,
	type PostDepreciationResult,
} from "../depreciation/depreciation-persistence.service";

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
	postDisposalBarrier(
		tx: Prisma.TransactionClient,
		job: DepreciationJobData,
	): Promise<PostDepreciationResult>;
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
	let categoryName: string;
	let fixedAssetItemCode: string;
	let fixedAssetItemId: string;
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

	const createCompositeTarget = async (label: string): Promise<string> => {
		const target = await prisma.client.asset.create({
			data: {
				series: `R011-${label}-TARGET-${suffix}`,
				assetName: `R-011 ${label} Target`,
				itemCode: `R011-${label}-TARGET-${suffix}`,
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
		return target.id;
	};

	const createExistingTargetCapitalization = (
		label: string,
		sourceAssetId: string,
		targetAssetId: string,
	) =>
		service.createAssetCapitalization(
			{
				companyId,
				financeBookId: secondaryFinanceBookId,
				postingDate: "2026-08-10",
				targetType: "EXISTING_ASSET",
				targetAssetId,
				stockItems: [],
				assetItems: [{ assetId: sourceAssetId, assetValue: 1 }],
				serviceItems: [
					{
						expenseAccount: `R-011 ${label} Service ${suffix}`,
						amount: 10,
					},
				],
			},
			organizationId,
		);

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
		categoryName = category.name;
		const fixedAssetItem = await prisma.inventoryItem.create({
			data: {
				name: `R-011 Capitalization Item ${suffix}`,
				code: `R011-CAP-${suffix}`,
				isFixedAsset: true,
			},
		});
		fixedAssetItemCode = fixedAssetItem.code;
		fixedAssetItemId = fixedAssetItem.id;
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
			postDisposalBarrier: async (tx, job) =>
				worker.postDisposalBarrier(tx, job),
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
			await prisma.client.assetDepreciationJournalEntry.deleteMany({
				where: { companyId: { in: [companyId, singletonCompanyId] } },
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
			await prisma.client.inventoryItem.deleteMany({
				where: { id: fixedAssetItemId },
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

	it("protects a generated capitalization target across delete and cancel races", async () => {
		const source = await createTwoBookAsset("R011-GENERATED", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const draft = await service.createAssetCapitalization(
			{
				companyId,
				financeBookId: secondaryFinanceBookId,
				postingDate: "2026-08-10",
				targetType: "NEW_ASSET",
				targetAssetName: `R-011 Generated Target ${suffix}`,
				targetAssetCategory: categoryName,
				targetItemCode: fixedAssetItemCode,
				stockItems: [],
				assetItems: [{ assetId: source.assetId, assetValue: 1 }],
				serviceItems: [
					{ expenseAccount: `R-011 Service ${suffix}`, amount: 20 },
				],
			},
			organizationId,
		);
		const submitted = await service.submitAssetCapitalization(
			{ id: draft.id },
			organizationId,
		);
		const targetId = submitted.targetAssetId;
		if (!targetId) throw new Error("Expected generated capitalization target");

		await expect(
			service.deleteAsset(targetId, organizationId),
		).rejects.toThrow();
		await expect(
			service.deleteManyAssets([targetId], organizationId),
		).rejects.toThrow();
		await expect(
			prisma.client.$transaction((tx) =>
				tx.asset.delete({ where: { id: targetId } }),
			),
		).rejects.toThrow();

		const [cancelled, deleted] = await Promise.allSettled([
			service.cancelAssetCapitalization({ id: draft.id }, organizationId),
			service.deleteAsset(targetId, organizationId),
		]);
		expect(cancelled.status).toBe("fulfilled");
		expect(deleted.status).toBe("rejected");

		const [capitalization, target] = await Promise.all([
			prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: draft.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: targetId },
				select: { status: true },
			}),
		]);
		expect(capitalization.status).toBe("CANCELLED");
		expect(target.status).toBe("CANCELLED");
		await expect(service.deleteAsset(targetId, organizationId)).rejects.toThrow(
			/linked to capitalization/,
		);
		await expect(
			service.deleteManyAssets([targetId], organizationId),
		).rejects.toThrow(/linked to capitalization/);
		await expect(
			prisma.client.$transaction((tx) =>
				tx.asset.delete({ where: { id: targetId } }),
			),
		).rejects.toThrow();
	});

	it("rejects a later same-date depreciation before capitalization reversal mutates state", async () => {
		const source = await createTwoBookAsset("R011-SAME-DATE", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const target = await prisma.client.asset.create({
			data: {
				series: `R011-SAME-DATE-TARGET-${suffix}`,
				assetName: "R-011 Same-Date Composite Target",
				itemCode: `R011-SAME-DATE-TARGET-${suffix}`,
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
					{ expenseAccount: `R-011 Same-Date Service ${suffix}`, amount: 20 },
				],
			},
			organizationId,
		);
		await service.submitAssetCapitalization({ id: draft.id }, organizationId);
		const persistedCap =
			await prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: draft.id },
				select: { submittedAt: true },
			});
		if (!persistedCap.submittedAt)
			throw new Error("Expected submitted timestamp");
		await prisma.client.assetDepreciationJournalEntry.create({
			data: {
				series: `R011-LATER-DEP-${suffix}`,
				assetId: source.assetId,
				assetFinanceBookId: source.secondaryAssetFinanceBookId,
				companyId,
				financeBookName: `R-005 Secondary ${suffix}`,
				postingDate: new Date("2026-08-10T00:00:00.000Z"),
				depreciationAmount: 1,
				status: "POSTED",
				createdAt: new Date(persistedCap.submittedAt.getTime() + 1_000),
			},
		});

		await expect(
			service.cancelAssetCapitalization({ id: draft.id }, organizationId),
		).rejects.toThrow(/later depreciation posting/);
		const [capitalization, sourceState] = await Promise.all([
			prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: draft.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: source.assetId },
				select: { status: true },
			}),
		]);
		expect(capitalization.status).toBe("SUBMITTED");
		expect(sourceState.status).toBe("CAPITALIZED");
	});

	it("rejects target item identity drift before posting capitalization effects", async () => {
		const source = await createTwoBookAsset("R011-IDENTITY", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const target = await prisma.client.asset.create({
			data: {
				series: `R011-IDENTITY-TARGET-${suffix}`,
				assetName: "R-011 Identity Composite Target",
				itemCode: `R011-IDENTITY-TARGET-${suffix}`,
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
		const draft = await service.createAssetCapitalization(
			{
				companyId,
				financeBookId: defaultFinanceBookId,
				postingDate: "2026-08-10",
				targetType: "EXISTING_ASSET",
				targetAssetId: target.id,
				stockItems: [],
				assetItems: [{ assetId: source.assetId, assetValue: 1 }],
				serviceItems: [
					{ expenseAccount: `R-011 Identity Service ${suffix}`, amount: 20 },
				],
			},
			organizationId,
		);
		await prisma.client.asset.update({
			where: { id: target.id },
			data: { itemCode: `R011-IDENTITY-CHANGED-${suffix}` },
		});

		await expect(
			service.submitAssetCapitalization({ id: draft.id }, organizationId),
		).rejects.toThrow(/draft composite asset/);
		const [capitalization, sourceState] = await Promise.all([
			prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: draft.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: source.assetId },
				select: { status: true },
			}),
		]);
		expect(capitalization.status).toBe("DRAFT");
		expect(sourceState.status).toBe("PARTIALLY_DEPRECIATED");
	});

	it("rejects a capitalization whose accounting pointer has been replaced", async () => {
		const source = await createTwoBookAsset("R011-AAE", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const target = await prisma.client.asset.create({
			data: {
				series: `R011-AAE-TGT-${suffix}`,
				assetName: "R-011 Accounting Lineage Target",
				itemCode: `R011-AAE-TGT-${suffix}`,
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
					{ expenseAccount: `R-011 AAE Service ${suffix}`, amount: 20 },
				],
			},
			organizationId,
		);
		await service.submitAssetCapitalization({ id: draft.id }, organizationId);
		const originalAccounting =
			await prisma.client.assetAccountingEntry.findUniqueOrThrow({
				where: {
					sourceType_sourceId: {
						sourceType: "CAPITALIZATION",
						sourceId: draft.id,
					},
				},
				include: { lines: true },
			});
		const replacement = await prisma.client.assetAccountingEntry.create({
			data: {
				series: `R011-WRONG-AAE-${suffix}`,
				companyId,
				assetId: target.id,
				financeBookId: secondaryFinanceBookId,
				sourceType: "REPAIR",
				sourceId: `R011-WRONG-AAE-SOURCE-${suffix}`,
				postingDate: originalAccounting.postingDate,
				remarks: "R-011 malformed accounting lineage",
				status: "POSTED",
				lines: {
					create: [
						{
							lineType: "DEBIT",
							account: `R-011 Wrong Debit ${suffix}`,
							debitAmount: 1,
							creditAmount: 0,
						},
						{
							lineType: "CREDIT",
							account: `R-011 Wrong Credit ${suffix}`,
							debitAmount: 0,
							creditAmount: 1,
						},
					],
				},
			},
		});
		await prisma.client.assetCapitalization.update({
			where: { id: draft.id },
			data: { accountingEntryId: replacement.id },
		});

		await expect(
			service.cancelAssetCapitalization({ id: draft.id }, organizationId),
		).rejects.toThrow(/accounting lineage/);
		const [capitalization, sourceState] = await Promise.all([
			prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: draft.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: source.assetId },
				select: { status: true },
			}),
		]);
		expect(capitalization.status).toBe("SUBMITTED");
		expect(sourceState.status).toBe("CAPITALIZED");
	});

	it("resolves the selected disposal book before the barrier and restores only that book", async () => {
		const fixture = await createTwoBookAsset("DISPOSAL", {
			rootValue: 100,
			secondaryValue: 80,
		});
		const secondarySchedule =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: { assetFinanceBookId: fixture.secondaryAssetFinanceBookId },
				include: { entries: { orderBy: { sequence: "asc" } } },
			});
		const firstEntry = secondarySchedule.entries[0];
		if (!firstEntry) throw new Error("Expected the first disposal period");
		await worker.post({
			version: 1,
			organizationId,
			assetId: fixture.assetId,
			assetFinanceBookId: fixture.secondaryAssetFinanceBookId,
			scheduleId: secondarySchedule.id,
			scheduleEntryId: firstEntry.id,
			depreciationDate: firstEntry.scheduleDate.toISOString().slice(0, 10),
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
			Number(
				postedState.financeBooks.find(
					(book) => book.financeBookId === secondaryFinanceBookId,
				)?.valueAfterDepreciation,
			),
		).toBe(67.1);
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
			Number(
				restored.financeBooks.find(
					(book) => book.financeBookId === secondaryFinanceBookId,
				)?.valueAfterDepreciation,
			),
		).toBe(70);
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

	it("synchronizes an existing target book through capitalization, reload, revision, and posting", async () => {
		const source = await createTwoBookAsset("EXIST", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const shiftAllocations = [
			{ periodIndex: 0, shift: "Single", factor: 1 },
			{ periodIndex: 1, shift: "Double", factor: 2 },
			{ periodIndex: 2, shift: "Single", factor: 1 },
		];
		await prisma.client.assetFinanceBook.update({
			where: {
				assetId_financeBookId: {
					assetId: source.assetId,
					financeBookId: secondaryFinanceBookId,
				},
			},
			data: {
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 1,
				dailyProrataBased: true,
				shiftBased: true,
				precision: 3,
				ratePrecision: 3,
				calculateUsingTotalDays: false,
				shiftAllocations: {
					deleteMany: {},
					create: shiftAllocations,
				},
			},
		});
		const target = await prisma.client.asset.create({
			data: {
				series: `R009-CAP-TARGET-${suffix}`,
				assetName: "R-009 Existing Target",
				itemCode: `R009-CAP-TARGET-${suffix}`,
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
		const staleBook = await prisma.client.assetFinanceBook.create({
			data: {
				assetId: target.id,
				financeBookId: secondaryFinanceBookId,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				totalNumberOfDepreciations: 5,
				frequencyOfDepreciation: 12,
				dailyProrataBased: false,
				shiftBased: false,
				precision: 2,
				ratePrecision: 2,
				calculateUsingTotalDays: false,
				rateOfDepreciation: 5,
				expectedValueAfterUsefulLife: 20,
				depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
				valueAfterDepreciation: 0,
			},
		});

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
					{ expenseAccount: `R-009 Service ${suffix}`, amount: 1.234567 },
				],
			},
			organizationId,
		);
		await service.submitAssetCapitalization({ id: draft.id }, organizationId);

		const reloadedBook = await prisma.client.assetFinanceBook.findUniqueOrThrow(
			{
				where: { id: staleBook.id },
				include: {
					shiftAllocations: { orderBy: { periodIndex: "asc" } },
					schedules: {
						where: { status: "ACTIVE" },
						include: { entries: { orderBy: { sequence: "asc" } } },
					},
				},
			},
		);
		const reloadedSchedule = reloadedBook.schedules[0];
		if (!reloadedSchedule) throw new Error("Expected synchronized schedule");
		expect(reloadedBook.depreciationMethod).toBe("STRAIGHT_LINE");
		expect(reloadedBook.totalNumberOfDepreciations).toBe(3);
		expect(reloadedBook.frequencyOfDepreciation).toBe(1);
		expect(reloadedBook.dailyProrataBased).toBe(true);
		expect(reloadedBook.shiftBased).toBe(true);
		expect(reloadedBook.precision).toBe(3);
		expect(reloadedBook.ratePrecision).toBe(3);
		expect(reloadedBook.calculateUsingTotalDays).toBe(false);
		expect(reloadedBook.openingAccumulatedDepreciation.toNumber()).toBe(0);
		expect(reloadedBook.totalNumberOfBookedDepreciations).toBe(0);
		expect(
			reloadedBook.shiftAllocations.map((row) => [
				row.periodIndex,
				row.shift,
				Number(row.factor),
			]),
		).toEqual(
			shiftAllocations.map((row) => [row.periodIndex, row.shift, row.factor]),
		);
		expect({
			depreciationMethod: reloadedSchedule.depreciationMethod,
			totalNumberOfDepreciations: reloadedSchedule.totalNumberOfDepreciations,
			frequencyOfDepreciation: reloadedSchedule.frequencyOfDepreciation,
			dailyProrataBased: reloadedSchedule.dailyProrataBased,
			shiftBased: reloadedSchedule.shiftBased,
			precision: reloadedSchedule.precision,
			ratePrecision: reloadedSchedule.ratePrecision,
			calculateUsingTotalDays: reloadedSchedule.calculateUsingTotalDays,
		}).toEqual({
			depreciationMethod: reloadedBook.depreciationMethod,
			totalNumberOfDepreciations: reloadedBook.totalNumberOfDepreciations,
			frequencyOfDepreciation: reloadedBook.frequencyOfDepreciation,
			dailyProrataBased: reloadedBook.dailyProrataBased,
			shiftBased: reloadedBook.shiftBased,
			precision: reloadedBook.precision,
			ratePrecision: reloadedBook.ratePrecision,
			calculateUsingTotalDays: reloadedBook.calculateUsingTotalDays,
		});
		expect(reloadedSchedule.entries.map((entry) => entry.shift)).toEqual([
			"Single",
			"Double",
			"Single",
			"Single",
		]);

		const firstEntry = reloadedSchedule.entries[0];
		if (!firstEntry) throw new Error("Expected a synchronized schedule entry");
		await expect(
			worker.post({
				version: 1,
				organizationId,
				sourceCapitalizationId: "wrong-capitalization-lineage",
				assetId: target.id,
				assetFinanceBookId: reloadedBook.id,
				scheduleId: reloadedSchedule.id,
				scheduleEntryId: firstEntry.id,
				depreciationDate: firstEntry.scheduleDate.toISOString().slice(0, 10),
			}),
		).rejects.toThrow(/mismatched capitalization lineage/);
		const posting = await worker.post({
			version: 1,
			organizationId,
			sourceCapitalizationId: draft.id,
			assetId: target.id,
			assetFinanceBookId: reloadedBook.id,
			scheduleId: reloadedSchedule.id,
			scheduleEntryId: firstEntry.id,
			depreciationDate: firstEntry.scheduleDate.toISOString().slice(0, 10),
		});
		if (posting.status !== "posted") throw new Error("Expected target posting");
		const journal =
			await prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: posting.postingId },
			});
		expect(Number(journal.depreciationAmount)).toBe(
			Number(firstEntry.depreciationAmount),
		);
		expect(journal.sourceCapitalizationId).toBe(draft.id);

		const postedEntryBeforeRetry =
			await prisma.client.assetDepreciationScheduleEntry.findUniqueOrThrow({
				where: { id: firstEntry.id },
				select: { postingId: true, postedAt: true },
			});
		await expect(
			worker.post({
				version: 1,
				organizationId,
				sourceCapitalizationId: "wrong-capitalization-lineage-retry",
				assetId: target.id,
				assetFinanceBookId: reloadedBook.id,
				scheduleId: reloadedSchedule.id,
				scheduleEntryId: firstEntry.id,
				depreciationDate: firstEntry.scheduleDate.toISOString().slice(0, 10),
			}),
		).rejects.toThrow(/mismatched capitalization lineage/);
		expect(
			await prisma.client.assetDepreciationScheduleEntry.findUniqueOrThrow({
				where: { id: firstEntry.id },
				select: { postingId: true, postedAt: true },
			}),
		).toEqual(postedEntryBeforeRetry);

		const idempotentRetry = await worker.post({
			version: 1,
			organizationId,
			sourceCapitalizationId: draft.id,
			assetId: target.id,
			assetFinanceBookId: reloadedBook.id,
			scheduleId: reloadedSchedule.id,
			scheduleEntryId: firstEntry.id,
			depreciationDate: firstEntry.scheduleDate.toISOString().slice(0, 10),
		});
		expect(idempotentRetry).toEqual({
			status: "already-posted",
			postingId: posting.postingId,
		});

		await prisma.client.assetDepreciationSchedule.update({
			where: { id: reloadedSchedule.id },
			data: { sourceCapitalizationId: null },
		});
		await prisma.client.assetDepreciationScheduleEntry.update({
			where: { id: firstEntry.id },
			data: { postingId: null, postedAt: null },
		});
		const nullLineageEntryBefore =
			await prisma.client.assetDepreciationScheduleEntry.findUniqueOrThrow({
				where: { id: firstEntry.id },
				select: { postingId: true, postedAt: true },
			});
		const journalBeforeNullLineage =
			await prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: posting.postingId },
				select: { sourceCapitalizationId: true, status: true },
			});
		await expect(
			worker.post({
				version: 1,
				organizationId,
				assetId: target.id,
				assetFinanceBookId: reloadedBook.id,
				scheduleId: reloadedSchedule.id,
				scheduleEntryId: firstEntry.id,
				depreciationDate: firstEntry.scheduleDate.toISOString().slice(0, 10),
			}),
		).rejects.toThrow(/mismatched capitalization lineage/);
		expect(
			await prisma.client.assetDepreciationScheduleEntry.findUniqueOrThrow({
				where: { id: firstEntry.id },
				select: { postingId: true, postedAt: true },
			}),
		).toEqual(nullLineageEntryBefore);
		expect(
			await prisma.client.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: posting.postingId },
				select: { sourceCapitalizationId: true, status: true },
			}),
		).toEqual(journalBeforeNullLineage);
		await prisma.client.assetDepreciationSchedule.update({
			where: { id: reloadedSchedule.id },
			data: { sourceCapitalizationId: draft.id },
		});
		await prisma.client.assetDepreciationScheduleEntry.update({
			where: { id: firstEntry.id },
			data: { postingId: posting.postingId, postedAt: new Date() },
		});

		const revisions = await prisma.client.$transaction((tx) =>
			new AssetDepreciationRevisionService().revise(tx, organizationId, {
				assetId: target.id,
				financeBookId: secondaryFinanceBookId,
				effectiveDate: new Date("2026-08-11T00:00:00.000Z"),
				valueDelta: 0,
				usefulLifeDeltaMonths: 0,
			}),
		);
		expect(revisions).toHaveLength(1);
		const successor =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: { assetFinanceBookId: reloadedBook.id, status: "ACTIVE" },
				include: { entries: { orderBy: { sequence: "asc" } } },
			});
		expect(successor.shiftBased).toBe(true);
		expect(successor.dailyProrataBased).toBe(true);
		expect(successor.precision).toBe(3);
		expect(successor.ratePrecision).toBe(3);
		expect(successor.entries[0]?.shift).toBe("Double");
	});

	it("fails closed when the persisted source schedule closure marker is missing", async () => {
		const source = await createTwoBookAsset("B01-MISSING", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const targetId = await createCompositeTarget("B01-MISSING");
		const draft = await createExistingTargetCapitalization(
			"B01 Missing",
			source.assetId,
			targetId,
		);
		await service.submitAssetCapitalization({ id: draft.id }, organizationId);

		const sourceSchedule =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: {
					assetId: source.assetId,
					assetFinanceBookId: source.secondaryAssetFinanceBookId,
				},
				select: { id: true, status: true, closedByCapitalizationId: true },
			});
		const sourceItem =
			await prisma.client.assetCapitalizationAssetItem.findFirstOrThrow({
				where: { capitalizationId: draft.id, assetId: source.assetId },
				select: { closedScheduleId: true },
			});
		expect(sourceItem.closedScheduleId).toBe(sourceSchedule.id);
		expect(sourceSchedule.status).toBe("CANCELLED");
		expect(sourceSchedule.closedByCapitalizationId).toBe(draft.id);

		const [
			sourceBefore,
			sourceBookBefore,
			targetBefore,
			targetBookBefore,
			capBefore,
			accountingBefore,
			activityCountBefore,
		] = await Promise.all([
			prisma.client.asset.findUniqueOrThrow({
				where: { id: source.assetId },
				select: { status: true, disposalDate: true },
			}),
			prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: { id: source.secondaryAssetFinanceBookId },
				select: {
					valueAfterDepreciation: true,
					totalNumberOfBookedDepreciations: true,
					stateVersion: true,
					postingStatus: true,
				},
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: targetId },
				select: {
					status: true,
					netPurchaseAmount: true,
					valueAfterDepreciation: true,
				},
			}),
			prisma.client.assetFinanceBook.findFirstOrThrow({
				where: { assetId: targetId, financeBookId: secondaryFinanceBookId },
				select: {
					valueAfterDepreciation: true,
					stateVersion: true,
					postingStatus: true,
				},
			}),
			prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: draft.id },
				select: { status: true, accountingEntryId: true, stockEntryId: true },
			}),
			prisma.client.assetAccountingEntry.findFirstOrThrow({
				where: { sourceType: "CAPITALIZATION", sourceId: draft.id },
				select: { id: true, status: true },
			}),
			prisma.client.assetActivity.count({
				where: { assetId: { in: [source.assetId, targetId] } },
			}),
		]);

		await prisma.client.assetDepreciationSchedule.update({
			where: { id: sourceSchedule.id },
			data: { closedByCapitalizationId: null },
		});
		await expect(
			service.cancelAssetCapitalization({ id: draft.id }, organizationId),
		).rejects.toThrow(/schedule closure lineage/);

		expect(
			await prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: draft.id },
				select: { status: true, accountingEntryId: true, stockEntryId: true },
			}),
		).toEqual(capBefore);
		expect(
			await prisma.client.asset.findUniqueOrThrow({
				where: { id: source.assetId },
				select: { status: true, disposalDate: true },
			}),
		).toEqual(sourceBefore);
		expect(
			await prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: { id: source.secondaryAssetFinanceBookId },
				select: {
					valueAfterDepreciation: true,
					totalNumberOfBookedDepreciations: true,
					stateVersion: true,
					postingStatus: true,
				},
			}),
		).toEqual(sourceBookBefore);
		expect(
			await prisma.client.asset.findUniqueOrThrow({
				where: { id: targetId },
				select: {
					status: true,
					netPurchaseAmount: true,
					valueAfterDepreciation: true,
				},
			}),
		).toEqual(targetBefore);
		expect(
			await prisma.client.assetFinanceBook.findFirstOrThrow({
				where: { assetId: targetId, financeBookId: secondaryFinanceBookId },
				select: {
					valueAfterDepreciation: true,
					stateVersion: true,
					postingStatus: true,
				},
			}),
		).toEqual(targetBookBefore);
		expect(
			await prisma.client.assetAccountingEntry.findFirstOrThrow({
				where: { sourceType: "CAPITALIZATION", sourceId: draft.id },
				select: { id: true, status: true },
			}),
		).toEqual(accountingBefore);
		expect(
			await prisma.client.assetActivity.count({
				where: { assetId: { in: [source.assetId, targetId] } },
			}),
		).toBe(activityCountBefore);
		expect(
			await prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
				where: { id: sourceSchedule.id },
				select: { status: true, closedByCapitalizationId: true },
			}),
		).toEqual({ status: "CANCELLED", closedByCapitalizationId: null });
	});

	it("fails closed when a generated target schedule points at another Asset", async () => {
		const source = await createTwoBookAsset("B02-TARGET", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const targetId = await createCompositeTarget("B02-TARGET");
		const draft = await createExistingTargetCapitalization(
			"B02 Target",
			source.assetId,
			targetId,
		);
		await service.submitAssetCapitalization({ id: draft.id }, organizationId);
		const generatedSchedule =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: { sourceCapitalizationId: draft.id },
				select: {
					id: true,
					assetId: true,
					assetFinanceBookId: true,
					status: true,
					sourceCapitalizationId: true,
				},
			});
		await prisma.client.assetDepreciationSchedule.update({
			where: { id: generatedSchedule.id },
			data: { assetId: source.assetId },
		});

		await expect(
			service.cancelAssetCapitalization({ id: draft.id }, organizationId),
		).rejects.toThrow(/schedule lineage/);
		expect(
			await prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
				where: { id: generatedSchedule.id },
				select: {
					assetId: true,
					assetFinanceBookId: true,
					status: true,
					sourceCapitalizationId: true,
				},
			}),
		).toEqual({
			assetId: source.assetId,
			assetFinanceBookId: generatedSchedule.assetFinanceBookId,
			status: generatedSchedule.status,
			sourceCapitalizationId: draft.id,
		});
		expect(
			await prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: draft.id },
				select: { status: true },
			}),
		).toEqual({ status: "SUBMITTED" });
	});

	it("fails closed when a source closed schedule points at another Asset", async () => {
		const source = await createTwoBookAsset("B02-SOURCE", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const targetId = await createCompositeTarget("B02-SOURCE");
		const draft = await createExistingTargetCapitalization(
			"B02 Source",
			source.assetId,
			targetId,
		);
		await service.submitAssetCapitalization({ id: draft.id }, organizationId);
		const sourceSchedule =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: {
					assetId: source.assetId,
					assetFinanceBookId: source.secondaryAssetFinanceBookId,
				},
				select: { id: true, assetFinanceBookId: true, status: true },
			});
		await prisma.client.assetDepreciationSchedule.update({
			where: { id: sourceSchedule.id },
			data: { assetId: targetId },
		});

		await expect(
			service.cancelAssetCapitalization({ id: draft.id }, organizationId),
		).rejects.toThrow(/schedule closure lineage/);
		expect(
			await prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
				where: { id: sourceSchedule.id },
				select: { assetId: true, assetFinanceBookId: true, status: true },
			}),
		).toEqual({
			assetId: targetId,
			assetFinanceBookId: sourceSchedule.assetFinanceBookId,
			status: sourceSchedule.status,
		});
		expect(
			await prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: draft.id },
				select: { status: true },
			}),
		).toEqual({ status: "SUBMITTED" });
	});

	it("fails closed when a source closed schedule points at another FinanceBook", async () => {
		const source = await createTwoBookAsset("B02-BOOK", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const targetId = await createCompositeTarget("B02-BOOK");
		const draft = await createExistingTargetCapitalization(
			"B02 Book",
			source.assetId,
			targetId,
		);
		await service.submitAssetCapitalization({ id: draft.id }, organizationId);
		const sourceSchedule =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: {
					assetId: source.assetId,
					assetFinanceBookId: source.secondaryAssetFinanceBookId,
				},
				select: { id: true, assetId: true, status: true },
			});
		await prisma.client.assetDepreciationSchedule.update({
			where: { id: sourceSchedule.id },
			data: { assetFinanceBookId: source.defaultAssetFinanceBookId },
		});

		await expect(
			service.cancelAssetCapitalization({ id: draft.id }, organizationId),
		).rejects.toThrow(/schedule closure lineage/);
		expect(
			await prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
				where: { id: sourceSchedule.id },
				select: { assetId: true, assetFinanceBookId: true, status: true },
			}),
		).toEqual({
			assetId: sourceSchedule.assetId,
			assetFinanceBookId: source.defaultAssetFinanceBookId,
			status: sourceSchedule.status,
		});
		expect(
			await prisma.client.assetCapitalization.findUniqueOrThrow({
				where: { id: draft.id },
				select: { status: true },
			}),
		).toEqual({ status: "SUBMITTED" });
	});

	it("restores an existing target book exactly when capitalization is cancelled", async () => {
		const source = await createTwoBookAsset("R011-EXC", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const generatedShiftAllocations = [
			{ periodIndex: 0, shift: "Single", factor: 1 },
			{ periodIndex: 1, shift: "Double", factor: 2 },
			{ periodIndex: 2, shift: "Single", factor: 1 },
		];
		await prisma.client.assetFinanceBook.update({
			where: { id: source.secondaryAssetFinanceBookId },
			data: {
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 1,
				dailyProrataBased: true,
				shiftBased: true,
				precision: 3,
				ratePrecision: 3,
				shiftAllocations: {
					deleteMany: {},
					create: generatedShiftAllocations,
				},
			},
		});
		const target = await prisma.client.asset.create({
			data: {
				series: `R011-EXC-TGT-${suffix}`,
				assetName: "R-011 Existing Cancellation Target",
				itemCode: `R011-EXISTING-CANCEL-TARGET-${suffix}`,
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
		const previousLastPostedDate = new Date("2026-07-01T00:00:00.000Z");
		const legacyShiftAllocations = [
			{ periodIndex: 0, shift: "Legacy", factor: 0.5 },
		];
		const existingTargetBook = await prisma.client.assetFinanceBook.create({
			data: {
				assetId: target.id,
				financeBookId: secondaryFinanceBookId,
				stateVersion: 4,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				totalNumberOfDepreciations: 5,
				increaseInAssetLife: 2,
				frequencyOfDepreciation: 12,
				dailyProrataBased: false,
				shiftBased: false,
				precision: 2,
				ratePrecision: 2,
				calculateUsingTotalDays: true,
				rateOfDepreciation: 5,
				expectedValueAfterUsefulLife: 20,
				depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
				openingAccumulatedDepreciation: 3,
				openingNumberOfBookedDepreciations: 2,
				valueAfterDepreciation: 7,
				totalNumberOfBookedDepreciations: 2,
				postingStatus: "PARTIALLY_DEPRECIATED",
				lastPostedDepreciationDate: previousLastPostedDate,
				shiftAllocations: { create: legacyShiftAllocations },
			},
		});

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
					{
						expenseAccount: `R-011 Existing Cancel Service ${suffix}`,
						amount: 10,
					},
				],
			},
			organizationId,
		);
		await service.submitAssetCapitalization({ id: draft.id }, organizationId);
		const persistedSourceSchedule =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: {
					assetId: source.assetId,
					assetFinanceBookId: source.secondaryAssetFinanceBookId,
				},
				select: { id: true, status: true, closedByCapitalizationId: true },
			});
		const persistedSourceItem =
			await prisma.client.assetCapitalizationAssetItem.findFirstOrThrow({
				where: { capitalizationId: draft.id, assetId: source.assetId },
				select: { closedScheduleId: true },
			});
		expect(persistedSourceItem.closedScheduleId).toBe(
			persistedSourceSchedule.id,
		);
		expect(persistedSourceSchedule.status).toBe("CANCELLED");
		expect(persistedSourceSchedule.closedByCapitalizationId).toBe(draft.id);
		await service.cancelAssetCapitalization({ id: draft.id }, organizationId);

		const restoredBook = await prisma.client.assetFinanceBook.findUniqueOrThrow(
			{
				where: { id: existingTargetBook.id },
				include: { shiftAllocations: { orderBy: { periodIndex: "asc" } } },
			},
		);
		expect(restoredBook.stateVersion).toBe(4);
		expect(restoredBook.depreciationMethod).toBe("WRITTEN_DOWN_VALUE");
		expect(restoredBook.totalNumberOfDepreciations).toBe(5);
		expect(restoredBook.increaseInAssetLife).toBe(2);
		expect(restoredBook.frequencyOfDepreciation).toBe(12);
		expect(restoredBook.calculateUsingTotalDays).toBe(true);
		expect(Number(restoredBook.rateOfDepreciation)).toBe(5);
		expect(Number(restoredBook.expectedValueAfterUsefulLife)).toBe(20);
		expect(Number(restoredBook.openingAccumulatedDepreciation)).toBe(3);
		expect(restoredBook.openingNumberOfBookedDepreciations).toBe(2);
		expect(Number(restoredBook.valueAfterDepreciation)).toBe(7);
		expect(restoredBook.totalNumberOfBookedDepreciations).toBe(2);
		expect(restoredBook.postingStatus).toBe("PARTIALLY_DEPRECIATED");
		expect(restoredBook.lastPostedDepreciationDate).toEqual(
			previousLastPostedDate,
		);
		expect(
			restoredBook.shiftAllocations.map((row) => [
				row.periodIndex,
				row.shift,
				Number(row.factor),
			]),
		).toEqual([[0, "Legacy", 0.5]]);

		const [restoredTarget, restoredSourceSchedule, cancelled] =
			await Promise.all([
				prisma.client.asset.findUniqueOrThrow({
					where: { id: target.id },
					select: {
						status: true,
						calculateDepreciation: true,
						netPurchaseAmount: true,
						valueAfterDepreciation: true,
					},
				}),
				prisma.client.assetDepreciationSchedule.findFirstOrThrow({
					where: {
						assetFinanceBookId: source.secondaryAssetFinanceBookId,
					},
					select: { status: true, closedByCapitalizationId: true },
				}),
				prisma.client.assetCapitalization.findUniqueOrThrow({
					where: { id: draft.id },
					select: { status: true },
				}),
			]);
		expect(restoredTarget.status).toBe("DRAFT");
		expect(restoredTarget.calculateDepreciation).toBe(false);
		expect(Number(restoredTarget.netPurchaseAmount)).toBe(0);
		expect(Number(restoredTarget.valueAfterDepreciation)).toBe(0);
		expect(restoredSourceSchedule.status).toBe("ACTIVE");
		expect(restoredSourceSchedule.closedByCapitalizationId).toBe(draft.id);
		expect(cancelled.status).toBe("CANCELLED");
	});

	it("uses selected root-book precision for capitalization accounting", async () => {
		const source = await createTwoBookAsset("ROOT", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const target = await prisma.client.asset.create({
			data: {
				series: `R009-ROOT-TARGET-${suffix}`,
				assetName: "R-009 Root Precision Target",
				itemCode: `R009-ROOT-TARGET-${suffix}`,
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
		await prisma.client.assetFinanceBook.create({
			data: {
				assetId: target.id,
				financeBookId: defaultFinanceBookId,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 2,
				frequencyOfDepreciation: 1,
				precision: 3,
				ratePrecision: 3,
				depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
				valueAfterDepreciation: 0,
			},
		});
		const draft = await service.createAssetCapitalization(
			{
				companyId,
				financeBookId: defaultFinanceBookId,
				postingDate: "2026-08-10",
				targetType: "EXISTING_ASSET",
				targetAssetId: target.id,
				stockItems: [],
				assetItems: [{ assetId: source.assetId, assetValue: 1 }],
				serviceItems: [
					{ expenseAccount: `R-009 Root Service ${suffix}`, amount: 1.234567 },
				],
			},
			organizationId,
		);
		await service.submitAssetCapitalization({ id: draft.id }, organizationId);
		const accounting =
			await prisma.client.assetAccountingEntry.findUniqueOrThrow({
				where: {
					sourceType_sourceId: {
						sourceType: "CAPITALIZATION",
						sourceId: draft.id,
					},
				},
				include: { lines: true },
			});
		const lines = accounting.lines.map((line) => [
			line.account,
			Number(line.debitAmount),
			Number(line.creditAmount),
		]);
		expect(lines).toContainEqual([`R-009 Root Service ${suffix}`, 0, 1.235]);
		expect(lines).toContainEqual([`R-005 Fixed Asset ${suffix}`, 121.235, 0]);
	});

	it("rejects replacement of an existing target book with schedule history", async () => {
		const source = await createTwoBookAsset("HIST", {
			rootValue: 120,
			secondaryValue: 100,
		});
		const target = await prisma.client.asset.create({
			data: {
				series: `R009-HISTORY-TARGET-${suffix}`,
				assetName: "R-009 History Target",
				itemCode: `R009-HISTORY-TARGET-${suffix}`,
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
		const staleBook = await prisma.client.assetFinanceBook.create({
			data: {
				assetId: target.id,
				financeBookId: secondaryFinanceBookId,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 2,
				frequencyOfDepreciation: 1,
				depreciationStartDate: new Date("2026-01-01T00:00:00.000Z"),
				valueAfterDepreciation: 0,
			},
		});
		await createSchedule(target.id, staleBook.id, 0);
		const draft = await service.createAssetCapitalization(
			{
				companyId,
				financeBookId: secondaryFinanceBookId,
				postingDate: "2026-08-10",
				targetType: "EXISTING_ASSET",
				targetAssetId: target.id,
				stockItems: [],
				assetItems: [{ assetId: source.assetId, assetValue: 1 }],
				serviceItems: [],
			},
			organizationId,
		);
		await expect(
			service.submitAssetCapitalization({ id: draft.id }, organizationId),
		).rejects.toThrow("already has state in finance book");
		expect(
			await prisma.client.assetDepreciationSchedule.count({
				where: { assetFinanceBookId: staleBook.id },
			}),
		).toBe(1);
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
