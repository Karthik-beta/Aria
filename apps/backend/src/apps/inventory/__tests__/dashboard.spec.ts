import type { PrismaService } from "../../../shared/prisma.service";
import { DashboardSubService } from "../services/dashboard.service";

// ── Mock Factories ────────────────────────────────────────────────────

/**
 * Creates a minimal mock of PrismaService for DashboardSubService tests.
 *
 * Key design decisions:
 * - stockEntry.findMany defaults to [] via mockResolvedValue to handle both
 *   the getStockMovements call and the getRecentActivity call safely.
 * - stockEntryItem includes findMany for committed stock snapshot reads and
 *   aggregate/groupBy for chart summaries.
 */
function createDashboardMockPrisma() {
	return {
		client: {
			$queryRaw: jest.fn().mockResolvedValue([]),
		},
		inventoryItem: {
			count: jest.fn().mockResolvedValue(0),
			aggregate: jest
				.fn()
				.mockResolvedValue({ _sum: { quantity: 0 }, _count: 0 }),
			findMany: jest.fn().mockResolvedValue([]),
			update: jest.fn().mockResolvedValue(undefined),
		},
		warehouse: {
			count: jest.fn().mockResolvedValue(0),
			findMany: jest.fn().mockResolvedValue([]),
		},
		materialRequest: {
			count: jest.fn().mockResolvedValue(0),
		},
		stockEntry: {
			findMany: jest.fn().mockResolvedValue([]),
			groupBy: jest.fn().mockResolvedValue([]),
		},
		stockEntryItem: {
			findMany: jest.fn().mockResolvedValue([]),
			groupBy: jest.fn().mockResolvedValue([]),
			aggregate: jest.fn().mockResolvedValue({ _sum: { qty: 0 } }),
		},
		deliveryNote: {
			findMany: jest.fn().mockResolvedValue([]),
			groupBy: jest.fn().mockResolvedValue([]),
		},
		deliveryNoteItem: {
			findMany: jest.fn().mockResolvedValue([]),
		},
		purchaseReceipt: {
			findMany: jest.fn().mockResolvedValue([]),
		},
		purchaseReceiptItem: {
			findMany: jest.fn().mockResolvedValue([]),
		},
		batch: {
			groupBy: jest.fn().mockResolvedValue([]),
			findMany: jest.fn().mockResolvedValue([]),
		},
	};
}

type DashboardMockPrisma = ReturnType<typeof createDashboardMockPrisma>;

function createService(mockPrisma: DashboardMockPrisma) {
	return new DashboardSubService(mockPrisma as unknown as PrismaService);
}

// ── KPI Tests ─────────────────────────────────────────────────────────

