import { ConflictException } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import type { AssetDashboardSubService } from "../asset-dashboard.service";

function createMockPrisma() {
	const mockTx = {
		assetDepreciationSchedule: {
			update: jest.fn(),
			create: jest.fn(),
		},
		assetRevaluationEntry: {
			create: jest.fn(),
			update: jest.fn(),
		},
		asset: {
			update: jest.fn(),
		},
		assetActivity: {
			create: jest.fn(),
		},
		assetValueAdjustment: {
			update: jest.fn(),
		},
	};

	return {
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
		},
		client: {
			$queryRaw: jest.fn(),
		},
		$transaction: jest.fn().mockImplementation(async (fn) => fn(mockTx)),
		_mockTx: mockTx,
	};
}

function createTestContext() {
	const mockPrisma = createMockPrisma();
	mockPrisma.documentSeriesCounter.findUnique.mockResolvedValue(null);
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
	const service = new AssetService(
		mockPrisma as unknown as PrismaService,
		mockDashboard,
		mockFiscalYear,
	);
	return { service, mockPrisma, mockTx: mockPrisma._mockTx };
}

const baseAssetContext = {
	id: "asset-001",
	series: "AST-2026-00001",
	assetName: "Hydraulic Pump A",
	company: "ACME Corp",
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
	depreciationSchedules: [{ id: "sched-prev", revisionNumber: 1 }],
};

