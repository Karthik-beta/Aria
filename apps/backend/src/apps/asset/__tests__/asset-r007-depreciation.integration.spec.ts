import type { Asset } from "@aria/types";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetDepreciationLifecycleService } from "../depreciation/asset-depreciation-lifecycle.service";
import { DEPRECIATION_JOB_VERSION } from "../depreciation/depreciation.constants";
import { DepreciationPersistenceService } from "../depreciation/depreciation-persistence.service";

/**
 * Proves R-007 through the real lifecycle and posting services on PostgreSQL.
 * Each test owns its Asset rows; the database itself is supplied by the
 * disposable validation harness rather than the developer database.
 */
describe("R-007 depreciation basis and finite WDV integration", () => {
	let prisma: PrismaService;
	let lifecycle: AssetDepreciationLifecycleService;
	let worker: DepreciationPersistenceService;
	let organizationId: string;
	let companyId: string;
	let categoryId: string;
	let defaultFinanceBookId: string;
	let secondaryFinanceBookId: string;
	let suffix: string;
	const assetIds: string[] = [];

	const makeBookConfiguration = (
		financeBookId: string,
		overrides: Partial<Asset.AssetFinanceBookInput> = {},
	): Asset.AssetFinanceBookInput => ({
		financeBookId,
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 3,
		frequencyOfDepreciation: 12,
		depreciationStartDate: "2031-12-31",
		expectedValueAfterUsefulLife: 100,
		openingAccumulatedDepreciation: 200,
		openingNumberOfBookedDepreciations: 1,
		...overrides,
	});

	const createAsset = async (label: string, amount = 1_000) => {
		const asset = await prisma.asset.create({
			data: {
				series: `R007-${label}-${suffix}`,
				assetName: `R-007 ${label}`,
				itemCode: `R007-${label}-${suffix}`,
				assetCategoryId: categoryId,
				companyId,
				purchaseDate: new Date("2030-01-01T00:00:00.000Z"),
				availableForUseDate: new Date("2030-01-01T00:00:00.000Z"),
				netPurchaseAmount: amount,
				calculateDepreciation: true,
				valueAfterDepreciation: amount,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 12,
				depreciationStartDate: new Date("2031-12-31T00:00:00.000Z"),
				status: "SUBMITTED",
			},
		});
		assetIds.push(asset.id);
		return asset;
	};

	const loadBook = async (assetId: string, financeBookId: string) =>
		prisma.assetFinanceBook.findFirstOrThrow({
			where: { assetId, financeBookId },
			include: {
				schedules: {
					where: { status: { in: ["DRAFT", "ACTIVE"] } },
					include: { entries: { orderBy: { sequence: "asc" } } },
				},
			},
		});

	const loadActiveSchedule = async (assetId: string, financeBookId: string) => {
		const book = await loadBook(assetId, financeBookId);
		const schedule = book.schedules.find(
			(candidate) => candidate.status === "ACTIVE",
		);
		if (!schedule) throw new Error(`No active schedule for ${financeBookId}`);
		return { book, schedule };
	};

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();
		suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const organization = await prisma.organization.create({
			data: {
				name: `R-007 Organization ${suffix}`,
				slug: `r007-${suffix}`,
			},
		});
		organizationId = organization.id;

		const [defaultBook, secondaryBook] = await Promise.all([
			prisma.financeBook.create({ data: { name: `R-007 Default ${suffix}` } }),
			prisma.financeBook.create({
				data: { name: `R-007 Secondary ${suffix}` },
			}),
		]);
		defaultFinanceBookId = defaultBook.id;
		secondaryFinanceBookId = secondaryBook.id;

		const company = await prisma.company.create({
			data: {
				organizationId,
				name: `R-007 Company ${suffix}`,
				defaultFinanceBookId,
				defaultCostCenter: `R-007 Cost Center ${suffix}`,
				accumulatedDepreciationAccount: `R-007 Accumulated ${suffix}`,
				depreciationExpenseAccount: `R-007 Expense ${suffix}`,
			},
		});
		companyId = company.id;

		const category = await prisma.assetCategory.create({
			data: {
				name: `R-007 Category ${suffix}`,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 12,
				expectedValueAfterUsefulLife: 100,
			},
		});
		categoryId = category.id;
		await prisma.assetCategoryAccount.create({
			data: {
				assetCategoryId: categoryId,
				companyId,
				fixedAssetAccount: `R-007 Fixed ${suffix}`,
				accumulatedDepreciationAccount: `R-007 Accumulated ${suffix}`,
				depreciationExpenseAccount: `R-007 Expense ${suffix}`,
			},
		});

		lifecycle = new AssetDepreciationLifecycleService(prisma);
		worker = new DepreciationPersistenceService(prisma);
	});

	afterEach(async () => {
		if (assetIds.length === 0) return;
		const ids = [...assetIds];
		await prisma.assetDepreciationJournalEntry.deleteMany({
			where: { assetId: { in: ids } },
		});
		await prisma.assetDepreciationSchedule.deleteMany({
			where: { assetId: { in: ids } },
		});
		await prisma.assetFinanceBook.deleteMany({
			where: { assetId: { in: ids } },
		});
		await prisma.asset.deleteMany({ where: { id: { in: ids } } });
		assetIds.length = 0;
	});

	afterAll(async () => {
		if (!prisma) return;
		try {
			await prisma.assetCategoryAccount.deleteMany({
				where: { assetCategoryId: categoryId },
			});
			await prisma.assetCategory.delete({ where: { id: categoryId } });
			await prisma.company.update({
				where: { id: companyId },
				data: { defaultFinanceBookId: null },
			});
			await prisma.company.delete({ where: { id: companyId } });
			await prisma.organization.delete({ where: { id: organizationId } });
			await prisma.financeBook.deleteMany({
				where: { id: { in: [defaultFinanceBookId, secondaryFinanceBookId] } },
			});
		} finally {
			await prisma.onModuleDestroy();
		}
	});

	it("A persists the remaining straight-line basis after opening depreciation", async () => {
		const asset = await createAsset("A-opening");
		await lifecycle.configureAssetBooks(
			asset.id,
			[makeBookConfiguration(defaultFinanceBookId)],
			organizationId,
		);

		const { book, schedule } = await loadActiveSchedule(
			asset.id,
			defaultFinanceBookId,
		);
		const entries = schedule.entries.map((entry) => [
			Number(entry.depreciationAmount),
			Number(entry.accumulatedDepreciationAmount),
			Number(entry.bookValueAfterDepreciation),
		]);
		expect(entries).toEqual([
			[350, 550, 450],
			[350, 900, 100],
		]);
		expect(Number(book.valueAfterDepreciation)).toBe(800);
		expect(book.openingNumberOfBookedDepreciations).toBe(1);
		expect(book.totalNumberOfBookedDepreciations).toBe(1);
		expect(book.postingStatus).toBe("PARTIALLY_DEPRECIATED");
		expect(entries.reduce((total, [amount]) => total + amount, 0)).toBe(700);
	});

	it("B isolates two finance books and keeps the root projection on the default book", async () => {
		const asset = await createAsset("B-two-books");
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBookConfiguration(defaultFinanceBookId),
				makeBookConfiguration(secondaryFinanceBookId, {
					openingAccumulatedDepreciation: 400,
				}),
			],
			organizationId,
		);

		const defaultState = await loadActiveSchedule(
			asset.id,
			defaultFinanceBookId,
		);
		const secondaryState = await loadActiveSchedule(
			asset.id,
			secondaryFinanceBookId,
		);
		expect(
			defaultState.schedule.entries.map((entry) =>
				Number(entry.depreciationAmount),
			),
		).toEqual([350, 350]);
		expect(
			secondaryState.schedule.entries.map((entry) =>
				Number(entry.depreciationAmount),
			),
		).toEqual([250, 250]);
		expect(Number(defaultState.book.valueAfterDepreciation)).toBe(800);
		expect(Number(secondaryState.book.valueAfterDepreciation)).toBe(600);

		const secondaryEntry = secondaryState.schedule.entries[0];
		if (!secondaryEntry) throw new Error("Expected a secondary-book entry");
		await worker.post({
			version: DEPRECIATION_JOB_VERSION,
			organizationId,
			assetId: asset.id,
			assetFinanceBookId: secondaryState.book.id,
			scheduleId: secondaryState.schedule.id,
			scheduleEntryId: secondaryEntry.id,
			depreciationDate: secondaryEntry.scheduleDate.toISOString().slice(0, 10),
		});

		const afterPost = await prisma.asset.findUniqueOrThrow({
			where: { id: asset.id },
			select: { valueAfterDepreciation: true },
		});
		const secondaryAfterPost = await prisma.assetFinanceBook.findUniqueOrThrow({
			where: { id: secondaryState.book.id },
			select: {
				valueAfterDepreciation: true,
				totalNumberOfBookedDepreciations: true,
			},
		});
		expect(Number(afterPost.valueAfterDepreciation)).toBe(800);
		expect(Number(secondaryAfterPost.valueAfterDepreciation)).toBe(350);
		expect(secondaryAfterPost.totalNumberOfBookedDepreciations).toBe(2);
		const journal = await prisma.assetDepreciationJournalEntry.findFirstOrThrow(
			{
				where: {
					assetId: asset.id,
					assetFinanceBookId: secondaryState.book.id,
				},
				select: { depreciationAmount: true },
			},
		);
		expect(Number(journal.depreciationAmount)).toBe(250);
	});

	it("C preserves opening periods while posting the selected book through accounting", async () => {
		const asset = await createAsset("C-posting");
		await lifecycle.configureAssetBooks(
			asset.id,
			[makeBookConfiguration(defaultFinanceBookId)],
			organizationId,
		);
		const state = await loadActiveSchedule(asset.id, defaultFinanceBookId);
		const firstEntry = state.schedule.entries[0];
		if (!firstEntry) throw new Error("Expected a pending depreciation entry");

		const result = await worker.post({
			version: DEPRECIATION_JOB_VERSION,
			organizationId,
			assetId: asset.id,
			assetFinanceBookId: state.book.id,
			scheduleId: state.schedule.id,
			scheduleEntryId: firstEntry.id,
			depreciationDate: firstEntry.scheduleDate.toISOString().slice(0, 10),
		});
		if (result.status !== "posted") {
			throw new Error("Expected the first depreciation period to be postable");
		}
		expect(result.status).toBe("posted");

		const [postedEntry, postedBook, postedAsset, journal] = await Promise.all([
			prisma.assetDepreciationScheduleEntry.findUniqueOrThrow({
				where: { id: firstEntry.id },
				select: { postingId: true, bookValueAfterDepreciation: true },
			}),
			prisma.assetFinanceBook.findUniqueOrThrow({
				where: { id: state.book.id },
				select: {
					valueAfterDepreciation: true,
					totalNumberOfBookedDepreciations: true,
					postingStatus: true,
				},
			}),
			prisma.asset.findUniqueOrThrow({
				where: { id: asset.id },
				select: { valueAfterDepreciation: true, status: true },
			}),
			prisma.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: result.postingId },
				select: { assetFinanceBookId: true, depreciationAmount: true },
			}),
		]);
		expect(postedEntry.postingId).toBe(result.postingId);
		expect(Number(postedEntry.bookValueAfterDepreciation)).toBe(450);
		expect(Number(postedBook.valueAfterDepreciation)).toBe(450);
		expect(postedBook.totalNumberOfBookedDepreciations).toBe(2);
		expect(postedBook.postingStatus).toBe("PARTIALLY_DEPRECIATED");
		expect(Number(postedAsset.valueAfterDepreciation)).toBe(450);
		expect(postedAsset.status).toBe("PARTIALLY_DEPRECIATED");
		expect(journal.assetFinanceBookId).toBe(state.book.id);
		expect(Number(journal.depreciationAmount)).toBe(350);
	});

	it("D persists a finite terminal state for fully depreciated zero-salvage WDV", async () => {
		const asset = await createAsset("D-zero-wdv");
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBookConfiguration(defaultFinanceBookId, {
					depreciationMethod: "WRITTEN_DOWN_VALUE",
					totalNumberOfDepreciations: 12,
					frequencyOfDepreciation: 1,
					depreciationStartDate: "2030-12-31",
					expectedValueAfterUsefulLife: 0,
					openingAccumulatedDepreciation: 1_000,
					openingNumberOfBookedDepreciations: 11,
				}),
			],
			organizationId,
		);

		const { book, schedule } = await loadActiveSchedule(
			asset.id,
			defaultFinanceBookId,
		);
		const persistedAsset = await prisma.asset.findUniqueOrThrow({
			where: { id: asset.id },
			select: { valueAfterDepreciation: true, isFullyDepreciated: true },
		});
		expect(schedule.entries).toHaveLength(0);
		expect(book.rateOfDepreciation).toBeNull();
		expect(Number(book.valueAfterDepreciation)).toBe(0);
		expect(book.totalNumberOfBookedDepreciations).toBe(11);
		expect(book.postingStatus).toBe("FULLY_DEPRECIATED");
		expect(Number(persistedAsset.valueAfterDepreciation)).toBe(0);
		expect(persistedAsset.isFullyDepreciated).toBe(true);
		expect(
			await prisma.assetDepreciationJournalEntry.count({
				where: { assetId: asset.id },
			}),
		).toBe(0);
	});

	it("E preserves a positive salvage boundary as a finite WDV terminal state", async () => {
		const asset = await createAsset("E-residual-wdv");
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBookConfiguration(defaultFinanceBookId, {
					depreciationMethod: "WRITTEN_DOWN_VALUE",
					totalNumberOfDepreciations: 12,
					frequencyOfDepreciation: 1,
					depreciationStartDate: "2030-12-31",
					expectedValueAfterUsefulLife: 100,
					openingAccumulatedDepreciation: 900,
					openingNumberOfBookedDepreciations: 11,
				}),
			],
			organizationId,
		);

		const { book, schedule } = await loadActiveSchedule(
			asset.id,
			defaultFinanceBookId,
		);
		const persistedAsset = await prisma.asset.findUniqueOrThrow({
			where: { id: asset.id },
			select: { valueAfterDepreciation: true, isFullyDepreciated: true },
		});
		expect(schedule.entries).toHaveLength(0);
		expect(Number(book.rateOfDepreciation)).toBeCloseTo(0);
		expect(Number(book.valueAfterDepreciation)).toBe(100);
		expect(book.postingStatus).toBe("FULLY_DEPRECIATED");
		expect(Number(persistedAsset.valueAfterDepreciation)).toBe(100);
		expect(persistedAsset.isFullyDepreciated).toBe(true);
	});

	it("F rejects a persisted negative WDV rate without replacing terminal state", async () => {
		const asset = await createAsset("F-negative-wdv-rate");
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBookConfiguration(defaultFinanceBookId, {
					depreciationMethod: "WRITTEN_DOWN_VALUE",
					totalNumberOfDepreciations: 12,
					frequencyOfDepreciation: 1,
					depreciationStartDate: "2030-12-31",
					expectedValueAfterUsefulLife: 0,
					openingAccumulatedDepreciation: 1000,
					openingNumberOfBookedDepreciations: 11,
				}),
			],
			organizationId,
		);

		const before = await loadActiveSchedule(asset.id, defaultFinanceBookId);

		await prisma.assetFinanceBook.update({
			where: { id: before.book.id },
			data: { rateOfDepreciation: -5 },
		});

		await expect(
			lifecycle.configureAssetBooks(asset.id, undefined, organizationId),
		).rejects.toThrow("ratePercent must be non-negative");

		const [after, persistedAsset, journalCount] = await Promise.all([
			loadBook(asset.id, defaultFinanceBookId),
			prisma.asset.findUniqueOrThrow({
				where: { id: asset.id },
				select: {
					valueAfterDepreciation: true,
					isFullyDepreciated: true,
				},
			}),
			prisma.assetDepreciationJournalEntry.count({
				where: { assetId: asset.id },
			}),
		]);

		expect(after.schedules).toHaveLength(1);
		expect(after.schedules[0]?.id).toBe(before.schedule.id);
		expect(after.schedules[0]?.entries).toHaveLength(0);
		expect(Number(after.rateOfDepreciation)).toBe(-5);
		expect(Number(after.valueAfterDepreciation)).toBe(0);
		expect(after.totalNumberOfBookedDepreciations).toBe(11);
		expect(after.postingStatus).toBe("FULLY_DEPRECIATED");
		expect(Number(persistedAsset.valueAfterDepreciation)).toBe(0);
		expect(persistedAsset.isFullyDepreciated).toBe(true);
		expect(journalCount).toBe(0);
	});
});