describe("DashboardSubService › getKpis", () => {
	let mp: DashboardMockPrisma;
	let service: DashboardSubService;

	beforeEach(() => {
		jest.clearAllMocks();
		mp = createDashboardMockPrisma();
		service = createService(mp);
	});

	it("returns correct KPI values from committed stock snapshot data", async () => {
		mp.inventoryItem.count.mockResolvedValue(100);
		mp.warehouse.count.mockResolvedValue(5);
		mp.materialRequest.count.mockResolvedValue(12);
		mp.inventoryItem.findMany.mockResolvedValue([
			{
				code: "ITEM-A",
				name: "Alpha",
				safetyStock: 10,
				valuationRate: 200,
				itemGroup: { groupName: "Electronics" },
			},
			{
				code: "ITEM-B",
				name: "Beta",
				safetyStock: 50,
				valuationRate: 500,
				itemGroup: { groupName: "Hardware" },
			},
			{
				code: "ITEM-C",
				name: "Gamma",
				safetyStock: 0,
				valuationRate: 100,
				itemGroup: { groupName: "Hardware" },
			},
		]);
		mp.purchaseReceiptItem.findMany.mockResolvedValue([
			{ itemCode: "ITEM-A", acceptedQuantity: 30 },
			{ itemCode: "ITEM-B", acceptedQuantity: 20 },
			{ itemCode: "ITEM-C", acceptedQuantity: 25 },
		]);
		mp.deliveryNoteItem.findMany.mockResolvedValue([
			{ itemCode: "ITEM-C", quantity: 5 },
		]);

		const result = await service.getDashboardData();

		expect(result.kpis).toEqual({
			totalItems: 100,
			activeWarehouses: 5,
			pendingMaterialRequests: 12,
			lowStockItemCount: 1,
			totalStockValue: 18_000,
			totalStockQuantity: 70,
		});
	});

	it("derives low stock counts from the committed movement snapshot", async () => {
		mp.inventoryItem.findMany.mockResolvedValue([
			{
				code: "LOW-001",
				name: "Critical Part",
				safetyStock: 20,
				valuationRate: 125,
				itemGroup: { groupName: "Electronics" },
			},
		]);
		mp.purchaseReceiptItem.findMany.mockResolvedValue([
			{ itemCode: "LOW-001", acceptedQuantity: 10 },
		]);
		mp.deliveryNoteItem.findMany.mockResolvedValue([
			{ itemCode: "LOW-001", quantity: 3 },
		]);

		const result = await service.getDashboardData();

		expect(result.kpis.lowStockItemCount).toBe(1);
		expect(result.lowStockItems[0]).toMatchObject({
			itemCode: "LOW-001",
			currentQty: 7,
			safetyStock: 20,
			deficit: 13,
		});
	});

	it("returns zero stock totals when no committed movements exist", async () => {
		mp.inventoryItem.findMany.mockResolvedValue([
			{
				code: "ITEM-EMPTY",
				name: "No Movement Item",
				safetyStock: 0,
				valuationRate: 999,
				itemGroup: { groupName: "Raw" },
			},
		]);

		const result = await service.getDashboardData();

		expect(result.kpis.totalStockValue).toBe(0);
		expect(result.kpis.totalStockQuantity).toBe(0);
	});
});

// ── Stock Movements Tests ─────────────────────────────────────────────

describe("DashboardSubService › getStockMovements", () => {
	let mp: DashboardMockPrisma;
	let service: DashboardSubService;

	beforeEach(() => {
		jest.clearAllMocks();
		mp = createDashboardMockPrisma();
		service = createService(mp);
	});

	it("aggregates inbound from MATERIAL_RECEIPT and outbound from delivery notes", async () => {
		const date = "2025-01-10";

		mp.stockEntry.findMany
			.mockResolvedValueOnce([
				// getStockMovements call
				{
					postingDate: new Date(`${date}T12:00:00Z`),
					stockEntryType: "MATERIAL_RECEIPT",
					items: [{ qty: 50 }, { qty: 30 }],
				},
			])
			.mockResolvedValue([]); // getRecentActivity call

		mp.deliveryNote.findMany.mockResolvedValue([
			{
				postingDate: new Date(`${date}T14:00:00Z`),
				totalQuantity: 20,
			},
		]);

		mp.purchaseReceipt.findMany.mockResolvedValue([
			{
				postingDate: new Date(`${date}T10:00:00Z`),
				totalQuantity: 15,
			},
		]);

		const result = await service.getDashboardData();
		const day = result.stockMovements.find((m) => m.date === date);

		expect(day).toBeDefined();
		// MATERIAL_RECEIPT(80) + purchaseReceipt(15) = 95 inbound
		expect(day?.inbound).toBe(95);
		// deliveryNote = 20 outbound
		expect(day?.outbound).toBe(20);
	});

	it("sorts results ascending by date", async () => {
		mp.stockEntry.findMany
			.mockResolvedValueOnce([
				{
					postingDate: new Date("2025-01-15T00:00:00Z"),
					stockEntryType: "MATERIAL_RECEIPT",
					items: [{ qty: 10 }],
				},
				{
					postingDate: new Date("2025-01-13T00:00:00Z"),
					stockEntryType: "MATERIAL_RECEIPT",
					items: [{ qty: 5 }],
				},
			])
			.mockResolvedValue([]);

		const result = await service.getDashboardData();

		expect(result.stockMovements[0]?.date).toBe("2025-01-13");
		expect(result.stockMovements[1]?.date).toBe("2025-01-15");
	});

	it("returns empty array when no stock moves in the period", async () => {
		// Default mocks return [] for all findMany calls
		const result = await service.getDashboardData();

		expect(result.stockMovements).toEqual([]);
	});
});

