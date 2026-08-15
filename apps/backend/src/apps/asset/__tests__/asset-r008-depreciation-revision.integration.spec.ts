import type { Asset } from "@aria/types";
import { Prisma } from "../../../generated/prisma/client";
import { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { AssetAccountingService } from "../asset-accounting.service";
import { AssetDashboardSubService } from "../asset-dashboard.service";
import { AssetStockPostingService } from "../asset-stock-posting.service";
import { buildDepreciationSchedulePreview } from "../asset-value-adjustment.utils";
import { AssetDepreciationLifecycleService } from "../depreciation/asset-depreciation-lifecycle.service";
import { AssetDepreciationRevisionService } from "../depreciation/asset-depreciation-revision.service";
import { DEPRECIATION_JOB_VERSION } from "../depreciation/depreciation.constants";
import { DepreciationPersistenceService } from "../depreciation/depreciation-persistence.service";

const dateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const dateString = (value: Date): string => value.toISOString().slice(0, 10);

/**
 * Exercises R-008 through the real PostgreSQL lifecycle, revision, preview,
 * and worker paths. The assertions deliberately retain predecessor rows and
 * compare persisted successor rows with the shared preview calculation.
 */
describe("R-008 depreciation revision semantics", () => {
	let prisma: PrismaService;
	let service: AssetService;
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
	const capitalizationIds: string[] = [];

	const createAsset = async (
		label: string,
		options: {
			amount?: number;
			availableForUseDate?: string;
			purchaseDate?: string;
			depreciationStartDate?: string;
			depreciationMethod?: Asset.DepreciationMethod;
			totalNumberOfDepreciations?: number;
			frequencyOfDepreciation?: number;
			expectedValueAfterUsefulLife?: number;
			openingAccumulatedDepreciation?: number;
			openingNumberOfBookedDepreciations?: number;
		} = {},
	): Promise<{ id: string }> => {
		const amount = options.amount ?? 1_000;
		const purchaseDate = options.purchaseDate ?? "2030-01-01";
		const availableForUseDate = options.availableForUseDate ?? purchaseDate;
		const depreciationStartDate =
			options.depreciationStartDate ?? availableForUseDate;
		const depreciationMethod = options.depreciationMethod ?? "STRAIGHT_LINE";
		const totalNumberOfDepreciations = options.totalNumberOfDepreciations ?? 3;
		const frequencyOfDepreciation = options.frequencyOfDepreciation ?? 12;
		const expectedValueAfterUsefulLife =
			options.expectedValueAfterUsefulLife ?? 0;
		const openingAccumulatedDepreciation =
			options.openingAccumulatedDepreciation ?? 0;
		const openingNumberOfBookedDepreciations =
			options.openingNumberOfBookedDepreciations ?? 0;
		const asset = await prisma.client.asset.create({
			data: {
				series: `R008-${label}-${suffix}`,
				assetName: `R-008 ${label}`,
				itemCode: `R008-${label}-${suffix}`,
				assetCategoryId: categoryId,
				companyId,
				purchaseDate: dateOnly(purchaseDate),
				availableForUseDate: dateOnly(availableForUseDate),
				netPurchaseAmount: amount,
				valueAfterDepreciation: amount - openingAccumulatedDepreciation,
				calculateDepreciation: true,
				openingAccumulatedDepreciation,
				openingNumberOfBookedDepreciations,
				depreciationMethod,
				totalNumberOfDepreciations,
				frequencyOfDepreciation,
				expectedValueAfterUsefulLife,
				depreciationStartDate: dateOnly(depreciationStartDate),
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
		totalNumberOfDepreciations: 3,
		frequencyOfDepreciation: 12,
		depreciationStartDate: "2030-01-31",
		...overrides,
	});

	const loadBookState = async (assetId: string, financeBookId: string) => {
		const book = await prisma.client.assetFinanceBook.findUniqueOrThrow({
			where: { assetId_financeBookId: { assetId, financeBookId } },
			include: {
				shiftAllocations: { orderBy: { periodIndex: "asc" } },
				schedules: {
					include: { entries: { orderBy: { sequence: "asc" } } },
					orderBy: { revisionNumber: "asc" },
				},
			},
		});
		const activeSchedules = book.schedules.filter(
			(schedule) => schedule.status === "ACTIVE",
		);
		const activeSchedule = activeSchedules[0];
		if (!activeSchedule) {
			throw new Error(`No active schedule for ${financeBookId}`);
		}
		return { book, activeSchedule, activeSchedules };
	};

	const postEntry = async (
		assetId: string,
		financeBookId: string,
		entryIndex = 0,
	): Promise<string> => {
		const state = await loadBookState(assetId, financeBookId);
		const entry = state.activeSchedule.entries.filter(
			(candidate) => candidate.postingId === null,
		)[entryIndex];
		if (!entry) throw new Error("Expected a pending depreciation entry");
		const result = await worker.post({
			version: DEPRECIATION_JOB_VERSION,
			organizationId,
			assetId,
			assetFinanceBookId: state.book.id,
			scheduleId: state.activeSchedule.id,
			scheduleEntryId: entry.id,
			depreciationDate: dateString(entry.scheduleDate),
		});
		if (result.status !== "posted") {
			throw new Error(`Expected a posted entry, got ${result.status}`);
		}
		return result.postingId;
	};

	const revise = (
		assetId: string,
		input: Omit<
			Parameters<AssetDepreciationRevisionService["revise"]>[2],
			"assetId"
		>,
	) =>
		prisma.client.$transaction((tx) =>
			revision.revise(tx, organizationId, { assetId, ...input }),
		);

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();
		suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const organization = await prisma.client.organization.create({
			data: { name: `R-008 Organization ${suffix}`, slug: `r008-${suffix}` },
		});
		organizationId = organization.id;
		const [defaultBook, secondaryBook] = await Promise.all([
			prisma.client.financeBook.create({
				data: { name: `R-008 Default ${suffix}` },
			}),
			prisma.client.financeBook.create({
				data: { name: `R-008 Secondary ${suffix}` },
			}),
		]);
		defaultFinanceBookId = defaultBook.id;
		secondaryFinanceBookId = secondaryBook.id;
		const company = await prisma.client.company.create({
			data: {
				organizationId,
				name: `R-008 Company ${suffix}`,
				defaultFinanceBookId,
				defaultCostCenter: `R-008 Cost Center ${suffix}`,
				accumulatedDepreciationAccount: `R-008 Accumulated ${suffix}`,
				depreciationExpenseAccount: `R-008 Expense ${suffix}`,
			},
		});
		companyId = company.id;
		const category = await prisma.client.assetCategory.create({
			data: {
				name: `R-008 Category ${suffix}`,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 12,
			},
		});
		categoryId = category.id;
		await prisma.client.assetCategoryAccount.create({
			data: {
				assetCategoryId: categoryId,
				companyId,
				fixedAssetAccount: `R-008 Fixed ${suffix}`,
				accumulatedDepreciationAccount: `R-008 Accumulated ${suffix}`,
				depreciationExpenseAccount: `R-008 Expense ${suffix}`,
			},
		});

		lifecycle = new AssetDepreciationLifecycleService(prisma);
		revision = new AssetDepreciationRevisionService();
		service = new AssetService(
			prisma,
			new AssetDashboardSubService(prisma),
			new FiscalYearService(prisma),
			lifecycle,
			undefined,
			undefined,
			new AssetAccountingService(),
			new AssetStockPostingService(),
			revision,
		);
		worker = new DepreciationPersistenceService(prisma);
	});

	afterEach(async () => {
		if (assetIds.length === 0 && capitalizationIds.length === 0) return;
		const ids = [...assetIds];
		const capIds = [...capitalizationIds];
		if (capIds.length > 0) {
			await prisma.client.assetCapitalization.deleteMany({
				where: { id: { in: capIds } },
			});
			await prisma.client.assetAccountingEntry.deleteMany({
				where: {
					sourceType: "CAPITALIZATION",
					sourceId: { in: capIds },
				},
			});
		}
		await prisma.client.assetDepreciationJournalEntry.deleteMany({
			where: { assetId: { in: ids } },
		});
		await prisma.client.assetDepreciationSchedule.deleteMany({
			where: { assetId: { in: ids } },
		});
		await prisma.client.assetFinanceBook.deleteMany({
			where: { assetId: { in: ids } },
		});
		await prisma.client.asset.deleteMany({ where: { id: { in: ids } } });
		assetIds.length = 0;
		capitalizationIds.length = 0;
	});

	afterAll(async () => {
		if (!prisma) return;
		try {
			await prisma.client.assetCategoryAccount.deleteMany({
				where: { assetCategoryId: categoryId },
			});
			await prisma.client.assetCategory.delete({ where: { id: categoryId } });
			await prisma.client.company.update({
				where: { id: companyId },
				data: { defaultFinanceBookId: null },
			});
			await prisma.client.company.delete({ where: { id: companyId } });
			await prisma.client.organization.delete({
				where: { id: organizationId },
			});
			await prisma.client.financeBook.deleteMany({
				where: { id: { in: [defaultFinanceBookId, secondaryFinanceBookId] } },
			});
		} finally {
			await prisma.onModuleDestroy();
		}
	});

	it("keeps DDB on original life, preserves posted history, and chains multiple revisions", async () => {
		const asset = await createAsset("ddb", {
			amount: 1_000,
			availableForUseDate: "2020-01-01",
			purchaseDate: "2020-01-01",
			depreciationStartDate: "2020-01-31",
			depreciationMethod: "DOUBLE_DECLINING_BALANCE",
			totalNumberOfDepreciations: 10,
			frequencyOfDepreciation: 12,
			expectedValueAfterUsefulLife: 100,
		});
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBook(defaultFinanceBookId, {
					depreciationMethod: "DOUBLE_DECLINING_BALANCE",
					totalNumberOfDepreciations: 10,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2020-01-31",
					expectedValueAfterUsefulLife: 100,
				}),
			],
			organizationId,
		);

		const initial = await loadBookState(asset.id, defaultFinanceBookId);
		expect(initial.activeSchedule.rateOfDepreciation).toBe(20);
		const predecessorId = initial.activeSchedule.id;
		await postEntry(asset.id, defaultFinanceBookId);
		await postEntry(asset.id, defaultFinanceBookId);
		const postedBeforeRevision =
			await prisma.client.assetDepreciationScheduleEntry.findMany({
				where: { scheduleId: predecessorId },
				select: {
					sequence: true,
					depreciationAmount: true,
					accumulatedDepreciationAmount: true,
					bookValueAfterDepreciation: true,
					postingId: true,
				},
				orderBy: { sequence: "asc" },
			});
		expect(
			postedBeforeRevision.filter((entry) => entry.postingId !== null),
		).toHaveLength(2);

		await revise(asset.id, {
			financeBookId: defaultFinanceBookId,
			effectiveDate: dateOnly("2021-02-01"),
			valueDelta: 0,
			usefulLifeDeltaMonths: 0,
		});
		const firstRevision = await loadBookState(asset.id, defaultFinanceBookId);
		expect(firstRevision.activeSchedule.previousScheduleId).toBe(predecessorId);
		expect(firstRevision.activeSchedule.revisionNumber).toBe(2);
		expect(firstRevision.activeSchedule.startDate).toEqual(
			dateOnly("2020-01-31"),
		);
		expect(firstRevision.activeSchedule.totalNumberOfDepreciations).toBe(10);
		expect(firstRevision.activeSchedule.rateOfDepreciation).toBe(20);
		expect(firstRevision.activeSchedule.bookedDepreciations).toBe(2);
		expect(firstRevision.activeSchedule.entries[0]).toMatchObject({
			sequence: 3,
			scheduleDate: dateOnly("2022-01-31"),
		});
		expect(firstRevision.activeSchedule.entries.at(-1)).toMatchObject({
			sequence: 11,
			scheduleDate: dateOnly("2029-12-31"),
		});

		const predecessorAfterRevision =
			await prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
				where: { id: predecessorId },
				select: { status: true },
			});
		expect(predecessorAfterRevision.status).toBe("CANCELLED");
		const postedAfterRevision =
			await prisma.client.assetDepreciationScheduleEntry.findMany({
				where: { scheduleId: predecessorId },
				select: {
					sequence: true,
					depreciationAmount: true,
					accumulatedDepreciationAmount: true,
					bookValueAfterDepreciation: true,
					postingId: true,
				},
				orderBy: { sequence: "asc" },
			});
		expect(postedAfterRevision).toEqual(postedBeforeRevision);

		await postEntry(asset.id, defaultFinanceBookId);
		const postedSuccessorEntry = firstRevision.activeSchedule.entries[0];
		if (!postedSuccessorEntry) throw new Error("Expected successor posting");
		const secondRevisionDate = dateOnly("2022-02-01");
		await revise(asset.id, {
			financeBookId: defaultFinanceBookId,
			effectiveDate: secondRevisionDate,
			valueDelta: 0,
			usefulLifeDeltaMonths: 0,
		});
		const secondRevision = await loadBookState(asset.id, defaultFinanceBookId);
		const allSchedules = await prisma.client.assetDepreciationSchedule.findMany(
			{
				where: { assetId: asset.id },
				orderBy: { revisionNumber: "asc" },
				include: { entries: { orderBy: { sequence: "asc" } } },
			},
		);
		expect(allSchedules.map((schedule) => schedule.revisionNumber)).toEqual([
			1, 2, 3,
		]);
		expect(
			allSchedules.filter((schedule) => schedule.status === "ACTIVE"),
		).toHaveLength(1);
		expect(secondRevision.activeSchedule.previousScheduleId).toBe(
			firstRevision.activeSchedule.id,
		);
		expect(secondRevision.book.totalNumberOfBookedDepreciations).toBe(3);
		expect(secondRevision.activeSchedule.entries[0]).toMatchObject({
			sequence: 4,
			scheduleDate: dateOnly("2023-01-31"),
		});
		const postedSuccessorAfterRevision =
			await prisma.client.assetDepreciationScheduleEntry.findUniqueOrThrow({
				where: { id: postedSuccessorEntry.id },
				select: {
					postingId: true,
					depreciationAmount: true,
					bookValueAfterDepreciation: true,
				},
			});
		expect(postedSuccessorAfterRevision.postingId).not.toBeNull();
		expect(Number(postedSuccessorAfterRevision.depreciationAmount)).toBe(
			Number(postedSuccessorEntry.depreciationAmount),
		);
		expect(
			Number(postedSuccessorAfterRevision.bookValueAfterDepreciation),
		).toBe(Number(postedSuccessorEntry.bookValueAfterDepreciation));
	});

	it("recomputes WDV from current value and persists the exact two-month extension with preview parity", async () => {
		const asset = await createAsset("wdv", {
			amount: 1_000,
			availableForUseDate: "2020-01-01",
			purchaseDate: "2020-01-01",
			depreciationStartDate: "2020-01-31",
			depreciationMethod: "WRITTEN_DOWN_VALUE",
			totalNumberOfDepreciations: 5,
			frequencyOfDepreciation: 12,
			expectedValueAfterUsefulLife: 100,
		});
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBook(defaultFinanceBookId, {
					depreciationMethod: "WRITTEN_DOWN_VALUE",
					totalNumberOfDepreciations: 5,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2020-01-31",
					rateOfDepreciation: 50,
					expectedValueAfterUsefulLife: 100,
				}),
			],
			organizationId,
		);
		const initial = await loadBookState(asset.id, defaultFinanceBookId);
		expect(initial.activeSchedule.rateOfDepreciation).toBe(50);
		await postEntry(asset.id, defaultFinanceBookId);
		await postEntry(asset.id, defaultFinanceBookId);

		const beforeRevision = await loadBookState(asset.id, defaultFinanceBookId);
		const currentValue = Number(beforeRevision.book.valueAfterDepreciation);
		expect(currentValue).toBeGreaterThan(100);
		expect(currentValue).toBeLessThan(1_000);
		const preview = await buildDepreciationSchedulePreview({
			adjustmentDate: dateOnly("2022-02-01"),
			currentAssetValue: currentValue,
			newAssetValue: currentValue,
			purchaseAmount: 1_000,
			openingAccumulatedDepreciation: 0,
			bookedDepreciations: beforeRevision.book.totalNumberOfBookedDepreciations,
			depreciationMethod: "WRITTEN_DOWN_VALUE",
			totalNumberOfDepreciations:
				beforeRevision.book.totalNumberOfDepreciations,
			frequencyOfDepreciation: beforeRevision.book.frequencyOfDepreciation,
			depreciationStartDate: beforeRevision.book.depreciationStartDate,
			availableForUseDate: dateOnly("2020-01-01"),
			usefulLifeExtensionMonths: 2,
			rateOfDepreciation: Number(beforeRevision.book.rateOfDepreciation),
			expectedValueAfterUsefulLife: Number(
				beforeRevision.book.expectedValueAfterUsefulLife,
			),
			precision: beforeRevision.book.precision,
			ratePrecision: beforeRevision.book.ratePrecision,
		});
		if (!preview) throw new Error("Expected WDV preview");

		await revise(asset.id, {
			financeBookId: defaultFinanceBookId,
			effectiveDate: dateOnly("2022-02-01"),
			valueDelta: 0,
			usefulLifeDeltaMonths: 2,
		});
		const persisted = await loadBookState(asset.id, defaultFinanceBookId);
		const persistedEntries = persisted.activeSchedule.entries.map((entry) => ({
			sequence: entry.sequence,
			scheduleDate: dateString(entry.scheduleDate),
			depreciationAmount: Number(entry.depreciationAmount),
			accumulatedDepreciationAmount: Number(
				entry.accumulatedDepreciationAmount,
			),
			bookValueAfterDepreciation: Number(entry.bookValueAfterDepreciation),
		}));
		expect(persisted.activeSchedule.startDate).toEqual(dateOnly("2020-01-31"));
		expect(persisted.book.increaseInAssetLife).toBe(2);
		expect(persisted.activeSchedule.rateOfDepreciation).toBe(
			preview.rateOfDepreciation,
		);
		expect(persisted.activeSchedule.rateOfDepreciation).not.toBe(50);
		expect(persistedEntries).toEqual(preview.entries);
		expect(persistedEntries.at(-1)).toMatchObject({
			sequence: 6,
			scheduleDate: "2025-02-28",
		});
	});

	it("isolates a selected book while retaining opening basis and all R-009 schedule options", async () => {
		const asset = await createAsset("options-isolation", {
			amount: 1_000,
			availableForUseDate: "2030-01-01",
			purchaseDate: "2030-01-01",
			depreciationStartDate: "2030-12-31",
		});
		const shifts = [
			{ periodIndex: 0, shift: "Single", factor: 1 },
			{ periodIndex: 1, shift: "Double", factor: 2 },
			{ periodIndex: 2, shift: "Single", factor: 1 },
		];
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2030-12-31",
				}),
				makeBook(secondaryFinanceBookId, {
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2030-12-31",
					dailyProrataBased: true,
					shiftBased: true,
					precision: 3,
					ratePrecision: 3,
					calculateUsingTotalDays: false,
					openingAccumulatedDepreciation: 200,
					openingNumberOfBookedDepreciations: 1,
					shiftAllocations: shifts,
				}),
			],
			organizationId,
		);

		const beforeDefault = await loadBookState(asset.id, defaultFinanceBookId);
		const beforeSecondary = await loadBookState(
			asset.id,
			secondaryFinanceBookId,
		);
		const defaultScheduleId = beforeDefault.activeSchedule.id;
		const defaultValue = Number(beforeDefault.book.valueAfterDepreciation);
		expect(beforeSecondary.book.openingAccumulatedDepreciation).toEqual(
			new Prisma.Decimal("200"),
		);
		expect(beforeSecondary.activeSchedule.entries[0]?.shift).toBe("Double");

		await revise(asset.id, {
			financeBookId: secondaryFinanceBookId,
			effectiveDate: dateOnly("2031-01-01"),
			valueDelta: 0,
			usefulLifeDeltaMonths: 0,
		});

		const afterDefault = await loadBookState(asset.id, defaultFinanceBookId);
		const afterSecondary = await loadBookState(
			asset.id,
			secondaryFinanceBookId,
		);
		expect(afterDefault.activeSchedule.id).toBe(defaultScheduleId);
		expect(afterDefault.activeSchedule.status).toBe("ACTIVE");
		expect(Number(afterDefault.book.valueAfterDepreciation)).toBe(defaultValue);
		expect(afterSecondary.activeSchedule.revisionNumber).toBe(2);
		expect(afterSecondary.activeSchedule.dailyProrataBased).toBe(true);
		expect(afterSecondary.activeSchedule.shiftBased).toBe(true);
		expect(afterSecondary.activeSchedule.precision).toBe(3);
		expect(afterSecondary.activeSchedule.ratePrecision).toBe(3);
		expect(afterSecondary.activeSchedule.calculateUsingTotalDays).toBe(false);
		expect(afterSecondary.activeSchedule.totalNumberOfDepreciations).toBe(3);
		expect(afterSecondary.activeSchedule.bookedDepreciations).toBe(1);
		expect(
			afterSecondary.activeSchedule.openingAccumulatedDepreciation,
		).toEqual(new Prisma.Decimal("200"));
		expect(afterSecondary.activeSchedule.entries[0]).toMatchObject({
			sequence: 2,
			shift: "Double",
		});
		expect(
			Number(
				afterSecondary.activeSchedule.entries[0]?.accumulatedDepreciationAmount,
			),
		).toBeGreaterThan(200);
	});

	it("permits a terminal revision after every full extension row is posted", async () => {
		const asset = await createAsset("extension-capacity", {
			amount: 1_000,
			availableForUseDate: "2030-01-01",
			purchaseDate: "2030-01-01",
			depreciationStartDate: "2030-01-31",
			totalNumberOfDepreciations: 3,
			frequencyOfDepreciation: 12,
		});
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2030-01-31",
				}),
			],
			organizationId,
		);

		await revise(asset.id, {
			financeBookId: defaultFinanceBookId,
			effectiveDate: dateOnly("2030-02-01"),
			valueDelta: 0,
			usefulLifeDeltaMonths: 12,
		});
		const extended = await loadBookState(asset.id, defaultFinanceBookId);
		expect(extended.book.increaseInAssetLife).toBe(12);
		expect(extended.activeSchedule.entries).toHaveLength(5);
		expect(extended.activeSchedule.entries.at(-1)).toMatchObject({
			sequence: 5,
			scheduleDate: dateOnly("2033-12-31"),
		});

		for (let index = 0; index < 5; index += 1) {
			await postEntry(asset.id, defaultFinanceBookId);
		}
		const exhausted = await loadBookState(asset.id, defaultFinanceBookId);
		expect(exhausted.book.totalNumberOfBookedDepreciations).toBe(5);
		expect(exhausted.book.totalNumberOfDepreciations).toBe(3);
		expect(exhausted.book.valueAfterDepreciation).toEqual(
			new Prisma.Decimal("0"),
		);
		expect(
			exhausted.activeSchedule.entries.every(
				(entry) => entry.postingId !== null,
			),
		).toBe(true);
		const forgedEntry =
			await prisma.client.assetDepreciationScheduleEntry.create({
				data: {
					scheduleId: exhausted.activeSchedule.id,
					sequence: 6,
					scheduleDate: dateOnly("2034-01-31"),
					depreciationAmount: 1,
					accumulatedDepreciationAmount: 1,
					bookValueAfterDepreciation: 0,
				},
			});
		await expect(
			worker.post({
				version: DEPRECIATION_JOB_VERSION,
				organizationId,
				assetId: asset.id,
				assetFinanceBookId: exhausted.book.id,
				scheduleId: exhausted.activeSchedule.id,
				scheduleEntryId: forgedEntry.id,
				depreciationDate: dateString(forgedEntry.scheduleDate),
			}),
		).rejects.toThrow("maximum bookable schedule capacity");
		const afterRejectedPost = await loadBookState(
			asset.id,
			defaultFinanceBookId,
		);
		expect(afterRejectedPost.book.totalNumberOfBookedDepreciations).toBe(5);
		expect(
			afterRejectedPost.activeSchedule.entries.find(
				(entry) => entry.id === forgedEntry.id,
			)?.postingId,
		).toBeNull();
		await prisma.client.assetDepreciationScheduleEntry.delete({
			where: { id: forgedEntry.id },
		});

		const terminalRevision = await revise(asset.id, {
			financeBookId: defaultFinanceBookId,
			effectiveDate: dateOnly("2034-01-01"),
			valueDelta: 0,
			usefulLifeDeltaMonths: 0,
		});
		expect(terminalRevision).toHaveLength(1);
		const terminal = await loadBookState(asset.id, defaultFinanceBookId);
		expect(terminal.activeSchedule.entries).toHaveLength(0);
		expect(terminal.activeSchedule.previousScheduleId).toBe(
			exhausted.activeSchedule.id,
		);
		expect(terminal.book.totalNumberOfBookedDepreciations).toBe(5);
		expect(terminal.book.postingStatus).toBe("FULLY_DEPRECIATED");
	});

	it("uses the public capitalization date for preview and persisted successor parity", async () => {
		const source = await createAsset("cap-src", {
			amount: 1_000,
			availableForUseDate: "2020-01-01",
			purchaseDate: "2020-01-01",
			depreciationStartDate: "2020-01-31",
			totalNumberOfDepreciations: 3,
			frequencyOfDepreciation: 1,
		});
		await lifecycle.configureAssetBooks(
			source.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 1,
					depreciationStartDate: "2020-01-31",
				}),
				makeBook(secondaryFinanceBookId, {
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 1,
					depreciationStartDate: "2020-01-31",
				}),
			],
			organizationId,
		);
		const target = await prisma.client.asset.create({
			data: {
				series: `R008-CAP-TARGET-${suffix}`,
				assetName: "R-008 Capitalization Target",
				itemCode: `R008-CAP-TARGET-${suffix}`,
				assetType: "COMPOSITE_ASSET",
				assetCategoryId: categoryId,
				companyId,
				purchaseDate: dateOnly("2020-01-01"),
				availableForUseDate: dateOnly("2020-01-01"),
				netPurchaseAmount: 0,
				valueAfterDepreciation: 0,
				calculateDepreciation: false,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 1,
				expectedValueAfterUsefulLife: 0,
				depreciationStartDate: dateOnly("2020-01-31"),
				status: "DRAFT",
			},
		});
		assetIds.push(target.id);

		const draft = await service.createAssetCapitalization(
			{
				companyId,
				financeBookId: secondaryFinanceBookId,
				postingDate: "2020-08-10",
				targetType: "EXISTING_ASSET",
				targetAssetId: target.id,
				stockItems: [],
				assetItems: [{ assetId: source.id, assetValue: 1 }],
				serviceItems: [],
			},
			organizationId,
		);
		capitalizationIds.push(draft.id);
		const submitted = await service.submitAssetCapitalization(
			{ id: draft.id },
			organizationId,
		);
		expect(submitted.status).toBe("SUBMITTED");

		const afterCapitalization = await loadBookState(
			target.id,
			secondaryFinanceBookId,
		);
		expect(afterCapitalization.activeSchedule.startDate).toEqual(
			dateOnly("2020-08-10"),
		);
		const currentValue = Number(
			afterCapitalization.book.valueAfterDepreciation,
		);
		const preview = await service.previewAssetValueAdjustment(
			{
				assetId: target.id,
				financeBookId: secondaryFinanceBookId,
				adjustmentDate: "2020-08-11",
				newAssetValue: currentValue,
			},
			organizationId,
		);
		const previewSchedule = preview.depreciationSchedule;
		if (!previewSchedule) throw new Error("Expected capitalization preview");
		const expectedEntries = previewSchedule.entries.map((entry) => ({
			sequence: entry.sequence,
			scheduleDate: entry.scheduleDate,
			depreciationAmount: entry.depreciationAmount,
			accumulatedDepreciationAmount: entry.accumulatedDepreciationAmount,
			bookValueAfterDepreciation: entry.bookValueAfterDepreciation,
		}));

		await revise(target.id, {
			financeBookId: secondaryFinanceBookId,
			effectiveDate: dateOnly("2020-08-11"),
			valueDelta: 0,
			usefulLifeDeltaMonths: 0,
		});
		const persisted = await loadBookState(target.id, secondaryFinanceBookId);
		expect(
			persisted.activeSchedule.entries.map((entry) => ({
				sequence: entry.sequence,
				scheduleDate: dateString(entry.scheduleDate),
				depreciationAmount: Number(entry.depreciationAmount),
				accumulatedDepreciationAmount: Number(
					entry.accumulatedDepreciationAmount,
				),
				bookValueAfterDepreciation: Number(entry.bookValueAfterDepreciation),
			})),
		).toEqual(expectedEntries);
	});

	it("rejects a persisted negative WDV rate before a terminal shortcut can mutate state", async () => {
		const asset = await createAsset("negative-wdv-rate", {
			amount: 1_000,
			availableForUseDate: "2030-01-01",
			purchaseDate: "2030-01-01",
			depreciationStartDate: "2030-01-31",
			depreciationMethod: "WRITTEN_DOWN_VALUE",
			totalNumberOfDepreciations: 3,
			frequencyOfDepreciation: 12,
		});
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBook(defaultFinanceBookId, {
					depreciationMethod: "WRITTEN_DOWN_VALUE",
					rateOfDepreciation: 5,
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2030-01-31",
				}),
			],
			organizationId,
		);
		const before = await loadBookState(asset.id, defaultFinanceBookId);
		await prisma.client.assetFinanceBook.update({
			where: {
				assetId_financeBookId: {
					assetId: asset.id,
					financeBookId: defaultFinanceBookId,
				},
			},
			data: {
				rateOfDepreciation: -5,
				valueAfterDepreciation: 0,
				expectedValueAfterUsefulLife: 0,
			},
		});

		await expect(
			revise(asset.id, {
				financeBookId: defaultFinanceBookId,
				effectiveDate: dateOnly("2030-02-01"),
				valueDelta: 0,
				usefulLifeDeltaMonths: 0,
			}),
		).rejects.toThrow("ratePercent must be non-negative");
		const after = await loadBookState(asset.id, defaultFinanceBookId);
		expect(after.activeSchedule.id).toBe(before.activeSchedule.id);
		expect(after.activeSchedule.status).toBe("ACTIVE");
		expect(after.activeSchedules).toHaveLength(1);
		expect(after.book.rateOfDepreciation).toEqual(new Prisma.Decimal("-5"));
		expect(after.book.valueAfterDepreciation).toEqual(new Prisma.Decimal("0"));
	});

	it("defaults every full extension row to the ERPNext Single shift", async () => {
		const asset = await createAsset("extension-shifts", {
			amount: 1_000,
			availableForUseDate: "2030-01-01",
			purchaseDate: "2030-01-01",
			depreciationStartDate: "2030-01-31",
			totalNumberOfDepreciations: 3,
			frequencyOfDepreciation: 12,
		});
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2030-01-31",
					shiftBased: true,
					shiftAllocations: [
						{ periodIndex: 0, shift: "Single", factor: 1 },
						{ periodIndex: 1, shift: "Double", factor: 2 },
						{ periodIndex: 2, shift: "Single", factor: 1 },
					],
				}),
			],
			organizationId,
		);

		await revise(asset.id, {
			financeBookId: defaultFinanceBookId,
			effectiveDate: dateOnly("2030-02-01"),
			valueDelta: 0,
			usefulLifeDeltaMonths: 12,
		});
		const revised = await loadBookState(asset.id, defaultFinanceBookId);
		expect(revised.activeSchedule.entries).toHaveLength(5);
		expect(revised.activeSchedule.entries.map((entry) => entry.shift)).toEqual([
			"Single",
			"Double",
			"Single",
			"Single",
			"Single",
		]);
	});

	it("rejects invalid revisions before changing the active schedule", async () => {
		const asset = await createAsset("invalid", {
			amount: 1_000,
			availableForUseDate: "2030-01-01",
			purchaseDate: "2030-01-01",
			depreciationStartDate: "2030-01-31",
		});
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2030-01-31",
				}),
			],
			organizationId,
		);
		const before = await loadBookState(asset.id, defaultFinanceBookId);
		await expect(
			revise(asset.id, {
				financeBookId: defaultFinanceBookId,
				effectiveDate: dateOnly("2030-02-01"),
				valueDelta: 0,
				usefulLifeDeltaMonths: -1,
			}),
		).rejects.toThrow("cannot be negative");
		await expect(
			revise(asset.id, {
				financeBookId: defaultFinanceBookId,
				effectiveDate: dateOnly("2029-12-31"),
				valueDelta: 0,
				usefulLifeDeltaMonths: 0,
			}),
		).rejects.toThrow("before the asset's available-for-use date");
		const after = await loadBookState(asset.id, defaultFinanceBookId);
		expect(after.activeSchedule.id).toBe(before.activeSchedule.id);
		expect(after.activeSchedule.status).toBe("ACTIVE");
		expect(after.activeSchedules).toHaveLength(1);
		expect(after.book.increaseInAssetLife).toBe(0);
	});

	it("serializes concurrent revisions and leaves one active successor and cursor", async () => {
		const asset = await createAsset("concurrent", {
			amount: 1_000,
			availableForUseDate: "2030-01-01",
			purchaseDate: "2030-01-01",
			depreciationStartDate: "2030-01-31",
		});
		await lifecycle.configureAssetBooks(
			asset.id,
			[
				makeBook(defaultFinanceBookId, {
					totalNumberOfDepreciations: 5,
					frequencyOfDepreciation: 12,
					depreciationStartDate: "2030-01-31",
				}),
			],
			organizationId,
		);

		const attempts = await Promise.allSettled([
			revise(asset.id, {
				financeBookId: defaultFinanceBookId,
				effectiveDate: dateOnly("2030-02-01"),
				valueDelta: 0,
				usefulLifeDeltaMonths: 0,
			}),
			revise(asset.id, {
				financeBookId: defaultFinanceBookId,
				effectiveDate: dateOnly("2030-02-01"),
				valueDelta: 0,
				usefulLifeDeltaMonths: 0,
			}),
		]);
		const failures = attempts.filter(
			(result): result is PromiseRejectedResult => result.status === "rejected",
		);
		expect(failures).toHaveLength(0);

		const state = await loadBookState(asset.id, defaultFinanceBookId);
		expect(state.activeSchedules).toHaveLength(1);
		expect(state.book.totalNumberOfBookedDepreciations).toBe(0);
		expect(state.book.valueAfterDepreciation).toEqual(
			new Prisma.Decimal("1000"),
		);
		expect(state.book.schedules).toHaveLength(3);
		expect(
			state.book.schedules.map((schedule) => schedule.revisionNumber),
		).toEqual([1, 2, 3]);
	});
});
