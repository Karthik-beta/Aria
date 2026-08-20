import type { AssetFinanceBookFormValues } from "@aria/types";
import {
	Asset,
	assetFinanceBookFormFromPersisted,
	assetFinanceBookInputFromForm,
} from "@aria/types";
import { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { AssetDashboardSubService } from "../asset-dashboard.service";
import { AssetDepreciationLifecycleService } from "../depreciation/asset-depreciation-lifecycle.service";

/**
 * Proves the form mapping boundary against the real Asset service and a
 * migrated PostgreSQL schema. The same rows are serialized, persisted,
 * reloaded, and rehydrated without losing book options or shift names.
 */
describe("R-018 persisted Asset form round-trip", () => {
	let prisma: PrismaService;
	let service: AssetService;
	let organizationId: string;
	let companyId: string;
	let categoryId: string;
	let defaultFinanceBookId: string;
	let secondaryFinanceBookId: string;
	const assetIds: string[] = [];

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();

		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const organization = await prisma.organization.create({
			data: {
				name: `R-018 Form Organization ${suffix}`,
				slug: `r018-form-${suffix}`,
			},
		});
		organizationId = organization.id;

		const [defaultBook, secondaryBook] = await Promise.all([
			prisma.financeBook.create({
				data: { name: `R-018 Default Book ${suffix}` },
			}),
			prisma.financeBook.create({
				data: { name: `R-018 Secondary Book ${suffix}` },
			}),
		]);
		defaultFinanceBookId = defaultBook.id;
		secondaryFinanceBookId = secondaryBook.id;

		const company = await prisma.company.create({
			data: {
				organizationId,
				name: `R-018 Company ${suffix}`,
				defaultFinanceBookId,
				defaultCostCenter: `R-018 Cost Center ${suffix}`,
				accumulatedDepreciationAccount: `R-018 Accumulated ${suffix}`,
			},
		});
		companyId = company.id;

		const category = await prisma.assetCategory.create({
			data: {
				name: `R-018 Delayed Category ${suffix}`,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				totalNumberOfDepreciations: 99,
				frequencyOfDepreciation: 12,
				rateOfDepreciation: 50,
				expectedValueAfterUsefulLife: 1,
			},
		});
		categoryId = category.id;

		service = new AssetService(
			prisma,
			new AssetDashboardSubService(prisma),
			new FiscalYearService(prisma),
			new AssetDepreciationLifecycleService(prisma),
		);
	});

	afterAll(async () => {
		if (!prisma) return;
		try {
			if (assetIds.length > 0) {
				await prisma.assetDepreciationJournalEntry.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.assetDepreciationSchedule.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.assetFinanceBook.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.assetActivity.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
			}
			if (categoryId) {
				await prisma.assetCategory.delete({ where: { id: categoryId } });
			}
			if (companyId) {
				await prisma.company.update({
					where: { id: companyId },
					data: { defaultFinanceBookId: null },
				});
				await prisma.company.delete({ where: { id: companyId } });
			}
			if (organizationId) {
				await prisma.organization.delete({ where: { id: organizationId } });
			}
			if (defaultFinanceBookId || secondaryFinanceBookId) {
				await prisma.financeBook.deleteMany({
					where: {
						id: {
							in: [defaultFinanceBookId, secondaryFinanceBookId].filter(
								(id): id is string => Boolean(id),
							),
						},
					},
				});
			}
		} finally {
			await prisma.onModuleDestroy();
		}
	});

	it("persists and rehydrates typed books, rate gating, asset types, and delayed-category edits", async () => {
		const shiftAllocations = [
			{ periodIndex: 0, shift: "Day:Night", factor: 1 },
			{ periodIndex: 1, shift: "Night,Weekend", factor: 2 },
			{ periodIndex: 2, shift: "Two Shifts", factor: 1 },
		];
		const straightLineForm: AssetFinanceBookFormValues = {
			financeBookId: defaultFinanceBookId,
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: "3",
			frequencyOfDepreciation: "1",
			depreciationStartDate: "2030-01-31",
			dailyProrataBased: true,
			shiftBased: true,
			precision: "3",
			ratePrecision: "4",
			calculateUsingTotalDays: false,
			rateOfDepreciation: "",
			shiftAllocations: JSON.stringify(shiftAllocations),
			expectedValueAfterUsefulLife: "100",
			openingAccumulatedDepreciation: "0",
			openingNumberOfBookedDepreciations: "0",
			manualEntriesText: "",
		};
		const writtenDownValueForm: AssetFinanceBookFormValues = {
			financeBookId: secondaryFinanceBookId,
			depreciationMethod: "WRITTEN_DOWN_VALUE",
			totalNumberOfDepreciations: "12",
			frequencyOfDepreciation: "1",
			depreciationStartDate: "2030-01-31",
			dailyProrataBased: false,
			shiftBased: false,
			precision: "2",
			ratePrecision: "2",
			calculateUsingTotalDays: false,
			rateOfDepreciation: "20",
			shiftAllocations: "",
			expectedValueAfterUsefulLife: "100",
			openingAccumulatedDepreciation: "0",
			openingNumberOfBookedDepreciations: "0",
			manualEntriesText: "",
		};

		for (const depreciationMethod of [
			"STRAIGHT_LINE",
			"DOUBLE_DECLINING_BALANCE",
			"MANUAL",
		] as const) {
			expect(
				assetFinanceBookInputFromForm({
					...straightLineForm,
					depreciationMethod,
					rateOfDepreciation: "20",
					shiftBased: false,
					shiftAllocations: "",
				}),
			).toMatchObject({ rateOfDepreciation: null });
		}

		const financeBooks = [
			assetFinanceBookInputFromForm(straightLineForm),
			assetFinanceBookInputFromForm(writtenDownValueForm),
		];
		const createPayload = Asset.createAssetSchema.parse({
			assetName: "R-018 Existing Asset",
			assetType: "EXISTING_ASSET",
			companyId,
			assetCategoryId: categoryId,
			purchaseDate: "2030-01-01",
			availableForUseDate: "2030-01-02",
			netPurchaseAmount: 10_000,
			calculateDepreciation: true,
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: 3,
			frequencyOfDepreciation: 1,
			depreciationStartDate: "2030-01-31",
			expectedValueAfterUsefulLife: 100,
			financeBooks,
		});
		const created = await service.createAsset(createPayload, organizationId);
		assetIds.push(created.id);
		expect(created.assetType).toBe("EXISTING_ASSET");

		const firstReload = await service.findAssetById(created.id, organizationId);
		if (!firstReload) throw new Error("Created R-018 asset did not reload");
		expect(firstReload.assetType).toBe("EXISTING_ASSET");
		const firstHydrated = (firstReload.financeBooks ?? []).map(
			assetFinanceBookFormFromPersisted,
		);
		expect(firstHydrated).toEqual(
			expect.arrayContaining([straightLineForm, writtenDownValueForm]),
		);

		const persistedBooks = await prisma.assetFinanceBook.findMany({
			where: { assetId: created.id },
			include: {
				shiftAllocations: { orderBy: { periodIndex: "asc" } },
				schedules: { include: { entries: { orderBy: { sequence: "asc" } } } },
			},
		});
		const persistedStraightLine = persistedBooks.find(
			(book) => book.financeBookId === defaultFinanceBookId,
		);
		const persistedWrittenDownValue = persistedBooks.find(
			(book) => book.financeBookId === secondaryFinanceBookId,
		);
		if (!persistedStraightLine || !persistedWrittenDownValue) {
			throw new Error("Expected both R-018 finance books to persist");
		}
		expect(persistedStraightLine.rateOfDepreciation).toBeNull();
		expect(
			persistedStraightLine.shiftAllocations.map((row) => ({
				periodIndex: row.periodIndex,
				shift: row.shift,
				factor: Number(row.factor),
			})),
		).toEqual(shiftAllocations);
		expect(Number(persistedWrittenDownValue.rateOfDepreciation)).toBe(20);
		const straightLineSchedule = persistedStraightLine.schedules[0];
		const writtenDownValueSchedule = persistedWrittenDownValue.schedules[0];
		if (!straightLineSchedule || !writtenDownValueSchedule) {
			throw new Error("Expected both R-018 schedules to persist");
		}
		expect(straightLineSchedule.rateOfDepreciation).toBeNull();
		expect(Number(writtenDownValueSchedule.rateOfDepreciation)).toBe(20);
		expect(
			straightLineSchedule.entries
				.slice(0, shiftAllocations.length)
				.map((entry) => entry.shift),
		).toEqual(shiftAllocations.map((allocation) => allocation.shift));

		const updated = await service.updateAsset(
			Asset.updateAssetSchema.parse({
				id: created.id,
				assetCategoryId: categoryId,
				assetType: "EXISTING_ASSET",
				calculateDepreciation: true,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 1,
				expectedValueAfterUsefulLife: 100,
				depreciationStartDate: "2030-01-31",
				financeBooks,
			}),
			organizationId,
		);
		expect(updated.depreciationMethod).toBe("STRAIGHT_LINE");
		expect(updated.totalNumberOfDepreciations).toBe(3);
		expect(updated.frequencyOfDepreciation).toBe(1);
		expect(updated.expectedValueAfterUsefulLife).toBe(100);
		const delayedCategoryReload = await service.findAssetById(
			created.id,
			organizationId,
		);
		if (!delayedCategoryReload) {
			throw new Error("Updated R-018 asset did not reload");
		}
		expect(delayedCategoryReload.depreciationMethod).toBe("STRAIGHT_LINE");
		expect(delayedCategoryReload.totalNumberOfDepreciations).toBe(3);
		expect(delayedCategoryReload.frequencyOfDepreciation).toBe(1);
		expect(delayedCategoryReload.expectedValueAfterUsefulLife).toBe(100);
		expect(
			(delayedCategoryReload.financeBooks ?? []).map(
				assetFinanceBookFormFromPersisted,
			),
		).toEqual(expect.arrayContaining([straightLineForm, writtenDownValueForm]));

		for (const assetType of [
			"COMPOSITE_ASSET",
			"COMPOSITE_COMPONENT",
		] as const) {
			const composite = await service.createAsset(
				Asset.createAssetSchema.parse({
					assetName: `R-018 ${assetType}`,
					assetType,
					companyId,
					purchaseDate: "2030-01-01",
					netPurchaseAmount: 0,
					calculateDepreciation: false,
				}),
				organizationId,
			);
			assetIds.push(composite.id);
			const compositeReload = await service.findAssetById(
				composite.id,
				organizationId,
			);
			expect(compositeReload?.assetType).toBe(assetType);
		}
	});
});