// ── Warehouse Stock Tests ─────────────────────────────────────────────

describe("DashboardSubService › getWarehouseStock", () => {
	let mp: DashboardMockPrisma;
	let service: DashboardSubService;

	beforeEach(() => {
		jest.clearAllMocks();
		mp = createDashboardMockPrisma();
		service = createService(mp);
	});

	it("maps batch groupBy results to warehouse stock entries sorted by totalQty desc", async () => {
		const wh1 = "wh-001";
		const wh2 = "wh-002";

		mp.batch.groupBy.mockResolvedValue([
			{ currentWarehouseId: wh1, _sum: { quantity: 250 }, _count: 5 },
			{ currentWarehouseId: wh2, _sum: { quantity: 100 }, _count: 2 },
		]);
		mp.warehouse.findMany.mockResolvedValue([
			{ id: wh1, name: "Main Store" },
			{ id: wh2, name: "Secondary Store" },
		]);

		const result = await service.getDashboardData();

		expect(result.warehouseStock).toHaveLength(2);
		expect(result.warehouseStock[0]).toMatchObject({
			warehouse: "Main Store",
			totalQty: 250,
			itemCount: 5,
		});
	});

	it("falls back to warehouse name list when no batch data exists", async () => {
		mp.batch.groupBy.mockResolvedValue([]);
		mp.warehouse.findMany.mockResolvedValue([
			{ name: "Fallback Warehouse" },
			{ name: "Overflow Store" },
		]);

		const result = await service.getDashboardData();

		expect(result.warehouseStock).toHaveLength(2);
		expect(result.warehouseStock[0]).toMatchObject({
			warehouse: "Fallback Warehouse",
			totalQty: 0,
			itemCount: 0,
		});
	});

	it("uses 'Unknown' for unresolvable warehouse IDs", async () => {
		mp.batch.groupBy.mockResolvedValue([
			{ currentWarehouseId: "missing-id", _sum: { quantity: 10 }, _count: 1 },
		]);
		mp.warehouse.findMany.mockResolvedValue([]); // no names found

		const result = await service.getDashboardData();

		expect(result.warehouseStock[0]?.warehouse).toBe("Unknown");
	});
});

// ── Item Group Distribution Tests ─────────────────────────────────────

