import { BadRequestException, ConflictException } from "@nestjs/common";
import type { FiscalYearService } from "../../../shared/fiscal-year/fiscal-year.service";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetService } from "../asset.service";
import type { AssetAccountingService } from "../asset-accounting.service";
import type { AssetDashboardSubService } from "../asset-dashboard.service";
import type { AssetStockPostingService } from "../asset-stock-posting.service";
import type { AssetDepreciationRevisionService } from "../depreciation/asset-depreciation-revision.service";
import type { DepreciationBarrierService } from "../depreciation/depreciation-barrier.service";

const ORIGINAL_APP_TIME_ZONE = process.env.APP_TIME_ZONE;
const COMPANY = "Acme Corp";
const COMPANY_ID = "company-1";
const ORGANIZATION_ID = "organization-1";
const COMPANY_RELATION = {
	id: COMPANY_ID,
	name: COMPANY,
	organizationId: ORGANIZATION_ID,
};
const FIXED_ASSET_ACCOUNT = "Plant and Machinery - ACME";
const ACCUMULATED_DEPRECIATION_ACCOUNT = "Accumulated Depreciation - ACME";
const GAIN_LOSS_ACCOUNT = "Gain or Loss on Asset Disposal - ACME";
const PROCEEDS_ACCOUNT = "Bank - ACME";
const STOCK_EXPENSE_ACCOUNT = "Stock Adjustment - ACME";
const REPAIR_EXPENSE_ACCOUNT = "Repairs Payable - ACME";
const SERVICE_EXPENSE_ACCOUNT = "Services Payable - ACME";
const COST_CENTER = "Main - ACME";

