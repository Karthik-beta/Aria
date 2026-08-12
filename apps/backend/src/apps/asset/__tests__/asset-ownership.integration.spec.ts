import { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { AssetAccountingService } from "../asset-accounting.service";
import { AssetDashboardSubService } from "../asset-dashboard.service";
import type { AssetDepreciationLifecycleService } from "../depreciation/asset-depreciation-lifecycle.service";
import { DEPRECIATION_JOB_VERSION } from "../depreciation/depreciation.constants";
import { DepreciationPersistenceService } from "../depreciation/depreciation-persistence.service";

/**
 * Exercises the persisted Organization -> Company -> Asset boundary against PostgreSQL.
 * The test intentionally calls the service boundary with two trusted organizations so a
 * foreign Company or Asset CUID cannot be used as an ownership selector.
 */
describe("Asset ownership integration", () => {
	let prisma: PrismaService;
	let service: AssetService;
	let organizationAId: string;
	let organizationBId: string;
	let companyAId: string;
	let companyA2Id: string;
	let companyBId: string;
	let assetAId: string;
	let assetBId: string;
	let assetBBarcode: string;
	let accountingEntryId: string;
	let financeBookId: string;
	let assetFinanceBookId: string;
	let scheduleId: string;
	let journalEntryId: string;

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();

		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const [organizationA, organizationB] = await Promise.all([
			prisma.organization.create({
				data: {
					name: `R-001 Organization A ${suffix}`,
					slug: `r001-organization-a-${suffix}`,
				},
			}),
			prisma.organization.create({
				data: {
					name: `R-001 Organization B ${suffix}`,
					slug: `r001-organization-b-${suffix}`,
				},
			}),
		]);
		organizationAId = organizationA.id;
		organizationBId = organizationB.id;

		const [companyA, companyA2, companyB] = await Promise.all([
			prisma.company.create({
				data: {
					organizationId: organizationA.id,
					name: `R-001 Shared Company ${suffix}`,
				},
			}),
			prisma.company.create({
				data: {
					organizationId: organizationA.id,
					name: `R-001 Alternate Company ${suffix}`,
				},
			}),
			prisma.company.create({
				data: {
					organizationId: organizationB.id,
					name: `R-001 Shared Company ${suffix}`,
				},
			}),
		]);
		companyAId = companyA.id;
		companyA2Id = companyA2.id;
		companyBId = companyB.id;

		const lifecycle = {
			configureAssetBooks: async () => undefined,
			submitAsset: async () => undefined,
			cancelAsset: async () => undefined,
		} as unknown as AssetDepreciationLifecycleService;
		service = new AssetService(
			prisma,
			new AssetDashboardSubService(prisma),
			new FiscalYearService(prisma),
			lifecycle,
		);
	});

	afterAll(async () => {
		if (!prisma) return;
		if (journalEntryId) {
			await prisma.assetDepreciationJournalEntry.delete({
				where: { id: journalEntryId },
			});
		}
		if (scheduleId) {
			await prisma.assetDepreciationSchedule.delete({
				where: { id: scheduleId },
			});
		}
		if (assetFinanceBookId) {
			await prisma.assetFinanceBook.delete({
				where: { id: assetFinanceBookId },
			});
		}
		if (financeBookId) {
			await prisma.financeBook.delete({ where: { id: financeBookId } });
		}
		if (accountingEntryId) {
			await prisma.client.assetAccountingEntry.delete({
				where: { id: accountingEntryId },
			});
		}
		if (assetAId) {
			await prisma.asset.delete({ where: { id: assetAId } });
		}
		if (assetBId) {
			await prisma.asset.delete({ where: { id: assetBId } });
		}
		const testOrganizationIds = [organizationAId, organizationBId].filter(
			(id): id is string => Boolean(id),
		);
		if (testOrganizationIds.length > 0) {
			await prisma.company.deleteMany({
				where: { organizationId: { in: testOrganizationIds } },
			});
		}
		if (organizationAId || organizationBId) {
			await prisma.organization.deleteMany({
				where: {
					id: { in: [organizationAId, organizationBId].filter(Boolean) },
				},
			});
		}
		await prisma.onModuleDestroy();
	});

	it("persists the relational Company owner for an Asset", async () => {
		const created = await service.createAsset(
			{
				assetName: "R-001 Organization A Asset",
				companyId: companyAId,
				itemCode: "R001-ASSET-A",
				netPurchaseAmount: 100,
			},
			organizationAId,
		);
		assetAId = created.id;

		const persisted = await prisma.asset.findUniqueOrThrow({
			where: { id: created.id },
			select: {
				companyId: true,
				company: { select: { id: true, name: true } },
			},
		});

		expect(persisted).toEqual({
			companyId: companyAId,
			company: {
				id: companyAId,
				name: created.company,
			},
		});
	});

	it("enforces organization isolation across reads, writes, schedules, dashboards, and reports", async () => {
		assetBBarcode = `R002-BARCODE-${Date.now()}`;
		const foreignAsset = await service.createAsset(
			{
				assetName: "R-002 Organization B Asset",
				companyId: companyBId,
				itemCode: `R002-ASSET-B-${Date.now()}`,
				barcode: assetBBarcode,
				purchaseDate: new Date("2026-08-01T00:00:00.000Z"),
				netPurchaseAmount: 200,
			},
			organizationBId,
		);
		assetBId = foreignAsset.id;

		// Use operational records so the dashboard and fixed-asset register have
		// observable rows in both organizations without bypassing the service reads.
		await prisma.asset.updateMany({
			where: { id: { in: [assetAId, assetBId] } },
			data: { status: "SUBMITTED" },
		});

		const ownAssets = await service.findAllAssets(organizationAId);
		const foreignAssets = await service.findAllAssets(organizationBId);
		expect(ownAssets.items.map((asset) => asset.id)).toEqual([assetAId]);
		expect(foreignAssets.items.map((asset) => asset.id)).toEqual([assetBId]);
		expect(await service.findAssetById(assetAId, organizationBId)).toBeNull();
		expect(await service.findAssetById(assetBId, organizationAId)).toBeNull();
		expect(
			await service.findAssetByBarcode(assetBBarcode, organizationBId),
		).not.toBeNull();
		expect(
			await service.findAssetByBarcode(assetBBarcode, organizationAId),
		).toBeNull();

		const updated = await service.updateAsset(
			{ id: assetAId, assetName: "R-002 Organization A Updated" },
			organizationAId,
		);
		expect(updated.assetName).toBe("R-002 Organization A Updated");
		await expect(
			service.updateAsset(
				{ id: assetAId, assetName: "R-002 Foreign Update" },
				organizationBId,
			),
		).rejects.toThrow(/not found/);
		await expect(
			service.deleteAsset(assetBId, organizationAId),
		).rejects.toThrow(/not found/);
		await expect(
			service.submitAsset(assetBId, organizationAId),
		).rejects.toThrow(/not found/);

		await expect(
			service.listAssetDepreciationSchedules(assetBId, organizationAId),
		).rejects.toThrow(/not found/);
		await expect(
			service.previewAssetValueAdjustment(
				{
					assetId: assetAId,
					adjustmentDate: new Date("2026-08-12T00:00:00.000Z"),
					newAssetValue: 150,
				},
				organizationBId,
			),
		).rejects.toThrow(/not found/);
		await expect(
			service.createAssetMovement(
				{
					companyId: companyBId,
					transactionDate: new Date("2026-08-12T00:00:00.000Z"),
					purpose: "ISSUE",
					items: [{ assetId: assetBId }],
				},
				organizationAId,
			),
		).rejects.toThrow(/not available in the active organization/);
		await expect(
			service.scrapAsset(
				{
					assetId: assetAId,
					disposalDate: new Date("2026-08-12T00:00:00.000Z"),
					gainLossAccount: "Gain Loss - R002",
				},
				organizationBId,
			),
		).rejects.toThrow(/not found/);

		const reportInput = {
			fromDate: new Date("2026-01-01T00:00:00.000Z"),
			toDate: new Date("2026-12-31T00:00:00.000Z"),
			groupBy: "ASSET_CATEGORY" as const,
		};
		const register = await service.findFixedAssetRegisterReport(
			reportInput,
			organizationAId,
		);
		expect(register.rows.map((row) => row.assetId)).toEqual([assetAId]);
		expect(register.rows.some((row) => row.assetId === assetBId)).toBe(false);

		const balances = await service.findAssetDepreciationsAndBalances(
			{ ...reportInput, groupBy: "ASSET" },
			organizationAId,
		);
		expect(balances.rows.every((row) => row.assetId !== assetBId)).toBe(true);
		expect(balances.summary.matchedAssetCount).toBe(1);

		const dashboard = await service.getDashboardData(organizationAId);
		expect(dashboard.kpis.totalAssets).toBe(1);
		expect(
			dashboard.statusDistribution.reduce((total, row) => total + row.count, 0),
		).toBe(1);
		expect(
			dashboard.recentActivity.every(
				(activity) => activity.assetId !== assetBId,
			),
		).toBe(true);
	});

	it("rejects a Company and Asset CUID from another organization", async () => {
		const companyA = await prisma.company.findUniqueOrThrow({
			where: { id: companyAId },
		});
		const companyB = await prisma.company.findUniqueOrThrow({
			where: { id: companyBId },
		});

		await expect(
			service.createAsset(
				{
					assetName: "R-001 Foreign Company Asset",
					companyId: companyA.id,
				},
				organizationBId,
			),
		).rejects.toThrow(/not available in the active organization/);

		await expect(
			service.updateAsset(
				{ id: assetAId, assetName: "R-001 Foreign Asset Update" },
				organizationBId,
			),
		).rejects.toThrow(/not found/);

		await expect(
			service.updateAsset(
				{ id: assetAId, companyId: companyB.id },
				organizationAId,
			),
		).rejects.toThrow(/not available in the active organization/);

		await expect(
			service.updateAsset(
				{ id: assetAId, companyId: companyA2Id },
				organizationAId,
			),
		).rejects.toThrow(/reassignment is not supported/);

		const persisted = await prisma.asset.findUniqueOrThrow({
			where: { id: assetAId },
			select: { companyId: true, assetName: true },
		});
		expect(persisted).toEqual({
			companyId: companyAId,
			assetName: "R-002 Organization A Updated",
		});
	});

	it("allows same-name Companies in different Organizations but not within one", async () => {
		const companyA = await prisma.company.findUniqueOrThrow({
			where: { id: companyAId },
		});
		const companyB = await prisma.company.findUniqueOrThrow({
			where: { id: companyBId },
		});
		expect(companyA.name).toBe(companyB.name);

		await expect(
			Promise.resolve(
				prisma.company.create({
					data: {
						organizationId: organizationAId,
						name: companyA.name,
					},
				}),
			),
		).rejects.toThrow();

		const renamed = `R-001 Renamed Company ${Date.now()}`;
		await prisma.company.update({
			where: { id: companyAId },
			data: { name: renamed },
		});
		const persisted = await prisma.asset.findUniqueOrThrow({
			where: { id: assetAId },
			select: { companyId: true, company: { select: { name: true } } },
		});
		expect(persisted).toEqual({
			companyId: companyAId,
			company: { name: renamed },
		});
	});

	it("uses the renamed Company ID for accounting and depreciation", async () => {
		const renamed = `R-001 Runtime Rename ${Date.now()}`;
		await prisma.company.update({
			where: { id: companyAId },
			data: {
				name: renamed,
				accumulatedDepreciationAccount: "Accumulated Depreciation - R001",
				depreciationExpenseAccount: "Depreciation Expense - R001",
			},
		});

		const accounting = new AssetAccountingService();
		const accountingEntry = await prisma.client.$transaction((tx) =>
			accounting.createPostedEntry(tx, organizationAId, {
				companyId: companyAId,
				assetId: assetAId,
				sourceType: "REPAIR",
				sourceId: `R-001-RENAME-ACCOUNTING-${Date.now()}`,
				postingDate: new Date("2026-08-10T00:00:00.000Z"),
				remarks: "R-001 rename accounting proof",
				lines: [
					{
						account: "Depreciation Expense - R001",
						debitAmount: 10,
						creditAmount: 0,
					},
					{
						account: "Accumulated Depreciation - R001",
						debitAmount: 0,
						creditAmount: 10,
					},
				],
			}),
		);
		accountingEntryId = accountingEntry.id;

		const financeBook = await prisma.financeBook.create({
			data: { name: `R-001 Runtime Finance Book ${Date.now()}` },
		});
		financeBookId = financeBook.id;
		await prisma.asset.update({
			where: { id: assetAId },
			data: { calculateDepreciation: true, status: "SUBMITTED" },
		});

		const assetFinanceBook = await prisma.assetFinanceBook.create({
			data: {
				assetId: assetAId,
				financeBookId: financeBook.id,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 1,
				frequencyOfDepreciation: 1,
				depreciationStartDate: new Date("2026-08-10T00:00:00.000Z"),
				valueAfterDepreciation: 100,
			},
		});
		assetFinanceBookId = assetFinanceBook.id;

		const schedule = await prisma.assetDepreciationSchedule.create({
			data: {
				assetId: assetAId,
				assetFinanceBookId: assetFinanceBook.id,
				revisionNumber: 1,
				status: "ACTIVE",
				startDate: new Date("2026-08-10T00:00:00.000Z"),
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 1,
				frequencyOfDepreciation: 1,
				bookedDepreciations: 0,
				remainingDepreciations: 1,
				baseAssetValue: 100,
				entries: {
					create: {
						sequence: 1,
						scheduleDate: new Date("2026-08-10T00:00:00.000Z"),
						depreciationAmount: 10,
						accumulatedDepreciationAmount: 10,
						bookValueAfterDepreciation: 90,
					},
				},
			},
		});
		scheduleId = schedule.id;
		const scheduleEntry =
			await prisma.assetDepreciationScheduleEntry.findFirstOrThrow({
				where: { scheduleId: schedule.id },
			});

		const depreciation = new DepreciationPersistenceService(prisma);
		const posted = await depreciation.post({
			version: DEPRECIATION_JOB_VERSION,
			organizationId: organizationAId,
			assetId: assetAId,
			assetFinanceBookId: assetFinanceBook.id,
			scheduleId: schedule.id,
			scheduleEntryId: scheduleEntry.id,
			depreciationDate: "2026-08-10",
		});
		expect(posted.status).toBe("posted");
		if (posted.status !== "posted") return;
		journalEntryId = posted.postingId;

		const [persistedAccounting, persistedJournal] = await Promise.all([
			prisma.client.assetAccountingEntry.findUniqueOrThrow({
				where: { id: accountingEntry.id },
				select: { companyId: true, company: { select: { name: true } } },
			}),
			prisma.assetDepreciationJournalEntry.findUniqueOrThrow({
				where: { id: posted.postingId },
				select: { companyId: true, company: { select: { name: true } } },
			}),
		]);
		expect(persistedAccounting).toEqual({
			companyId: companyAId,
			company: { name: renamed },
		});
		expect(persistedJournal).toEqual({
			companyId: companyAId,
			company: { name: renamed },
		});
	});
});
