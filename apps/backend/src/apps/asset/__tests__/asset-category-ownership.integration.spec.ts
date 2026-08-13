import { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { AssetDashboardSubService } from "../asset-dashboard.service";

/**
 * Exercises the mixed-ownership AssetCategory boundary against PostgreSQL.
 * The category is shared globally, while each nested account mapping is
 * returned and replaced only through its Company's Organization owner.
 */
describe("Asset category ownership integration", () => {
	let prisma: PrismaService;
	let service: AssetService;
	let organizationAId = "";
	let organizationBId = "";
	let companyAId = "";
	let companyBId = "";
	let categoryId = "";

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();

		const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const [organizationA, organizationB] = await Promise.all([
			prisma.organization.create({
				data: {
					name: `R-003 Organization A ${suffix}`,
					slug: `r003-organization-a-${suffix}`,
				},
			}),
			prisma.organization.create({
				data: {
					name: `R-003 Organization B ${suffix}`,
					slug: `r003-organization-b-${suffix}`,
				},
			}),
		]);
		organizationAId = organizationA.id;
		organizationBId = organizationB.id;

		const [companyA, companyB] = await Promise.all([
			prisma.company.create({
				data: { organizationId: organizationAId, name: "R-003 Acme" },
			}),
			prisma.company.create({
				data: { organizationId: organizationBId, name: "R-003 Acme" },
			}),
		]);
		companyAId = companyA.id;
		companyBId = companyB.id;

		service = new AssetService(
			prisma,
			new AssetDashboardSubService(prisma),
			new FiscalYearService(prisma),
		);
	});

	afterAll(async () => {
		if (!prisma) return;
		try {
			if (categoryId) {
				await prisma.assetCategory.delete({ where: { id: categoryId } });
			}
			const organizationIds = [organizationAId, organizationBId].filter(
				(id): id is string => Boolean(id),
			);
			if (organizationIds.length > 0) {
				await prisma.company.deleteMany({
					where: { organizationId: { in: organizationIds } },
				});
				await prisma.organization.deleteMany({
					where: { id: { in: organizationIds } },
				});
			}
		} finally {
			await prisma.onModuleDestroy();
		}
	});

	it("isolates account reads, writes, and same-name Companies", async () => {
		const categoryName = `R-003 Shared Category ${Date.now()}`;
		const accountA = {
			companyId: companyAId,
			fixedAssetAccount: "Fixed Asset - R003 A",
			accumulatedDepreciationAccount: "Accumulated Depreciation - R003 A",
			depreciationExpenseAccount: "Depreciation Expense - R003 A",
			capitalWorkInProgressAccount: "CWIP - R003 A",
		};
		const accountB = {
			companyId: companyBId,
			fixedAssetAccount: "Fixed Asset - R003 B",
			accumulatedDepreciationAccount: "Accumulated Depreciation - R003 B",
			depreciationExpenseAccount: "Depreciation Expense - R003 B",
			capitalWorkInProgressAccount: "CWIP - R003 B",
		};

		const created = await service.createAssetCategory(
			{
				name: categoryName,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 36,
				frequencyOfDepreciation: 12,
				accounts: [accountA],
			},
			organizationAId,
		);
		categoryId = created.id;
		expect(created.accounts?.map((account) => account.companyId)).toEqual([
			companyAId,
		]);

		const initialOrganizationBRead = await service.findAssetCategoryById(
			categoryId,
			organizationBId,
		);
		expect(initialOrganizationBRead?.accounts).toEqual([]);

		await service.updateAssetCategory(
			{ id: categoryId, accounts: [accountB] },
			organizationBId,
		);

		const organizationARead = await service.findAssetCategoryById(
			categoryId,
			organizationAId,
		);
		const organizationBRead = await service.findAssetCategoryById(
			categoryId,
			organizationBId,
		);
		expect(organizationARead?.accounts).toEqual([
			expect.objectContaining({
				companyId: companyAId,
				companyName: "R-003 Acme",
				fixedAssetAccount: "Fixed Asset - R003 A",
			}),
		]);
		expect(organizationBRead?.accounts).toEqual([
			expect.objectContaining({
				companyId: companyBId,
				companyName: "R-003 Acme",
				fixedAssetAccount: "Fixed Asset - R003 B",
			}),
		]);
		expect(
			organizationARead?.accounts?.some(
				(account) => account.companyId === companyBId,
			),
		).toBe(false);
		expect(
			organizationBRead?.accounts?.some(
				(account) => account.companyId === companyAId,
			),
		).toBe(false);

		await expect(
			service.updateAssetCategory(
				{ id: categoryId, accounts: [accountB] },
				organizationAId,
			),
		).rejects.toThrow(/not available in the active organization/);

		await service.updateAssetCategory(
			{
				id: categoryId,
				accounts: [
					{
						...accountA,
						fixedAssetAccount: "Fixed Asset - R003 A Updated",
					},
				],
			},
			organizationAId,
		);

		const organizationAAfterUpdate = await service.findAssetCategoryById(
			categoryId,
			organizationAId,
		);
		const organizationBAfterUpdate = await service.findAssetCategoryById(
			categoryId,
			organizationBId,
		);
		expect(organizationAAfterUpdate?.accounts?.[0]).toEqual(
			expect.objectContaining({
				companyId: companyAId,
				fixedAssetAccount: "Fixed Asset - R003 A Updated",
			}),
		);
		expect(organizationBAfterUpdate?.accounts?.[0]).toEqual(
			expect.objectContaining({
				companyId: companyBId,
				fixedAssetAccount: "Fixed Asset - R003 B",
			}),
		);

		const persistedAccounts = await prisma.assetCategoryAccount.findMany({
			where: { assetCategoryId: categoryId },
			select: {
				companyId: true,
				fixedAssetAccount: true,
			},
			orderBy: { companyId: "asc" },
		});
		expect(persistedAccounts).toEqual(
			[
				{
					companyId: companyAId,
					fixedAssetAccount: "Fixed Asset - R003 A Updated",
				},
				{
					companyId: companyBId,
					fixedAssetAccount: "Fixed Asset - R003 B",
				},
			].sort((left, right) => left.companyId.localeCompare(right.companyId)),
		);
	});
});