describe("DashboardSubService › getItemGroupDistribution", () => {
	let mp: DashboardMockPrisma;
	let service: DashboardSubService;

	beforeEach(() => {
		jest.clearAllMocks();
		mp = createDashboardMockPrisma();
		service = createService(mp);
	});

	it("computes stock value per item group sorted by value descending", async () => {
		mp.inventoryItem.findMany.mockResolvedValue([
			{
				code: "ELEC-001",
				name: "Electronics A",
				safetyStock: 0,
				valuationRate: 1000,
				itemGroup: { groupName: "Electronics" },
			},
			{
				code: "FURN-001",
				name: "Furniture A",
				safetyStock: 0,
				valuationRate: 500,
				itemGroup: { groupName: "Furniture" },
			},
			{
				code: "ELEC-002",
				name: "Electronics B",
				safetyStock: 0,
				valuationRate: 2000,
				itemGroup: { groupName: "Electronics" },
			},
		]);
		mp.purchaseReceiptItem.findMany.mockResolvedValue([
			{ itemCode: "ELEC-001", acceptedQuantity: 10 },
			{ itemCode: "FURN-001", acceptedQuantity: 5 },
			{ itemCode: "ELEC-002", acceptedQuantity: 2 },
		]);

		const result = await service.getDashboardData();

		// Electronics: (10×1000) + (2×2000) = 14_000 → first
		expect(result.itemGroupDistribution[0]).toMatchObject({
			group: "Electronics",
			value: 14_000,
			itemCount: 2,
		});
		// Furniture: 5×500 = 2_500 → second
		expect(result.itemGroupDistribution[1]).toMatchObject({
			group: "Furniture",
			value: 2_500,
			itemCount: 1,
		});
	});

	it("labels items with null itemGroup as 'Uncategorised'", async () => {
		mp.inventoryItem.findMany.mockResolvedValue([
			{
				code: "UNCAT-001",
				name: "Loose Part",
				safetyStock: 0,
				valuationRate: 100,
				itemGroup: null,
			},
		]);
		mp.purchaseReceiptItem.findMany.mockResolvedValue([
			{ itemCode: "UNCAT-001", acceptedQuantity: 3 },
		]);

		const result = await service.getDashboardData();

		expect(result.itemGroupDistribution[0]?.group).toBe("Uncategorised");
	});

	it("treats null valuationRate as 0", async () => {
		mp.inventoryItem.findMany.mockResolvedValue([
			{
				code: "MISC-001",
				name: "Misc Part",
				safetyStock: 0,
				valuationRate: null,
				itemGroup: { groupName: "Misc" },
			},
		]);
		mp.purchaseReceiptItem.findMany.mockResolvedValue([
			{ itemCode: "MISC-001", acceptedQuantity: 10 },
		]);

		const result = await service.getDashboardData();

		expect(result.itemGroupDistribution[0]?.value).toBe(0);
	});

	it("keeps zero-value categories so the frontend can render an empty chart shell", async () => {
		mp.inventoryItem.findMany.mockResolvedValue([
			{
				code: "ZERO-001",
				name: "Zero Stock",
				safetyStock: 0,
				valuationRate: 100,
				itemGroup: { groupName: "Dormant Category" },
			},
		]);

		const result = await service.getDashboardData();

		expect(result.itemGroupDistribution).toContainEqual({
			group: "Dormant Category",
			value: 0,
			itemCount: 1,
		});
	});
});

// ── Recent Activity Tests ─────────────────────────────────────────────

describe("DashboardSubService › getRecentActivity", () => {
	let mp: DashboardMockPrisma;
	let service: DashboardSubService;

	beforeEach(() => {
		jest.clearAllMocks();
		mp = createDashboardMockPrisma();
		service = createService(mp);
	});

	it("maps stock entries to activity records with ISO posting date", async () => {
		const postingDate = new Date("2025-01-10T08:00:00.000Z");

		// getStockMovements (1st call) returns []
		// getRecentActivity (2nd call) returns the entry
		mp.stockEntry.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
			{
				id: "entry-1",
				series: "MAT-STE-001",
				stockEntryType: "MATERIAL_RECEIPT",
				postingDate,
				items: [
					{
						itemCode: "ITEM-001",
						itemName: "Widget A",
						qty: 50,
						targetWarehouse: "Main Store",
						sourceWarehouse: null,
					},
				],
			},
		]);

		const result = await service.getDashboardData();

		expect(result.recentActivity).toHaveLength(1);
		expect(result.recentActivity[0]).toMatchObject({
			id: "entry-1",
			series: "MAT-STE-001",
			type: "MATERIAL_RECEIPT",
			itemCode: "ITEM-001",
			itemName: "Widget A",
			qty: 50,
			warehouse: "Main Store",
			postingDate: postingDate.toISOString(),
		});
	});

	it("uses fallback values when an entry has no items", async () => {
		mp.stockEntry.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
			{
				id: "entry-2",
				series: "MAT-STE-002",
				stockEntryType: "MATERIAL_ISSUE",
				postingDate: new Date("2025-01-11T10:00:00Z"),
				items: [],
			},
		]);

		const result = await service.getDashboardData();

		expect(result.recentActivity[0]).toMatchObject({
			itemCode: "—",
			itemName: null,
			qty: 0,
			warehouse: null,
		});
	});

	it("prefers targetWarehouse over sourceWarehouse", async () => {
		mp.stockEntry.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
			{
				id: "e3",
				series: "STE-003",
				stockEntryType: "MATERIAL_TRANSFER",
				postingDate: new Date(),
				items: [
					{
						itemCode: "X",
						itemName: null,
						qty: 1,
						targetWarehouse: "Target WH",
						sourceWarehouse: "Source WH",
					},
				],
			},
		]);

		const result = await service.getDashboardData();

		expect(result.recentActivity[0]?.warehouse).toBe("Target WH");
	});
});

