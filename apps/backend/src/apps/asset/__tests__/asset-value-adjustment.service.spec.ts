import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import type { AssetDashboardSubService } from "../asset-dashboard.service";
import type { AssetDepreciationRevisionService } from "../depreciation/asset-depreciation-revision.service";

const COMPANY_ID = "company-1";
const COMPANY = "ACME Corp";
const COMPANY_RELATION = {
	id: COMPANY_ID,
	name: COMPANY,
	organizationId: "org-1",
};
const OTHER_COMPANY_RELATION = {
	id: "company-2",
	name: "Other Corp",
	organizationId: "org-1",
};

function createMockPrisma() {
	const mockTx = {
		$queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]),
		assetDepreciationSchedule: {
			update: jest.fn(),
			create: jest.fn(),
		},
		assetRevaluationEntry: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
		},
		asset: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
		},
		assetActivity: {
			create: jest.fn(),
		},
		assetValueAdjustment: {
			create: jest.fn(),
			findFirst: jest.fn(),
			findFirstOrThrow: jest.fn(),
			findUnique: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
			count: jest.fn(),
		},
		documentSeriesCounter: {
			findUnique: jest.fn(),
			update: jest.fn(),
		},
	};

	const result = {
		asset: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
		},
		assetCategory: {
			findUnique: jest.fn(),
		},
		assetValueAdjustment: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		assetRevaluationEntry: {
			findFirst: jest.fn(),
			findUnique: jest.fn(),
		},
		assetDepreciationSchedule: {
			update: jest.fn(),
			create: jest.fn(),
		},
		assetActivity: {
			create: jest.fn(),
		},
		documentSeriesCounter: {
			findUnique: jest.fn(),
			update: jest.fn(),
		},
		client: {
			$queryRaw: jest.fn(),
		},
		$transaction: jest.fn().mockImplementation(async (fn) => fn(mockTx)),
		_mockTx: mockTx,
	};

	mockTx.asset.findFirst.mockImplementation((args: unknown) =>
		mockTx.asset.findUnique(args),
	);
	mockTx.asset.updateMany.mockImplementation(
		async (args: { data: unknown }) => {
			await mockTx.asset.update({
				where: { id: "asset-001" },
				data: args.data,
			});
			return { count: 1 };
		},
	);

	const rootAsset = result.asset;
	rootAsset.findFirst.mockImplementation((args: unknown) =>
		rootAsset.findUnique(args),
	);
	const rootAdjustment = result.assetValueAdjustment;
	rootAdjustment.findFirst.mockImplementation((args: unknown) =>
		rootAdjustment.findUnique(args),
	);
	mockTx.assetValueAdjustment.findFirst.mockImplementation((args: unknown) =>
		mockTx.assetValueAdjustment.findUnique(args),
	);
	mockTx.assetValueAdjustment.findFirstOrThrow.mockImplementation(
		(args: unknown) => mockTx.assetValueAdjustment.findUnique(args),
	);
	for (const delegate of [
		mockTx.assetValueAdjustment,
		mockTx.assetRevaluationEntry,
	] as const) {
		delegate.updateMany.mockImplementation(async (args: unknown) => {
			const { where, data } = args as {
				where?: { id?: string };
				data?: unknown;
			};
			const result = await delegate.update({
				where: { id: where?.id },
				data,
			});
			if (result !== undefined) delegate.findUnique.mockResolvedValue(result);
			return { count: 1 };
		});
	}

	return result;
}

