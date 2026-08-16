import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { FixedAssetRegisterReportService } from "../fixed-asset-register-report";

/**
 * Runs the Fixed Asset Register against persisted rows on PostgreSQL.
 * The fixture deliberately combines same-named Companies in two Organizations,
 * two finance books, future-dated movements, a terminal lifecycle event, and
 * an active unposted schedule whose amounts must not be counted by the report.
 */
describe("R-006 Fixed Asset Register integration", () => {
	let prisma: PrismaService;
	let reportService: FixedAssetRegisterReportService;
	let assetService: AssetService;
	let organizationAId: string;
	let organizationBId: string;
	let companyAId: string;
	let companyBId: string;
	let defaultFinanceBookId: string;
	let secondaryFinanceBookId: string;
	let foreignFinanceBookId: string;
	let assetAId: string;
	let assetBId: string;
	let defaultAssetFinanceBookId: string;
	let secondaryAssetFinanceBookId: string;
	let categoryId: string;
	let locationId: string;
	let suffix: string;

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();
		reportService = new FixedAssetRegisterReportService(prisma);
		assetService = new AssetService(
			prisma,
			{} as ConstructorParameters<typeof AssetService>[1],
			{} as ConstructorParameters<typeof AssetService>[2],
		);
		suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const [organizationA, organizationB] = await Promise.all([
			prisma.organization.create({
				data: {
					name: `R-006 Organization A ${suffix}`,
					slug: `r006-organization-a-${suffix}`,
				},
			}),
			prisma.organization.create({
				data: {
					name: `R-006 Organization B ${suffix}`,
					slug: `r006-organization-b-${suffix}`,
				},
			}),
		]);
		organizationAId = organizationA.id;
		organizationBId = organizationB.id;

		const [defaultBook, secondaryBook, foreignBook] = await Promise.all([
			prisma.financeBook.create({
				data: { name: `R-006 Corporate Book ${suffix}` },
			}),
			prisma.financeBook.create({
				data: { name: `R-006 Tax Book ${suffix}` },
			}),
			prisma.financeBook.create({
				data: { name: `R-006 Foreign Book ${suffix}` },
			}),
		]);
		defaultFinanceBookId = defaultBook.id;
		secondaryFinanceBookId = secondaryBook.id;
		foreignFinanceBookId = foreignBook.id;

		const [companyA, companyB] = await Promise.all([
			prisma.company.create({
				data: {
					organizationId: organizationAId,
					name: `R-006 Shared Company ${suffix}`,
					defaultFinanceBookId,
				},
			}),
			prisma.company.create({
				data: {
					organizationId: organizationBId,
					name: `R-006 Shared Company ${suffix}`,
					defaultFinanceBookId: foreignFinanceBookId,
				},
			}),
		]);
		companyAId = companyA.id;
		companyBId = companyB.id;

		const [category, location] = await Promise.all([
			prisma.assetCategory.create({
				data: { name: `R-006 Machinery ${suffix}` },
			}),
			prisma.location.create({
				data: { name: `R-006 Plant ${suffix}` },
			}),
		]);
		categoryId = category.id;
		locationId = location.id;

		const assetA = await prisma.asset.create({
			data: {
				series: `R006-A-${suffix}`,
				assetName: "R-006 Company A asset",
				itemCode: `R006-IA-${suffix}`,
				assetCategoryId: categoryId,
				locationId,
				companyId: companyAId,
				purchaseDate: new Date("2026-01-10T00:00:00.000Z"),
				availableForUseDate: new Date("2026-01-15T00:00:00.000Z"),
				netPurchaseAmount: 1_200,
				calculateDepreciation: true,
				valueAfterDepreciation: 777,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 10,
				frequencyOfDepreciation: 1,
				depreciationStartDate: new Date("2026-01-15T00:00:00.000Z"),
				status: "SOLD",
			},
		});
		assetAId = assetA.id;

		const assetB = await prisma.asset.create({
			data: {
				series: `R006-B-${suffix}`,
				assetName: "R-006 Company B asset",
				itemCode: `R006-IB-${suffix}`,
				companyId: companyBId,
				purchaseDate: new Date("2026-01-10T00:00:00.000Z"),
				netPurchaseAmount: 9_999,
				status: "SUBMITTED",
			},
		});
		assetBId = assetB.id;

		await prisma.assetFinanceBook.create({
			data: {
				assetId: assetBId,
				financeBookId: foreignFinanceBookId,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 1,
				frequencyOfDepreciation: 1,
				depreciationStartDate: new Date("2026-01-15T00:00:00.000Z"),
				postingStatus: "PENDING",
			},
		});

		const [defaultAssetBook, secondaryAssetBook] = await Promise.all([
			prisma.assetFinanceBook.create({
				data: {
					assetId: assetAId,
					financeBookId: defaultFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 10,
					frequencyOfDepreciation: 1,
					depreciationStartDate: new Date("2026-01-15T00:00:00.000Z"),
					openingAccumulatedDepreciation: 100,
					valueAfterDepreciation: 1_100,
					postingStatus: "PARTIALLY_DEPRECIATED",
				},
			}),
			prisma.assetFinanceBook.create({
				data: {
					assetId: assetAId,
					financeBookId: secondaryFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 10,
					frequencyOfDepreciation: 1,
					depreciationStartDate: new Date("2026-01-15T00:00:00.000Z"),
					openingAccumulatedDepreciation: 300,
					valueAfterDepreciation: 900,
					postingStatus: "PARTIALLY_DEPRECIATED",
				},
			}),
		]);
		defaultAssetFinanceBookId = defaultAssetBook.id;
		secondaryAssetFinanceBookId = secondaryAssetBook.id;

		await prisma.assetDepreciationSchedule.create({
			data: {
				assetId: assetAId,
				assetFinanceBookId: defaultAssetFinanceBookId,
				revisionNumber: 1,
				status: "ACTIVE",
				startDate: new Date("2026-01-15T00:00:00.000Z"),
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 10,
				frequencyOfDepreciation: 1,
				bookedDepreciations: 0,
				remainingDepreciations: 10,
				baseAssetValue: 1_200,
				entries: {
					create: [
						{
							sequence: 1,
							scheduleDate: new Date("2026-01-31T00:00:00.000Z"),
							depreciationAmount: 50,
							accumulatedDepreciationAmount: 150,
							bookValueAfterDepreciation: 1_050,
						},
						{
							sequence: 2,
							scheduleDate: new Date("2026-03-31T00:00:00.000Z"),
							depreciationAmount: 75,
							accumulatedDepreciationAmount: 225,
							bookValueAfterDepreciation: 975,
						},
					],
				},
			},
		});

		await prisma.assetDepreciationJournalEntry.createMany({
			data: [
				{
					series: `R006-D1-${suffix}`,
					assetId: assetAId,
					assetFinanceBookId: defaultAssetFinanceBookId,
					companyId: companyAId,
					financeBookName: defaultBook.name,
					postingDate: new Date("2026-01-31T00:00:00.000Z"),
					depreciationAmount: 50,
				},
				{
					series: `R006-D2-${suffix}`,
					assetId: assetAId,
					assetFinanceBookId: defaultAssetFinanceBookId,
					companyId: companyAId,
					financeBookName: defaultBook.name,
					postingDate: new Date("2026-03-31T00:00:00.000Z"),
					depreciationAmount: 75,
				},
				{
					series: `R006-D3-${suffix}`,
					assetId: assetAId,
					assetFinanceBookId: defaultAssetFinanceBookId,
					companyId: companyAId,
					financeBookName: defaultBook.name,
					postingDate: new Date("2026-04-01T00:00:00.000Z"),
					depreciationAmount: 500,
				},
				{
					series: `R006-D4-${suffix}`,
					assetId: assetAId,
					assetFinanceBookId: secondaryAssetFinanceBookId,
					companyId: companyAId,
					financeBookName: secondaryBook.name,
					postingDate: new Date("2026-01-31T00:00:00.000Z"),
					depreciationAmount: 20,
				},
				{
					series: `R006-D5-${suffix}`,
					assetId: assetAId,
					assetFinanceBookId: secondaryAssetFinanceBookId,
					companyId: companyAId,
					financeBookName: secondaryBook.name,
					postingDate: new Date("2026-03-31T00:00:00.000Z"),
					depreciationAmount: 40,
				},
			],
		});

		await prisma.assetValueAdjustment.createMany({
			data: [
				{
					series: `R006-V1-${suffix}`,
					assetId: assetAId,
					financeBookId: defaultFinanceBookId,
					adjustmentDate: new Date("2026-02-01T00:00:00.000Z"),
					currentAssetValue: 1_000,
					newAssetValue: 1_025,
					differenceAmount: 25,
					differenceAccount: "R-006 Reserve",
					fixedAssetAccount: "R-006 Fixed Asset",
					status: "SUBMITTED",
					direction: "INCREASE",
					previousAssetStatus: "SUBMITTED",
				},
				{
					series: `R006-V2-${suffix}`,
					assetId: assetAId,
					financeBookId: secondaryFinanceBookId,
					adjustmentDate: new Date("2026-02-01T00:00:00.000Z"),
					currentAssetValue: 900,
					newAssetValue: 890,
					differenceAmount: -10,
					differenceAccount: "R-006 Tax Reserve",
					fixedAssetAccount: "R-006 Tax Fixed Asset",
					status: "SUBMITTED",
					direction: "DECREASE",
					previousAssetStatus: "SUBMITTED",
				},
				{
					series: `R006-V3-${suffix}`,
					assetId: assetAId,
					financeBookId: defaultFinanceBookId,
					adjustmentDate: new Date("2026-04-01T00:00:00.000Z"),
					currentAssetValue: 1_025,
					newAssetValue: 1_525,
					differenceAmount: 500,
					differenceAccount: "R-006 Future Reserve",
					fixedAssetAccount: "R-006 Fixed Asset",
					status: "SUBMITTED",
					direction: "INCREASE",
					previousAssetStatus: "SUBMITTED",
				},
			],
		});

		await prisma.assetCapitalization.create({
			data: {
				series: `R006-C1-${suffix}`,
				companyId: companyAId,
				financeBookId: defaultFinanceBookId,
				postingDate: new Date("2026-03-15T00:00:00.000Z"),
				targetType: "EXISTING_ASSET",
				targetAssetId: assetAId,
				status: "SUBMITTED",
				totalValue: 200,
				totalAssetValue: 200,
			},
		});

		await prisma.assetDisposal.create({
			data: {
				series: `R006-X1-${suffix}`,
				assetId: assetAId,
				companyId: companyAId,
				financeBookId: defaultFinanceBookId,
				disposalDate: new Date("2026-04-15T00:00:00.000Z"),
				disposalType: "SELL",
				gainLossAmount: 0,
				status: "POSTED",
				previousAssetStatus: "SUBMITTED",
			},
		});
	});

	afterAll(async () => {
		if (!prisma) return;
		try {
			if (assetAId || assetBId) {
				const assetIds = [assetAId, assetBId].filter((id): id is string =>
					Boolean(id),
				);
				await prisma.assetDisposal.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.assetCapitalization.deleteMany({
					where: { targetAssetId: { in: assetIds } },
				});
				await prisma.assetValueAdjustment.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.assetDepreciationJournalEntry.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.assetDepreciationSchedule.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.assetFinanceBook.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
			}
			if (categoryId) {
				await prisma.assetCategory.delete({ where: { id: categoryId } });
			}
			if (locationId) {
				await prisma.location.delete({ where: { id: locationId } });
			}
			if (companyAId) {
				await prisma.company.update({
					where: { id: companyAId },
					data: { defaultFinanceBookId: null },
				});
			}
			if (companyAId || companyBId) {
				await prisma.company.deleteMany({
					where: { id: { in: [companyAId, companyBId].filter(Boolean) } },
				});
			}
			if (organizationAId || organizationBId) {
				await prisma.organization.deleteMany({
					where: {
						id: { in: [organizationAId, organizationBId].filter(Boolean) },
					},
				});
			}
			if (
				defaultFinanceBookId ||
				secondaryFinanceBookId ||
				foreignFinanceBookId
			) {
				await prisma.financeBook.deleteMany({
					where: {
						id: {
							in: [
								defaultFinanceBookId,
								secondaryFinanceBookId,
								foreignFinanceBookId,
							].filter((id): id is string => Boolean(id)),
						},
					},
				});
			}
		} finally {
			await prisma.onModuleDestroy();
		}
	});

	it("scopes by exact Company and keeps the report read-only", async () => {
		const before = await prisma.asset.findUniqueOrThrow({
			where: { id: assetAId },
			select: { netPurchaseAmount: true, valueAfterDepreciation: true },
		});
		const beforeJournalCount = await prisma.assetDepreciationJournalEntry.count(
			{
				where: { assetId: assetAId },
			},
		);

		const report = await reportService.generateReport(
			{
				companyId: companyAId,
				fromDate: "2026-01-01",
				toDate: "2026-03-31",
				groupBy: "ASSET_CATEGORY",
			},
			organizationAId,
		);

		expect(report.rows.map((row) => row.assetId)).toEqual([assetAId]);
		expect(report.rows.some((row) => row.assetId === assetBId)).toBe(false);
		expect(report.scope.companyId).toBe(companyAId);
		expect(report.scope.financeBookId).toBe(defaultFinanceBookId);
		expect(report.rows[0]).toMatchObject({
			depreciatedAmount: 125,
			accumulatedDepreciation: 225,
			revaluationAmount: 25,
			netPurchaseAmount: 1_200,
			netBookValue: 1_000,
		});

		const after = await prisma.asset.findUniqueOrThrow({
			where: { id: assetAId },
			select: { netPurchaseAmount: true, valueAfterDepreciation: true },
		});
		expect(after).toEqual(before);
		expect(
			await prisma.assetDepreciationJournalEntry.count({
				where: { assetId: assetAId },
			}),
		).toBe(beforeJournalCount);

		await expect(
			reportService.generateReport(
				{
					companyId: companyBId,
					fromDate: "2026-01-01",
					toDate: "2026-03-31",
					groupBy: "ASSET_CATEGORY",
				},
				organizationAId,
			),
		).rejects.toThrow(/not available in the active organization/);
	});

	it("enforces Company-scoped FinanceBook eligibility for report and options", async () => {
		const siblingBook = await prisma.financeBook.create({
			data: { name: `R-006 Same-org foreign book ${suffix}` },
		});
		const siblingCompany = await prisma.company.create({
			data: {
				organizationId: organizationAId,
				name: `R-006 Sibling Company ${suffix}`,
			},
		});
		const siblingAsset = await prisma.asset.create({
			data: {
				series: `R006-SIBLING-${suffix}`,
				assetName: "R-006 same-organization sibling asset",
				itemCode: `R006-IS-${suffix}`,
				companyId: siblingCompany.id,
				purchaseDate: new Date("2026-01-10T00:00:00.000Z"),
				netPurchaseAmount: 1,
				status: "SUBMITTED",
			},
		});
		try {
			await prisma.assetFinanceBook.create({
				data: {
					assetId: siblingAsset.id,
					financeBookId: siblingBook.id,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 1,
					frequencyOfDepreciation: 1,
					depreciationStartDate: new Date("2026-01-10T00:00:00.000Z"),
					postingStatus: "PENDING",
				},
			});

			const options = await assetService.findAllFinanceBooks(organizationAId, {
				take: 250,
				companyId: companyAId,
			});
			expect(options.items.map((book) => book.id)).toEqual(
				expect.arrayContaining([defaultFinanceBookId, secondaryFinanceBookId]),
			);
			expect(
				options.items.some((book) => book.id === foreignFinanceBookId),
			).toBe(false);
			expect(options.items.some((book) => book.id === siblingBook.id)).toBe(
				false,
			);

			const explicitDefault = await reportService.generateReport(
				{
					companyId: companyAId,
					financeBookId: defaultFinanceBookId,
					fromDate: "2026-01-01",
					toDate: "2026-03-31",
					groupBy: "ASSET_CATEGORY",
				},
				organizationAId,
			);
			expect(explicitDefault.scope.financeBookSelection).toBe("EXPLICIT");
			expect(explicitDefault.scope.financeBookId).toBe(defaultFinanceBookId);

			await expect(
				reportService.generateReport(
					{
						companyId: companyAId,
						financeBookId: siblingBook.id,
						fromDate: "2026-01-01",
						toDate: "2026-03-31",
						groupBy: "ASSET_CATEGORY",
					},
					organizationAId,
				),
			).rejects.toThrow(/not eligible for Company/);

			await expect(
				reportService.generateReport(
					{
						companyId: companyAId,
						financeBookId: foreignFinanceBookId,
						fromDate: "2026-01-01",
						toDate: "2026-03-31",
						groupBy: "ASSET_CATEGORY",
					},
					organizationAId,
				),
			).rejects.toThrow(/not eligible for Company/);
		} finally {
			await prisma.assetFinanceBook.deleteMany({
				where: { assetId: siblingAsset.id },
			});
			await prisma.asset.delete({ where: { id: siblingAsset.id } });
			await prisma.company.delete({ where: { id: siblingCompany.id } });
			await prisma.financeBook.delete({ where: { id: siblingBook.id } });
		}
	});

	it("reconstructs selected-book history, fiscal boundaries, and terminal status", async () => {
		const beforeCapitalization = await reportService.generateReport(
			{
				companyId: companyAId,
				fromDate: "2026-01-01",
				toDate: "2026-02-28",
				groupBy: "ASSET_CATEGORY",
			},
			organizationAId,
		);
		expect(beforeCapitalization.rows[0]).toMatchObject({
			depreciatedAmount: 50,
			accumulatedDepreciation: 150,
			revaluationAmount: 25,
			netPurchaseAmount: 1_000,
			netBookValue: 875,
		});

		const secondary = await reportService.generateReport(
			{
				companyId: companyAId,
				financeBookId: secondaryFinanceBookId,
				fromDate: "2026-01-01",
				toDate: "2026-03-31",
				groupBy: "ASSET_CATEGORY",
			},
			organizationAId,
		);
		expect(secondary.rows[0]).toMatchObject({
			depreciatedAmount: 60,
			accumulatedDepreciation: 360,
			revaluationAmount: -10,
			netPurchaseAmount: 1_000,
			netBookValue: 630,
			status: "SUBMITTED",
		});
		expect(secondary.scope.financeBookSelection).toBe("EXPLICIT");

		const disposed = await reportService.generateReport(
			{
				companyId: companyAId,
				fromDate: "2026-01-01",
				toDate: "2026-04-30",
				groupBy: "ASSET_CATEGORY",
				status: "DISPOSED",
			},
			organizationAId,
		);
		expect(disposed.rows).toHaveLength(1);
		expect(disposed.rows[0]?.status).toBe("SOLD");
		expect(disposed.rows[0]?.depreciatedAmount).toBe(625);
		expect(disposed.rows[0]?.revaluationAmount).toBe(525);

		const inLocationAfterDisposal = await reportService.generateReport(
			{
				companyId: companyAId,
				fromDate: "2026-01-01",
				toDate: "2026-04-30",
				groupBy: "ASSET_CATEGORY",
			},
			organizationAId,
		);
		expect(inLocationAfterDisposal.rows).toHaveLength(0);
	});

	it("derives ERPNext chart buckets from included rows and report date", async () => {
		const secondAsset = await prisma.asset.create({
			data: {
				series: `R006-CHART-${suffix}`,
				assetName: "R-006 chart companion asset",
				itemCode: `R006-IC-${suffix}`,
				assetCategoryId: categoryId,
				locationId,
				companyId: companyAId,
				purchaseDate: new Date("2026-01-20T00:00:00.000Z"),
				netPurchaseAmount: 300,
				status: "SUBMITTED",
			},
		});
		try {
			const report = await reportService.generateReport(
				{
					companyId: companyAId,
					fromDate: "2026-01-01",
					toDate: "2026-03-31",
					groupBy: "ASSET_CATEGORY",
				},
				organizationAId,
			);
			expect(report.rows).toHaveLength(2);
			expect(report.chartPoints).toEqual([
				{ month: "2026-01", assetValue: 1_300, depreciatedAmount: 125 },
				{ month: "2026-02", assetValue: 0, depreciatedAmount: 0 },
				{ month: "2026-03", assetValue: 0, depreciatedAmount: 0 },
			]);

			const exactPurchaseDate = await reportService.generateReport(
				{
					companyId: companyAId,
					fromDate: "2026-01-10",
					toDate: "2026-01-10",
					groupBy: "ASSET_CATEGORY",
				},
				organizationAId,
			);
			expect(exactPurchaseDate.rows.map((row) => row.assetId)).toEqual([
				assetAId,
			]);
			expect(exactPurchaseDate.chartPoints).toEqual([
				{ month: "2026-01", assetValue: 900, depreciatedAmount: 0 },
			]);

			const categoryFiltered = await reportService.generateReport(
				{
					companyId: companyAId,
					fromDate: "2026-01-01",
					toDate: "2026-03-31",
					groupBy: "LOCATION",
					assetCategory: `R-006 Machinery ${suffix}`,
				},
				organizationAId,
			);
			expect(categoryFiltered.rows).toHaveLength(2);
			expect(categoryFiltered.chartPoints[0]).toEqual({
				month: "2026-01",
				assetValue: 1_300,
				depreciatedAmount: 125,
			});

			const locationFiltered = await reportService.generateReport(
				{
					companyId: companyAId,
					fromDate: "2026-01-01",
					toDate: "2026-03-31",
					groupBy: "ASSET_CATEGORY",
					location: `R-006 Plant ${suffix}`,
				},
				organizationAId,
			);
			expect(locationFiltered.rows).toHaveLength(2);
			expect(locationFiltered.chartPoints[0]?.assetValue).toBe(1_300);

			const disposed = await reportService.generateReport(
				{
					companyId: companyAId,
					fromDate: "2026-01-01",
					toDate: "2026-04-30",
					groupBy: "ASSET_CATEGORY",
					status: "DISPOSED",
				},
				organizationAId,
			);
			expect(disposed.rows.map((row) => row.assetId)).toEqual([assetAId]);
			expect(disposed.chartPoints[0]).toEqual({
				month: "2026-01",
				assetValue: 1_000,
				depreciatedAmount: 625,
			});
		} finally {
			await prisma.asset.delete({ where: { id: secondAsset.id } });
		}
	});

	it("reconstructs pre-disposal nullable lineage and fails closed once effective", async () => {
		const disposalTypes = ["SELL", "SCRAP"] as const;
		const fixtures: Array<{
			assetId: string;
			disposalType: (typeof disposalTypes)[number];
		}> = [];
		const snapshot = async (assetId: string) => ({
			asset: await prisma.asset.findUniqueOrThrow({
				where: { id: assetId },
				select: {
					status: true,
					disposalDate: true,
					netPurchaseAmount: true,
					openingAccumulatedDepreciation: true,
					valueAfterDepreciation: true,
					isFullyDepreciated: true,
				},
			}),
			disposals: await prisma.assetDisposal.findMany({
				where: { assetId },
				orderBy: { id: "asc" },
				select: {
					financeBookId: true,
					disposalDate: true,
					disposalType: true,
					previousAssetStatus: true,
					status: true,
					gainLossAmount: true,
				},
			}),
			financeBooks: await prisma.assetFinanceBook.findMany({
				where: { assetId },
				orderBy: { id: "asc" },
				select: {
					financeBookId: true,
					openingAccumulatedDepreciation: true,
					valueAfterDepreciation: true,
					postingStatus: true,
					lastPostedDepreciationDate: true,
				},
			}),
			journals: await prisma.assetDepreciationJournalEntry.findMany({
				where: { assetId },
				orderBy: { id: "asc" },
				select: {
					assetFinanceBookId: true,
					postingDate: true,
					depreciationAmount: true,
					status: true,
				},
			}),
			accountingEntries: await prisma.client.assetAccountingEntry.findMany({
				where: { assetId },
				orderBy: { id: "asc" },
				select: {
					financeBookId: true,
					sourceType: true,
					sourceId: true,
					postingDate: true,
					status: true,
					lines: {
						orderBy: { id: "asc" },
						select: {
							lineType: true,
							account: true,
							debitAmount: true,
							creditAmount: true,
						},
					},
				},
			}),
		});
		try {
			for (const [index, disposalType] of disposalTypes.entries()) {
				const asset = await prisma.asset.create({
					data: {
						series: `R006-NULL-${disposalType}-${suffix}`,
						assetName: `R-006 nullable ${disposalType.toLowerCase()} asset`,
						itemCode: `R006-IN-${index}-${suffix}`,
						companyId: companyAId,
						purchaseDate: new Date("2026-05-01T00:00:00.000Z"),
						availableForUseDate: new Date("2026-05-01T00:00:00.000Z"),
						netPurchaseAmount: 100,
						calculateDepreciation: true,
						status: disposalType === "SELL" ? "SOLD" : "SCRAPPED",
					},
				});
				await prisma.assetFinanceBook.create({
					data: {
						assetId: asset.id,
						financeBookId: defaultFinanceBookId,
						depreciationMethod: "STRAIGHT_LINE",
						totalNumberOfDepreciations: 1,
						frequencyOfDepreciation: 1,
						depreciationStartDate: new Date("2026-05-01T00:00:00.000Z"),
						postingStatus: "PENDING",
					},
				});
				await prisma.assetDisposal.create({
					data: {
						series: `R006-NULL-D1-${disposalType}-${suffix}`,
						assetId: asset.id,
						companyId: companyAId,
						financeBookId: null,
						disposalDate: new Date("2026-05-15T00:00:00.000Z"),
						disposalType,
						gainLossAmount: 0,
						status: "POSTED",
						previousAssetStatus: "SUBMITTED",
					},
				});
				fixtures.push({
					assetId: asset.id,
					disposalType,
				});
			}

			for (const { assetId, disposalType } of fixtures) {
				const before = await snapshot(assetId);
				const preDisposalInLocation = await reportService.generateReport(
					{
						companyId: companyAId,
						assetId,
						fromDate: "2026-05-01",
						toDate: "2026-05-14",
						groupBy: "ASSET_CATEGORY",
						status: "IN_LOCATION",
					},
					organizationAId,
				);
				expect(preDisposalInLocation.rows).toHaveLength(1);
				expect(preDisposalInLocation.rows[0]).toMatchObject({
					assetId,
					status: "SUBMITTED",
				});

				const preDisposalDisposed = await reportService.generateReport(
					{
						companyId: companyAId,
						assetId,
						fromDate: "2026-05-01",
						toDate: "2026-05-14",
						groupBy: "ASSET_CATEGORY",
						status: "DISPOSED",
					},
					organizationAId,
				);
				expect(preDisposalDisposed.rows).toHaveLength(0);

				for (const toDate of ["2026-05-15", "2026-05-16"]) {
					for (const status of ["IN_LOCATION", "DISPOSED"] as const) {
						await expect(
							reportService.generateReport(
								{
									companyId: companyAId,
									assetId,
									fromDate: "2026-05-01",
									toDate,
									groupBy: "ASSET_CATEGORY",
									status,
								},
								organizationAId,
							),
						).rejects.toThrow(
							new RegExp(
								`posted ${disposalType.toLowerCase()} disposal on 2026-05-15.*without finance-book lineage`,
							),
						);
					}
				}
				expect(await snapshot(assetId)).toEqual(before);
			}
		} finally {
			const assetIds = fixtures.map(({ assetId }) => assetId);
			if (assetIds.length > 0) {
				await prisma.assetDisposal.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.assetFinanceBook.deleteMany({
					where: { assetId: { in: assetIds } },
				});
				await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
			}
		}
	});

	it("preserves explicit SELL and SCRAP lineage around the disposal date", async () => {
		const scrapAsset = await prisma.asset.create({
			data: {
				series: `R006-EXPLICIT-SCRAP-${suffix}`,
				assetName: "R-006 explicit scrap asset",
				itemCode: `R006-ES-${suffix}`,
				companyId: companyAId,
				purchaseDate: new Date("2026-05-01T00:00:00.000Z"),
				availableForUseDate: new Date("2026-05-01T00:00:00.000Z"),
				netPurchaseAmount: 100,
				calculateDepreciation: true,
				status: "SCRAPPED",
			},
		});
		try {
			await prisma.assetFinanceBook.create({
				data: {
					assetId: scrapAsset.id,
					financeBookId: defaultFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 1,
					frequencyOfDepreciation: 1,
					depreciationStartDate: new Date("2026-05-01T00:00:00.000Z"),
					postingStatus: "PENDING",
				},
			});
			await prisma.assetDisposal.create({
				data: {
					series: `R006-EXPLICIT-D-SCRAP-${suffix}`,
					assetId: scrapAsset.id,
					companyId: companyAId,
					financeBookId: defaultFinanceBookId,
					disposalDate: new Date("2026-05-15T00:00:00.000Z"),
					disposalType: "SCRAP",
					gainLossAmount: 0,
					status: "POSTED",
					previousAssetStatus: "SUBMITTED",
				},
			});

			const cases = [
				{
					assetId: assetAId,
					fromDate: "2026-01-01",
					disposalDate: "2026-04-15",
					terminalStatus: "SOLD",
				},
				{
					assetId: scrapAsset.id,
					fromDate: "2026-05-01",
					disposalDate: "2026-05-15",
					terminalStatus: "SCRAPPED",
				},
			] as const;

			for (const testCase of cases) {
				const dateCases = [
					{
						toDate:
							testCase.disposalDate === "2026-04-15"
								? "2026-04-14"
								: "2026-05-14",
						status: "SUBMITTED",
						inLocationRows: 1,
						disposedRows: 0,
					},
					{
						toDate: testCase.disposalDate,
						status: testCase.terminalStatus,
						inLocationRows: 0,
						disposedRows: 1,
					},
					{
						toDate:
							testCase.disposalDate === "2026-04-15"
								? "2026-04-16"
								: "2026-05-16",
						status: testCase.terminalStatus,
						inLocationRows: 0,
						disposedRows: 1,
					},
				] as const;

				for (const dateCase of dateCases) {
					const baseInput = {
						companyId: companyAId,
						assetId: testCase.assetId,
						fromDate: testCase.fromDate,
						toDate: dateCase.toDate,
						groupBy: "ASSET_CATEGORY" as const,
					};
					const inLocation = await reportService.generateReport(
						{ ...baseInput, status: "IN_LOCATION" },
						organizationAId,
					);
					expect(inLocation.rows).toHaveLength(dateCase.inLocationRows);
					if (dateCase.inLocationRows === 1) {
						expect(inLocation.rows[0]?.status).toBe(dateCase.status);
					}

					const disposed = await reportService.generateReport(
						{ ...baseInput, status: "DISPOSED" },
						organizationAId,
					);
					expect(disposed.rows).toHaveLength(dateCase.disposedRows);
					if (dateCase.disposedRows === 1) {
						expect(disposed.rows[0]?.status).toBe(dateCase.status);
					}
				}
			}
		} finally {
			await prisma.assetDisposal.deleteMany({
				where: { assetId: scrapAsset.id },
			});
			await prisma.assetFinanceBook.deleteMany({
				where: { assetId: scrapAsset.id },
			});
			await prisma.asset.delete({ where: { id: scrapAsset.id } });
		}
	});
});