// ── Batch Expiry Tests ────────────────────────────────────────────────

describe("DashboardSubService › getBatchExpiry", () => {
	let mp: DashboardMockPrisma;
	let service: DashboardSubService;

	beforeEach(() => {
		jest.clearAllMocks();
		mp = createDashboardMockPrisma();
		service = createService(mp);
	});

	it("returns batches with ISO expiryDate and correct daysUntilExpiry", async () => {
		const expiryDate = new Date();
		expiryDate.setDate(expiryDate.getDate() + 30);

		mp.batch.findMany.mockResolvedValue([
			{
				batchId: "BATCH-001",
				quantity: 100,
				expiryDate,
				item: { code: "ITEM-001", name: "Perishable Widget" },
				currentWarehouse: { name: "Cold Store" },
			},
		]);

		const result = await service.getDashboardData();

		expect(result.batchExpiry).toHaveLength(1);
		const batch = result.batchExpiry[0];
		expect(batch?.batchId).toBe("BATCH-001");
		expect(batch?.expiryDate).toBe(expiryDate.toISOString());
		// Allow ±1 day for rounding/sub-second execution time
		expect(batch?.daysUntilExpiry).toBeGreaterThanOrEqual(29);
		expect(batch?.daysUntilExpiry).toBeLessThanOrEqual(31);
	});

	it("filters out batches with null expiryDate", async () => {
		mp.batch.findMany.mockResolvedValue([
			{
				batchId: "BATCH-NULL",
				quantity: 50,
				expiryDate: null,
				item: { code: "ITEM-002", name: "No Expiry" },
				currentWarehouse: null,
			},
		]);

		const result = await service.getDashboardData();

		expect(result.batchExpiry).toHaveLength(0);
	});

	it("uses null warehouse when currentWarehouse is absent", async () => {
		const expiryDate = new Date();
		expiryDate.setDate(expiryDate.getDate() + 10);

		mp.batch.findMany.mockResolvedValue([
			{
				batchId: "BATCH-002",
				quantity: 20,
				expiryDate,
				item: { code: "Y", name: "No Location" },
				currentWarehouse: null,
			},
		]);

		const result = await service.getDashboardData();

		expect(result.batchExpiry[0]?.warehouse).toBeNull();
	});
});

// ── Delivery Status Tests ─────────────────────────────────────────────

describe("DashboardSubService › getDeliveryStatus", () => {
	let mp: DashboardMockPrisma;
	let service: DashboardSubService;

	beforeEach(() => {
		jest.clearAllMocks();
		mp = createDashboardMockPrisma();
		service = createService(mp);
	});

	it("maps deliveryNote groupBy results to status array", async () => {
		mp.deliveryNote.groupBy.mockResolvedValue([
			{ status: "DRAFT", _count: 5, _sum: { totalAmount: 10_000 } },
			{ status: "SUBMITTED", _count: 3, _sum: { totalAmount: 50_000 } },
		]);

		const result = await service.getDashboardData();

		expect(result.deliveryStatus).toHaveLength(2);
		expect(result.deliveryStatus).toContainEqual({
			status: "SUBMITTED",
			count: 3,
			totalAmount: 50_000,
		});
	});

	it("rounds totalAmount to integer", async () => {
		mp.deliveryNote.groupBy.mockResolvedValue([
			{ status: "SUBMITTED", _count: 1, _sum: { totalAmount: 99.75 } },
		]);

		const result = await service.getDashboardData();

		expect(result.deliveryStatus[0]?.totalAmount).toBe(100);
	});

	it("handles null totalAmount as 0", async () => {
		mp.deliveryNote.groupBy.mockResolvedValue([
			{ status: "CANCELLED", _count: 2, _sum: { totalAmount: null } },
		]);

		const result = await service.getDashboardData();

		expect(result.deliveryStatus[0]?.totalAmount).toBe(0);
	});

	it("returns empty array when no delivery notes exist", async () => {
		// Default mock returns [] for groupBy
		const result = await service.getDashboardData();

		expect(result.deliveryStatus).toEqual([]);
	});
});