function createTestContext() {
	const mockPrisma = createMockPrisma();
	mockPrisma.documentSeriesCounter.findUnique.mockResolvedValue(null);
	mockPrisma._mockTx.documentSeriesCounter.findUnique.mockResolvedValue(null);
	mockPrisma.client.$queryRaw.mockImplementation(async (query: unknown) => {
		const values =
			query &&
			typeof query === "object" &&
			"values" in query &&
			Array.isArray(query.values)
				? query.values
				: [];
		const initialValue =
			typeof values[1] === "number" && Number.isFinite(values[1])
				? values[1]
				: 1;
		return [{ value: initialValue }];
	});
	const mockDashboard = {} as unknown as AssetDashboardSubService;
	const mockFiscalYear = {
		getFiscalYearEndDate: jest.fn().mockResolvedValue(null),
	} as unknown as FiscalYearService;
	const mockDepreciationRevision = {
		revise: jest.fn().mockResolvedValue([
			{
				assetFinanceBookId: "asset-book-001",
				previousScheduleId: "sched-prev",
				scheduleId: "sched-002",
				carryingValue: 90000,
				totalNumberOfDepreciations: 10,
				remainingDepreciations: 8,
			},
		]),
		restoreRevision: jest.fn().mockResolvedValue(undefined),
	};
	const service = new AssetService(
		mockPrisma as unknown as PrismaService,
		mockDashboard,
		mockFiscalYear,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		mockDepreciationRevision as unknown as AssetDepreciationRevisionService,
	);
	return {
		service,
		mockPrisma,
		mockTx: mockPrisma._mockTx,
		mockDepreciationRevision,
	};
}

const baseAssetContext = {
	id: "asset-001",
	series: "AST-2026-00001",
	assetName: "Hydraulic Pump A",
	companyId: COMPANY_ID,
	company: COMPANY_RELATION,
	status: "SUBMITTED",
	purchaseDate: new Date("2026-01-01"),
	availableForUseDate: new Date("2026-01-15"),
	netPurchaseAmount: new Prisma.Decimal("100000"),
	openingAccumulatedDepreciation: new Prisma.Decimal("20000"),
	openingNumberOfBookedDepreciations: 2,
	isFullyDepreciated: false,
	valueAfterDepreciation: new Prisma.Decimal("80000"),
	calculateDepreciation: true,
	depreciationMethod: "STRAIGHT_LINE",
	totalNumberOfDepreciations: 10,
	frequencyOfDepreciation: 1,
	assetCategory: {
		id: "cat-001",
		name: "Machinery",
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 10,
		frequencyOfDepreciation: 1,
		nonDepreciableCategory: false,
	},
	financeBooks: [
		{
			id: "asset-book-001",
			assetId: "asset-001",
			financeBookId: "finance-book-001",
			financeBook: { name: "Company Books" },
			depreciationMethod: "STRAIGHT_LINE",
			totalNumberOfDepreciations: 10,
			frequencyOfDepreciation: 1,
			depreciationStartDate: new Date("2026-01-31"),
			dailyProrataBased: false,
			shiftBased: false,
			rateOfDepreciation: null,
			expectedValueAfterUsefulLife: new Prisma.Decimal("0"),
			openingAccumulatedDepreciation: new Prisma.Decimal("20000"),
			openingNumberOfBookedDepreciations: 2,
			valueAfterDepreciation: new Prisma.Decimal("80000"),
			totalNumberOfBookedDepreciations: 2,
			lastPostedDepreciationDate: new Date("2026-03-31"),
			postingStatus: "PARTIALLY_DEPRECIATED",
		},
	],
};

function createAdjustmentRow(overrides?: Record<string, unknown>) {
	return {
		id: "adj-001",
		series: "AVA-2026-00001",
		assetId: "asset-001",
		financeBookId: "finance-book-001",
		financeBook: { name: "Company Books" },
		assetCategorySnapshot: "Machinery",
		adjustmentDate: new Date("2026-04-15"),
		currentAssetValue: new Prisma.Decimal("80000"),
		newAssetValue: new Prisma.Decimal("90000"),
		differenceAmount: new Prisma.Decimal("10000"),
		differenceAccount: "Asset Revaluation Reserve",
		fixedAssetAccount: "Machinery Fixed Asset",
		costCenter: "Main Plant",
		notes: "Annual valuation uplift",
		status: "DRAFT",
		direction: "INCREASE",
		previousAssetStatus: "SUBMITTED",
		previousIsFullyDepreciated: false,
		previousAssetValueAfterDepreciation: new Prisma.Decimal("80000"),
		submittedAt: null,
		cancelledAt: null,
		createdAt: new Date("2026-04-15T10:00:00Z"),
		updatedAt: new Date("2026-04-15T10:00:00Z"),
		asset: {
			id: "asset-001",
			series: "AST-2026-00001",
			assetName: "Hydraulic Pump A",
			companyId: COMPANY_ID,
			company: COMPANY_RELATION,
			assetCategory: { name: "Machinery" },
		},
		revaluationEntry: null,
		depreciationSchedule: null,
		...overrides,
	};
}

