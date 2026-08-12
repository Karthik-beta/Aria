import { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { AssetAccountingService } from "../asset-accounting.service";
import { AssetDashboardSubService } from "../asset-dashboard.service";
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

		service = new AssetService(
			prisma,
			new AssetDashboardSubService(prisma),
			new FiscalYearService(prisma),
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
		if (companyAId || companyA2Id || companyBId) {
			await prisma.company.deleteMany({
				where: {
					id: { in: [companyAId, companyA2Id, companyBId].filter(Boolean) },
				},
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
		).rejects.toThrow(/not available in the active organization/);

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
			assetName: "R-001 Organization A Asset",
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
			accounting.createPostedEntry(tx, {
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