function createAdjustmentRow(overrides?: Record<string, unknown>) {
	return {
		id: "adj-001",
		series: "AVA-2026-00001",
		assetId: "asset-001",
		assetCategorySnapshot: "Machinery",
		companySnapshot: "ACME Corp",
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
		submittedAt: null,
		cancelledAt: null,
		createdAt: new Date("2026-04-15T10:00:00Z"),
		updatedAt: new Date("2026-04-15T10:00:00Z"),
		asset: {
			id: "asset-001",
			series: "AST-2026-00001",
			assetName: "Hydraulic Pump A",
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

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma, mockTx } = createTestContext());
	});

	it("builds a value-adjustment preview with revaluation direction and schedule entries", async () => {
		mockPrisma.asset.findUnique.mockResolvedValue(baseAssetContext);

		const result = await service.previewAssetValueAdjustment({
			assetId: "asset-001",
			adjustmentDate: new Date("2026-04-15"),
			newAssetValue: 90000,
		});

		expect(result.currentAssetValue).toBe(80000);
		expect(result.differenceAmount).toBe(10000);
		expect(result.direction).toBe("INCREASE");
		expect(result.fixedAssetAccount).toBe("Machinery Fixed Asset");
		expect(result.validationMessages).toEqual([]);
		expect(result.depreciationSchedule?.entries).toHaveLength(8);
	});

	it("creates a draft asset value adjustment with computed snapshot values", async () => {
		mockPrisma.asset.findUnique.mockResolvedValue(baseAssetContext);
		mockPrisma.assetValueAdjustment.findFirst.mockResolvedValue(null);
		mockPrisma.assetValueAdjustment.findUnique.mockResolvedValue(null);
		mockPrisma.assetValueAdjustment.create.mockResolvedValue(
			createAdjustmentRow(),
		);

		const result = await service.createAssetValueAdjustment({
			assetId: "asset-001",
			adjustmentDate: new Date("2026-04-15"),
			newAssetValue: 90000,
			differenceAccount: "Asset Revaluation Reserve",
			costCenter: "Main Plant",
			notes: "Annual valuation uplift",
		});

		expect(mockPrisma.assetValueAdjustment.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					series: "AVA-2026-00001",
					currentAssetValue: "80000",
					differenceAmount: "10000",
					fixedAssetAccount: "Machinery Fixed Asset",
				}),
			}),
		);
		expect(result.status).toBe("DRAFT");
	});

	it("submits a draft adjustment and creates revaluation plus depreciation revision records", async () => {
		mockPrisma.assetValueAdjustment.findUnique.mockResolvedValue({
			id: "adj-001",
			series: "AVA-2026-00001",
			assetId: "asset-001",
			adjustmentDate: new Date("2026-04-15"),
			currentAssetValue: new Prisma.Decimal("80000"),
			newAssetValue: new Prisma.Decimal("90000"),
			differenceAccount: "Asset Revaluation Reserve",
			costCenter: "Main Plant",
			notes: "Annual valuation uplift",
			status: "DRAFT",
		});
		mockPrisma.asset.findUnique.mockResolvedValue(baseAssetContext);
		mockPrisma.assetRevaluationEntry.findFirst.mockResolvedValue(null);
		mockPrisma.assetRevaluationEntry.findUnique.mockResolvedValue(null);
		mockTx.assetValueAdjustment.update.mockResolvedValue(
			createAdjustmentRow({
				status: "SUBMITTED",
				submittedAt: new Date("2026-04-15T12:00:00Z"),
				revaluationEntry: {
					id: "entry-001",
					series: "JE-AVA-2026-00001",
					adjustmentId: "adj-001",
					assetId: "asset-001",
					company: "ACME Corp",
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

		const result = await service.submitAssetValueAdjustment({ id: "adj-001" });

		expect(mockTx.assetDepreciationSchedule.update).toHaveBeenCalledWith({
			where: { id: "sched-prev" },
			data: { status: "CANCELLED" },
		});
		expect(mockTx.assetRevaluationEntry.create).toHaveBeenCalled();
		expect(mockTx.asset.update).toHaveBeenCalledWith({
			where: { id: "asset-001" },
			data: expect.objectContaining({
				valueAfterDepreciation: "90000",
				status: "PARTIALLY_DEPRECIATED",
			}),
		});
		expect(result.status).toBe("SUBMITTED");
		expect(result.revaluationEntry?.series).toBe("JE-AVA-2026-00001");
	});

	it("cancels the latest submitted adjustment and restores the prior asset state", async () => {
		mockPrisma.assetValueAdjustment.findUnique.mockResolvedValue({
			id: "adj-001",
			series: "AVA-2026-00001",
			assetId: "asset-001",
			currentAssetValue: new Prisma.Decimal("80000"),
			status: "SUBMITTED",
			previousAssetStatus: "SUBMITTED",
			previousIsFullyDepreciated: false,
			submittedAt: new Date("2026-04-15T12:00:00Z"),
			revaluationEntry: { id: "entry-001" },
			depreciationSchedule: {
				id: "sched-002",
				previousScheduleId: "sched-prev",
			},
		});
		mockPrisma.assetValueAdjustment.count.mockResolvedValue(0);
		mockTx.assetValueAdjustment.update.mockResolvedValue(
			createAdjustmentRow({
				status: "CANCELLED",
				cancelledAt: new Date("2026-04-16T10:00:00Z"),
				revaluationEntry: {
					id: "entry-001",
					series: "JE-AVA-2026-00001",
					adjustmentId: "adj-001",
					assetId: "asset-001",
					company: "ACME Corp",
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

		const result = await service.cancelAssetValueAdjustment({ id: "adj-001" });

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
			series: "AVA-2026-00001",
			assetId: "asset-001",
			adjustmentDate: new Date("2026-04-15"),
			currentAssetValue: new Prisma.Decimal("70000"),
			newAssetValue: new Prisma.Decimal("90000"),
			differenceAccount: "Asset Revaluation Reserve",
			costCenter: "Main Plant",
			notes: "Annual valuation uplift",
			status: "DRAFT",
		});
		mockPrisma.asset.findUnique.mockResolvedValue(baseAssetContext);

		await expect(
			service.submitAssetValueAdjustment({ id: "adj-001" }),
		).rejects.toBeInstanceOf(ConflictException);
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
			};
			mockPrisma.asset.findUnique.mockResolvedValue(assetContextApril);

			const result = await service.previewAssetValueAdjustment({
				assetId: "asset-001",
				adjustmentDate: new Date("2025-04-15"),
				newAssetValue: 100000,
			});

			expect(result.depreciationSchedule).not.toBeNull();
			expect(result.depreciationSchedule?.entries.length).toBeGreaterThan(0);
		});

		it("preserves salvage value when expectedValueAfterUsefulLife is set", async () => {
			const assetWithSalvage = {
				...baseAssetContext,
				assetCategory: {
					...baseAssetContext.assetCategory,
					expectedValueAfterUsefulLife: new Prisma.Decimal("10000"),
				},
			};
			mockPrisma.asset.findUnique.mockResolvedValue(assetWithSalvage);

			const result = await service.previewAssetValueAdjustment({
				assetId: "asset-001",
				adjustmentDate: new Date("2026-04-15"),
				newAssetValue: 100000,
			});

			expect(result.depreciationSchedule).not.toBeNull();
			const lastEntry =
				result.depreciationSchedule?.entries[
					result.depreciationSchedule?.entries.length - 1
				];
			expect(lastEntry?.bookValueAfterDepreciation).toBeCloseTo(10000, 0);
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
			};
			mockPrisma.asset.findUnique.mockResolvedValue(wdvAssetContext);

			const result = await service.previewAssetValueAdjustment({
				assetId: "asset-001",
				adjustmentDate: new Date("2024-11-01"),
				newAssetValue: 100000,
			});

			expect(result.depreciationSchedule).not.toBeNull();
			expect(result.depreciationSchedule?.depreciationMethod).toBe(
				"WRITTEN_DOWN_VALUE",
			);
		});
	});
});