describe("AssetService > AssetValueAdjustment", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];
	let mockTx: ReturnType<typeof createTestContext>["mockTx"];
	let mockDepreciationRevision: ReturnType<
		typeof createTestContext
	>["mockDepreciationRevision"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma, mockTx, mockDepreciationRevision } =
			createTestContext());
	});

	it("builds a value-adjustment preview with revaluation direction and schedule entries", async () => {
		mockPrisma.asset.findUnique.mockResolvedValue(baseAssetContext);

		const result = await service.previewAssetValueAdjustment(
			{
				assetId: "asset-001",
				adjustmentDate: "2026-04-15",
				newAssetValue: 90000,
			},
			"org-1",
		);

		expect(result.currentAssetValue).toBe(80000);
		expect(result.differenceAmount).toBe(10000);
		expect(result.direction).toBe("INCREASE");
		expect(result.financeBookId).toBe("finance-book-001");
		expect(result.financeBookName).toBe("Company Books");
		expect(result.fixedAssetAccount).toBe("Machinery Fixed Asset");
		expect(result.validationMessages).toEqual([]);
		expect(result.depreciationSchedule?.entries).toHaveLength(8);
	});

	it("creates a draft asset value adjustment with computed snapshot values", async () => {
		mockPrisma.asset.findUnique.mockResolvedValue(baseAssetContext);
		mockTx.asset.findUnique.mockResolvedValue(baseAssetContext);
		mockPrisma.assetValueAdjustment.findFirst.mockResolvedValue(null);
		mockPrisma.assetValueAdjustment.findUnique.mockResolvedValue(null);
		mockTx.assetValueAdjustment.create.mockResolvedValue(createAdjustmentRow());

		const result = await service.createAssetValueAdjustment(
			{
				assetId: "asset-001",
				adjustmentDate: "2026-04-15",
				newAssetValue: 90000,
				differenceAccount: "Asset Revaluation Reserve",
				costCenter: "Main Plant",
				notes: "Annual valuation uplift",
			},
			"org-1",
		);

		expect(mockTx.assetValueAdjustment.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					series: "AVA-2026-00001",
					currentAssetValue: "80000",
					differenceAmount: "10000",
					fixedAssetAccount: "Machinery Fixed Asset",
					financeBookId: "finance-book-001",
				}),
			}),
		);
		expect(result.status).toBe("DRAFT");
	});

	it("requires an explicit configured finance book when the asset has multiple books", async () => {
		const multiBookAsset = {
			...baseAssetContext,
			financeBooks: [
				...baseAssetContext.financeBooks,
				{
					...baseAssetContext.financeBooks[0],
					id: "asset-book-002",
					financeBookId: "finance-book-002",
					financeBook: { name: "Tax Books" },
					valueAfterDepreciation: new Prisma.Decimal("60000"),
				},
			],
		};
		mockPrisma.asset.findUnique.mockResolvedValue(multiBookAsset);

		const missingSelection = await service.previewAssetValueAdjustment(
			{
				assetId: "asset-001",
				adjustmentDate: "2026-04-15",
				newAssetValue: 70000,
			},
			"org-1",
		);
		expect(missingSelection.validationMessages).toContain(
			"Select the finance book whose carrying value and schedule should be revised.",
		);

		const selected = await service.previewAssetValueAdjustment(
			{
				assetId: "asset-001",
				financeBookId: "finance-book-002",
				adjustmentDate: "2026-04-15",
				newAssetValue: 70000,
			},
			"org-1",
		);
		expect(selected.currentAssetValue).toBe(60000);
		expect(selected.financeBookName).toBe("Tax Books");
	});

	it("rejects a finance book that is not configured for the selected asset", async () => {
		mockPrisma.asset.findUnique.mockResolvedValue(baseAssetContext);

		await expect(
			service.previewAssetValueAdjustment(
				{
					assetId: "asset-001",
					financeBookId: "finance-book-other",
					adjustmentDate: "2026-04-15",
					newAssetValue: 90000,
				},
				"org-1",
			),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it("submits a draft adjustment and creates revaluation plus depreciation revision records", async () => {
		mockPrisma.assetValueAdjustment.findUnique.mockResolvedValue({
			id: "adj-001",
			assetId: "asset-001",
			financeBookId: "finance-book-001",
			adjustmentDate: new Date("2026-04-15"),
			status: "DRAFT",
		});
		mockTx.assetValueAdjustment.findUnique.mockResolvedValue({
			id: "adj-001",
			series: "AVA-2026-00001",
			assetId: "asset-001",
			financeBookId: "finance-book-001",
			adjustmentDate: new Date("2026-04-15"),
			currentAssetValue: new Prisma.Decimal("80000"),
			newAssetValue: new Prisma.Decimal("90000"),
			differenceAccount: "Asset Revaluation Reserve",
			costCenter: "Main Plant",
			notes: "Annual valuation uplift",
			status: "DRAFT",
		});
		mockTx.asset.findUnique.mockResolvedValue(baseAssetContext);
		mockTx.assetRevaluationEntry.findFirst.mockResolvedValue(null);
		mockTx.assetRevaluationEntry.findUnique.mockResolvedValue(null);
		mockTx.assetValueAdjustment.update.mockResolvedValue(
			createAdjustmentRow({
				status: "SUBMITTED",
				submittedAt: new Date("2026-04-15T12:00:00Z"),
				revaluationEntry: {
					id: "entry-001",
					series: "JE-AVA-2026-00001",
					adjustmentId: "adj-001",
					assetId: "asset-001",
					companyId: COMPANY_ID,
					company: COMPANY_RELATION,
					postingDate: new Date("2026-04-15"),
					remarks: "Asset revaluation for AST-2026-00001 via AVA-2026-00001",
					status: "POSTED",
					reversedAt: null,
					createdAt: new Date("2026-04-15T12:00:00Z"),
					updatedAt: new Date("2026-04-15T12:00:00Z"),
					lines: [
						{
							id: "line-001",
							lineType: "DEBIT",
							account: "Machinery Fixed Asset",
							debitAmount: new Prisma.Decimal("10000"),
							creditAmount: new Prisma.Decimal("0"),
							costCenter: "Main Plant",
							createdAt: new Date("2026-04-15T12:00:00Z"),
							updatedAt: new Date("2026-04-15T12:00:00Z"),
						},
					],
				},
				depreciationSchedule: {
					id: "sched-002",
					adjustmentId: "adj-001",
					assetId: "asset-001",
					assetFinanceBookId: "asset-book-001",
					previousScheduleId: "sched-prev",
					revisionNumber: 2,
					status: "ACTIVE",
					startDate: new Date("2026-04-15"),
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 10,
					frequencyOfDepreciation: 1,
					bookedDepreciations: 2,
					remainingDepreciations: 8,
					openingAccumulatedDepreciation: new Prisma.Decimal("20000"),
					baseAssetValue: new Prisma.Decimal("90000"),
					notes: "Projected from adjustment AVA-2026-00001",
					createdAt: new Date("2026-04-15T12:00:00Z"),
					updatedAt: new Date("2026-04-15T12:00:00Z"),
					entries: [
						{
							id: "entry-001",
							sequence: 1,
							scheduleDate: new Date("2026-04-30"),
							depreciationAmount: new Prisma.Decimal("11250"),
							accumulatedDepreciationAmount: new Prisma.Decimal("31250"),
							bookValueAfterDepreciation: new Prisma.Decimal("78750"),
							createdAt: new Date("2026-04-15T12:00:00Z"),
							updatedAt: new Date("2026-04-15T12:00:00Z"),
						},
					],
				},
			}),
		);

		const result = await service.submitAssetValueAdjustment(
			{ id: "adj-001" },
			"org-1",
			"actor-001",
		);

		expect(mockDepreciationRevision.revise).toHaveBeenCalledWith(
			mockTx,
			"org-1",
			expect.objectContaining({
				assetId: "asset-001",
				financeBookId: "finance-book-001",
				adjustmentId: "adj-001",
				valueDelta: 10000,
			}),
		);
		expect(mockTx.assetRevaluationEntry.create).toHaveBeenCalled();
		expect(mockTx.asset.update).toHaveBeenCalledWith({
			where: { id: "asset-001" },
			data: expect.objectContaining({
				valueAfterDepreciation: "90000",
				status: "PARTIALLY_DEPRECIATED",
			}),
		});
		expect(mockTx.assetActivity.create).toHaveBeenCalledWith({
			data: expect.objectContaining({ userId: "actor-001" }),
		});
		expect(result.status).toBe("SUBMITTED");
		expect(result.revaluationEntry?.series).toBe("JE-AVA-2026-00001");
	});

	it("cancels the latest submitted adjustment and restores the prior asset state", async () => {
		mockPrisma.assetValueAdjustment.findUnique.mockResolvedValue({
			id: "adj-001",
			assetId: "asset-001",
			status: "SUBMITTED",
		});
		mockTx.assetValueAdjustment.findUnique.mockResolvedValue({
			id: "adj-001",
			series: "AVA-2026-00001",
			assetId: "asset-001",
			financeBookId: "finance-book-001",
			currentAssetValue: new Prisma.Decimal("80000"),
			status: "SUBMITTED",
			previousAssetStatus: "SUBMITTED",
			previousIsFullyDepreciated: false,
			previousAssetValueAfterDepreciation: new Prisma.Decimal("80000"),
			submittedAt: new Date("2026-04-15T12:00:00Z"),
			revaluationEntry: { id: "entry-001" },
			depreciationSchedule: { id: "sched-002" },
		});
		mockTx.asset.findUnique.mockResolvedValue({
			companyId: COMPANY_ID,
			company: COMPANY_RELATION,
		});
		mockTx.assetValueAdjustment.count.mockResolvedValue(0);
		mockTx.assetValueAdjustment.update.mockResolvedValue(
			createAdjustmentRow({
				status: "CANCELLED",
				cancelledAt: new Date("2026-04-16T10:00:00Z"),
				revaluationEntry: {
					id: "entry-001",
					series: "JE-AVA-2026-00001",
					adjustmentId: "adj-001",
					assetId: "asset-001",
					companyId: COMPANY_ID,
					company: COMPANY_RELATION,
					postingDate: new Date("2026-04-15"),
					remarks: "Asset revaluation for AST-2026-00001 via AVA-2026-00001",
					status: "REVERSED",
					reversedAt: new Date("2026-04-16T10:00:00Z"),
					createdAt: new Date("2026-04-15T12:00:00Z"),
					updatedAt: new Date("2026-04-16T10:00:00Z"),
					lines: [],
				},
				depreciationSchedule: {
					id: "sched-002",
					adjustmentId: "adj-001",
					assetId: "asset-001",
					assetFinanceBookId: "asset-book-001",
					previousScheduleId: "sched-prev",
					revisionNumber: 2,
					status: "CANCELLED",
					startDate: new Date("2026-04-15"),
					depreciationMethod: "STRAIGHT_LINE",
					totalNumberOfDepreciations: 10,
					frequencyOfDepreciation: 1,
					bookedDepreciations: 2,
					remainingDepreciations: 8,
					openingAccumulatedDepreciation: new Prisma.Decimal("20000"),
					baseAssetValue: new Prisma.Decimal("90000"),
					notes: "Projected from adjustment AVA-2026-00001",
					createdAt: new Date("2026-04-15T12:00:00Z"),
					updatedAt: new Date("2026-04-16T10:00:00Z"),
					entries: [],
				},
			}),
		);

		const result = await service.cancelAssetValueAdjustment(
			{ id: "adj-001" },
			"org-1",
		);

		expect(mockDepreciationRevision.restoreRevision).toHaveBeenCalledWith(
			mockTx,
			"org-1",
			{
				assetId: "asset-001",
				financeBookId: "finance-book-001",
				scheduleId: "sched-002",
				previousValueAfterDepreciation: 80000,
			},
		);
		expect(mockTx.assetRevaluationEntry.update).toHaveBeenCalledWith({
			where: { id: "entry-001" },
			data: expect.objectContaining({ status: "REVERSED" }),
		});
		expect(mockTx.asset.update).toHaveBeenCalledWith({
			where: { id: "asset-001" },
			data: expect.objectContaining({
				valueAfterDepreciation: "80000",
				status: "SUBMITTED",
			}),
		});
		expect(result.status).toBe("CANCELLED");
	});

	it("rejects submission when the draft snapshot is stale", async () => {
		mockPrisma.assetValueAdjustment.findUnique.mockResolvedValue({
			id: "adj-001",
			assetId: "asset-001",
			financeBookId: "finance-book-001",
			adjustmentDate: new Date("2026-04-15"),
			status: "DRAFT",
		});
		mockTx.assetValueAdjustment.findUnique.mockResolvedValue({
			id: "adj-001",
			series: "AVA-2026-00001",
			assetId: "asset-001",
			financeBookId: "finance-book-001",
			adjustmentDate: new Date("2026-04-15"),
			currentAssetValue: new Prisma.Decimal("70000"),
			newAssetValue: new Prisma.Decimal("90000"),
			differenceAccount: "Asset Revaluation Reserve",
			costCenter: "Main Plant",
			notes: "Annual valuation uplift",
			status: "DRAFT",
		});
		mockTx.asset.findUnique.mockResolvedValue(baseAssetContext);

		await expect(
			service.submitAssetValueAdjustment({ id: "adj-001" }, "org-1"),
		).rejects.toBeInstanceOf(ConflictException);
	});

	it("uses the current canonical Asset Company ID when submitting", async () => {
		mockPrisma.assetValueAdjustment.findUnique.mockResolvedValue({
			id: "adj-001",
			assetId: "asset-001",
			financeBookId: "finance-book-001",
			adjustmentDate: new Date("2026-04-15"),
			status: "DRAFT",
		});
		mockTx.assetValueAdjustment.findUnique.mockResolvedValue({
			id: "adj-001",
			series: "AVA-2026-00001",
			assetId: "asset-001",
			financeBookId: "finance-book-001",
			adjustmentDate: new Date("2026-04-15"),
			currentAssetValue: new Prisma.Decimal("80000"),
			newAssetValue: new Prisma.Decimal("90000"),
			differenceAccount: "Asset Revaluation Reserve",
			costCenter: "Main Plant",
			notes: null,
			status: "DRAFT",
		});
		mockTx.asset.findUnique.mockResolvedValue({
			...baseAssetContext,
			companyId: OTHER_COMPANY_RELATION.id,
			company: OTHER_COMPANY_RELATION,
		});

		mockTx.assetValueAdjustment.update.mockResolvedValue(
			createAdjustmentRow({
				asset: {
					id: "asset-001",
					series: "AST-2026-00001",
					assetName: "Hydraulic Pump A",
					companyId: OTHER_COMPANY_RELATION.id,
					company: OTHER_COMPANY_RELATION,
					assetCategory: { name: "Machinery" },
				},
			}),
		);

		const result = await service.submitAssetValueAdjustment(
			{ id: "adj-001" },
			"org-1",
		);

		expect(mockTx.assetRevaluationEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ companyId: OTHER_COMPANY_RELATION.id }),
			}),
		);
		expect(result.companyId).toBe(OTHER_COMPANY_RELATION.id);
	});

	describe("fiscal year scenarios", () => {
		it("builds correct schedule when adjustment date is in April (FY transition)", async () => {
			const assetContextApril = {
				...baseAssetContext,
				availableForUseDate: new Date("2025-01-15"),
				purchaseDate: new Date("2025-01-01"),
				netPurchaseAmount: new Prisma.Decimal("100000"),
				openingAccumulatedDepreciation: new Prisma.Decimal("0"),
				openingNumberOfBookedDepreciations: 0,
				valueAfterDepreciation: new Prisma.Decimal("100000"),
				financeBooks: [
					{
						...baseAssetContext.financeBooks[0],
						openingAccumulatedDepreciation: new Prisma.Decimal("0"),
						openingNumberOfBookedDepreciations: 0,
						valueAfterDepreciation: new Prisma.Decimal("100000"),
						totalNumberOfBookedDepreciations: 0,
						lastPostedDepreciationDate: null,
						postingStatus: "PENDING",
					},
				],
			};
			mockPrisma.asset.findUnique.mockResolvedValue(assetContextApril);

			const result = await service.previewAssetValueAdjustment(
				{
					assetId: "asset-001",
					adjustmentDate: "2025-04-15",
					newAssetValue: 100000,
				},
				"org-1",
			);

			expect(result.depreciationSchedule).not.toBeNull();
			expect(result.depreciationSchedule?.entries.length).toBeGreaterThan(0);
		});

		it("scales salvage value proportionally like ERPNext", async () => {
			const assetWithSalvage = {
				...baseAssetContext,
				financeBooks: [
					{
						...baseAssetContext.financeBooks[0],
						expectedValueAfterUsefulLife: new Prisma.Decimal("10000"),
					},
				],
			};
			mockPrisma.asset.findUnique.mockResolvedValue(assetWithSalvage);

			const result = await service.previewAssetValueAdjustment(
				{
					assetId: "asset-001",
					adjustmentDate: "2026-04-15",
					newAssetValue: 40000,
				},
				"org-1",
			);

			expect(result.depreciationSchedule).not.toBeNull();
			const lastEntry =
				result.depreciationSchedule?.entries[
					result.depreciationSchedule?.entries.length - 1
				];
			expect(lastEntry?.bookValueAfterDepreciation).toBeCloseTo(5000, 0);
		});

		it("handles WDV depreciation with fiscal year boundary crossing", async () => {
			const wdvAssetContext = {
				...baseAssetContext,
				depreciationMethod: "WRITTEN_DOWN_VALUE",
				assetCategory: {
					...baseAssetContext.assetCategory,
					depreciationMethod: "WRITTEN_DOWN_VALUE",
					rateOfDepreciation: 20,
				},
				openingAccumulatedDepreciation: new Prisma.Decimal("0"),
				openingNumberOfBookedDepreciations: 0,
				valueAfterDepreciation: new Prisma.Decimal("100000"),
				financeBooks: [
					{
						...baseAssetContext.financeBooks[0],
						depreciationMethod: "WRITTEN_DOWN_VALUE",
						rateOfDepreciation: new Prisma.Decimal("20"),
						openingAccumulatedDepreciation: new Prisma.Decimal("0"),
						openingNumberOfBookedDepreciations: 0,
						valueAfterDepreciation: new Prisma.Decimal("100000"),
						totalNumberOfBookedDepreciations: 0,
						lastPostedDepreciationDate: null,
						postingStatus: "PENDING",
					},
				],
			};
			mockPrisma.asset.findUnique.mockResolvedValue(wdvAssetContext);

			const result = await service.previewAssetValueAdjustment(
				{
					assetId: "asset-001",
					adjustmentDate: "2024-11-01",
					newAssetValue: 100000,
				},
				"org-1",
			);

			expect(result.depreciationSchedule).not.toBeNull();
			expect(result.depreciationSchedule?.depreciationMethod).toBe(
				"WRITTEN_DOWN_VALUE",
			);
		});
	});
});
