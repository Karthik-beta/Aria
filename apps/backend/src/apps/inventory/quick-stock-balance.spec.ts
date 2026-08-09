import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../shared/prisma.service";
import { InventoryService } from "./inventory.service";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_ITEM = {
	id: "item-id-001",
	code: "ITEM-001",
	name: "Test Widget",
	description: "A test widget",
	valuationRate: 500,
	barcodes: [{ barcode: "BC-001" }, { barcode: "BC-002" }],
};

const MOCK_STOCK_ENTRY = {
	id: "se-001",
	series: "STE-001",
	stockEntryType: "MATERIAL_RECEIPT" as const,
	postingDate: new Date("2026-03-20T00:00:00.000Z"),
	company: "Test Co",
	status: "SUBMITTED" as const,
	project: null,
	defaultSourceWarehouse: null,
	defaultTargetWarehouse: "Stores - GH",
	isOpening: false,
	remarks: null,
	printHeading: null,
	letterHead: null,
	inspectionRequired: false,
	createdAt: new Date("2026-03-20T00:00:00.000Z"),
	updatedAt: new Date("2026-03-20T00:00:00.000Z"),
};

const MOCK_STOCK_ENTRY_ITEM = {
	id: "sei-001",
	stockEntryId: "se-001",
	sourceWarehouse: null,
	targetWarehouse: "Stores - GH",
	itemCode: "ITEM-001",
	itemName: "Test Widget",
	description: null,
	qty: 10,
	basicRate: 500,
	basicAmount: 5000,
	unitOfMeasure: "Nos",
	stockEntry: MOCK_STOCK_ENTRY,
};

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

