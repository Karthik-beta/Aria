import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import { AssetAccountingService } from "../asset-accounting.service";
import { AssetDashboardSubService } from "../asset-dashboard.service";
import { AssetStockPostingService } from "../asset-stock-posting.service";
import { AssetDepreciationLifecycleService } from "../depreciation/asset-depreciation-lifecycle.service";
import { AssetDepreciationRevisionService } from "../depreciation/asset-depreciation-revision.service";
import { CwipCapitalizationPersistenceService } from "../depreciation/cwip-capitalization-persistence.service";

const dateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

/**
 * Exercises R-014 with real PostgreSQL rows, selected-book state versions,
 * predecessor/successor schedules, and transaction-level cancellation races.
 */
describe("R-014 value-adjustment lineage integration", () => {
	let prisma: PrismaService;
	let service: AssetService;
	let cwip: CwipCapitalizationPersistenceService;
	let organizationId: string;
	let companyId: string;
	let categoryId: string;
	let defaultFinanceBookId: string;
	let secondaryFinanceBookId: string;
	let suffix: string;

	const createSchedule = async (
		assetId: string,
		assetFinanceBookId: string,
		bookValue: number,
	): Promise<void> => {
		await prisma.client.assetDepreciationSchedule.create({
			data: {
				assetId,
				assetFinanceBookId,
				revisionNumber: 1,
				status: "ACTIVE",
				startDate: dateOnly("2026-01-01"),
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 1,
				dailyProrataBased: false,
				shiftBased: false,
				rateOfDepreciation: null,
				expectedValueAfterUsefulLife: 0,
				bookedDepreciations: 0,
				remainingDepreciations: 3,
				openingAccumulatedDepreciation: 0,
				baseAssetValue: bookValue,
				entries: {
					create: [
						{
							sequence: 1,
							scheduleDate: dateOnly("2026-09-01"),
							depreciationAmount: 10,
							accumulatedDepreciationAmount: 10,
							bookValueAfterDepreciation: Math.max(bookValue - 10, 0),
						},
						{
							sequence: 2,
							scheduleDate: dateOnly("2026-10-01"),
							depreciationAmount: 10,
							accumulatedDepreciationAmount: 20,
							bookValueAfterDepreciation: Math.max(bookValue - 20, 0),
						},
						{
							sequence: 3,
							scheduleDate: dateOnly("2026-11-01"),
							depreciationAmount: 10,
							accumulatedDepreciationAmount: 30,
							bookValueAfterDepreciation: Math.max(bookValue - 30, 0),
						},
					],
				},
			},
		});
	};

	const createTwoBookAsset = async (
		label: string,
	): Promise<{
		id: string;
		defaultBookId: string;
		secondaryBookId: string;
	}> => {
		const asset = await prisma.client.asset.create({
			data: {
				series: `R014-${label}-${suffix}`,
				assetName: `R-014 ${label}`,
				itemCode: `R014-${label}-${suffix}`,
				assetCategoryId: categoryId,
				companyId,
				purchaseDate: dateOnly("2026-01-01"),
				availableForUseDate: dateOnly("2026-01-01"),
				netPurchaseAmount: 100,
				valueAfterDepreciation: 100,
				calculateDepreciation: true,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 1,
				depreciationStartDate: dateOnly("2026-01-01"),
				status: "PARTIALLY_DEPRECIATED",
			},
		});
		const [defaultBook, secondaryBook] = await Promise.all([
			prisma.client.assetFinanceBook.create({
				data: {
					assetId: asset.id,
					financeBookId: defaultFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 1,
					depreciationStartDate: dateOnly("2026-01-01"),
					valueAfterDepreciation: 100,
					postingStatus: "PARTIALLY_DEPRECIATED",
				},
			}),
			prisma.client.assetFinanceBook.create({
				data: {
					assetId: asset.id,
					financeBookId: secondaryFinanceBookId,
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 3,
					frequencyOfDepreciation: 1,
					depreciationStartDate: dateOnly("2026-01-01"),
					openingAccumulatedDepreciation: 20,
					valueAfterDepreciation: 80,
					postingStatus: "PARTIALLY_DEPRECIATED",
				},
			}),
		]);
		await Promise.all([
			createSchedule(asset.id, defaultBook.id, 100),
			createSchedule(asset.id, secondaryBook.id, 80),
		]);
		return {
			id: asset.id,
			defaultBookId: defaultBook.id,
			secondaryBookId: secondaryBook.id,
		};
	};

	const submitAdjustment = async (
		assetId: string,
		financeBookId: string,
		newAssetValue: number,
		adjustmentDate: string,
	) => {
		const draft = await service.createAssetValueAdjustment(
			{
				assetId,
				financeBookId,
				adjustmentDate,
				newAssetValue,
				differenceAccount: `R-014 Revaluation ${suffix}`,
			},
			organizationId,
		);
		return service.submitAssetValueAdjustment({ id: draft.id }, organizationId);
	};

	beforeAll(async () => {
		prisma = new PrismaService();
		await prisma.onModuleInit();
		suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

		const organization = await prisma.client.organization.create({
			data: {
				name: `R-014 Organization ${suffix}`,
				slug: `r014-${suffix}`,
			},
		});
		organizationId = organization.id;
		const [defaultBook, secondaryBook] = await Promise.all([
			prisma.client.financeBook.create({
				data: { name: `R-014 Default ${suffix}` },
			}),
			prisma.client.financeBook.create({
				data: { name: `R-014 Secondary ${suffix}` },
			}),
		]);
		defaultFinanceBookId = defaultBook.id;
		secondaryFinanceBookId = secondaryBook.id;
		const company = await prisma.client.company.create({
			data: {
				organizationId,
				name: `R-014 Company ${suffix}`,
				defaultFinanceBookId,
			},
		});
		companyId = company.id;
		const category = await prisma.client.assetCategory.create({
			data: {
				name: `R-014 Machinery ${suffix}`,
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 3,
				frequencyOfDepreciation: 1,
				expectedValueAfterUsefulLife: 0,
				enableCwipAccounting: true,
			},
		});
		categoryId = category.id;
		await prisma.client.assetCategoryAccount.create({
			data: {
				assetCategoryId: categoryId,
				companyId,
				fixedAssetAccount: `R-014 Fixed Asset ${suffix}`,
				capitalWorkInProgressAccount: `R-014 CWIP ${suffix}`,
			},
		});
		const accounting = new AssetAccountingService();
		service = new AssetService(
			prisma,
			new AssetDashboardSubService(prisma),
			new FiscalYearService(prisma),
			new AssetDepreciationLifecycleService(prisma),
			undefined,
			undefined,
			accounting,
			new AssetStockPostingService(),
			new AssetDepreciationRevisionService(),
		);
		cwip = new CwipCapitalizationPersistenceService(prisma, accounting);
	});

	afterAll(async () => {
		if (!prisma) return;
		try {
			const assets = await prisma.client.asset.findMany({
				where: { companyId },
				select: { id: true },
			});
			const assetIds = assets.map((asset) => asset.id);
			const capitalizations = await prisma.client.assetCapitalization.findMany({
				where: { companyId },
				select: { id: true },
			});
			const capitalizationIds = capitalizations.map((cap) => cap.id);
			await prisma.client.assetCapitalizationAssetItem.deleteMany({
				where: { capitalizationId: { in: capitalizationIds } },
			});
			await prisma.client.assetCapitalization.deleteMany({
				where: { id: { in: capitalizationIds } },
			});
			await prisma.client.assetValueAdjustment.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetRevaluationEntry.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetDepreciationJournalEntry.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetAccountingEntry.deleteMany({
				where: { companyId },
			});
			await prisma.client.assetRepair.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetDisposal.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetActivity.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetDepreciationSchedule.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.assetFinanceBook.deleteMany({
				where: { assetId: { in: assetIds } },
			});
			await prisma.client.asset.deleteMany({ where: { id: { in: assetIds } } });
			await prisma.client.assetCategory.delete({ where: { id: categoryId } });
			await prisma.client.company.update({
				where: { id: companyId },
				data: { defaultFinanceBookId: null },
			});
			await prisma.client.company.delete({ where: { id: companyId } });
			await prisma.client.financeBook.deleteMany({
				where: { id: { in: [defaultFinanceBookId, secondaryFinanceBookId] } },
			});
			await prisma.client.organization.delete({
				where: { id: organizationId },
			});
		} finally {
			await prisma.onModuleDestroy();
		}
	});

	it("cancels a secondary-book adjustment without changing the root projection", async () => {
		const fixture = await createTwoBookAsset("SECONDARY");
		const submitted = await submitAdjustment(
			fixture.id,
			secondaryFinanceBookId,
			90,
			"2026-08-10",
		);
		const submittedState = await prisma.client.asset.findUniqueOrThrow({
			where: { id: fixture.id },
			select: {
				valueAfterDepreciation: true,
				financeBooks: {
					select: {
						financeBookId: true,
						valueAfterDepreciation: true,
						stateVersion: true,
					},
				},
			},
		});
		expect(Number(submittedState.valueAfterDepreciation)).toBe(100);
		expect(
			Number(
				submittedState.financeBooks.find(
					(book) => book.financeBookId === secondaryFinanceBookId,
				)?.valueAfterDepreciation,
			),
		).toBe(90);
		expect(
			submittedState.financeBooks.find(
				(book) => book.financeBookId === defaultFinanceBookId,
			)?.stateVersion,
		).toBe(0);
		expect(
			submittedState.financeBooks.find(
				(book) => book.financeBookId === secondaryFinanceBookId,
			)?.stateVersion,
		).toBe(1);

		const cancelled = await service.cancelAssetValueAdjustment(
			{ id: submitted.id },
			organizationId,
		);
		expect(cancelled.status).toBe("CANCELLED");
		const restoredState = await prisma.client.asset.findUniqueOrThrow({
			where: { id: fixture.id },
			select: {
				valueAfterDepreciation: true,
				financeBooks: {
					select: {
						financeBookId: true,
						valueAfterDepreciation: true,
						stateVersion: true,
					},
				},
			},
		});
		expect(Number(restoredState.valueAfterDepreciation)).toBe(100);
		expect(
			Number(
				restoredState.financeBooks.find(
					(book) => book.financeBookId === secondaryFinanceBookId,
				)?.valueAfterDepreciation,
			),
		).toBe(80);
		expect(
			Number(
				restoredState.financeBooks.find(
					(book) => book.financeBookId === defaultFinanceBookId,
				)?.valueAfterDepreciation,
			),
		).toBe(100);
		expect(
			restoredState.financeBooks.find(
				(book) => book.financeBookId === secondaryFinanceBookId,
			)?.stateVersion,
		).toBe(2);
		const revaluation =
			await prisma.client.assetRevaluationEntry.findUniqueOrThrow({
				where: { adjustmentId: submitted.id },
				select: { status: true },
			});
		expect(revaluation.status).toBe("REVERSED");
	});

	it("blocks cancellation after a later repair and leaves every linked row unchanged", async () => {
		const fixture = await createTwoBookAsset("REPAIR");
		const submitted = await submitAdjustment(
			fixture.id,
			defaultFinanceBookId,
			110,
			"2026-08-10",
		);
		const repair = await prisma.client.assetRepair.create({
			data: {
				series: `R014-REPAIR-${suffix}`,
				assetId: fixture.id,
				companyId,
				failureDate: dateOnly("2026-08-11"),
				completionDate: dateOnly("2026-08-11"),
				repairStatus: "COMPLETED",
				submittedAt: new Date("2026-08-12T12:00:00.000Z"),
			},
		});

		let cancellationError: unknown;
		try {
			await service.cancelAssetValueAdjustment(
				{ id: submitted.id },
				organizationId,
			);
		} catch (error) {
			cancellationError = error;
		}
		expect(cancellationError).toBeTruthy();

		const [adjustment, revaluation, asset, book] = await Promise.all([
			prisma.client.assetValueAdjustment.findUniqueOrThrow({
				where: { id: submitted.id },
				select: { status: true },
			}),
			prisma.client.assetRevaluationEntry.findUniqueOrThrow({
				where: { adjustmentId: submitted.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: fixture.id },
				select: { valueAfterDepreciation: true },
			}),
			prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: {
					assetId_financeBookId: {
						assetId: fixture.id,
						financeBookId: defaultFinanceBookId,
					},
				},
				select: { valueAfterDepreciation: true, stateVersion: true },
			}),
		]);
		expect(adjustment.status).toBe("SUBMITTED");
		expect(revaluation.status).toBe("POSTED");
		expect(Number(asset.valueAfterDepreciation)).toBe(110);
		expect(Number(book.valueAfterDepreciation)).toBe(110);
		expect(book.stateVersion).toBe(1);
		expect(repair.id).toBeTruthy();
	});

	it("serializes concurrent cancellation so only one transaction can reverse the lineage", async () => {
		const fixture = await createTwoBookAsset("CONCURRENT");
		const submitted = await submitAdjustment(
			fixture.id,
			defaultFinanceBookId,
			110,
			"2026-08-10",
		);
		const results = await Promise.allSettled([
			service.cancelAssetValueAdjustment({ id: submitted.id }, organizationId),
			service.cancelAssetValueAdjustment({ id: submitted.id }, organizationId),
		]);
		expect(
			results.filter((result) => result.status === "fulfilled"),
		).toHaveLength(1);
		expect(
			results.filter((result) => result.status === "rejected"),
		).toHaveLength(1);
		const [adjustment, revaluations] = await Promise.all([
			prisma.client.assetValueAdjustment.findUniqueOrThrow({
				where: { id: submitted.id },
				select: { status: true },
			}),
			prisma.client.assetRevaluationEntry.count({
				where: { adjustmentId: submitted.id, status: "REVERSED" },
			}),
		]);
		expect(adjustment.status).toBe("CANCELLED");
		expect(revaluations).toBe(1);
	});

	it("fails closed for a persisted compatible adjustment with null submittedAt", async () => {
		const fixture = await createTwoBookAsset("AMBIGUOUS");
		const submitted = await submitAdjustment(
			fixture.id,
			defaultFinanceBookId,
			110,
			"2026-08-10",
		);
		await prisma.client.assetValueAdjustment.create({
			data: {
				series: `R014-AMBIGUOUS-LATER-${suffix}`,
				assetId: fixture.id,
				financeBookId: defaultFinanceBookId,
				assetCategorySnapshot: "R-014 Machinery",
				adjustmentDate: dateOnly("2026-08-11"),
				currentAssetValue: 110,
				newAssetValue: 120,
				differenceAmount: 10,
				differenceAccount: "R-014 Ambiguous Revaluation",
				fixedAssetAccount: "R-014 Fixed Asset",
				status: "SUBMITTED",
				direction: "INCREASE",
				previousAssetStatus: "SUBMITTED",
				previousAssetValueAfterDepreciation: 110,
				previousFinanceBookStateVersion: 1,
				submittedFinanceBookStateVersion: null,
				submittedAt: null,
			},
		});

		const before = await Promise.all([
			prisma.client.assetValueAdjustment.findUniqueOrThrow({
				where: { id: submitted.id },
				select: { status: true },
			}),
			prisma.client.assetRevaluationEntry.findUniqueOrThrow({
				where: { adjustmentId: submitted.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: fixture.id },
				select: {
					valueAfterDepreciation: true,
					status: true,
					isFullyDepreciated: true,
				},
			}),
			prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: {
					assetId_financeBookId: {
						assetId: fixture.id,
						financeBookId: defaultFinanceBookId,
					},
				},
				select: { valueAfterDepreciation: true, stateVersion: true },
			}),
			prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: {
					assetId: fixture.id,
					assetFinanceBookId: fixture.defaultBookId,
					status: "ACTIVE",
				},
				select: { id: true, status: true, previousScheduleId: true },
			}),
			prisma.client.assetActivity.count({ where: { assetId: fixture.id } }),
		]);

		await expect(
			service.cancelAssetValueAdjustment({ id: submitted.id }, organizationId),
		).rejects.toThrow("incomplete chronology lineage");

		const after = await Promise.all([
			prisma.client.assetValueAdjustment.findUniqueOrThrow({
				where: { id: submitted.id },
				select: { status: true },
			}),
			prisma.client.assetRevaluationEntry.findUniqueOrThrow({
				where: { adjustmentId: submitted.id },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: fixture.id },
				select: {
					valueAfterDepreciation: true,
					status: true,
					isFullyDepreciated: true,
				},
			}),
			prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: {
					assetId_financeBookId: {
						assetId: fixture.id,
						financeBookId: defaultFinanceBookId,
					},
				},
				select: { valueAfterDepreciation: true, stateVersion: true },
			}),
			prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: {
					assetId: fixture.id,
					assetFinanceBookId: fixture.defaultBookId,
					status: "ACTIVE",
				},
				select: { id: true, status: true, previousScheduleId: true },
			}),
			prisma.client.assetActivity.count({ where: { assetId: fixture.id } }),
		]);

		expect(after).toEqual(before);
	});

	it("permits cancellation when a compatible adjustment is provably earlier", async () => {
		const fixture = await createTwoBookAsset("EARLIER");
		const submitted = await submitAdjustment(
			fixture.id,
			defaultFinanceBookId,
			110,
			"2026-08-10",
		);
		const earlier = await prisma.client.assetValueAdjustment.create({
			data: {
				series: `R014-EARLIER-${suffix}`,
				assetId: fixture.id,
				financeBookId: defaultFinanceBookId,
				assetCategorySnapshot: "R-014 Machinery",
				adjustmentDate: dateOnly("2026-08-09"),
				currentAssetValue: 100,
				newAssetValue: 105,
				differenceAmount: 5,
				differenceAccount: "R-014 Earlier Revaluation",
				fixedAssetAccount: "R-014 Fixed Asset",
				status: "SUBMITTED",
				direction: "INCREASE",
				previousAssetStatus: "PARTIALLY_DEPRECIATED",
				previousAssetValueAfterDepreciation: 100,
				previousFinanceBookStateVersion: 0,
				submittedFinanceBookStateVersion: 0,
				submittedAt: new Date("2026-08-09T12:00:00.000Z"),
			},
		});

		await expect(
			service.cancelAssetValueAdjustment({ id: submitted.id }, organizationId),
		).resolves.toMatchObject({ status: "CANCELLED" });
		const [cancelled, retained, revaluation] = await Promise.all([
			prisma.client.assetValueAdjustment.findUniqueOrThrow({
				where: { id: submitted.id },
				select: { status: true },
			}),
			prisma.client.assetValueAdjustment.findUniqueOrThrow({
				where: { id: earlier.id },
				select: { status: true, submittedAt: true },
			}),
			prisma.client.assetRevaluationEntry.findUniqueOrThrow({
				where: { adjustmentId: submitted.id },
				select: { status: true },
			}),
		]);
		expect(cancelled.status).toBe("CANCELLED");
		expect(retained.status).toBe("SUBMITTED");
		expect(retained.submittedAt).toEqual(new Date("2026-08-09T12:00:00.000Z"));
		expect(revaluation.status).toBe("REVERSED");
	});

	it("fails closed for a cross-Asset predecessor before any rollback mutation", async () => {
		const assetA = await createTwoBookAsset("CROSS-ASSET-A");
		const assetB = await createTwoBookAsset("CROSS-ASSET-B");
		const submitted = await submitAdjustment(
			assetA.id,
			defaultFinanceBookId,
			110,
			"2026-08-10",
		);
		const currentSchedule =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: {
					assetId: assetA.id,
					assetFinanceBookId: assetA.defaultBookId,
					status: "ACTIVE",
				},
			});
		const foreignPredecessor =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: {
					assetId: assetB.id,
					assetFinanceBookId: assetB.defaultBookId,
				},
			});
		await prisma.client.$transaction(async (tx) => {
			await tx.assetDepreciationSchedule.update({
				where: { id: foreignPredecessor.id },
				data: { status: "CANCELLED" },
			});
			await tx.assetDepreciationSchedule.update({
				where: { id: currentSchedule.id },
				data: { previousScheduleId: foreignPredecessor.id },
			});
		});

		await expect(
			service.cancelAssetValueAdjustment({ id: submitted.id }, organizationId),
		).rejects.toThrow("exact adjacent schedule");

		const [adjustment, revaluation, current, foreign, book] = await Promise.all(
			[
				prisma.client.assetValueAdjustment.findUniqueOrThrow({
					where: { id: submitted.id },
					select: { status: true },
				}),
				prisma.client.assetRevaluationEntry.findUniqueOrThrow({
					where: { adjustmentId: submitted.id },
					select: { status: true },
				}),
				prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
					where: { id: currentSchedule.id },
					select: { status: true, previousScheduleId: true },
				}),
				prisma.client.assetDepreciationSchedule.findUniqueOrThrow({
					where: { id: foreignPredecessor.id },
					select: { status: true },
				}),
				prisma.client.assetFinanceBook.findUniqueOrThrow({
					where: {
						assetId_financeBookId: {
							assetId: assetA.id,
							financeBookId: defaultFinanceBookId,
						},
					},
					select: { valueAfterDepreciation: true, stateVersion: true },
				}),
			],
		);
		expect(adjustment.status).toBe("SUBMITTED");
		expect(revaluation.status).toBe("POSTED");
		expect(current).toEqual({
			status: "ACTIVE",
			previousScheduleId: foreignPredecessor.id,
		});
		expect(foreign.status).toBe("CANCELLED");
		expect(Number(book.valueAfterDepreciation)).toBe(110);
		expect(book.stateVersion).toBe(1);
	});

	it("fails closed for a cross-book predecessor before any rollback mutation", async () => {
		const fixture = await createTwoBookAsset("CROSS-BOOK");
		const submitted = await submitAdjustment(
			fixture.id,
			defaultFinanceBookId,
			110,
			"2026-08-10",
		);
		const currentSchedule =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: {
					assetId: fixture.id,
					assetFinanceBookId: fixture.defaultBookId,
					status: "ACTIVE",
				},
			});
		const foreignPredecessor =
			await prisma.client.assetDepreciationSchedule.findFirstOrThrow({
				where: {
					assetId: fixture.id,
					assetFinanceBookId: fixture.secondaryBookId,
				},
			});
		await prisma.client.$transaction(async (tx) => {
			await tx.assetDepreciationSchedule.update({
				where: { id: foreignPredecessor.id },
				data: { status: "CANCELLED" },
			});
			await tx.assetDepreciationSchedule.update({
				where: { id: currentSchedule.id },
				data: { previousScheduleId: foreignPredecessor.id },
			});
		});

		await expect(
			service.cancelAssetValueAdjustment({ id: submitted.id }, organizationId),
		).rejects.toThrow("exact adjacent schedule");

		const [adjustment, revaluation, schedules, book] = await Promise.all([
			prisma.client.assetValueAdjustment.findUniqueOrThrow({
				where: { id: submitted.id },
				select: { status: true },
			}),
			prisma.client.assetRevaluationEntry.findUniqueOrThrow({
				where: { adjustmentId: submitted.id },
				select: { status: true },
			}),
			prisma.client.assetDepreciationSchedule.findMany({
				where: {
					assetId: fixture.id,
					id: { in: [currentSchedule.id, foreignPredecessor.id] },
				},
				select: { id: true, status: true, previousScheduleId: true },
			}),
			prisma.client.assetFinanceBook.findUniqueOrThrow({
				where: {
					assetId_financeBookId: {
						assetId: fixture.id,
						financeBookId: defaultFinanceBookId,
					},
				},
				select: { valueAfterDepreciation: true, stateVersion: true },
			}),
		]);
		expect(adjustment.status).toBe("SUBMITTED");
		expect(revaluation.status).toBe("POSTED");
		expect(schedules).toEqual(
			expect.arrayContaining([
				{
					id: currentSchedule.id,
					status: "ACTIVE",
					previousScheduleId: foreignPredecessor.id,
				},
				{
					id: foreignPredecessor.id,
					status: "CANCELLED",
					previousScheduleId: null,
				},
			]),
		);
		expect(Number(book.valueAfterDepreciation)).toBe(110);
		expect(book.stateVersion).toBe(1);
	});

	it("makes CWIP persistence wait on the canonical Asset lock", async () => {
		const fixture = await createTwoBookAsset("CWIP-LOCK");
		await prisma.client.asset.update({
			where: { id: fixture.id },
			data: { status: "SUBMITTED" },
		});

		let releaseHolder: (() => void) | undefined;
		const holderReleased = new Promise<void>((resolve) => {
			releaseHolder = resolve;
		});
		let resolveLockAcquired: (() => void) | undefined;
		const lockAcquired = new Promise<void>((resolve) => {
			resolveLockAcquired = resolve;
		});
		const holder = prisma.client.$transaction(async (tx) => {
			await tx.$queryRaw`
				SELECT pg_advisory_xact_lock(hashtext(${`asset:${fixture.id}`})) IS NULL AS "locked"
			`;
			resolveLockAcquired?.();
			await holderReleased;
		});
		await lockAcquired;

		const posting = cwip.post({
			version: 1,
			organizationId,
			assetId: fixture.id,
			availableForUseDate: "2026-01-01",
		});
		try {
			const beforeRelease = await Promise.race([
				posting.then(() => "posted" as const),
				new Promise<"waiting">((resolve) =>
					setTimeout(() => resolve("waiting"), 300),
				),
			]);
			expect(beforeRelease).toBe("waiting");
			expect(
				await prisma.client.assetAccountingEntry.count({
					where: { assetId: fixture.id },
				}),
			).toBe(0);
		} finally {
			releaseHolder?.();
			await holder;
		}

		await expect(posting).resolves.toMatchObject({ status: "posted" });
		const [entry, asset] = await Promise.all([
			prisma.client.assetAccountingEntry.findFirstOrThrow({
				where: { assetId: fixture.id, sourceType: "CWIP_CAPITALIZATION" },
				select: { status: true },
			}),
			prisma.client.asset.findUniqueOrThrow({
				where: { id: fixture.id },
				select: { cwipAccountingEntryId: true },
			}),
		]);
		expect(entry.status).toBe("POSTED");
		expect(asset.cwipAccountingEntryId).not.toBeNull();
	});
});