// ── Top Moving Items Tests ────────────────────────────────────────────

describe("DashboardSubService › getTopMovingItems", () => {
	let mp: DashboardMockPrisma;
	let service: DashboardSubService;

	beforeEach(() => {
		jest.clearAllMocks();
		mp = createDashboardMockPrisma();
		service = createService(mp);
	});

	it("maps stockEntryItem groupBy results to top moving items", async () => {
		mp.stockEntryItem.groupBy.mockResolvedValue([
			{
				itemCode: "ITEM-TOP",
				itemName: "Best Seller",
				_sum: { qty: 1000 },
				_count: 25,
			},
		]);

		const result = await service.getDashboardData();

		expect(result.topMovingItems).toHaveLength(1);
		expect(result.topMovingItems[0]).toMatchObject({
			itemCode: "ITEM-TOP",
			itemName: "Best Seller",
			totalQty: 1000,
			transactionCount: 25,
		});
	});

	it("rounds fractional totalQty to integer", async () => {
		mp.stockEntryItem.groupBy.mockResolvedValue([
			{ itemCode: "X", itemName: "Frac", _sum: { qty: 7.8 }, _count: 1 },
		]);

		const result = await service.getDashboardData();

		expect(result.topMovingItems[0]?.totalQty).toBe(8);
	});

	it("returns empty array when no stock entry items exist", async () => {
		// Default mock returns []
		const result = await service.getDashboardData();

		expect(result.topMovingItems).toEqual([]);
	});
});

// ── Stock Entry Type Breakdown Tests ─────────────────────────────────

describe("DashboardSubService › getStockEntryTypeBreakdown", () => {
	let mp: DashboardMockPrisma;
	let service: DashboardSubService;

	beforeEach(() => {
		jest.clearAllMocks();
		mp = createDashboardMockPrisma();
		service = createService(mp);
	});

	it("groups entries by type with count and aggregated qty, sorted by count desc", async () => {
		mp.stockEntry.groupBy.mockResolvedValue([
			{ stockEntryType: "MATERIAL_RECEIPT", _count: 42 },
			{ stockEntryType: "MATERIAL_ISSUE", _count: 18 },
		]);
		// stockEntryItem.aggregate is called once per type
		mp.stockEntryItem.aggregate
			.mockResolvedValueOnce({ _sum: { qty: 840 } }) // MATERIAL_RECEIPT
			.mockResolvedValueOnce({ _sum: { qty: 360 } }); // MATERIAL_ISSUE

		const result = await service.getDashboardData();

		expect(result.stockEntryTypeBreakdown).toHaveLength(2);
		// Sorted by count desc
		expect(result.stockEntryTypeBreakdown[0]).toMatchObject({
			type: "MATERIAL_RECEIPT",
			count: 42,
			totalQty: 840,
		});
		expect(result.stockEntryTypeBreakdown[1]).toMatchObject({
			type: "MATERIAL_ISSUE",
			count: 18,
			totalQty: 360,
		});
	});

	it("handles null qty sum as 0", async () => {
		mp.stockEntry.groupBy.mockResolvedValue([
			{ stockEntryType: "MANUFACTURE", _count: 5 },
		]);
		mp.stockEntryItem.aggregate.mockResolvedValue({ _sum: { qty: null } });

		const result = await service.getDashboardData();

		expect(result.stockEntryTypeBreakdown[0]?.totalQty).toBe(0);
	});

	it("returns empty array when no stock entries exist", async () => {
		// Default mock returns [] for groupBy
		const result = await service.getDashboardData();

		expect(result.stockEntryTypeBreakdown).toEqual([]);
	});
});

// ── Low Stock Items Tests ─────────────────────────────────────────────

