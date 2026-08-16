import type { Prisma } from "../../../generated/prisma/client";
import { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { AssetDashboardSubService } from "../asset-dashboard.service";

type AssetBookBalance = {
	financeBookId: string | null;
	assetFinanceBookId: string | null;
	precision: number;
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

/**
 * Exercises the selected-book balance boundary against a freshly migrated PostgreSQL schema.
 * The fixture deliberately mixes two books, same-day non-midnight postings, and an ambiguous
 * legacy adjustment so the proof covers the R-005 fail-closed and as-of-date contracts.
 */
describe("Asset finance book correctness integration", () => {
	let prisma: PrismaService;
	let service: AssetService;
	let organizationId: string;
	let companyId: string;
	let categoryId: string;
	let defaultFinanceBookId: string;
	let secondaryFinanceBookId: string;
	let assetId: string;
	let defaultAssetFinanceBookId: string;
	let secondaryAssetFinanceBookId: string;

	const balanceReader = (): AssetBalanceReader =>
		service as unknown as AssetBalanceReader;

	const readBalance = async (
		asOfDate: string,
		financeBookId?: string,
	): Promise<AssetBookBalance> =>
		prisma.client.$transaction((tx) =>
			balanceReader().getAssetBookBalance(
				tx,
				organizationId,
				assetId,
				new Date(asOfDate),
				financeBookId,
			),
		);

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();

		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const organization = await prisma.organization.create({
			data: {
				name: `R-005 Finance Books ${suffix}`,
				slug: `r005-finance-books-${suffix}`,
			},
		});
		organizationId = organization.id;

		const company = await prisma.company.create({
			data: {
				organizationId,
				name: `R-005 Company ${suffix}`,
				defaultCostCenter: `R-005 Cost Center ${suffix}`,
				accumulatedDepreciationAccount: `R-005 Accumulated ${suffix}`,
			},
		});
		companyId = company.id;

		const [defaultBook, secondaryBook] = await Promise.all([
			prisma.financeBook.create({
				data: { name: `R-005 Company Book ${suffix}` },
			}),
			prisma.financeBook.create({
				data: { name: `R-005 Tax Book ${suffix}` },
			}),
		]);
		defaultFinanceBookId = defaultBook.id;
		secondaryFinanceBookId = secondaryBook.id;
		await prisma.company.update({
			where: { id: companyId },
			data: { defaultFinanceBookId },
		});

		const category = await prisma.assetCategory.create({
			data: {
				name: `R-005 Machinery ${suffix}`,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 10,
				frequencyOfDepreciation: 1,
			},
		});
		categoryId = category.id;
		await prisma.assetCategoryAccount.create({
			data: {
				assetCategoryId: categoryId,
				companyId,
				fixedAssetAccount: `R-005 Fixed Asset ${suffix}`,
				accumulatedDepreciationAccount: `R-005 Accumulated ${suffix}`,
			},
		});

		const asset = await prisma.asset.create({
			data: {
				series: `R005-AST-${Date.now()}`,
				assetName: "R-005 Two-book Asset",
				itemCode: `R005-ITEM-${Date.now()}`,
				assetCategoryId: categoryId,
				companyId,
				purchaseDate: new Date("2026-08-01T00:00:00.000Z"),
				availableForUseDate: new Date("2026-08-01T00:00:00.000Z"),
				netPurchaseAmount: 100,
				calculateDepreciation: true,
				valueAfterDepreciation: 70,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 10,
				frequencyOfDepreciation: 1,
				depreciationStartDate: new Date("2026-08-01T00:00:00.000Z"),
				status: "PARTIALLY_DEPRECIATED",
			},
		});
		assetId = asset.id;

		const [defaultAssetBook, secondaryAssetBook] = await Promise.all([
			prisma.assetFinanceBook.create({
				data: {
					assetId,
					financeBookId: defaultFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 10,
					frequencyOfDepreciation: 1,
					depreciationStartDate: new Date("2026-08-01T00:00:00.000Z"),
					openingAccumulatedDepreciation: 30,
					openingNumberOfBookedDepreciations: 3,
					valueAfterDepreciation: 70,
					totalNumberOfBookedDepreciations: 3,
					postingStatus: "PARTIALLY_DEPRECIATED",
				},
			}),
			prisma.assetFinanceBook.create({
				data: {
					assetId,
					financeBookId: secondaryFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 10,
					frequencyOfDepreciation: 1,
					depreciationStartDate: new Date("2026-08-01T00:00:00.000Z"),
					openingAccumulatedDepreciation: 10,
					openingNumberOfBookedDepreciations: 1,
					valueAfterDepreciation: 90,
					totalNumberOfBookedDepreciations: 1,
					postingStatus: "PARTIALLY_DEPRECIATED",
				},
			}),
		]);
		defaultAssetFinanceBookId = defaultAssetBook.id;
		secondaryAssetFinanceBookId = secondaryAssetBook.id;

		await prisma.assetValueAdjustment.createMany({
			data: [
				{
					series: `R005-AVA-DEFAULT-${Date.now()}`,
					assetId,
					financeBookId: defaultFinanceBookId,
					assetCategorySnapshot: category.name,
					adjustmentDate: new Date("2026-08-10T15:30:00.000Z"),
					currentAssetValue: 70,
					newAssetValue: 75,
					differenceAmount: 5,
					differenceAccount: "R-005 Revaluation Reserve",
					fixedAssetAccount: "R-005 Fixed Asset",
					status: "SUBMITTED",
					direction: "INCREASE",
					previousAssetStatus: "PARTIALLY_DEPRECIATED",
				},
				{
					series: `R005-AVA-SECONDARY-${Date.now()}`,
					assetId,
					financeBookId: secondaryFinanceBookId,
					assetCategorySnapshot: category.name,
					adjustmentDate: new Date("2026-08-10T15:30:00.000Z"),
					currentAssetValue: 90,
					newAssetValue: 130,
					differenceAmount: 40,
					differenceAccount: "R-005 Tax Revaluation Reserve",
					fixedAssetAccount: "R-005 Tax Fixed Asset",
					status: "SUBMITTED",
					direction: "INCREASE",
					previousAssetStatus: "PARTIALLY_DEPRECIATED",
				},
				{
					series: `R005-AVA-FUTURE-${Date.now()}`,
					assetId,
					financeBookId: defaultFinanceBookId,
					assetCategorySnapshot: category.name,
					adjustmentDate: new Date("2026-08-11T00:00:00.000Z"),
					currentAssetValue: 75,
					newAssetValue: 95,
					differenceAmount: 20,
					differenceAccount: "R-005 Future Reserve",
					fixedAssetAccount: "R-005 Fixed Asset",
					status: "SUBMITTED",
					direction: "INCREASE",
					previousAssetStatus: "PARTIALLY_DEPRECIATED",
				},
			],
		});

		await Promise.all([
			prisma.assetDepreciationJournalEntry.create({
				data: {
					series: `R005-DEP-DEFAULT-${Date.now()}`,
					assetId,
					assetFinanceBookId: defaultAssetFinanceBookId,
					companyId,
					financeBookName: defaultBook.name,
					postingDate: new Date("2026-08-10T23:59:00.000Z"),
					depreciationAmount: 5,
				},
			}),
			prisma.assetDepreciationJournalEntry.create({
				data: {
					series: `R005-DEP-SECONDARY-${Date.now()}`,
					assetId,
					assetFinanceBookId: secondaryAssetFinanceBookId,
					companyId,
					financeBookName: secondaryBook.name,
					postingDate: new Date("2026-08-10T23:59:00.000Z"),
					depreciationAmount: 10,
				},
			}),
		]);

		service = new AssetService(
			prisma,
			new AssetDashboardSubService(prisma),
			new FiscalYearService(prisma),
		);
	});

	afterAll(async () => {
		if (!prisma) return;
		try {
			if (assetId) {
				await prisma.assetDisposal.deleteMany({ where: { assetId } });
				await prisma.client.assetAccountingEntry.deleteMany({
					where: { assetId },
				});
				await prisma.assetDepreciationJournalEntry.deleteMany({
					where: { assetId },
				});
				await prisma.assetValueAdjustment.deleteMany({ where: { assetId } });
				await prisma.assetFinanceBook.deleteMany({ where: { assetId } });
				await prisma.asset.delete({ where: { id: assetId } });
			}
			if (categoryId) {
				await prisma.assetCategoryAccount.deleteMany({
					where: { assetCategoryId: categoryId },
				});
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

	it("isolates selected books, honors date boundaries, persists default lineage, and rejects null legacy context", async () => {
		const defaultBalance = await readBalance("2026-08-10T23:59:59.999Z");
		expect(defaultBalance).toEqual({
			financeBookId: defaultFinanceBookId,
			assetFinanceBookId: defaultAssetFinanceBookId,
			precision: 2,
			grossValue: 105,
			carryingValue: 70,
			accumulatedDepreciation: 35,
		});

		const secondaryBalance = await readBalance(
			"2026-08-10T23:59:59.999Z",
			secondaryFinanceBookId,
		);
		expect(secondaryBalance).toEqual({
			financeBookId: secondaryFinanceBookId,
			assetFinanceBookId: secondaryAssetFinanceBookId,
			precision: 2,
			grossValue: 140,
			carryingValue: 120,
			accumulatedDepreciation: 20,
		});

		const beforeFutureAdjustment = await readBalance("2026-08-10");
		expect(beforeFutureAdjustment.grossValue).toBe(105);
		const afterFutureAdjustment = await readBalance("2026-08-11");
		expect(afterFutureAdjustment.grossValue).toBe(125);

		const disposal = await service.sellAsset(
			{
				assetId,
				disposalDate: "2026-08-10",
				salesAmount: 80,
				proceedsAccount: "R-005 Bank",
				gainLossAccount: "R-005 Gain Loss",
			},
			organizationId,
		);
		expect(disposal.financeBookId).toBe(defaultFinanceBookId);
		expect(disposal.gainLossAmount).toBe(10);

		const [persistedDisposal, persistedAccounting, persistedAsset] =
			await Promise.all([
				prisma.assetDisposal.findFirstOrThrow({
					where: { id: disposal.id },
					select: { financeBookId: true, gainLossAmount: true },
				}),
				prisma.client.assetAccountingEntry.findFirstOrThrow({
					where: { assetId, sourceType: "DISPOSAL" },
					select: { financeBookId: true },
				}),
				prisma.asset.findUniqueOrThrow({
					where: { id: assetId },
					select: { status: true, valueAfterDepreciation: true },
				}),
			]);
		expect(persistedDisposal.financeBookId).toBe(defaultFinanceBookId);
		expect(Number(persistedDisposal.gainLossAmount)).toBe(10);
		expect(persistedAccounting.financeBookId).toBe(defaultFinanceBookId);
		expect(persistedAsset.status).toBe("SOLD");
		// The root Asset row remains the Company-default compatibility projection;
		// posting the disposal does not replace it with a secondary-book value.
		expect(Number(persistedAsset.valueAfterDepreciation)).toBe(70);

		await prisma.assetValueAdjustment.create({
			data: {
				series: `R005-AVA-LEGACY-${Date.now()}`,
				assetId,
				financeBookId: null,
				assetCategorySnapshot: "R-005 legacy",
				adjustmentDate: new Date("2026-08-10T12:00:00.000Z"),
				currentAssetValue: 70,
				newAssetValue: 71,
				differenceAmount: 1,
				differenceAccount: "R-005 Legacy Reserve",
				fixedAssetAccount: "R-005 Fixed Asset",
				status: "SUBMITTED",
				direction: "INCREASE",
				previousAssetStatus: "PARTIALLY_DEPRECIATED",
			},
		});
		await expect(
			readBalance("2026-08-10", defaultFinanceBookId),
		).rejects.toThrow(/without a finance book/);
	});
});