function buildMockPrisma() {
	return {
		inventoryItem: {
			findFirst: jest.fn(),
		},
		itemBarcode: {
			findFirst: jest.fn(),
		},
		stockEntryItem: {
			findMany: jest.fn(),
		},
		// Stubs for other tables required by InventoryService constructor
		item: { findMany: jest.fn(), findUnique: jest.fn() },
		itemGroup: { findMany: jest.fn() },
		itemGroupDefault: { count: jest.fn() },
		itemReorder: { count: jest.fn() },
		stockSettings: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			count: jest.fn(),
		},
		itemVariantSettings: {
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			upsert: jest.fn(),
		},
		itemVariantSettingsField: {
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			deleteMany: jest.fn(),
		},
		unitOfMeasurement: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			createMany: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		warehouse: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		productBundle: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		shippingRule: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		brand: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
		itemAttribute: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		itemAttributeValue: {
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
		itemAlternate: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			upsert: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
		},
		itemManufacturer: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			updateMany: jest.fn(),
			delete: jest.fn(),
		},
		materialRequest: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		materialRequestItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
			count: jest.fn(),
		},
		stockEntry: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		deliveryNote: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		deliveryNoteItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
			count: jest.fn(),
		},
		purchaseReceipt: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		purchaseReceiptItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
			count: jest.fn(),
		},
		purchaseReceiptTax: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
		pickList: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		pickListItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
			count: jest.fn(),
		},
		deliveryTrip: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
		},
		deliveryTripStop: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
		serialNo: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		serialNoHistory: {
			findMany: jest.fn(),
			create: jest.fn(),
		},
		batch: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		installationNote: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		installationNoteItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
		packingSlip: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		packingSlipItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
		qiParameterGroup: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		qiParameter: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		qiTemplate: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		qiTemplateItem: {
			deleteMany: jest.fn(),
			create: jest.fn(),
			findMany: jest.fn(),
		},
		$transaction: jest.fn(),
	};
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("InventoryService.getQuickStockBalance", () => {
	let service: InventoryService;
	let mockPrisma: ReturnType<typeof buildMockPrisma>;

	beforeEach(() => {
		jest.clearAllMocks();
		mockPrisma = buildMockPrisma();
		mockPrisma.$transaction.mockImplementation(
			(
				input:
					| ((tx: typeof mockPrisma) => unknown)
					| readonly Promise<unknown>[],
			) => {
				if (typeof input === "function") {
					return input(mockPrisma);
				}
				return Promise.all(input);
			},
		);
		service = new InventoryService(mockPrisma as unknown as PrismaService);
	});

	describe("input validation", () => {
		it("throws BadRequestException when neither itemCode nor barcode is supplied", async () => {
			await expect(
				service.getQuickStockBalance({
					warehouse: "Stores - GH",
					date: new Date("2026-03-26"),
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("lookup by itemCode - happy path", () => {
		it("returns correct quantity and value for a single inbound stock movement", async () => {
			mockPrisma.inventoryItem.findFirst.mockResolvedValue(MOCK_ITEM);
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([
				MOCK_STOCK_ENTRY_ITEM,
			]);

			const result = await service.getQuickStockBalance({
				warehouse: "Stores - GH",
				date: new Date("2026-03-26"),
				itemCode: "ITEM-001",
			});

			expect(result.itemCode).toBe("ITEM-001");
			expect(result.itemName).toBe("Test Widget");
			expect(result.description).toBe("A test widget");
			expect(result.availableQty).toBe(10);
			// stockValue = 10 qty × 500 valuationRate
			expect(result.stockValue).toBe(5000);
			expect(result.barcodes).toEqual(["BC-001", "BC-002"]);
			expect(mockPrisma.stockEntryItem.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						stockEntry: expect.objectContaining({ status: "SUBMITTED" }),
					}),
				}),
			);
		});

		it("excludes draft and cancelled movements at the database query", async () => {
			mockPrisma.inventoryItem.findFirst.mockResolvedValue(MOCK_ITEM);
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([]);

			await service.getQuickStockBalance({
				warehouse: "Stores - GH",
				date: new Date("2026-03-26"),
				itemCode: "ITEM-001",
			});

			expect(mockPrisma.stockEntryItem.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						stockEntry: expect.objectContaining({ status: "SUBMITTED" }),
					}),
				}),
			);
		});

		it("returns zero quantity and value when there are no submitted movements", async () => {
			mockPrisma.inventoryItem.findFirst.mockResolvedValue(MOCK_ITEM);
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([]);

			const result = await service.getQuickStockBalance({
				warehouse: "Stores - GH",
				date: new Date("2026-03-26"),
				itemCode: "ITEM-001",
			});

			expect(result.availableQty).toBe(0);
			expect(result.stockValue).toBe(0);
		});

		it("calculates net quantity correctly when outbound movements are present", async () => {
			const outboundEntry = {
				...MOCK_STOCK_ENTRY,
				id: "se-002",
				series: "STE-002",
				postingDate: new Date("2026-03-22T00:00:00.000Z"),
				defaultSourceWarehouse: "Stores - GH",
				defaultTargetWarehouse: null,
			};
			const outboundItem = {
				...MOCK_STOCK_ENTRY_ITEM,
				id: "sei-002",
				stockEntryId: "se-002",
				sourceWarehouse: "Stores - GH",
				targetWarehouse: null,
				qty: 4,
				basicAmount: 2000,
				stockEntry: outboundEntry,
			};

			mockPrisma.inventoryItem.findFirst.mockResolvedValue(MOCK_ITEM);
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([
				MOCK_STOCK_ENTRY_ITEM,
				outboundItem,
			]);

			const result = await service.getQuickStockBalance({
				warehouse: "Stores - GH",
				date: new Date("2026-03-26"),
				itemCode: "ITEM-001",
			});

			// 10 in − 4 out = 6
			expect(result.availableQty).toBe(6);
			expect(result.stockValue).toBe(6 * 500);
		});

		it("excludes movements from other warehouses", async () => {
			const otherWarehouseEntry = {
				...MOCK_STOCK_ENTRY,
				id: "se-003",
				series: "STE-003",
				defaultTargetWarehouse: "Finished Goods - GH",
			};
			const otherWarehouseItem = {
				...MOCK_STOCK_ENTRY_ITEM,
				id: "sei-003",
				stockEntryId: "se-003",
				targetWarehouse: "Finished Goods - GH",
				stockEntry: otherWarehouseEntry,
			};

			// Both items are returned by the query (filtering happens in buildStockLedgerRows)
			mockPrisma.inventoryItem.findFirst.mockResolvedValue(MOCK_ITEM);
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([
				MOCK_STOCK_ENTRY_ITEM, // Stores - GH  → 10 in
				otherWarehouseItem, // Finished Goods - GH → excluded for "Stores - GH"
			]);

			const result = await service.getQuickStockBalance({
				warehouse: "Stores - GH",
				date: new Date("2026-03-26"),
				itemCode: "ITEM-001",
			});

			expect(result.availableQty).toBe(10);
		});

		it("throws NotFoundException when item code does not exist", async () => {
			mockPrisma.inventoryItem.findFirst.mockResolvedValue(null);
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([]);

			await expect(
				service.getQuickStockBalance({
					warehouse: "Stores - GH",
					date: new Date("2026-03-26"),
					itemCode: "NONEXISTENT",
				}),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("lookup by barcode - happy path", () => {
		it("resolves the item from the barcode and returns its balance", async () => {
			mockPrisma.itemBarcode.findFirst.mockResolvedValue({
				item: { code: "ITEM-001" },
			});
			mockPrisma.inventoryItem.findFirst.mockResolvedValue(MOCK_ITEM);
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([
				MOCK_STOCK_ENTRY_ITEM,
			]);

			const result = await service.getQuickStockBalance({
				warehouse: "Stores - GH",
				date: new Date("2026-03-26"),
				barcode: "BC-001",
			});

			expect(result.itemCode).toBe("ITEM-001");
			expect(result.availableQty).toBe(10);
		});

		it("throws NotFoundException when barcode is not registered to any item", async () => {
			mockPrisma.itemBarcode.findFirst.mockResolvedValue(null);

			await expect(
				service.getQuickStockBalance({
					warehouse: "Stores - GH",
					date: new Date("2026-03-26"),
					barcode: "INVALID-BARCODE",
				}),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("stock value calculation", () => {
		it("returns zero stock value when item has no valuation rate", async () => {
			const itemWithoutRate = { ...MOCK_ITEM, valuationRate: null };
			mockPrisma.inventoryItem.findFirst.mockResolvedValue(itemWithoutRate);
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([
				MOCK_STOCK_ENTRY_ITEM,
			]);

			const result = await service.getQuickStockBalance({
				warehouse: "Stores - GH",
				date: new Date("2026-03-26"),
				itemCode: "ITEM-001",
			});

			expect(result.stockValue).toBe(0); // qty × 0 (no rate)
		});
	});
});