describe("DashboardSubService › getLowStockItems", () => {
	let mp: DashboardMockPrisma;
	let service: DashboardSubService;

	beforeEach(() => {
		jest.clearAllMocks();
		mp = createDashboardMockPrisma();
		service = createService(mp);
	});

	it("maps movement-backed low stock records to DashboardLowStockItem shape", async () => {
		mp.inventoryItem.findMany.mockResolvedValue([
			{
				code: "LOW-001",
				name: "Critical Part",
				safetyStock: 20,
				valuationRate: 50,
				itemGroup: { groupName: "Components" },
			},
		]);
		mp.purchaseReceiptItem.findMany.mockResolvedValue([
			{ itemCode: "LOW-001", acceptedQuantity: 5 },
		]);

		const result = await service.getDashboardData();

		expect(result.lowStockItems).toHaveLength(1);
		expect(result.lowStockItems[0]).toMatchObject({
			itemCode: "LOW-001",
			itemName: "Critical Part",
			currentQty: 5,
			safetyStock: 20,
			deficit: 15,
			warehouse: "All Warehouses",
		});
	});

	it("returns empty array when no items are below safety stock", async () => {
		mp.inventoryItem.findMany.mockResolvedValue([
			{
				code: "OK-001",
				name: "Healthy Part",
				safetyStock: 10,
				valuationRate: 75,
				itemGroup: { groupName: "Components" },
			},
		]);
		mp.purchaseReceiptItem.findMany.mockResolvedValue([
			{ itemCode: "OK-001", acceptedQuantity: 25 },
		]);

		const result = await service.getDashboardData();

		expect(result.lowStockItems).toEqual([]);
	});
});

// ── getDashboardData integration shape test ───────────────────────────

describe("DashboardSubService › getDashboardData (shape)", () => {
	it("returns an object with all 10 required top-level fields", async () => {
		const mp = createDashboardMockPrisma();
		const service = createService(mp);

		const result = await service.getDashboardData();

		const requiredFields = [
			"kpis",
			"stockMovements",
			"warehouseStock",
			"itemGroupDistribution",
			"recentActivity",
			"lowStockItems",
			"batchExpiry",
			"deliveryStatus",
			"topMovingItems",
			"stockEntryTypeBreakdown",
		] as const;

		for (const field of requiredFields) {
			expect(result).toHaveProperty(field);
		}
	});

	it("kpis has all required numeric fields", async () => {
		const mp = createDashboardMockPrisma();
		mp.inventoryItem.count.mockResolvedValue(25);
		mp.warehouse.count.mockResolvedValue(4);
		mp.materialRequest.count.mockResolvedValue(7);
		mp.inventoryItem.findMany.mockResolvedValue([
			{
				code: "SHAPE-001",
				name: "Shape Item",
				safetyStock: 0,
				valuationRate: 10,
				itemGroup: { groupName: "Shape Group" },
			},
		]);
		mp.purchaseReceiptItem.findMany.mockResolvedValue([
			{ itemCode: "SHAPE-001", acceptedQuantity: 50 },
		]);

		const service = createService(mp);
		const result = await service.getDashboardData();

		expect(result.kpis).toMatchObject({
			totalItems: expect.any(Number),
			activeWarehouses: expect.any(Number),
			pendingMaterialRequests: expect.any(Number),
			lowStockItemCount: expect.any(Number),
			totalStockValue: expect.any(Number),
			totalStockQuantity: expect.any(Number),
		});
	});

	it("all array-type fields return arrays", async () => {
		const mp = createDashboardMockPrisma();
		const service = createService(mp);

		const result = await service.getDashboardData();

		const arrayFields = [
			"stockMovements",
			"warehouseStock",
			"itemGroupDistribution",
			"recentActivity",
			"lowStockItems",
			"batchExpiry",
			"deliveryStatus",
			"topMovingItems",
			"stockEntryTypeBreakdown",
		] as const;

		for (const field of arrayFields) {
			expect(Array.isArray(result[field])).toBe(true);
		}
	});
});
