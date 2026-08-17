import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Asset } from "@aria/types";
import { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { AssetDashboardSubService } from "../asset-dashboard.service";
import { AssetDepreciationLifecycleService } from "../depreciation/asset-depreciation-lifecycle.service";

const dateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

type AssetOverrides = {
	assetType?: "EXISTING_ASSET" | "COMPOSITE_ASSET" | "COMPOSITE_COMPONENT";
	availableForUseDate?: Date | null;
	calculateDepreciation?: boolean;
	companyId?: string;
	depreciationMethod?: "STRAIGHT_LINE" | "DOUBLE_DECLINING_BALANCE";
	depreciationStartDate?: Date | null;
	frequencyOfDepreciation?: number;
	status?: "DRAFT" | "SUBMITTED";
	totalNumberOfDepreciations?: number;
};

/**
 * Proves R-010 against real PostgreSQL rows and transaction locks. Each test
 * uses unique fixture names, and teardown removes only rows created here.
 */
describe("R-010 Asset lifecycle transaction integration", () => {
	let prisma: PrismaService;
	let lifecycle: AssetDepreciationLifecycleService;
	let assetService: AssetService;
	let organizationId: string;
	let companyId: string;
	let categoryId: string;
	let defaultFinanceBookId: string;
	let secondaryFinanceBookId: string;
	let suffix: string;
	const assetIds: string[] = [];
	const capitalizationIds: string[] = [];
	const repairIds: string[] = [];
	const journalEntryIds: string[] = [];
	const additionalCompanyIds: string[] = [];

	const createAsset = async (
		label: string,
		overrides: AssetOverrides = {},
	): Promise<{ id: string }> => {
		const asset = await prisma.client.asset.create({
			data: {
				series: `R010-${assetIds.length}-${suffix}`,
				assetName: `R-010 ${label}`,
				itemCode: `R010-${label}-${suffix}`,
				assetCategoryId: categoryId,
				companyId: overrides.companyId ?? companyId,
				purchaseDate: dateOnly("2030-01-01"),
				availableForUseDate: dateOnly("2030-01-02"),
				netPurchaseAmount: 1_000,
				valueAfterDepreciation: 1_000,
				assetType: "EXISTING_ASSET",
				calculateDepreciation: false,
				status: "DRAFT",
				...overrides,
			},
		});
		assetIds.push(asset.id);
		return asset;
	};

	const makeBook = (financeBookId: string, precision?: number) => ({
		financeBookId,
		depreciationMethod: "STRAIGHT_LINE" as const,
		totalNumberOfDepreciations: 3,
		frequencyOfDepreciation: 12,
		depreciationStartDate: "2030-01-02",
		...(precision === undefined ? {} : { precision }),
	});

	const runSubmitWinsOverUpdate = async (
		assetId: string,
		input: Asset.UpdateAssetInput,
	): Promise<unknown> => {
		let submitLockResolve!: () => void;
		const submitLockSeen = new Promise<void>((resolve) => {
			submitLockResolve = resolve;
		});
		let releaseSubmitResolve!: () => void;
		const releaseSubmit = new Promise<void>((resolve) => {
			releaseSubmitResolve = resolve;
		});
		let updateTransactionResolve!: () => void;
		const updateTransactionStarted = new Promise<void>((resolve) => {
			updateTransactionResolve = resolve;
		});
		let transactionIndex = 0;
		let submitLockObserved = false;
		const prismaWithTransaction = prisma as unknown as {
			$transaction: (
				callback: (tx: object) => Promise<unknown>,
			) => Promise<unknown>;
		};
		const originalTransaction = prismaWithTransaction.$transaction;

		prismaWithTransaction.$transaction = (callback) => {
			const currentTransactionIndex = transactionIndex++;
			return originalTransaction(async (rawTx) => {
				if (currentTransactionIndex === 1) updateTransactionResolve();
				const wrappedTx = new Proxy(rawTx as object, {
					get(target, property) {
						if (property !== "$queryRaw") {
							return Reflect.get(target, property, target);
						}
						const queryRaw = (
							target as { $queryRaw: (...args: unknown[]) => Promise<unknown> }
						).$queryRaw.bind(target);
						return async (...args: unknown[]) => {
							const result = await queryRaw(...args);
							if (currentTransactionIndex === 0 && !submitLockObserved) {
								submitLockObserved = true;
								submitLockResolve();
								await releaseSubmit;
							}
							return result;
						};
					},
				});
				return callback(wrappedTx);
			});
		};

		let updateError: unknown;
		try {
			const submitPromise = lifecycle.submitAsset(assetId, organizationId);
			await submitLockSeen;
			const updatePromise = assetService.updateAsset(input, organizationId);
			await updateTransactionStarted;
			releaseSubmitResolve();
			await submitPromise;
			try {
				await updatePromise;
			} catch (error) {
				updateError = error;
			}
		} finally {
			releaseSubmitResolve();
			prismaWithTransaction.$transaction = originalTransaction;
		}
		return updateError;
	};

	const cleanupAssets = async (): Promise<void> => {
		if (journalEntryIds.length > 0) {
			await prisma.client.assetDepreciationJournalEntry.deleteMany({
				where: { id: { in: journalEntryIds.splice(0) } },
			});
		}
		if (capitalizationIds.length > 0) {
			await prisma.client.assetCapitalization.deleteMany({
				where: { id: { in: capitalizationIds.splice(0) } },
			});
		}
		if (repairIds.length > 0) {
			await prisma.client.assetRepair.deleteMany({
				where: { id: { in: repairIds.splice(0) } },
			});
		}
		if (assetIds.length > 0) {
			const ids = assetIds.splice(0);
			await prisma.client.assetDepreciationSchedule.deleteMany({
				where: { assetId: { in: ids } },
			});
			await prisma.client.assetFinanceBook.deleteMany({
				where: { assetId: { in: ids } },
			});
			await prisma.client.asset.deleteMany({
				where: { id: { in: ids } },
			});
		}
	};

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();
		suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const organization = await prisma.client.organization.create({
			data: {
				name: `R-010 Organization ${suffix}`,
				slug: `r010-${suffix}`,
			},
		});
		organizationId = organization.id;

		const [defaultBook, secondaryBook] = await Promise.all([
			prisma.client.financeBook.create({
				data: { name: `R-010 Default ${suffix}` },
			}),
			prisma.client.financeBook.create({
				data: { name: `R-010 Secondary ${suffix}` },
			}),
		]);
		defaultFinanceBookId = defaultBook.id;
		secondaryFinanceBookId = secondaryBook.id;

		const company = await prisma.client.company.create({
			data: {
				organizationId,
				name: `R-010 Company ${suffix}`,
				defaultFinanceBookId,
			},
		});
		companyId = company.id;

		const category = await prisma.client.assetCategory.create({
			data: { name: `R-010 Category ${suffix}` },
		});
		categoryId = category.id;
		lifecycle = new AssetDepreciationLifecycleService(prisma);
		assetService = new AssetService(
			prisma,
			new AssetDashboardSubService(prisma),
			new FiscalYearService(prisma),
			lifecycle,
		);
	});

	afterAll(async () => {
		if (!prisma) return;
		try {
			await cleanupAssets();
			await prisma.client.assetCategory.delete({ where: { id: categoryId } });
			if (additionalCompanyIds.length > 0) {
				await prisma.client.company.deleteMany({
					where: { id: { in: additionalCompanyIds.splice(0) } },
				});
			}
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

	it("commits lifecycle state and schedules together, with idempotent retries", async () => {
		const asset = await createAsset("atomic", {
			calculateDepreciation: true,
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: 3,
			frequencyOfDepreciation: 12,
			depreciationStartDate: dateOnly("2030-01-02"),
		});

		await lifecycle.submitAsset(asset.id, organizationId);
		await lifecycle.submitAsset(asset.id, organizationId);

		const submitted = await prisma.client.asset.findUniqueOrThrow({
			where: { id: asset.id },
			include: { depreciationSchedules: true },
		});
		expect(submitted.status).toBe("SUBMITTED");
		expect(submitted.depreciationSchedules.length).toBe(1);
		expect(
			submitted.depreciationSchedules.every(
				(schedule) => schedule.status === "ACTIVE",
			),
		).toBe(true);

		await lifecycle.cancelAsset(asset.id, organizationId);
		await lifecycle.cancelAsset(asset.id, organizationId);

		const cancelled = await prisma.client.asset.findUniqueOrThrow({
			where: { id: asset.id },
			include: {
				activities: { orderBy: { createdAt: "asc" } },
				depreciationSchedules: true,
			},
		});
		expect(cancelled.status).toBe("CANCELLED");
		expect(
			cancelled.depreciationSchedules.every(
				(schedule) => schedule.status === "CANCELLED",
			),
		).toBe(true);
		expect(cancelled.activities.map((activity) => activity.activity)).toEqual([
			"Asset submitted for depreciation",
			"Asset cancelled",
		]);
	});

	it("serializes concurrent submit and cancel into one legal state with matching schedules", async () => {
		const asset = await createAsset("concurrent", {
			calculateDepreciation: true,
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: 2,
			frequencyOfDepreciation: 12,
			depreciationStartDate: dateOnly("2030-01-02"),
		});

		const outcomes = await Promise.allSettled([
			lifecycle.submitAsset(asset.id, organizationId),
			lifecycle.cancelAsset(asset.id, organizationId),
		]);
		const rejected = outcomes.filter(
			(outcome): outcome is PromiseRejectedResult =>
				outcome.status === "rejected",
		);
		for (const outcome of rejected) {
			expect(String(outcome.reason)).toMatch(
				/ cannot be cancelled from status DRAFT|Asset .* changed before it could be cancelled/,
			);
		}

		const finalAsset = await prisma.client.asset.findUniqueOrThrow({
			where: { id: asset.id },
			include: { depreciationSchedules: true },
		});
		expect(["SUBMITTED", "CANCELLED"]).toContain(finalAsset.status);
		if (finalAsset.status === "SUBMITTED") {
			expect(
				finalAsset.depreciationSchedules.every(
					(schedule) => schedule.status === "ACTIVE",
				),
			).toBe(true);
		} else {
			expect(
				finalAsset.depreciationSchedules.every(
					(schedule) => schedule.status === "CANCELLED",
				),
			).toBe(true);
		}
	});

	it("rolls back book and schedule rows when a later configuration fails", async () => {
		const asset = await createAsset("rollback", {
			calculateDepreciation: true,
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: 3,
			frequencyOfDepreciation: 12,
			depreciationStartDate: dateOnly("2030-01-02"),
		});

		await expect(
			lifecycle.configureAssetBooks(
				asset.id,
				[makeBook(defaultFinanceBookId), makeBook(secondaryFinanceBookId, -1)],
				organizationId,
			),
		).rejects.toThrow("precision must be an integer between zero and 6");

		expect(
			await prisma.client.assetFinanceBook.count({
				where: { assetId: asset.id },
			}),
		).toBe(0);
		expect(
			await prisma.client.assetDepreciationSchedule.count({
				where: { assetId: asset.id },
			}),
		).toBe(0);
	});

	it("rolls back submit and cancel effects when activity attribution fails", async () => {
		const asset = await createAsset("activity-rollback", {
			calculateDepreciation: true,
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: 3,
			frequencyOfDepreciation: 12,
			depreciationStartDate: dateOnly("2030-01-02"),
		});

		await expect(
			lifecycle.submitAsset(asset.id, organizationId, "missing-user"),
		).rejects.toThrow();
		let persisted = await prisma.client.asset.findUniqueOrThrow({
			where: { id: asset.id },
			include: {
				depreciationSchedules: true,
				financeBooks: true,
				activities: true,
			},
		});
		expect(persisted.status).toBe("DRAFT");
		expect(persisted.financeBooks).toHaveLength(0);
		expect(persisted.depreciationSchedules).toHaveLength(0);
		expect(persisted.activities).toHaveLength(0);

		await lifecycle.submitAsset(asset.id, organizationId);
		await expect(
			lifecycle.cancelAsset(asset.id, organizationId, "missing-user"),
		).rejects.toThrow();
		persisted = await prisma.client.asset.findUniqueOrThrow({
			where: { id: asset.id },
			include: {
				depreciationSchedules: true,
				financeBooks: true,
				activities: true,
			},
		});
		expect(persisted.status).toBe("SUBMITTED");
		expect(
			persisted.depreciationSchedules.every(
				(schedule) => schedule.status === "ACTIVE",
			),
		).toBe(true);
		expect(persisted.activities).toHaveLength(1);
	});

	it("requires an exact Company-matched composite capitalization", async () => {
		const siblingCompany = await prisma.client.company.create({
			data: {
				organizationId,
				name: `R-010 Sibling Company ${suffix}`,
			},
		});
		additionalCompanyIds.push(siblingCompany.id);

		const missingCapitalization = await createAsset("composite-missing", {
			assetType: "COMPOSITE_ASSET",
		});
		await expect(
			lifecycle.submitAsset(missingCapitalization.id, organizationId),
		).rejects.toThrow("Please capitalize this asset before submitting it");

		const foreignCapitalizationAsset = await createAsset(
			"composite-foreign-capitalization",
			{
				assetType: "COMPOSITE_ASSET",
				companyId: siblingCompany.id,
			},
		);
		const foreignCapitalization =
			await prisma.client.assetCapitalization.create({
				data: {
					series: `R010-CAP-FOREIGN-${suffix}`,
					companyId,
					postingDate: dateOnly("2030-01-02"),
					targetType: "NEW_ASSET",
					targetAssetId: foreignCapitalizationAsset.id,
					status: "SUBMITTED",
				},
			});
		capitalizationIds.push(foreignCapitalization.id);

		await expect(
			lifecycle.submitAsset(foreignCapitalizationAsset.id, organizationId),
		).rejects.toThrow("Please capitalize this asset before submitting it");

		await prisma.client.asset.update({
			where: { id: foreignCapitalizationAsset.id },
			data: { status: "SUBMITTED" },
		});
		await lifecycle.cancelAsset(foreignCapitalizationAsset.id, organizationId);
		const foreignCancelled = await prisma.client.asset.findUniqueOrThrow({
			where: { id: foreignCapitalizationAsset.id },
			select: { status: true },
		});
		expect(foreignCancelled.status).toBe("CANCELLED");

		const capitalized = await createAsset("composite-capitalized", {
			assetType: "COMPOSITE_ASSET",
		});
		const capitalization = await prisma.client.assetCapitalization.create({
			data: {
				series: `R010-CAP-${suffix}`,
				companyId,
				postingDate: dateOnly("2030-01-02"),
				targetType: "NEW_ASSET",
				targetAssetId: capitalized.id,
				status: "SUBMITTED",
			},
		});
		capitalizationIds.push(capitalization.id);

		await lifecycle.submitAsset(capitalized.id, organizationId);
		const submitted = await prisma.client.asset.findUniqueOrThrow({
			where: { id: capitalized.id },
			select: { status: true },
		});
		expect(submitted.status).toBe("SUBMITTED");
	});

	it("rejects a stale lifecycle-sensitive update after submit wins", async () => {
		const asset = await createAsset("stale-update");
		const updateError = await runSubmitWinsOverUpdate(asset.id, {
			id: asset.id,
			availableForUseDate: null,
		});

		expect(String(updateError)).toContain(
			"Depreciation-critical fields cannot be edited after submission",
		);
		const persisted = await prisma.client.asset.findUniqueOrThrow({
			where: { id: asset.id },
			select: { status: true, availableForUseDate: true },
		});
		expect(persisted.status).toBe("SUBMITTED");
		expect(persisted.availableForUseDate).toEqual(dateOnly("2030-01-02"));
	});

	it("does not replace submitted FinanceBook or schedule state from stale draft logic", async () => {
		const asset = await createAsset("stale-finance-book", {
			calculateDepreciation: true,
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: 3,
			frequencyOfDepreciation: 12,
			depreciationStartDate: dateOnly("2030-01-02"),
		});
		const updateError = await runSubmitWinsOverUpdate(asset.id, {
			id: asset.id,
			financeBooks: [makeBook(secondaryFinanceBookId)],
		});

		expect(String(updateError)).toContain(
			"Depreciation-critical fields cannot be edited after submission",
		);
		const persisted = await prisma.client.asset.findUniqueOrThrow({
			where: { id: asset.id },
			include: { financeBooks: true, depreciationSchedules: true },
		});
		expect(persisted.status).toBe("SUBMITTED");
		expect(persisted.financeBooks).toHaveLength(1);
		expect(persisted.financeBooks[0]?.financeBookId).toBe(defaultFinanceBookId);
		expect(persisted.depreciationSchedules).toHaveLength(1);
		expect(persisted.depreciationSchedules[0]?.status).toBe("ACTIVE");
	});

	it("preserves ordinary draft updates", async () => {
		const asset = await createAsset("valid-draft-update");
		const updated = await assetService.updateAsset(
			{ id: asset.id, assetName: "R-010 draft update accepted" },
			organizationId,
		);

		expect(updated.assetName).toBe("R-010 draft update accepted");
	});

	it("blocks cancellation while a posted depreciation effect remains linked", async () => {
		const asset = await createAsset("posted-effect", { status: "SUBMITTED" });
		const book = await prisma.client.assetFinanceBook.create({
			data: {
				assetId: asset.id,
				financeBookId: defaultFinanceBookId,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 12,
				depreciationStartDate: dateOnly("2030-01-02"),
			},
		});
		const journalEntry =
			await prisma.client.assetDepreciationJournalEntry.create({
				data: {
					series: `R010-JE-${suffix}`,
					assetId: asset.id,
					assetFinanceBookId: book.id,
					companyId,
					financeBookName: `R-010 Default ${suffix}`,
					postingDate: dateOnly("2030-02-01"),
					depreciationAmount: 100,
					status: "POSTED",
				},
			});
		journalEntryIds.push(journalEntry.id);

		await expect(
			lifecycle.cancelAsset(asset.id, organizationId),
		).rejects.toThrow("Posted depreciation must be reversed");

		const unchanged = await prisma.client.asset.findUniqueOrThrow({
			where: { id: asset.id },
			select: { status: true },
		});
		expect(unchanged.status).toBe("SUBMITTED");
	});

	it("ignores draft repairs but blocks pending repairs", async () => {
		const draftAsset = await createAsset("draft-repair", {
			status: "SUBMITTED",
		});
		const draftRepair = await prisma.client.assetRepair.create({
			data: {
				series: `R010-REPAIR-DRAFT-${suffix}`,
				assetId: draftAsset.id,
				companyId,
				failureDate: dateOnly("2030-01-02"),
				repairStatus: "DRAFT",
			},
		});
		repairIds.push(draftRepair.id);

		await lifecycle.cancelAsset(draftAsset.id, organizationId);
		const draftCancelled = await prisma.client.asset.findUniqueOrThrow({
			where: { id: draftAsset.id },
			select: { status: true },
		});
		expect(draftCancelled.status).toBe("CANCELLED");

		const pendingAsset = await createAsset("pending-repair", {
			status: "SUBMITTED",
		});
		const pendingRepair = await prisma.client.assetRepair.create({
			data: {
				series: `R010-REPAIR-PENDING-${suffix}`,
				assetId: pendingAsset.id,
				companyId,
				failureDate: dateOnly("2030-01-02"),
				repairStatus: "PENDING",
			},
		});
		repairIds.push(pendingRepair.id);

		await expect(
			lifecycle.cancelAsset(pendingAsset.id, organizationId),
		).rejects.toThrow("active maintenance or repairs");
		const pendingUnchanged = await prisma.client.asset.findUniqueOrThrow({
			where: { id: pendingAsset.id },
			select: { status: true },
		});
		expect(pendingUnchanged.status).toBe("SUBMITTED");
	});
});