function disposalRecord(overrides: Record<string, unknown> = {}) {
	const now = new Date("2026-01-15T00:00:00.000Z");
	return {
		id: "disposal-1",
		series: "DISP-2026-00001",
		assetId: "asset-1",
		asset: { assetName: "CNC Machine" },
		companyId: COMPANY_ID,
		company: COMPANY_RELATION,
		financeBookId: "finance-book-1",
		disposalDate: new Date("2026-01-15T00:00:00.000Z"),
		disposalType: "SELL",
		salesAmount: 8_500,
		gainLossAmount: 1_500,
		fixedAssetAccount: FIXED_ASSET_ACCOUNT,
		accumulatedDepreciationAccount: ACCUMULATED_DEPRECIATION_ACCOUNT,
		proceedsAccount: PROCEEDS_ACCOUNT,
		gainLossAccount: GAIN_LOSS_ACCOUNT,
		costCenter: COST_CENTER,
		accountingEntryId: "accounting-1",
		accountingEntry: { series: "AAE-2026-00001" },
		previousAssetStatus: "PARTIALLY_DEPRECIATED",
		previousIsFullyDepreciated: false,
		status: "POSTED",
		notes: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function repairConsumedItem(overrides: Record<string, unknown> = {}) {
	const now = new Date("2026-02-15T00:00:00.000Z");
	return {
		id: "repair-item-1",
		repairId: "repair-1",
		assetId: null,
		consumedAsset: null,
		itemCode: "BEARING-001",
		warehouse: "Stores - ACME",
		expenseAccount: STOCK_EXPENSE_ACCOUNT,
		quantity: 2,
		valuationRate: 250,
		totalAmount: 500,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function repairInvoice(overrides: Record<string, unknown> = {}) {
	const now = new Date("2026-02-15T00:00:00.000Z");
	return {
		id: "repair-invoice-1",
		repairId: "repair-1",
		purchaseInvoice: "PINV-2026-00001",
		expenseAccount: REPAIR_EXPENSE_ACCOUNT,
		amount: 1_000,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function repairRecord(overrides: Record<string, unknown> = {}) {
	const now = new Date("2026-02-15T00:00:00.000Z");
	return {
		id: "repair-1",
		series: "REP-2026-00001",
		assetId: "asset-1",
		asset: { assetName: "CNC Machine" },
		companyId: COMPANY_ID,
		company: COMPANY_RELATION,
		failureDate: new Date("2026-02-01T00:00:00.000Z"),
		completionDate: new Date("2026-02-15T00:00:00.000Z"),
		repairStatus: "PENDING",
		repairCost: 1_500,
		capitalizeRepairCost: true,
		increaseInAssetLife: 2,
		description: "Replace spindle bearings",
		previousAssetStatus: "PARTIALLY_DEPRECIATED",
		previousNetPurchaseAmount: null,
		previousValueAfterDepreciation: null,
		previousTotalDepreciations: null,
		submittedAt: null,
		cancelledAt: null,
		stockEntryId: null,
		accountingEntryId: null,
		consumedItems: [repairConsumedItem()],
		purchaseInvoices: [repairInvoice()],
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function capitalizationStockItem(overrides: Record<string, unknown> = {}) {
	const now = new Date("2026-03-01T00:00:00.000Z");
	return {
		id: "cap-stock-1",
		capitalizationId: "capitalization-1",
		itemCode: "STEEL-PLATE",
		warehouse: "Stores - ACME",
		expenseAccount: STOCK_EXPENSE_ACCOUNT,
		stockQty: 2,
		valuationRate: 250,
		amount: 500,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function capitalizationAssetItem(overrides: Record<string, unknown> = {}) {
	const now = new Date("2026-03-01T00:00:00.000Z");
	return {
		id: "cap-asset-1",
		capitalizationId: "capitalization-1",
		assetId: "source-asset-1",
		financeBookId: null,
		asset: { assetName: "Source Machine" },
		assetValue: 999,
		previousStatus: null,
		previousIsFullyDepreciated: false,
		previousDisposalDate: null,
		closedScheduleId: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function capitalizationServiceItem(overrides: Record<string, unknown> = {}) {
	const now = new Date("2026-03-01T00:00:00.000Z");
	return {
		id: "cap-service-1",
		capitalizationId: "capitalization-1",
		itemCode: "FABRICATION",
		expenseAccount: SERVICE_EXPENSE_ACCOUNT,
		amount: 200,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function capitalizationRecord(overrides: Record<string, unknown> = {}) {
	const now = new Date("2026-03-01T00:00:00.000Z");
	return {
		id: "capitalization-1",
		series: "CAP-2026-00001",
		companyId: COMPANY_ID,
		company: COMPANY_RELATION,
		postingDate: new Date("2026-03-01T00:00:00.000Z"),
		targetType: "EXISTING_ASSET",
		targetAssetId: "target-asset-1",
		financeBookId: null,
		targetAsset: { assetName: "Composite Machine" },
		targetAssetName: "Composite Machine",
		targetAssetCategory: "Plant and Machinery",
		targetItemCode: "COMPOSITE-MACHINE",
		status: "DRAFT",
		totalStockValue: 500,
		totalAssetValue: 3_000,
		totalServiceValue: 200,
		totalValue: 3_700,
		notes: null,
		submittedAt: null,
		cancelledAt: null,
		stockEntryId: null,
		accountingEntryId: null,
		createdTargetAsset: false,
		targetPreviousNetPurchaseAmount: null,
		targetPreviousValueAfterDepreciation: null,
		targetPreviousIsFullyDepreciated: false,
		targetPreviousFinanceBookValue: null,
		targetPreviousFinanceBookSnapshot: null,
		targetPreviousCalculateDepreciation: null,
		targetFinanceBookCreated: false,
		targetFinanceBookScheduleCreated: false,
		targetPreviousStatus: null,
		stockItems: [capitalizationStockItem()],
		assetItems: [capitalizationAssetItem()],
		serviceItems: [capitalizationServiceItem()],
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function assetRecord(overrides: Record<string, unknown> = {}) {
	const now = new Date("2025-01-01T00:00:00.000Z");
	return {
		id: "asset-1",
		series: "AST-2025-00001",
		assetName: "CNC Machine",
		itemCode: "CNC-MACHINE",
		barcode: null,
		assetCategoryId: "category-1",
		assetCategory: { id: "category-1", name: "Plant and Machinery" },
		companyId: COMPANY_ID,
		company: { ...COMPANY_RELATION, defaultFinanceBookId: "finance-book-1" },
		locationId: null,
		location: null,
		custodian: null,
		department: null,
		purchaseDate: now,
		availableForUseDate: now,
		disposalDate: null,
		netPurchaseAmount: 10_000,
		assetQuantity: 1,
		calculateDepreciation: true,
		openingAccumulatedDepreciation: 0,
		openingNumberOfBookedDepreciations: 0,
		isFullyDepreciated: false,
		valueAfterDepreciation: 7_000,
		maintenanceRequired: false,
		assetOwner: "COMPANY",
		assetOwnerCompany: COMPANY,
		supplier: null,
		customer: null,
		policyNumber: null,
		insurer: null,
		insuredValue: null,
		insuranceStartDate: null,
		insuranceEndDate: null,
		depreciationMethod: "STRAIGHT_LINE",
		totalNumberOfDepreciations: 10,
		frequencyOfDepreciation: 12,
		expectedValueAfterUsefulLife: 0,
		depreciationStartDate: now,
		purchaseReceipt: null,
		purchaseInvoice: null,
		status: "PARTIALLY_DEPRECIATED",
		financeBooks: [
			{
				id: "asset-book-1",
				financeBookId: "finance-book-1",
				financeBook: { name: "Company Books" },
				depreciationMethod: "STRAIGHT_LINE",
				totalNumberOfDepreciations: 10,
				increaseInAssetLife: 0,
				frequencyOfDepreciation: 12,
				depreciationStartDate: now,
				dailyProrataBased: false,
				shiftBased: false,
				rateOfDepreciation: null,
				expectedValueAfterUsefulLife: 0,
				openingAccumulatedDepreciation: 3_000,
				openingNumberOfBookedDepreciations: 3,
				valueAfterDepreciation: 7_000,
				totalNumberOfBookedDepreciations: 3,
				lastPostedDepreciationDate: null,
				postingStatus: "PARTIALLY_DEPRECIATED",
			},
		],
		activities: [],
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function createMockPrisma() {
	const mockTx = {
		$queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]),
		asset: {
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findFirst: jest.fn(),
			findFirstOrThrow: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
		},
		assetDisposal: {
			findFirst: jest.fn(),
			findFirstOrThrow: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
			count: jest.fn(),
		},
		assetMovement: {
			findFirst: jest.fn(),
			findFirstOrThrow: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
			count: jest.fn(),
		},
		assetRepair: {
			findFirst: jest.fn(),
			findFirstOrThrow: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
			count: jest.fn(),
		},
		assetCapitalization: {
			findFirst: jest.fn(),
			findFirstOrThrow: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
			count: jest.fn(),
		},
		assetMaintenanceTask: {
			findFirst: jest.fn().mockResolvedValue(null),
			findMany: jest.fn().mockResolvedValue([]),
			findFirstOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
			deleteMany: jest.fn(),
		},
		assetMaintenanceLog: {
			findFirst: jest.fn().mockResolvedValue(null),
			findMany: jest.fn().mockResolvedValue([]),
			findFirstOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
		},
		assetCapitalizationAssetItem: {
			update: jest.fn(),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
		},
		assetFinanceBook: {
			findFirst: jest.fn().mockResolvedValue({
				id: "source-asset-book-1",
				financeBookId: "finance-book-1",
				stateVersion: 2,
				valueAfterDepreciation: 7_000,
				totalNumberOfBookedDepreciations: 3,
				postingStatus: "PARTIALLY_DEPRECIATED",
				lastPostedDepreciationDate: null,
			}),
			findMany: jest.fn().mockResolvedValue([]),
			findUnique: jest.fn(),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
		},
		assetDepreciationSchedule: {
			findFirst: jest.fn().mockResolvedValue(null),
			findMany: jest.fn().mockResolvedValue([]),
			deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
		},
		assetDepreciationScheduleEntry: {
			findMany: jest.fn().mockResolvedValue([]),
			count: jest.fn().mockResolvedValue(0),
			updateMany: jest.fn().mockResolvedValue({ count: 0 }),
		},
		assetFinanceBookShiftAllocation: {
			deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
			createMany: jest.fn().mockResolvedValue({ count: 0 }),
		},
		assetActivity: {
			create: jest.fn(),
		},
		assetDepreciationJournalEntry: {
			count: jest.fn().mockResolvedValue(0),
			findMany: jest.fn().mockResolvedValue([]),
			updateMany: jest.fn().mockResolvedValue({ count: 0 }),
			aggregate: jest
				.fn()
				.mockResolvedValue({ _sum: { depreciationAmount: null } }),
		},
		assetAccountingEntry: {
			findFirst: jest.fn().mockResolvedValue({ id: "accounting-1" }),
			count: jest.fn().mockResolvedValue(0),
			findMany: jest.fn().mockResolvedValue([]),
		},
		assetValueAdjustment: {
			aggregate: jest
				.fn()
				.mockResolvedValue({ _sum: { differenceAmount: null } }),
			count: jest.fn().mockResolvedValue(0),
			findMany: jest.fn().mockResolvedValue([]),
		},
		company: {
			findUnique: jest.fn().mockResolvedValue({
				id: "company-1",
				disabled: false,
				defaultFinanceBookId: "finance-book-1",
				defaultCostCenter: COST_CENTER,
				accumulatedDepreciationAccount: ACCUMULATED_DEPRECIATION_ACCOUNT,
			}),
		},
		financeBook: {
			findUnique: jest.fn().mockResolvedValue({ id: "finance-book-2" }),
		},
		assetCategoryAccount: {
			findUnique: jest.fn().mockResolvedValue({
				fixedAssetAccount: FIXED_ASSET_ACCOUNT,
				accumulatedDepreciationAccount: ACCUMULATED_DEPRECIATION_ACCOUNT,
			}),
		},
		assetCategory: {
			findUnique: jest.fn().mockResolvedValue({ id: "category-1" }),
		},
		inventoryItem: {
			findUnique: jest.fn().mockResolvedValue({
				isFixedAsset: true,
				disabled: false,
				endOfLife: null,
			}),
		},
		documentSeriesCounter: {
			findUnique: jest.fn().mockResolvedValue(null),
			update: jest.fn(),
		},
	};
	const legacyIdWhere = (args: {
		where?: { id?: string; AND?: Array<{ id?: string }> };
	}) => ({
		...args,
		where: {
			id: args.where?.id ?? args.where?.AND?.find((part) => part.id)?.id,
		},
	});
	mockTx.asset.findFirst.mockImplementation(
		async (args: { where?: { id?: string; AND?: Array<{ id?: string }> } }) => {
			const result = await mockTx.asset.findUnique(legacyIdWhere(args));
			return result ?? mockTx.asset.findUniqueOrThrow(legacyIdWhere(args));
		},
	);
	mockTx.asset.findFirstOrThrow.mockImplementation(
		async (args: { where?: { id?: string; AND?: Array<{ id?: string }> } }) => {
			const result = await mockTx.asset.findUniqueOrThrow(legacyIdWhere(args));
			return result ?? mockTx.asset.findUnique(legacyIdWhere(args));
		},
	);
	mockTx.asset.updateMany.mockImplementation(
		async (args: {
			where?: { id?: string; AND?: Array<{ id?: string }> };
			data: unknown;
		}) => {
			const id = args.where?.id ?? args.where?.AND?.find((part) => part.id)?.id;
			const result = await mockTx.asset.update({
				where: { id },
				data: args.data,
			});
			if (result !== undefined)
				mockTx.asset.findUniqueOrThrow.mockResolvedValue(result);
			return { count: 1 };
		},
	);
	(mockTx.company as { findFirst?: jest.Mock }).findFirst = jest.fn(
		(args: unknown) => mockTx.company.findUnique(args),
	);
	for (const delegate of [
		mockTx.assetMovement,
		mockTx.assetRepair,
		mockTx.assetCapitalization,
		mockTx.assetDisposal,
	]) {
		delegate.findFirst.mockImplementation(async (args: unknown) => {
			const result = await delegate.findUnique(args);
			return result ?? delegate.findUniqueOrThrow?.(args);
		});
		delegate.findFirstOrThrow.mockImplementation(async (args: unknown) => {
			const result = await delegate.findUnique(args);
			return result ?? delegate.findUniqueOrThrow?.(args);
		});
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
	mockTx.assetMovement.findFirstOrThrow.mockImplementation(
		async (args: unknown) => {
			const result = await mockTx.assetMovement.findUniqueOrThrow(args);
			return result ?? mockTx.assetMovement.findUnique(args);
		},
	);

	const mockPrisma = {
		asset: {
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findFirst: jest.fn(),
			findFirstOrThrow: jest.fn(),
			update: jest.fn(),
		},
		assetDisposal: {
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn().mockResolvedValue([]),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
		},
		assetMovement: {
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
			count: jest.fn(),
		},
		assetRepair: {
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
		},
		assetCapitalization: {
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			findFirst: jest.fn(),
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			count: jest.fn(),
		},
		company: {
			findUnique: jest.fn().mockResolvedValue({
				...COMPANY_RELATION,
				disabled: false,
				defaultFinanceBookId: "finance-book-1",
			}),
			findFirst: jest.fn(),
		},
		assetActivity: { create: jest.fn() },
		documentSeriesCounter: {
			findUnique: jest.fn().mockResolvedValue(null),
			update: jest.fn(),
		},
		client: {
			$queryRaw: jest.fn().mockResolvedValue([{ value: 1 }]),
		},
		$transaction: jest
			.fn()
			.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<unknown>) =>
				fn(mockTx),
			),
		_mockTx: mockTx,
	};
	mockPrisma.asset.findFirst.mockImplementation(async (args: unknown) => {
		const result = await mockPrisma.asset.findUnique(args);
		return result ?? mockPrisma.asset.findUniqueOrThrow?.(args);
	});
	mockPrisma.asset.findFirstOrThrow.mockImplementation((args: unknown) =>
		mockPrisma.asset.findUnique(args),
	);
	mockPrisma.company.findFirst.mockImplementation((args: unknown) =>
		mockPrisma.company.findUnique(args),
	);
	for (const [txDelegate, prismaDelegate] of [
		[mockTx.assetMovement, mockPrisma.assetMovement],
		[mockTx.assetRepair, mockPrisma.assetRepair],
		[mockTx.assetCapitalization, mockPrisma.assetCapitalization],
		[mockTx.assetDisposal, mockPrisma.assetDisposal],
	] as const) {
		txDelegate.findUnique.mockImplementation((args: unknown) =>
			prismaDelegate.findUnique(args),
		);
	}
	for (const delegate of [
		mockPrisma.assetMovement,
		mockPrisma.assetRepair,
		mockPrisma.assetCapitalization,
		mockPrisma.assetDisposal,
	]) {
		delegate.findFirst.mockImplementation(async (args: unknown) => {
			const result = await delegate.findUnique(args);
			return result ?? delegate.findUniqueOrThrow?.(args);
		});
	}

	return mockPrisma;
}

function createTestContext() {
	const mockPrisma = createMockPrisma();
	const accounting = {
		createPostedEntry: jest.fn().mockResolvedValue({
			id: "accounting-1",
			series: "AAE-2026-00001",
		}),
		reversePostedEntry: jest.fn().mockResolvedValue({
			id: "accounting-reversal-1",
			series: "AAE-2026-00002",
		}),
	};
	const stockPosting = {
		createMaterialIssue: jest
			.fn()
			.mockResolvedValue({ id: "stock-entry-1", series: "STE-2026-00001" }),
		cancelMaterialIssue: jest.fn().mockResolvedValue(undefined),
	};
	const depreciationRevision = {
		revise: jest.fn().mockResolvedValue([]),
		closeOpenSchedules: jest.fn().mockResolvedValue(1),
		reactivateLatestClosedSchedules: jest.fn().mockResolvedValue(1),
		reactivateSchedulesClosedByCapitalization: jest.fn().mockResolvedValue(0),
	};
	const depreciationBarrier = {
		ensureDepreciationPosted: jest.fn().mockResolvedValue(undefined),
	};
	const dashboard = {} as AssetDashboardSubService;
	const fiscalYear = {
		getFiscalYearEndDate: jest.fn().mockResolvedValue(null),
	} as unknown as FiscalYearService;

	const service = new AssetService(
		mockPrisma as unknown as PrismaService,
		dashboard,
		fiscalYear,
		undefined,
		depreciationBarrier as unknown as DepreciationBarrierService,
		undefined,
		accounting as unknown as AssetAccountingService,
		stockPosting as unknown as AssetStockPostingService,
		depreciationRevision as unknown as AssetDepreciationRevisionService,
	);

	return {
		service,
		mockPrisma,
		accounting,
		stockPosting,
		depreciationRevision,
		depreciationBarrier,
	};
}

beforeAll(() => {
	process.env.APP_TIME_ZONE = "UTC";
});

afterAll(() => {
	if (ORIGINAL_APP_TIME_ZONE === undefined) {
		delete process.env.APP_TIME_ZONE;
	} else {
		process.env.APP_TIME_ZONE = ORIGINAL_APP_TIME_ZONE;
	}
});

describe("Asset lifecycle actions", () => {
	describe("disposal posting and restoration", () => {
		it("posts depreciation, revalidates the locked asset, and records balanced sale accounting", async () => {
			const {
				service,
				mockPrisma,
				accounting,
				depreciationRevision,
				depreciationBarrier,
			} = createTestContext();
			const disposalDate = new Date("2026-01-15T00:00:00.000Z");
			mockPrisma.asset.findUnique.mockResolvedValue(
				assetRecord({ status: "PARTIALLY_DEPRECIATED" }),
			);
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue(
				assetRecord({ status: "PARTIALLY_DEPRECIATED" }),
			);
			mockPrisma._mockTx.assetDisposal.create.mockResolvedValue(
				disposalRecord({ accountingEntryId: null, accountingEntry: null }),
			);
			mockPrisma._mockTx.assetDisposal.update.mockResolvedValue(
				disposalRecord(),
			);

			const result = await service.sellAsset(
				{
					assetId: "asset-1",
					disposalDate: "2026-01-15",
					salesAmount: 8_500,
					proceedsAccount: PROCEEDS_ACCOUNT,
					gainLossAccount: GAIN_LOSS_ACCOUNT,
					costCenter: COST_CENTER,
				},
				"org-1",
				"user-1",
			);

			expect(result.status).toBe("POSTED");
			expect(depreciationBarrier.ensureDepreciationPosted).toHaveBeenCalledWith(
				{
					kind: "organization",
					organizationId: "org-1",
					throughDate: disposalDate,
					assetIds: ["asset-1"],
					financeBookId: "finance-book-1",
				},
			);
			expect(mockPrisma._mockTx.$queryRaw).toHaveBeenCalled();
			expect(mockPrisma._mockTx.asset.findUnique).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: "asset-1" } }),
			);
			expect(accounting.createPostedEntry).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				expect.objectContaining({
					companyId: COMPANY_ID,
					assetId: "asset-1",
					sourceType: "DISPOSAL",
					postingDate: "2026-01-15",
					lines: [
						{
							account: FIXED_ASSET_ACCOUNT,
							debitAmount: 0,
							creditAmount: 10_000,
							costCenter: COST_CENTER,
						},
						{
							account: ACCUMULATED_DEPRECIATION_ACCOUNT,
							debitAmount: 3_000,
							creditAmount: 0,
							costCenter: COST_CENTER,
						},
						{
							account: PROCEEDS_ACCOUNT,
							debitAmount: 8_500,
							creditAmount: 0,
							costCenter: COST_CENTER,
						},
						{
							account: GAIN_LOSS_ACCOUNT,
							debitAmount: 0,
							creditAmount: 1_500,
							costCenter: COST_CENTER,
						},
					],
				}),
			);
			expect(depreciationRevision.closeOpenSchedules).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				"asset-1",
				"finance-book-1",
			);
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: { status: "SOLD", disposalDate },
			});
		});

		it("records a disposal loss as a debit when scrapping", async () => {
			const { service, mockPrisma, accounting } = createTestContext();
			mockPrisma.asset.findUnique.mockResolvedValue(assetRecord());
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue(assetRecord());
			mockPrisma._mockTx.assetDisposal.create.mockResolvedValue(
				disposalRecord({
					disposalType: "SCRAP",
					salesAmount: 0,
					gainLossAmount: -7_000,
					proceedsAccount: null,
					accountingEntryId: null,
					accountingEntry: null,
				}),
			);
			mockPrisma._mockTx.assetDisposal.update.mockResolvedValue(
				disposalRecord({
					disposalType: "SCRAP",
					salesAmount: 0,
					gainLossAmount: -7_000,
					proceedsAccount: null,
				}),
			);

			await service.scrapAsset(
				{
					assetId: "asset-1",
					disposalDate: "2026-01-15",
					gainLossAccount: GAIN_LOSS_ACCOUNT,
					costCenter: COST_CENTER,
				},
				"org-1",
			);

			const postingInput = accounting.createPostedEntry.mock.calls[0]?.[2];
			expect(postingInput?.lines).toContainEqual({
				account: GAIN_LOSS_ACCOUNT,
				debitAmount: 7_000,
				creditAmount: 0,
				costCenter: COST_CENTER,
			});
		});

		it("rejects a future disposal before running the depreciation barrier", async () => {
			const { service, depreciationBarrier } = createTestContext();

			await expect(
				service.scrapAsset(
					{
						assetId: "asset-1",
						disposalDate: "2100-01-01",
						gainLossAccount: GAIN_LOSS_ACCOUNT,
					},
					"org-1",
				),
			).rejects.toThrow("cannot be in the future");
			expect(
				depreciationBarrier.ensureDepreciationPosted,
			).not.toHaveBeenCalled();
		});

		it("rejects a duplicate or stale disposal after taking the asset lock", async () => {
			const { service, mockPrisma, accounting } = createTestContext();
			mockPrisma.asset.findUnique.mockResolvedValue(
				assetRecord({ status: "SOLD" }),
			);
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue(
				assetRecord({ status: "SOLD" }),
			);

			await expect(
				service.scrapAsset(
					{
						assetId: "asset-1",
						disposalDate: "2026-01-15",
						gainLossAccount: GAIN_LOSS_ACCOUNT,
					},
					"org-1",
				),
			).rejects.toThrow("cannot be disposed");
			expect(mockPrisma._mockTx.$queryRaw).toHaveBeenCalled();
			expect(accounting.createPostedEntry).not.toHaveBeenCalled();
		});

		it("rejects disposal before availability or after later posted depreciation", async () => {
			const first = createTestContext();
			first.mockPrisma.asset.findUnique.mockResolvedValue(
				assetRecord({
					purchaseDate: new Date("2026-02-01T00:00:00.000Z"),
					availableForUseDate: new Date("2026-02-05T00:00:00.000Z"),
				}),
			);
			first.mockPrisma._mockTx.asset.findUnique.mockResolvedValue(
				assetRecord({
					purchaseDate: new Date("2026-02-01T00:00:00.000Z"),
					availableForUseDate: new Date("2026-02-05T00:00:00.000Z"),
				}),
			);
			await expect(
				first.service.scrapAsset(
					{
						assetId: "asset-1",
						disposalDate: "2026-02-01",
						gainLossAccount: GAIN_LOSS_ACCOUNT,
					},
					"org-1",
				),
			).rejects.toThrow("available-for-use date");

			const second = createTestContext();
			second.mockPrisma.asset.findUnique.mockResolvedValue(assetRecord());
			second.mockPrisma._mockTx.asset.findUnique.mockResolvedValue(
				assetRecord(),
			);
			second.mockPrisma._mockTx.assetDepreciationJournalEntry.count.mockResolvedValue(
				1,
			);
			await expect(
				second.service.scrapAsset(
					{
						assetId: "asset-1",
						disposalDate: "2026-02-01",
						gainLossAccount: GAIN_LOSS_ACCOUNT,
					},
					"org-1",
				),
			).rejects.toThrow("latest posted depreciation");
		});

		it("restores the exact prior state, reverses accounting, and reactivates schedules", async () => {
			const { service, mockPrisma, accounting, depreciationRevision } =
				createTestContext();
			const disposedAsset = assetRecord({
				status: "SOLD",
				disposalDate: new Date("2026-01-15T00:00:00.000Z"),
			});
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue(disposedAsset);
			mockPrisma._mockTx.assetDisposal.findFirst.mockResolvedValue(
				disposalRecord({
					createdAt: new Date("2026-01-15T00:00:00.000Z"),
					previousAssetStatus: "FULLY_DEPRECIATED",
					previousIsFullyDepreciated: true,
				}),
			);
			mockPrisma._mockTx.asset.update.mockResolvedValue(
				assetRecord({ status: "FULLY_DEPRECIATED", isFullyDepreciated: true }),
			);

			const restored = await service.restoreAsset(
				{ assetId: "asset-1" },
				"org-1",
				"user-1",
			);

			expect(restored.status).toBe("FULLY_DEPRECIATED");
			expect(accounting.reversePostedEntry).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				"accounting-1",
			);
			expect(
				depreciationRevision.reactivateLatestClosedSchedules,
			).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				"asset-1",
				"finance-book-1",
			);
			expect(mockPrisma._mockTx.assetDisposal.update).toHaveBeenCalledWith({
				where: { id: "disposal-1" },
				data: { status: "CANCELLED" },
			});
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "asset-1" },
					data: {
						status: "FULLY_DEPRECIATED",
						isFullyDepreciated: true,
						disposalDate: null,
					},
				}),
			);
		});

		it("blocks restoration when downstream depreciation or accounting exists", async () => {
			const { service, mockPrisma, accounting, depreciationRevision } =
				createTestContext();
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue(
				assetRecord({ status: "SCRAPPED" }),
			);
			mockPrisma._mockTx.assetDisposal.findFirst.mockResolvedValue(
				disposalRecord(),
			);
			mockPrisma._mockTx.assetAccountingEntry.count.mockResolvedValue(1);

			await expect(
				service.restoreAsset({ assetId: "asset-1" }, "org-1"),
			).rejects.toThrow(ConflictException);
			expect(accounting.reversePostedEntry).not.toHaveBeenCalled();
			expect(
				depreciationRevision.reactivateLatestClosedSchedules,
			).not.toHaveBeenCalled();
		});

		it("rejects restoration of an operational asset", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue(
				assetRecord({ status: "SUBMITTED" }),
			);

			await expect(
				service.restoreAsset({ assetId: "asset-1" }, "org-1"),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("asset movement submission and cancellation", () => {
		it("acquires multi-asset advisory locks in deterministic sorted order", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma._mockTx.asset.findUnique
				.mockResolvedValueOnce({
					id: "asset-b",
					series: "AST-2025-00002",
					companyId: COMPANY_ID,
					company: COMPANY_RELATION,
					status: "SUBMITTED",
					locationId: "loc-1",
					custodian: null,
				})
				.mockResolvedValueOnce({
					id: "asset-a",
					series: "AST-2025-00001",
					companyId: COMPANY_ID,
					company: COMPANY_RELATION,
					status: "SUBMITTED",
					locationId: "loc-1",
					custodian: null,
				});
			mockPrisma._mockTx.assetMovement.findFirst.mockResolvedValue(null);
			mockPrisma._mockTx.assetMovement.create.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				transactionDate: new Date("2026-01-01T00:00:00.000Z"),
				purpose: "ISSUE",
				status: "DRAFT",
				notes: null,
				submittedAt: null,
				cancelledAt: null,
				items: [],
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-01T00:00:00.000Z"),
			});

			await service.createAssetMovement(
				{
					companyId: COMPANY_ID,
					transactionDate: "2026-01-01",
					purpose: "ISSUE",
					items: [
						{ assetId: "asset-b", toEmployee: "Employee B" },
						{ assetId: "asset-a", toEmployee: "Employee A" },
					],
				},
				"org-1",
			);

			const firstLockValues = mockPrisma._mockTx.$queryRaw.mock.calls
				.slice(0, 2)
				.map(([query]) => (query as { values: unknown[] }).values[0]);
			expect(firstLockValues).toEqual(["asset:asset-a", "asset:asset-b"]);
		});

		it("rejects duplicate assets before creating a movement", async () => {
			const { service } = createTestContext();

			await expect(
				service.createAssetMovement(
					{
						companyId: COMPANY_ID,
						transactionDate: "2026-01-01",
						purpose: "TRANSFER",
						items: [
							{ assetId: "asset-1", targetLocationId: "loc-2" },
							{ assetId: "asset-1", targetLocationId: "loc-3" },
						],
					},
					"org-1",
				),
			).rejects.toThrow("only once");
		});

		it("rejects creating a movement for an asset in another company", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue({
				id: "asset-1",
				series: "AST-2025-00001",
				companyId: "company-2",
				company: { id: "company-2", name: "Other Corp" },
				status: "SUBMITTED",
				locationId: "loc-1",
				custodian: null,
			});

			await expect(
				service.createAssetMovement(
					{
						companyId: COMPANY_ID,
						transactionDate: "2026-01-01",
						purpose: "TRANSFER",
						items: [{ assetId: "asset-1", targetLocationId: "loc-2" }],
					},
					"org-1",
				),
			).rejects.toThrow("does not belong");
		});

		it("rejects a movement dated before the latest submitted movement", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue({
				id: "asset-1",
				series: "AST-2025-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				status: "SUBMITTED",
				locationId: "loc-1",
				custodian: null,
			});
			mockPrisma._mockTx.assetMovement.findFirst.mockResolvedValue({
				transactionDate: new Date("2026-02-01T00:00:00.000Z"),
			});

			await expect(
				service.createAssetMovement(
					{
						companyId: COMPANY_ID,
						transactionDate: "2026-01-01",
						purpose: "TRANSFER",
						items: [{ assetId: "asset-1", targetLocationId: "loc-2" }],
					},
					"org-1",
				),
			).rejects.toThrow("cannot be earlier");
		});

		it("rejects a concurrent duplicate submit using the conditional transition", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.assetMovement.findUnique.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				transactionDate: new Date("2026-01-01T00:00:00.000Z"),
				status: "DRAFT",
				items: [],
			});
			mockPrisma._mockTx.assetMovement.updateMany.mockResolvedValue({
				count: 0,
			});

			await expect(
				service.submitAssetMovement({ id: "movement-1" }, "org-1"),
			).rejects.toThrow(ConflictException);
		});

		it("submits a draft movement and updates location and custodian", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.assetMovement.findUnique.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				transactionDate: new Date("2026-01-01T00:00:00.000Z"),
				status: "DRAFT",
				items: [
					{
						assetId: "asset-1",
						sourceLocationId: "loc-1",
						targetLocationId: "loc-2",
						fromEmployee: "Emp A",
						toEmployee: "Emp B",
						targetLocation: { name: "Warehouse B" },
					},
				],
			});
			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue({
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				locationId: "loc-1",
				custodian: "Emp A",
				series: "AST-2025-00001",
			});
			mockPrisma._mockTx.assetMovement.findUniqueOrThrow.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				transactionDate: new Date("2026-01-01T00:00:00.000Z"),
				purpose: "TRANSFER",
				status: "SUBMITTED",
				notes: null,
				submittedAt: new Date("2026-01-01T00:00:00.000Z"),
				cancelledAt: null,
				items: [],
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-01T00:00:00.000Z"),
			});

			const result = await service.submitAssetMovement(
				{ id: "movement-1" },
				"org-1",
			);

			expect(result.status).toBe("SUBMITTED");
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: { locationId: "loc-2", custodian: "Emp B" },
			});
		});

		it("preserves the current location when submitting an ISSUE without a target location", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.assetMovement.findUnique.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				transactionDate: new Date("2026-01-01T00:00:00.000Z"),
				purpose: "ISSUE",
				status: "DRAFT",
				items: [
					{
						assetId: "asset-1",
						sourceLocationId: "loc-1",
						targetLocationId: null,
						fromEmployee: "Emp A",
						toEmployee: "Emp B",
						targetLocation: null,
					},
				],
			});
			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue({
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				locationId: "loc-1",
				custodian: "Emp A",
				series: "AST-2025-00001",
				status: "SUBMITTED",
			});
			mockPrisma._mockTx.assetMovement.findUniqueOrThrow.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				transactionDate: new Date("2026-01-01T00:00:00.000Z"),
				purpose: "ISSUE",
				status: "SUBMITTED",
				notes: null,
				submittedAt: new Date("2026-01-01T00:00:00.000Z"),
				cancelledAt: null,
				items: [],
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-01T00:00:00.000Z"),
			});

			await service.submitAssetMovement({ id: "movement-1" }, "org-1");

			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: { custodian: "Emp B" },
			});
		});

		it("cancels a movement and reconstructs state from its snapshot", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.assetMovement.findUnique.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				status: "SUBMITTED",
				items: [
					{
						assetId: "asset-1",
						sourceLocationId: "loc-1",
						targetLocationId: "loc-2",
						fromEmployee: "Emp A",
						toEmployee: "Emp B",
					},
				],
			});
			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue({
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				series: "AST-2025-00001",
				locationId: "loc-2",
			});
			mockPrisma._mockTx.assetMovement.findFirst
				.mockImplementationOnce((args: unknown) =>
					mockPrisma.assetMovement.findUnique(args),
				)
				.mockResolvedValueOnce(null);
			mockPrisma._mockTx.assetMovement.findUniqueOrThrow.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				transactionDate: new Date("2026-01-01T00:00:00.000Z"),
				purpose: "TRANSFER",
				status: "CANCELLED",
				notes: null,
				submittedAt: new Date("2026-01-01T00:00:00.000Z"),
				cancelledAt: new Date("2026-01-02T00:00:00.000Z"),
				items: [],
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-02T00:00:00.000Z"),
			});

			await service.cancelAssetMovement({ id: "movement-1" }, "org-1");

			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: { locationId: "loc-1", custodian: "Emp A" },
			});
		});

		it("keeps the state from a later submitted movement when cancelling an earlier one", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.assetMovement.findUnique.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				status: "SUBMITTED",
				items: [
					{
						assetId: "asset-1",
						sourceLocationId: "loc-1",
						targetLocationId: "loc-2",
						fromEmployee: "Emp A",
						toEmployee: "Emp B",
					},
				],
			});
			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue({
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				series: "AST-2025-00001",
				locationId: "loc-2",
			});
			mockPrisma._mockTx.assetMovement.findFirst
				.mockImplementationOnce((args: unknown) =>
					mockPrisma.assetMovement.findUnique(args),
				)
				.mockResolvedValueOnce({
					items: [{ targetLocationId: "loc-3", toEmployee: "Emp C" }],
				});
			mockPrisma._mockTx.assetMovement.findUniqueOrThrow.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				transactionDate: new Date("2026-01-01T00:00:00.000Z"),
				purpose: "TRANSFER",
				status: "CANCELLED",
				notes: null,
				submittedAt: new Date("2026-01-01T00:00:00.000Z"),
				cancelledAt: new Date("2026-01-02T00:00:00.000Z"),
				items: [],
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-02T00:00:00.000Z"),
			});

			await service.cancelAssetMovement({ id: "movement-1" }, "org-1");

			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: { locationId: "loc-3", custodian: "Emp C" },
			});
		});

		it("does not clear location when the latest remaining movement is an ISSUE", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.assetMovement.findUnique.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				status: "SUBMITTED",
				items: [
					{
						assetId: "asset-1",
						sourceLocationId: "loc-1",
						targetLocationId: "loc-2",
						fromEmployee: "Emp A",
						toEmployee: "Emp B",
					},
				],
			});
			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue({
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				series: "AST-2025-00001",
				locationId: "loc-3",
			});
			mockPrisma._mockTx.assetMovement.findFirst
				.mockImplementationOnce((args: unknown) =>
					mockPrisma.assetMovement.findUnique(args),
				)
				.mockResolvedValueOnce({
					items: [{ targetLocationId: null, toEmployee: "Emp C" }],
				});
			mockPrisma._mockTx.assetMovement.findUniqueOrThrow.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				transactionDate: new Date("2026-01-01T00:00:00.000Z"),
				purpose: "TRANSFER",
				status: "CANCELLED",
				notes: null,
				submittedAt: new Date("2026-01-01T00:00:00.000Z"),
				cancelledAt: new Date("2026-01-02T00:00:00.000Z"),
				items: [],
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-02T00:00:00.000Z"),
			});

			await service.cancelAssetMovement({ id: "movement-1" }, "org-1");

			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: { locationId: "loc-3", custodian: "Emp C" },
			});
		});

		it("rejects a stale movement source at submission", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.assetMovement.findUnique.mockResolvedValue({
				id: "movement-1",
				series: "MOV-2026-00001",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				transactionDate: new Date("2026-01-01T00:00:00.000Z"),
				status: "DRAFT",
				items: [
					{
						assetId: "asset-1",
						sourceLocationId: "loc-1",
						targetLocationId: "loc-2",
						fromEmployee: "Emp A",
						toEmployee: "Emp B",
						targetLocation: { name: "Warehouse B" },
					},
				],
			});
			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue({
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				locationId: "loc-9",
				custodian: "Emp A",
				series: "AST-2025-00001",
			});

			await expect(
				service.submitAssetMovement({ id: "movement-1" }, "org-1"),
			).rejects.toThrow("changed after movement");
		});
	});

	describe("asset repair workflow", () => {
		it("creates a pending repair and marks the locked asset out of order", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue(
				assetRecord({ status: "PARTIALLY_DEPRECIATED" }),
			);
			mockPrisma._mockTx.assetRepair.findFirst.mockResolvedValue(null);
			mockPrisma._mockTx.assetRepair.create.mockResolvedValue(repairRecord());

			const result = await service.createAssetRepair(
				{
					assetId: "asset-1",
					companyId: COMPANY_ID,
					failureDate: "2026-02-01",
					completionDate: "2026-02-15",
					capitalizeRepairCost: true,
					increaseInAssetLife: 2,
					consumedItems: [
						{
							itemCode: "BEARING-001",
							warehouse: "Stores - ACME",
							expenseAccount: STOCK_EXPENSE_ACCOUNT,
							quantity: 2,
							valuationRate: 250,
						},
					],
					purchaseInvoices: [
						{
							purchaseInvoice: "PINV-2026-00001",
							expenseAccount: REPAIR_EXPENSE_ACCOUNT,
							amount: 1_000,
						},
					],
				},
				"org-1",
			);

			expect(result.repairStatus).toBe("PENDING");
			expect(mockPrisma._mockTx.assetRepair.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						repairStatus: "PENDING",
						repairCost: 1_500,
						previousAssetStatus: "PARTIALLY_DEPRECIATED",
					}),
				}),
			);
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: { status: "OUT_OF_ORDER" },
			});
		});

		it("rejects company, chronology, and duplicate-open-repair violations", async () => {
			const wrongCompany = createTestContext();
			wrongCompany.mockPrisma._mockTx.asset.findUnique.mockResolvedValue(
				assetRecord({
					companyId: "company-2",
					company: { id: "company-2", name: "Other Corp" },
				}),
			);
			await expect(
				wrongCompany.service.createAssetRepair(
					{
						assetId: "asset-1",
						companyId: COMPANY_ID,
						failureDate: "2026-02-01",
						capitalizeRepairCost: false,
						increaseInAssetLife: 0,
						consumedItems: [],
						purchaseInvoices: [],
					},
					"org-1",
				),
			).rejects.toThrow("does not belong");

			const badDate = createTestContext();
			badDate.mockPrisma._mockTx.asset.findUnique.mockResolvedValue(
				assetRecord({ purchaseDate: new Date("2026-02-10T00:00:00.000Z") }),
			);
			await expect(
				badDate.service.createAssetRepair(
					{
						assetId: "asset-1",
						companyId: COMPANY_ID,
						failureDate: "2026-02-01",
						capitalizeRepairCost: false,
						increaseInAssetLife: 0,
						consumedItems: [],
						purchaseInvoices: [],
					},
					"org-1",
				),
			).rejects.toThrow("before the asset purchase date");

			const duplicate = createTestContext();
			duplicate.mockPrisma._mockTx.asset.findUnique.mockResolvedValue(
				assetRecord(),
			);
			duplicate.mockPrisma._mockTx.assetRepair.findFirst.mockResolvedValue({
				series: "REP-2026-00000",
			});
			await expect(
				duplicate.service.createAssetRepair(
					{
						assetId: "asset-1",
						companyId: COMPANY_ID,
						failureDate: "2026-02-01",
						capitalizeRepairCost: false,
						increaseInAssetLife: 0,
						consumedItems: [],
						purchaseInvoices: [],
					},
					"org-1",
				),
			).rejects.toThrow(ConflictException);
		});

		it("completes a capitalized repair with stock, balanced accounting, and schedule revision", async () => {
			const {
				service,
				mockPrisma,
				accounting,
				stockPosting,
				depreciationRevision,
				depreciationBarrier,
			} = createTestContext();
			const completionDate = new Date("2026-02-15T00:00:00.000Z");
			mockPrisma.assetRepair.findUnique.mockResolvedValue({
				id: "repair-1",
				assetId: "asset-1",
				failureDate: new Date("2026-02-01T00:00:00.000Z"),
				completionDate,
				capitalizeRepairCost: true,
			});
			mockPrisma._mockTx.assetRepair.findUnique.mockResolvedValue(
				repairRecord(),
			);
			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue(
				assetRecord({ status: "OUT_OF_ORDER" }),
			);
			mockPrisma._mockTx.assetRepair.update.mockResolvedValue(
				repairRecord({
					repairStatus: "COMPLETED",
					submittedAt: completionDate,
					stockEntryId: "stock-entry-1",
					accountingEntryId: "accounting-1",
				}),
			);

			const result = await service.submitAssetRepair(
				{ id: "repair-1" },
				"org-1",
				"user-1",
			);

			expect(result.repairStatus).toBe("COMPLETED");
			expect(depreciationBarrier.ensureDepreciationPosted).toHaveBeenCalledWith(
				{
					kind: "organization",
					organizationId: "org-1",
					throughDate: "2026-02-15",
					assetIds: ["asset-1"],
				},
			);
			expect(stockPosting.createMaterialIssue).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				{
					companyId: COMPANY_ID,
					postingDate: "2026-02-15",
					sourceType: "ASSET_REPAIR",
					sourceId: "repair-1",
					lines: [
						{
							itemCode: "BEARING-001",
							warehouse: "Stores - ACME",
							quantity: 2,
							valuationRate: 250,
						},
					],
				},
			);
			expect(accounting.createPostedEntry).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				expect.objectContaining({
					sourceType: "REPAIR",
					lines: [
						{
							account: FIXED_ASSET_ACCOUNT,
							debitAmount: 1_500,
							creditAmount: 0,
							costCenter: COST_CENTER,
						},
						{
							account: STOCK_EXPENSE_ACCOUNT,
							debitAmount: 0,
							creditAmount: 500,
							costCenter: COST_CENTER,
						},
						{
							account: REPAIR_EXPENSE_ACCOUNT,
							debitAmount: 0,
							creditAmount: 1_000,
							costCenter: COST_CENTER,
						},
					],
				}),
			);
			expect(depreciationRevision.revise).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				expect.objectContaining({
					assetId: "asset-1",
					effectiveDate: completionDate,
					valueDelta: 1_500,
					usefulLifeDeltaMonths: 2,
				}),
			);
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: {
					status: "PARTIALLY_DEPRECIATED",
					netPurchaseAmount: 11_500,
					valueAfterDepreciation: 8_500,
					totalNumberOfDepreciations: 10,
					isFullyDepreciated: false,
				},
			});
		});

		it("rejects completion when chronology or pending asset state changed", async () => {
			const badDate = createTestContext();
			badDate.mockPrisma.assetRepair.findUnique.mockResolvedValue({
				id: "repair-1",
				assetId: "asset-1",
				failureDate: new Date("2026-02-15T00:00:00.000Z"),
				completionDate: new Date("2026-02-01T00:00:00.000Z"),
				capitalizeRepairCost: false,
			});
			await expect(
				badDate.service.submitAssetRepair({ id: "repair-1" }, "org-1"),
			).rejects.toThrow("before the failure date");

			const stale = createTestContext();
			stale.mockPrisma.assetRepair.findUnique.mockResolvedValue({
				id: "repair-1",
				assetId: "asset-1",
				failureDate: new Date("2026-02-01T00:00:00.000Z"),
				completionDate: new Date("2026-02-15T00:00:00.000Z"),
				capitalizeRepairCost: false,
			});
			stale.mockPrisma._mockTx.assetRepair.findUnique.mockResolvedValue(
				repairRecord({ capitalizeRepairCost: false }),
			);
			stale.mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue(
				assetRecord({ status: "SUBMITTED" }),
			);
			await expect(
				stale.service.submitAssetRepair({ id: "repair-1" }, "org-1"),
			).rejects.toThrow(ConflictException);
		});

		it("cancels a pending repair by restoring its exact prior status only", async () => {
			const {
				service,
				mockPrisma,
				accounting,
				stockPosting,
				depreciationRevision,
			} = createTestContext();
			mockPrisma.assetRepair.findUnique.mockResolvedValue({
				id: "repair-1",
				assetId: "asset-1",
			});
			mockPrisma._mockTx.assetRepair.findUnique.mockResolvedValue(
				repairRecord({
					repairStatus: "PENDING",
					previousAssetStatus: "SUBMITTED",
				}),
			);
			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue(
				assetRecord({ status: "OUT_OF_ORDER" }),
			);
			mockPrisma._mockTx.assetRepair.update.mockResolvedValue(
				repairRecord({ repairStatus: "CANCELLED" }),
			);

			await service.cancelAssetRepair({ id: "repair-1" }, "org-1");

			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: { status: "SUBMITTED" },
			});
			expect(accounting.reversePostedEntry).not.toHaveBeenCalled();
			expect(stockPosting.cancelMaterialIssue).not.toHaveBeenCalled();
			expect(depreciationRevision.revise).not.toHaveBeenCalled();
		});

		it("cancels a completed repair from its snapshot and reverses every posting", async () => {
			const {
				service,
				mockPrisma,
				accounting,
				stockPosting,
				depreciationRevision,
			} = createTestContext();
			const submittedAt = new Date("2026-02-15T00:00:00.000Z");
			mockPrisma.assetRepair.findUnique.mockResolvedValue({
				id: "repair-1",
				assetId: "asset-1",
			});
			mockPrisma._mockTx.assetRepair.findUnique.mockResolvedValue(
				repairRecord({
					repairStatus: "COMPLETED",
					submittedAt,
					stockEntryId: "stock-entry-1",
					accountingEntryId: "accounting-1",
					previousNetPurchaseAmount: 10_000,
					previousValueAfterDepreciation: 7_000,
					previousTotalDepreciations: 10,
				}),
			);
			mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue(
				assetRecord({
					netPurchaseAmount: 11_500,
					valueAfterDepreciation: 8_500,
					totalNumberOfDepreciations: 10,
				}),
			);
			mockPrisma._mockTx.assetRepair.update.mockResolvedValue(
				repairRecord({ repairStatus: "CANCELLED" }),
			);

			const result = await service.cancelAssetRepair(
				{ id: "repair-1" },
				"org-1",
				"user-1",
			);

			expect(result.repairStatus).toBe("CANCELLED");
			expect(accounting.reversePostedEntry).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				"accounting-1",
			);
			expect(stockPosting.cancelMaterialIssue).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				COMPANY_ID,
				"stock-entry-1",
				"ASSET_REPAIR",
				"repair-1",
			);
			expect(depreciationRevision.revise).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				expect.objectContaining({
					assetId: "asset-1",
					valueDelta: -1_500,
					usefulLifeDeltaMonths: -2,
				}),
			);
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "asset-1" },
				data: {
					status: "PARTIALLY_DEPRECIATED",
					netPurchaseAmount: 10_000,
					valueAfterDepreciation: 7_000,
					totalNumberOfDepreciations: 10,
					isFullyDepreciated: false,
				},
			});
		});

		it("blocks completed repair cancellation after stale values or downstream posting", async () => {
			const stale = createTestContext();
			stale.mockPrisma.assetRepair.findUnique.mockResolvedValue({
				id: "repair-1",
				assetId: "asset-1",
			});
			stale.mockPrisma._mockTx.assetRepair.findUnique.mockResolvedValue(
				repairRecord({
					repairStatus: "COMPLETED",
					submittedAt: new Date("2026-02-15T00:00:00.000Z"),
					previousNetPurchaseAmount: 10_000,
					previousValueAfterDepreciation: 7_000,
					previousTotalDepreciations: 10,
				}),
			);
			stale.mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue(
				assetRecord({
					netPurchaseAmount: 12_000,
					valueAfterDepreciation: 8_500,
					totalNumberOfDepreciations: 12,
				}),
			);
			await expect(
				stale.service.cancelAssetRepair({ id: "repair-1" }, "org-1"),
			).rejects.toThrow("changed after repair");

			const downstream = createTestContext();
			downstream.mockPrisma.assetRepair.findUnique.mockResolvedValue({
				id: "repair-1",
				assetId: "asset-1",
			});
			downstream.mockPrisma._mockTx.assetRepair.findUnique.mockResolvedValue(
				repairRecord({
					repairStatus: "COMPLETED",
					submittedAt: new Date("2026-02-15T00:00:00.000Z"),
					previousNetPurchaseAmount: 10_000,
					previousValueAfterDepreciation: 7_000,
					previousTotalDepreciations: 10,
				}),
			);
			downstream.mockPrisma._mockTx.asset.findUniqueOrThrow.mockResolvedValue(
				assetRecord({
					netPurchaseAmount: 11_500,
					valueAfterDepreciation: 8_500,
					totalNumberOfDepreciations: 10,
				}),
			);
			downstream.mockPrisma._mockTx.assetDepreciationJournalEntry.count.mockResolvedValue(
				1,
			);
			await expect(
				downstream.service.cancelAssetRepair({ id: "repair-1" }, "org-1"),
			).rejects.toThrow("blocked by later depreciation");
			expect(downstream.accounting.reversePostedEntry).not.toHaveBeenCalled();
		});
	});

	describe("asset capitalization workflow", () => {
		it("accepts an explicit secondary book without changing the root projection", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue({
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				series: "AST-2026-00010",
				assetName: "Composite Machine",
				itemCode: "COMPOSITE-MACHINE",
				status: "DRAFT",
				assetType: "COMPOSITE_ASSET",
				assetCategory: { name: "Plant and Machinery" },
			});
			mockPrisma._mockTx.assetCapitalization.create.mockResolvedValue(
				capitalizationRecord({
					financeBookId: "finance-book-2",
					totalStockValue: 0,
					totalAssetValue: 0,
					totalServiceValue: 200,
					totalValue: 200,
					stockItems: [],
					assetItems: [],
				}),
			);

			const result = await service.createAssetCapitalization(
				{
					companyId: COMPANY_ID,
					financeBookId: "finance-book-2",
					postingDate: "2026-03-01",
					targetType: "EXISTING_ASSET",
					targetAssetId: "target-asset-1",
					stockItems: [],
					assetItems: [],
					serviceItems: [
						{ expenseAccount: SERVICE_EXPENSE_ACCOUNT, amount: 200 },
					],
				},
				"org-1",
			);

			expect(result.financeBookId).toBe("finance-book-2");
		});

		it("validates source and target identities before creating a document", async () => {
			const duplicate = createTestContext();
			await expect(
				duplicate.service.createAssetCapitalization(
					{
						companyId: COMPANY_ID,
						postingDate: "2026-03-01",
						targetType: "EXISTING_ASSET",
						targetAssetId: "target-asset-1",
						stockItems: [],
						assetItems: [
							{ assetId: "source-asset-1", assetValue: 1 },
							{ assetId: "source-asset-1", assetValue: 2 },
						],
						serviceItems: [],
					},
					"org-1",
				),
			).rejects.toThrow("only once");

			const sameTarget = createTestContext();
			await expect(
				sameTarget.service.createAssetCapitalization(
					{
						companyId: COMPANY_ID,
						postingDate: "2026-03-01",
						targetType: "EXISTING_ASSET",
						targetAssetId: "source-asset-1",
						stockItems: [],
						assetItems: [{ assetId: "source-asset-1", assetValue: 1 }],
						serviceItems: [],
					},
					"org-1",
				),
			).rejects.toThrow("target asset cannot also be a consumed asset");

			await expect(
				sameTarget.service.createAssetCapitalization(
					{
						companyId: COMPANY_ID,
						postingDate: "2026-03-01",
						targetType: "NEW_ASSET",
						targetAssetId: "target-asset-1",
						stockItems: [],
						assetItems: [],
						serviceItems: [
							{ expenseAccount: SERVICE_EXPENSE_ACCOUNT, amount: 200 },
						],
					},
					"org-1",
				),
			).rejects.toThrow(
				"A new-asset capitalization cannot specify a target asset",
			);
		});

		it("uses server-derived source carrying values when creating capitalization", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue({
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				series: "AST-2026-00010",
				assetName: "Composite Machine",
				itemCode: "COMPOSITE-MACHINE",
				status: "DRAFT",
				assetType: "COMPOSITE_ASSET",
				calculateDepreciation: false,
				assetCategory: { name: "Plant and Machinery" },
			});
			mockPrisma._mockTx.asset.findMany.mockResolvedValue([
				{
					id: "source-asset-1",
					series: "AST-2025-00001",
					companyId: COMPANY_ID,
					company: { ...COMPANY_RELATION, defaultFinanceBookId: null },
					status: "PARTIALLY_DEPRECIATED",
					purchaseDate: new Date("2025-01-01T00:00:00.000Z"),
					availableForUseDate: new Date("2025-01-01T00:00:00.000Z"),
					valueAfterDepreciation: 3_000,
					financeBooks: [],
				},
			]);
			mockPrisma._mockTx.assetCapitalization.create.mockResolvedValue(
				capitalizationRecord(),
			);

			await service.createAssetCapitalization(
				{
					companyId: COMPANY_ID,
					postingDate: "2026-03-01",
					targetType: "EXISTING_ASSET",
					targetAssetId: "target-asset-1",
					stockItems: [],
					assetItems: [{ assetId: "source-asset-1", assetValue: 99_999 }],
					serviceItems: [],
				},
				"org-1",
			);

			expect(
				mockPrisma._mockTx.assetCapitalization.create,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						totalAssetValue: 3_000,
						totalValue: 3_000,
						assetItems: {
							create: [
								{
									assetId: "source-asset-1",
									financeBookId: null,
									assetValue: 3_000,
								},
							],
						},
					}),
				}),
			);
		});

		it("rejects a cross-company target and an ineligible source date", async () => {
			const crossCompany = createTestContext();
			crossCompany.mockPrisma._mockTx.asset.findUnique.mockResolvedValue({
				companyId: "company-2",
				company: { id: "company-2", name: "Other Corp" },
				series: "AST-2026-00010",
				status: "DRAFT",
				assetType: "COMPOSITE_ASSET",
				calculateDepreciation: false,
			});
			await expect(
				crossCompany.service.createAssetCapitalization(
					{
						companyId: COMPANY_ID,
						postingDate: "2026-03-01",
						targetType: "EXISTING_ASSET",
						targetAssetId: "target-asset-1",
						stockItems: [],
						assetItems: [],
						serviceItems: [
							{ expenseAccount: SERVICE_EXPENSE_ACCOUNT, amount: 200 },
						],
					},
					"org-1",
				),
			).rejects.toThrow("does not belong");

			const early = createTestContext();
			early.mockPrisma._mockTx.asset.findUnique.mockResolvedValue({
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				series: "AST-2026-00010",
				assetName: "Composite Machine",
				itemCode: "COMPOSITE-MACHINE",
				status: "DRAFT",
				assetType: "COMPOSITE_ASSET",
				calculateDepreciation: false,
				assetCategory: { name: "Plant and Machinery" },
			});
			early.mockPrisma._mockTx.asset.findMany.mockResolvedValue([
				{
					id: "source-asset-1",
					series: "AST-2025-00001",
					companyId: COMPANY_ID,
					company: { ...COMPANY_RELATION, defaultFinanceBookId: null },
					status: "SUBMITTED",
					purchaseDate: new Date("2026-04-01T00:00:00.000Z"),
					availableForUseDate: new Date("2026-04-01T00:00:00.000Z"),
					valueAfterDepreciation: 3_000,
					financeBooks: [],
				},
			]);
			await expect(
				early.service.createAssetCapitalization(
					{
						companyId: COMPANY_ID,
						postingDate: "2026-03-01",
						targetType: "EXISTING_ASSET",
						targetAssetId: "target-asset-1",
						stockItems: [],
						assetItems: [{ assetId: "source-asset-1", assetValue: 3_000 }],
						serviceItems: [],
					},
					"org-1",
				),
			).rejects.toThrow("became available");
		});

		it("posts stock and balanced accounting, capitalizes sources, and closes schedules", async () => {
			const {
				service,
				mockPrisma,
				accounting,
				stockPosting,
				depreciationRevision,
				depreciationBarrier,
			} = createTestContext();
			const postingDate = new Date("2026-03-01T00:00:00.000Z");
			mockPrisma.assetCapitalization.findUnique.mockResolvedValue({
				postingDate,
				targetAssetId: "target-asset-1",
				assetItems: [{ assetId: "source-asset-1" }],
			});
			mockPrisma._mockTx.assetCapitalization.findUnique.mockResolvedValue(
				capitalizationRecord(),
			);
			const sourceAsset = {
				id: "source-asset-1",
				series: "AST-2025-00001",
				companyId: COMPANY_ID,
				company: {
					...COMPANY_RELATION,
					defaultFinanceBookId: "finance-book-1",
				},
				assetCategoryId: "category-1",
				status: "PARTIALLY_DEPRECIATED",
				disposalDate: null,
				netPurchaseAmount: 5_000,
				valueAfterDepreciation: 3_000,
				calculateDepreciation: true,
				isFullyDepreciated: false,
				financeBooks: [
					{
						id: "source-asset-book-1",
						financeBookId: "finance-book-1",
						openingAccumulatedDepreciation: 2_000,
					},
				],
			};
			const targetAsset = {
				id: "target-asset-1",
				series: "AST-2026-00010",
				companyId: COMPANY_ID,
				itemCode: "COMPOSITE-MACHINE",
				company: { ...COMPANY_RELATION, defaultFinanceBookId: null },
				assetCategoryId: "category-1",
				status: "DRAFT",
				assetType: "COMPOSITE_ASSET",
				calculateDepreciation: false,
				isFullyDepreciated: false,
				netPurchaseAmount: 1_000,
				valueAfterDepreciation: 1_000,
			};
			// A secondary-book adjustment exists, but the default-book capitalization
			// must not include it in the selected source balance.
			mockPrisma._mockTx.assetValueAdjustment.aggregate.mockImplementation(
				async (args: { where?: { financeBookId?: string } }) => ({
					_sum: {
						differenceAmount:
							args.where?.financeBookId === "finance-book-1" ? 0 : 2_000,
					},
				}),
			);
			mockPrisma._mockTx.asset.findMany.mockResolvedValue([sourceAsset]);
			mockPrisma._mockTx.assetDepreciationSchedule.findMany.mockResolvedValue([
				{ id: "closed-schedule-1" },
			]);
			mockPrisma._mockTx.asset.findUnique.mockImplementation(
				async (args: { where?: { id?: string } }) =>
					args.where?.id === sourceAsset.id ? sourceAsset : targetAsset,
			);
			mockPrisma._mockTx.assetCapitalization.update.mockResolvedValue(
				capitalizationRecord({
					status: "SUBMITTED",
					submittedAt: postingDate,
					stockEntryId: "stock-entry-1",
					accountingEntryId: "accounting-1",
					targetPreviousNetPurchaseAmount: 1_000,
					targetPreviousValueAfterDepreciation: 1_000,
					targetPreviousStatus: "DRAFT",
				}),
			);

			const result = await service.submitAssetCapitalization(
				{ id: "capitalization-1" },
				"org-1",
				"user-1",
			);

			expect(result.status).toBe("SUBMITTED");
			expect(depreciationBarrier.ensureDepreciationPosted).toHaveBeenCalledWith(
				{
					kind: "organization",
					organizationId: "org-1",
					throughDate: postingDate,
					assetIds: ["source-asset-1"],
					sourceCapitalizationId: "capitalization-1",
				},
			);
			expect(stockPosting.createMaterialIssue).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				expect.objectContaining({
					sourceType: "ASSET_CAPITALIZATION",
					sourceId: "capitalization-1",
				}),
			);
			expect(
				mockPrisma._mockTx.assetCapitalizationAssetItem.updateMany,
			).toHaveBeenCalledWith({
				where: expect.objectContaining({ id: "cap-asset-1" }),
				data: {
					assetValue: 3_000,
					financeBookId: "finance-book-1",
					previousStatus: "PARTIALLY_DEPRECIATED",
					previousIsFullyDepreciated: false,
					previousDisposalDate: null,
				},
			});
			expect(accounting.createPostedEntry).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				expect.objectContaining({
					sourceType: "CAPITALIZATION",
					assetId: "target-asset-1",
					lines: [
						{
							account: FIXED_ASSET_ACCOUNT,
							debitAmount: 3_700,
							creditAmount: 0,
							costCenter: COST_CENTER,
						},
						{
							account: STOCK_EXPENSE_ACCOUNT,
							debitAmount: 0,
							creditAmount: 500,
							costCenter: COST_CENTER,
						},
						{
							account: SERVICE_EXPENSE_ACCOUNT,
							debitAmount: 0,
							creditAmount: 200,
							costCenter: COST_CENTER,
						},
						{
							account: FIXED_ASSET_ACCOUNT,
							debitAmount: 0,
							creditAmount: 5_000,
							costCenter: COST_CENTER,
						},
						{
							account: ACCUMULATED_DEPRECIATION_ACCOUNT,
							debitAmount: 2_000,
							creditAmount: 0,
							costCenter: COST_CENTER,
						},
					],
				}),
			);
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "target-asset-1" },
				data: {
					netPurchaseAmount: 4_700,
					valueAfterDepreciation: 4_700,
					isFullyDepreciated: false,
				},
			});
			expect(depreciationRevision.closeOpenSchedules).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				"source-asset-1",
				"finance-book-1",
				"capitalization-1",
			);
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "source-asset-1" },
				data: { status: "CAPITALIZED", disposalDate: postingDate },
			});
		});

		it("creates a server-owned draft target for new-asset capitalization", async () => {
			const { service, mockPrisma, accounting } = createTestContext();
			const postingDate = new Date("2026-03-01T00:00:00.000Z");
			mockPrisma.assetCapitalization.findUnique.mockResolvedValue({
				postingDate,
				targetAssetId: null,
				assetItems: [],
			});
			mockPrisma._mockTx.assetCapitalization.findUnique.mockResolvedValue(
				capitalizationRecord({
					targetType: "NEW_ASSET",
					targetAssetId: null,
					stockItems: [],
					assetItems: [],
					serviceItems: [capitalizationServiceItem()],
					totalStockValue: 0,
					totalAssetValue: 0,
					totalServiceValue: 200,
					totalValue: 200,
				}),
			);
			mockPrisma._mockTx.asset.create.mockResolvedValue({
				id: "new-target-1",
				series: "AST-2026-00020",
				companyId: COMPANY_ID,
				company: COMPANY_RELATION,
				assetCategoryId: "category-1",
				status: "DRAFT",
				calculateDepreciation: false,
				netPurchaseAmount: 0,
				valueAfterDepreciation: 0,
			});
			mockPrisma._mockTx.assetCapitalization.update.mockResolvedValue(
				capitalizationRecord({
					targetType: "NEW_ASSET",
					targetAssetId: "new-target-1",
					status: "SUBMITTED",
					createdTargetAsset: true,
					stockItems: [],
					assetItems: [],
					serviceItems: [capitalizationServiceItem()],
					totalStockValue: 0,
					totalAssetValue: 0,
					totalServiceValue: 200,
					totalValue: 200,
				}),
			);

			await service.submitAssetCapitalization(
				{ id: "capitalization-1" },
				"org-1",
			);

			expect(mockPrisma._mockTx.asset.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						itemCode: "COMPOSITE-MACHINE",
						companyId: COMPANY_ID,
						netPurchaseAmount: 0,
						calculateDepreciation: false,
						status: "DRAFT",
					}),
				}),
			);
			expect(accounting.createPostedEntry).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				expect.objectContaining({ assetId: "new-target-1" }),
			);
			expect(
				mockPrisma._mockTx.assetCapitalization.update,
			).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						targetAssetId: "new-target-1",
						createdTargetAsset: true,
					}),
				}),
			);
		});

		it("guards reversal, reverses postings, restores target, and reactivates sources", async () => {
			const {
				service,
				mockPrisma,
				accounting,
				stockPosting,
				depreciationRevision,
			} = createTestContext();
			const postingDate = new Date("2026-03-01T00:00:00.000Z");
			const submittedAt = new Date("2026-03-01T01:00:00.000Z");
			mockPrisma.assetCapitalization.findUnique.mockResolvedValue({
				targetAssetId: "target-asset-1",
				assetItems: [{ assetId: "source-asset-1" }],
			});
			mockPrisma._mockTx.assetCapitalization.findUnique.mockResolvedValue(
				capitalizationRecord({
					status: "SUBMITTED",
					financeBookId: "finance-book-1",
					postingDate,
					submittedAt,
					stockEntryId: "stock-entry-1",
					accountingEntryId: "accounting-1",
					targetPreviousNetPurchaseAmount: 1_000,
					targetPreviousValueAfterDepreciation: 1_000,
					targetPreviousStatus: "DRAFT",
					assetItems: [
						capitalizationAssetItem({
							financeBookId: "finance-book-1",
							assetValue: 3_000,
							previousStatus: "PARTIALLY_DEPRECIATED",
							previousIsFullyDepreciated: false,
							closedScheduleId: "closed-schedule-1",
							previousDisposalDate: null,
						}),
					],
				}),
			);
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue({
				id: "target-asset-1",
				series: "AST-2026-00010",
				companyId: COMPANY_ID,
				itemCode: "COMPOSITE-MACHINE",
				assetType: "COMPOSITE_ASSET",
				isFullyDepreciated: false,
				status: "DRAFT",
				netPurchaseAmount: 4_700,
				valueAfterDepreciation: 4_700,
				financeBooks: [],
			});
			mockPrisma._mockTx.asset.findMany.mockResolvedValue([
				{
					id: "source-asset-1",
					series: "AST-2025-00001",
					calculateDepreciation: true,
					company: {
						...COMPANY_RELATION,
						defaultFinanceBookId: "finance-book-1",
					},
					companyId: COMPANY_ID,
					isFullyDepreciated: false,
					financeBooks: [
						{ id: "source-asset-book-1", financeBookId: "finance-book-1" },
					],
					status: "CAPITALIZED",
					disposalDate: postingDate,
				},
			]);
			mockPrisma._mockTx.assetDepreciationSchedule.findFirst.mockResolvedValue({
				id: "closed-schedule-1",
				assetId: "source-asset-1",
				assetFinanceBookId: "source-asset-book-1",
				status: "CANCELLED",
				closedByCapitalizationId: "capitalization-1",
				assetFinanceBook: { assetId: "source-asset-1" },
			});
			mockPrisma._mockTx.assetDepreciationSchedule.findMany.mockResolvedValue([
				{
					id: "closed-schedule-1",
					assetFinanceBookId: "source-asset-book-1",
					status: "CANCELLED",
				},
			]);
			mockPrisma._mockTx.assetCapitalization.update.mockResolvedValue(
				capitalizationRecord({ status: "CANCELLED" }),
			);

			const result = await service.cancelAssetCapitalization(
				{ id: "capitalization-1" },
				"org-1",
				"user-1",
			);

			expect(result.status).toBe("CANCELLED");
			expect(accounting.reversePostedEntry).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				"accounting-1",
			);
			expect(stockPosting.cancelMaterialIssue).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				COMPANY_ID,
				"stock-entry-1",
				"ASSET_CAPITALIZATION",
				"capitalization-1",
			);
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "target-asset-1" },
				data: {
					status: "DRAFT",
					netPurchaseAmount: 1_000,
					valueAfterDepreciation: 1_000,
					isFullyDepreciated: false,
				},
			});
			expect(
				depreciationRevision.reactivateSchedulesClosedByCapitalization,
			).toHaveBeenCalledWith(
				mockPrisma._mockTx,
				"org-1",
				"capitalization-1",
				"source-asset-1",
				"closed-schedule-1",
				"finance-book-1",
			);
			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "source-asset-1" },
				data: {
					status: "PARTIALLY_DEPRECIATED",
					disposalDate: null,
				},
			});
		});

		it("blocks capitalization reversal after downstream posting", async () => {
			const { service, mockPrisma, accounting, depreciationRevision } =
				createTestContext();
			const postingDate = new Date("2026-03-01T00:00:00.000Z");
			mockPrisma.assetCapitalization.findUnique.mockResolvedValue({
				targetAssetId: "target-asset-1",
				assetItems: [{ assetId: "source-asset-1" }],
			});
			mockPrisma._mockTx.assetCapitalization.findUnique.mockResolvedValue(
				capitalizationRecord({
					status: "SUBMITTED",
					financeBookId: "finance-book-1",
					postingDate,
					submittedAt: new Date("2026-03-01T01:00:00.000Z"),
					stockEntryId: "stock-entry-1",
					accountingEntryId: "accounting-1",
					targetPreviousNetPurchaseAmount: 1_000,
					targetPreviousValueAfterDepreciation: 1_000,
					targetPreviousStatus: "DRAFT",
					assetItems: [
						capitalizationAssetItem({
							financeBookId: "finance-book-1",
							previousStatus: "PARTIALLY_DEPRECIATED",
							closedScheduleId: "closed-schedule-1",
							previousDisposalDate: null,
						}),
					],
				}),
			);
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue({
				id: "target-asset-1",
				series: "AST-2026-00010",
				companyId: COMPANY_ID,
				itemCode: "COMPOSITE-MACHINE",
				assetType: "COMPOSITE_ASSET",
				isFullyDepreciated: false,
				status: "DRAFT",
				netPurchaseAmount: 4_700,
				valueAfterDepreciation: 4_700,
				financeBooks: [],
			});
			mockPrisma._mockTx.asset.findMany.mockResolvedValue([
				{
					id: "source-asset-1",
					series: "AST-2025-00001",
					calculateDepreciation: true,
					companyId: COMPANY_ID,
					isFullyDepreciated: false,
					company: {
						...COMPANY_RELATION,
						defaultFinanceBookId: "finance-book-1",
					},
					financeBooks: [
						{ id: "source-asset-book-1", financeBookId: "finance-book-1" },
					],
					status: "CAPITALIZED",
					disposalDate: postingDate,
				},
			]);
			mockPrisma._mockTx.assetDepreciationSchedule.findFirst.mockResolvedValue({
				id: "closed-schedule-1",
				assetId: "source-asset-1",
				assetFinanceBookId: "source-asset-book-1",
				status: "CANCELLED",
				closedByCapitalizationId: "capitalization-1",
				assetFinanceBook: { assetId: "source-asset-1" },
			});
			mockPrisma._mockTx.assetDepreciationSchedule.findMany.mockResolvedValue([
				{
					id: "closed-schedule-1",
					assetFinanceBookId: "source-asset-book-1",
					status: "CANCELLED",
				},
			]);
			mockPrisma._mockTx.assetAccountingEntry.findMany.mockResolvedValue([
				{
					id: "later-accounting-1",
					postingDate: new Date("2026-03-01T00:00:00.000Z"),
					createdAt: new Date("2026-03-01T02:00:00.000Z"),
				},
			]);

			await expect(
				service.cancelAssetCapitalization({ id: "capitalization-1" }, "org-1"),
			).rejects.toThrow("later accounting entry");
			expect(accounting.reversePostedEntry).not.toHaveBeenCalled();
			expect(
				depreciationRevision.reactivateSchedulesClosedByCapitalization,
			).not.toHaveBeenCalled();
		});

		it("cancels a newly created target instead of exposing an empty draft", async () => {
			const { service, mockPrisma } = createTestContext();
			mockPrisma.assetCapitalization.findUnique.mockResolvedValue({
				targetAssetId: "new-target-1",
				assetItems: [],
			});
			mockPrisma._mockTx.assetCapitalization.findUnique.mockResolvedValue(
				capitalizationRecord({
					targetType: "NEW_ASSET",
					targetAssetId: "new-target-1",
					status: "SUBMITTED",
					createdTargetAsset: true,
					submittedAt: new Date("2026-03-01T01:00:00.000Z"),
					accountingEntryId: "accounting-1",
					targetPreviousNetPurchaseAmount: 0,
					targetPreviousValueAfterDepreciation: 0,
					targetPreviousStatus: "DRAFT",
					stockItems: [],
					assetItems: [],
					serviceItems: [capitalizationServiceItem()],
					totalStockValue: 0,
					totalAssetValue: 0,
					totalServiceValue: 200,
					totalValue: 200,
				}),
			);
			mockPrisma._mockTx.asset.findUnique.mockResolvedValue({
				id: "new-target-1",
				series: "AST-2026-00020",
				companyId: COMPANY_ID,
				itemCode: "COMPOSITE-MACHINE",
				assetType: "COMPOSITE_ASSET",
				isFullyDepreciated: false,
				status: "DRAFT",
				netPurchaseAmount: 200,
				valueAfterDepreciation: 200,
			});
			mockPrisma._mockTx.asset.findMany.mockResolvedValue([]);
			mockPrisma._mockTx.assetCapitalization.update.mockResolvedValue(
				capitalizationRecord({ status: "CANCELLED" }),
			);

			await service.cancelAssetCapitalization(
				{ id: "capitalization-1" },
				"org-1",
			);

			expect(mockPrisma._mockTx.asset.update).toHaveBeenCalledWith({
				where: { id: "new-target-1" },
				data: {
					status: "CANCELLED",
					netPurchaseAmount: 0,
					valueAfterDepreciation: 0,
					isFullyDepreciated: false,
				},
			});
		});
	});
});
