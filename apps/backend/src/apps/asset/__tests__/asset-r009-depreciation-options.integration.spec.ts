import type { Asset } from "@aria/types";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetDepreciationLifecycleService } from "../depreciation/asset-depreciation-lifecycle.service";
import { AssetDepreciationRevisionService } from "../depreciation/asset-depreciation-revision.service";
import { DEPRECIATION_JOB_VERSION } from "../depreciation/depreciation.constants";
import { DepreciationPersistenceService } from "../depreciation/depreciation-persistence.service";

/**
 * Exercises R-009 through PostgreSQL rather than mocks: the selected book's
 * option snapshot, allocation rows, immutable schedule rows, revision, and
 * worker journal all have to retain the same depreciation contract.
 */
describe("R-009 persisted depreciation options", () => {
	let prisma: PrismaService;
	let lifecycle: AssetDepreciationLifecycleService;
	let revision: AssetDepreciationRevisionService;
	let worker: DepreciationPersistenceService;
	let organizationId: string;
	let companyId: string;
	let categoryId: string;
	let defaultFinanceBookId: string;
	let secondaryFinanceBookId: string;
	let suffix: string;
	const assetIds: string[] = [];

	const createAsset = async (
		label: string,
		amount = 1_000,
		options: {
			availableForUseDate?: string;
			purchaseDate?: string;
			depreciationStartDate?: string;
		} = {},
	): Promise<{ id: string }> => {
		const purchaseDate = options.purchaseDate ?? "2030-01-01";
		const availableForUseDate = options.availableForUseDate ?? purchaseDate;
		const depreciationStartDate = options.depreciationStartDate ?? "2030-01-31";
		const asset = await prisma.asset.create({
			data: {
				series: `R009-${label}-${suffix}`,
				assetName: `R-009 ${label}`,
				itemCode: `R009-${label}-${suffix}`,
				assetCategoryId: categoryId,
				companyId,
				purchaseDate: new Date(`${purchaseDate}T00:00:00.000Z`),
				availableForUseDate: new Date(`${availableForUseDate}T00:00:00.000Z`),
				netPurchaseAmount: amount,
				valueAfterDepreciation: amount,
				calculateDepreciation: true,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 12,
				frequencyOfDepreciation: 1,
				depreciationStartDate: new Date(
					`${depreciationStartDate}T00:00:00.000Z`,
				),
				status: "SUBMITTED",
			},
		});
		assetIds.push(asset.id);
		return asset;
	};

	const makeBook = (
		financeBookId: string,
		overrides: Partial<Asset.AssetFinanceBookInput> = {},
	): Asset.AssetFinanceBookInput => ({
		financeBookId,
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 12,
		frequencyOfDepreciation: 1,
		depreciationStartDate: "2030-01-31",
		...overrides,
	});

	const loadActive = async (assetId: string, financeBookId: string) => {
		const book = await prisma.assetFinanceBook.findUniqueOrThrow({
			where: { assetId_financeBookId: { assetId, financeBookId } },
			include: {
				shiftAllocations: { orderBy: { periodIndex: "asc" } },
				schedules: {
					where: { status: "ACTIVE" },
					include: { entries: { orderBy: { sequence: "asc" } } },
					orderBy: { revisionNumber: "desc" },
				},
			},
		});
		const schedule = book.schedules[0];
		if (!schedule) throw new Error(`No active schedule for ${financeBookId}`);
		return { book, schedule };
	};

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();
		suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const organization = await prisma.organization.create({
			data: { name: `R-009 Organization ${suffix}`, slug: `r009-${suffix}` },
		});
		organizationId = organization.id;
		const [defaultBook, secondaryBook] = await Promise.all([
			prisma.financeBook.create({ data: { name: `R-009 Default ${suffix}` } }),
			prisma.financeBook.create({
				data: { name: `R-009 Secondary ${suffix}` },
			}),
		]);
		defaultFinanceBookId = defaultBook.id;
		secondaryFinanceBookId = secondaryBook.id;
		const company = await prisma.company.create({
			data: {
				organizationId,
				name: `R-009 Company ${suffix}`,
				defaultFinanceBookId,
				defaultCostCenter: `R-009 Cost Center ${suffix}`,
				accumulatedDepreciationAccount: `R-009 Accumulated ${suffix}`,
				depreciationExpenseAccount: `R-009 Expense ${suffix}`,
			},
		});
		companyId = company.id;
		const category = await prisma.assetCategory.create({
			data: {
				name: `R-009 Category ${suffix}`,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 12,
				frequencyOfDepreciation: 1,
			},
		});
		categoryId = category.id;
		await prisma.assetCategoryAccount.create({
			data: {
				assetCategoryId: categoryId,
				companyId,
				fixedAssetAccount: `R-009 Fixed ${suffix}`,
				accumulatedDepreciationAccount: `R-009 Accumulated ${suffix}`,
				depreciationExpenseAccount: `R-009 Expense ${suffix}`,
			},
		});

		lifecycle = new AssetDepreciationLifecycleService(prisma);
		revision = new AssetDepreciationRevisionService();
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

	it("round-trips shifts through the book, schedule, revision, and worker posting", async () => {
		const asset = await createAsset("shift", 120_000);
		const shiftAllocations = Array.from({ length: 12 }, (_, periodIndex) => ({
			periodIndex,
			shift: periodIndex === 4 ? "Double" : "Single",
			factor: periodIndex === 4 ? 2 : 1,
		}));
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBook(defaultFinanceBookId, {
					precision: 3,
					ratePrecision: 3,
					shiftBased: true,
					shiftAllocations,
				}),
			],
			organizationId,
		);

		const firstState = await loadActive(asset.id, defaultFinanceBookId);
		expect(firstState.book.precision).toBe(3);
		expect(firstState.book.ratePrecision).toBe(3);
		expect(firstState.book.shiftBased).toBe(true);
		expect(
			firstState.book.shiftAllocations.map((row) => [
				row.periodIndex,
				row.shift,
				Number(row.factor),
			]),
		).toEqual(
			shiftAllocations.map((row) => [row.periodIndex, row.shift, row.factor]),
		);
		expect(firstState.schedule.precision).toBe(3);
		expect(firstState.schedule.shiftBased).toBe(true);
		expect(firstState.schedule.entries[4]).toMatchObject({
			shift: "Double",
			depreciationAmount: new Prisma.Decimal("18461.538"),
		});
		expect(
			firstState.schedule.entries.reduce(
				(total, entry) => total + Number(entry.depreciationAmount),
				0,
			),
		).toBe(120_000);

		const firstEntry = firstState.schedule.entries[0];
		if (!firstEntry) throw new Error("Expected a shift schedule entry");
		const posting = await worker.post({
			version: DEPRECIATION_JOB_VERSION,
			organizationId,
			assetId: asset.id,
			assetFinanceBookId: firstState.book.id,
			scheduleId: firstState.schedule.id,
			scheduleEntryId: firstEntry.id,
			depreciationDate: firstEntry.scheduleDate.toISOString().slice(0, 10),
		});
		if (posting.status !== "posted") throw new Error("Expected shift posting");
		const journal =
			await prisma.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: posting.postingId },
				include: { lines: true },
			});
		expect(Number(journal.depreciationAmount)).toBe(9230.769);
		expect(journal.lines.map((line) => Number(line.debitAmount))).toContain(
			9230.769,
		);

		await prisma.client.$transaction((tx) =>
			revision.revise(tx, organizationId, {
				assetId: asset.id,
				financeBookId: defaultFinanceBookId,
				effectiveDate: new Date("2031-02-01T00:00:00.000Z"),
				valueDelta: 0,
				usefulLifeDeltaMonths: 0,
			}),
		);
		const successor = await loadActive(asset.id, defaultFinanceBookId);
		expect(successor.schedule.revisionNumber).toBe(2);
		expect(successor.schedule.precision).toBe(3);
		expect(successor.schedule.entries[0]?.shift).toBe("Single");
		expect(
			successor.schedule.entries.some((entry) => entry.shift === "Double"),
		).toBe(true);
	});

	it("copies complete options from an asset-category finance-book template", async () => {
		await prisma.assetCategoryFinanceBook.create({
			data: {
				assetCategoryId: categoryId,
				financeBookId: defaultFinanceBookId,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 1,
				dailyProrataBased: true,
				shiftBased: true,
				precision: 3,
				ratePrecision: 3,
				calculateUsingTotalDays: false,
				shiftAllocations: {
					create: [
						{ periodIndex: 0, shift: "Single", factor: 1 },
						{ periodIndex: 1, shift: "Double", factor: 2 },
						{ periodIndex: 2, shift: "Single", factor: 1 },
					],
				},
			},
		});
		const asset = await createAsset("category-template");

		await lifecycle.configureAssetBooks(asset.id, undefined, organizationId);

		const state = await loadActive(asset.id, defaultFinanceBookId);
		expect(state.book.precision).toBe(3);
		expect(state.book.ratePrecision).toBe(3);
		expect(state.book.calculateUsingTotalDays).toBe(false);
		expect(state.book.shiftAllocations.map((row) => row.shift)).toEqual([
			"Single",
			"Double",
			"Single",
		]);
		expect(
			state.schedule.entries.map((entry) => Number(entry.depreciationAmount)),
		).toEqual([250, 500, 250]);
	});

	it("preserves precision residuals and the explicit total-days policy", async () => {
		const precision3 = await createAsset("precision3");
		const precision6 = await createAsset("precision6");
		await lifecycle.configureAssetBooks(
			precision3.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 3,
					precision: 3,
				}),
			],
			organizationId,
		);
		await lifecycle.configureAssetBooks(
			precision6.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 3,
					precision: 6,
				}),
			],
			organizationId,
		);
		const [three, six] = await Promise.all([
			loadActive(precision3.id, defaultFinanceBookId),
			loadActive(precision6.id, defaultFinanceBookId),
		]);
		expect(
			three.schedule.entries.map((entry) => Number(entry.depreciationAmount)),
		).toEqual([333.333, 333.333, 333.334]);
		expect(
			six.schedule.entries.map((entry) => Number(entry.depreciationAmount)),
		).toEqual([333.333333, 333.333333, 333.333334]);

		const totalDays = await createAsset("total-days", 1_096, {
			availableForUseDate: "2020-01-15",
			purchaseDate: "2020-01-15",
			depreciationStartDate: "2020-01-31",
		});
		await lifecycle.configureAssetBooks(
			totalDays.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 36,
					depreciationStartDate: "2020-01-31",
					frequencyOfDepreciation: 1,
					dailyProrataBased: true,
					calculateUsingTotalDays: true,
				}),
			],
			organizationId,
		);
		const totalDaysState = await loadActive(totalDays.id, defaultFinanceBookId);
		expect(totalDaysState.book.calculateUsingTotalDays).toBe(true);
		expect(totalDaysState.schedule.calculateUsingTotalDays).toBe(true);
		expect(totalDaysState.schedule.entries[0]?.depreciationAmount).toEqual(
			new Prisma.Decimal("17"),
		);
		expect(totalDaysState.schedule.entries[1]?.depreciationAmount).toEqual(
			new Prisma.Decimal("29"),
		);
		expect(
			Number(totalDaysState.schedule.entries.at(-1)?.depreciationAmount),
		).toBe(14);
	});

	it("keeps pro-rata period counts, opening basis, and two-book projection isolated", async () => {
		const asset = await createAsset("opening-two-books");
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2031-12-31",
					expectedValueAfterUsefulLife: 100,
					openingAccumulatedDepreciation: 200,
					openingNumberOfBookedDepreciations: 1,
				}),
				makeBook(secondaryFinanceBookId, {
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2031-12-31",
					expectedValueAfterUsefulLife: 100,
					openingAccumulatedDepreciation: 400,
					openingNumberOfBookedDepreciations: 1,
				}),
			],
			organizationId,
		);
		const [defaultState, secondaryState, projected] = await Promise.all([
			loadActive(asset.id, defaultFinanceBookId),
			loadActive(asset.id, secondaryFinanceBookId),
			prisma.asset.findUniqueOrThrow({
				where: { id: asset.id },
				select: { valueAfterDepreciation: true },
			}),
		]);
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
		expect(Number(projected.valueAfterDepreciation)).toBe(800);
		const proRata = await createAsset("pro-rata", 100_000, {
			availableForUseDate: "2020-01-01",
			purchaseDate: "2020-01-01",
			depreciationStartDate: "2020-07-01",
		});
		await lifecycle.configureAssetBooks(
			proRata.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2020-07-01",
					expectedValueAfterUsefulLife: 10_000,
				}),
			],
			organizationId,
		);
		const proRataState = await loadActive(proRata.id, defaultFinanceBookId);
		expect(proRataState.schedule.entries).toHaveLength(4);
		expect(
			proRataState.schedule.entries.map((entry) =>
				Number(entry.depreciationAmount),
			),
		).toEqual([15_000, 30_000, 30_000, 15_000]);
	});

	it("rejects incomplete or unsupported options before creating a book", async () => {
		const shiftAsset = await createAsset("invalid-shift");
		await expect(
			lifecycle.configureAssetBooks(
				shiftAsset.id,
				[
					makeBook(defaultFinanceBookId, {
						shiftBased: true,
						shiftAllocations: [],
					}),
				],
				organizationId,
			),
		).rejects.toThrow("one persisted shift allocation for every period");
		expect(
			await prisma.assetFinanceBook.count({
				where: { assetId: shiftAsset.id },
			}),
		).toBe(0);

		const totalDaysAsset = await createAsset("invalid-total-days");
		await expect(
			lifecycle.configureAssetBooks(
				totalDaysAsset.id,
				[
					makeBook(defaultFinanceBookId, {
						calculateUsingTotalDays: true,
					}),
				],
				organizationId,
			),
		).rejects.toThrow("calculateUsingTotalDays requires daily straight-line");
		expect(
			await prisma.assetFinanceBook.count({
				where: { assetId: totalDaysAsset.id },
			}),
		).toBe(0);
	});
});
