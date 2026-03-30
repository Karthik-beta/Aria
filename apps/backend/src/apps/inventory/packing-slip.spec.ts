import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../shared/prisma.service";
import { InventoryService } from "./inventory.service";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const DELIVERY_NOTE_ID = "dn-001";
const DN_ITEM_ID = "dni-001";

const MOCK_DELIVERY_NOTE = {
	id: DELIVERY_NOTE_ID,
	status: "DRAFT",
};

const MOCK_ITEM_MASTER = {
	code: "ITEM-001",
	weightPerUnit: 2.5,
	weightUom: "Kg",
};

const CREATED_PS = {
	id: "ps-001",
	series: "PS-2026-00001",
	status: "DRAFT",
	deliveryNoteId: DELIVERY_NOTE_ID,
	fromCaseNo: 1,
	toCaseNo: 1,
	netWeightPkg: 25,
	netWeightUom: "Kg",
	grossWeightPkg: 25,
	grossWeightUom: "Kg",
	letterHead: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
	items: [
		{
			id: "psi-001",
			packingSlipId: "ps-001",
			deliveryNoteItemId: DN_ITEM_ID,
			itemCode: "ITEM-001",
			itemName: "Widget",
			description: null,
			qty: 10,
			netWeight: 2.5,
			weightUom: "Kg",
			batchNo: null,
		},
	],
};

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

function buildMockPrisma() {
	return {
		inventoryItem: {
			findFirst: jest.fn(),
			findMany: jest.fn(),
		},
		itemBarcode: { findFirst: jest.fn() },
		stockEntryItem: { findMany: jest.fn() },
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
		brand: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
		},
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
		stockEntryDetail: { findMany: jest.fn() },
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
			findUnique: jest.fn(),
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
		serialNoHistory: { findMany: jest.fn(), create: jest.fn() },
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

describe("InventoryService — Packing Slip", () => {
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

		// Default: delivery note items always have enough room for packing
		mockPrisma.deliveryNoteItem.findUnique.mockResolvedValue({
			quantity: 1000,
			packedQty: 0,
		});
	});

	describe("createPackingSlip — weight calculation (netWeight × qty)", () => {
		it("computes netWeightPkg as SUM(netWeight × qty) when weights are provided", async () => {
			// Arrange
			mockPrisma.deliveryNote.findUnique.mockResolvedValue(MOCK_DELIVERY_NOTE);
			// No existing packing slips → no case-number overlap
			mockPrisma.packingSlip.findMany.mockResolvedValue([]);
			// No packed qty on the DN item yet
			mockPrisma.packingSlipItem.findMany.mockResolvedValue([]);
			// Item master lookup for auto-fill (won't be used — weights provided)
			mockPrisma.inventoryItem.findMany.mockResolvedValue([MOCK_ITEM_MASTER]);
			// Series generation: return max existing as null
			mockPrisma.packingSlip.findFirst.mockResolvedValue(null);
			// The create call → capture what it receives
			mockPrisma.packingSlip.create.mockResolvedValue(CREATED_PS);

			await service.createPackingSlip({
				deliveryNoteId: DELIVERY_NOTE_ID,
				fromCaseNo: 1,
				items: [
					{
						deliveryNoteItemId: DN_ITEM_ID,
						itemCode: "ITEM-001",
						itemName: "Widget",
						qty: 10,
						netWeight: 2.5,
						weightUom: "Kg",
					},
				],
			});

			// Verify the create call used the correct netWeightPkg = 2.5 × 10 = 25
			const createCall = mockPrisma.packingSlip.create.mock.calls[0][0];
			expect(createCall.data.netWeightPkg).toBe(25);
			expect(createCall.data.netWeightUom).toBe("Kg");
			// Gross defaults to net when not specified
			expect(createCall.data.grossWeightPkg).toBe(25);
		});

		it("computes correctly with multiple items of different quantities", async () => {
			mockPrisma.deliveryNote.findUnique.mockResolvedValue(MOCK_DELIVERY_NOTE);
			mockPrisma.packingSlip.findMany.mockResolvedValue([]);
			mockPrisma.packingSlipItem.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([
				MOCK_ITEM_MASTER,
				{ code: "ITEM-002", weightPerUnit: 1.0, weightUom: "Kg" },
			]);
			mockPrisma.packingSlip.findFirst.mockResolvedValue(null);

			const multiItemResult = {
				...CREATED_PS,
				items: [
					{ ...CREATED_PS.items[0] },
					{
						...CREATED_PS.items[0],
						id: "psi-002",
						itemCode: "ITEM-002",
						qty: 5,
						netWeight: 3.0,
					},
				],
			};
			mockPrisma.packingSlip.create.mockResolvedValue(multiItemResult);

			await service.createPackingSlip({
				deliveryNoteId: DELIVERY_NOTE_ID,
				fromCaseNo: 1,
				items: [
					{
						deliveryNoteItemId: DN_ITEM_ID,
						itemCode: "ITEM-001",
						itemName: "Widget",
						qty: 10,
						netWeight: 2.5,
						weightUom: "Kg",
					},
					{
						deliveryNoteItemId: "dni-002",
						itemCode: "ITEM-002",
						itemName: "Gadget",
						qty: 5,
						netWeight: 3.0,
						weightUom: "Kg",
					},
				],
			});

			// 2.5×10 + 3.0×5 = 25 + 15 = 40
			const createCall = mockPrisma.packingSlip.create.mock.calls[0][0];
			expect(createCall.data.netWeightPkg).toBe(40);
		});

		it("uses explicit grossWeightPkg when provided", async () => {
			mockPrisma.deliveryNote.findUnique.mockResolvedValue(MOCK_DELIVERY_NOTE);
			mockPrisma.packingSlip.findMany.mockResolvedValue([]);
			mockPrisma.packingSlipItem.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([MOCK_ITEM_MASTER]);
			mockPrisma.packingSlip.findFirst.mockResolvedValue(null);
			mockPrisma.packingSlip.create.mockResolvedValue(CREATED_PS);

			await service.createPackingSlip({
				deliveryNoteId: DELIVERY_NOTE_ID,
				fromCaseNo: 1,
				grossWeightPkg: 30,
				items: [
					{
						deliveryNoteItemId: DN_ITEM_ID,
						itemCode: "ITEM-001",
						itemName: "Widget",
						qty: 10,
						netWeight: 2.5,
						weightUom: "Kg",
					},
				],
			});

			const createCall = mockPrisma.packingSlip.create.mock.calls[0][0];
			expect(createCall.data.grossWeightPkg).toBe(30);
			// net still = 2.5 × 10 = 25
			expect(createCall.data.netWeightPkg).toBe(25);
		});
	});

	describe("createPackingSlip — auto-fill weight from Item master", () => {
		it("fills netWeight from Item.weightPerUnit when item has no netWeight", async () => {
			mockPrisma.deliveryNote.findUnique.mockResolvedValue(MOCK_DELIVERY_NOTE);
			mockPrisma.packingSlip.findMany.mockResolvedValue([]);
			mockPrisma.packingSlipItem.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([MOCK_ITEM_MASTER]);
			mockPrisma.packingSlip.findFirst.mockResolvedValue(null);
			mockPrisma.packingSlip.create.mockResolvedValue(CREATED_PS);

			await service.createPackingSlip({
				deliveryNoteId: DELIVERY_NOTE_ID,
				fromCaseNo: 1,
				items: [
					{
						deliveryNoteItemId: DN_ITEM_ID,
						itemCode: "ITEM-001",
						itemName: "Widget",
						qty: 10,
						// No netWeight or weightUom provided
					},
				],
			});

			const createCall = mockPrisma.packingSlip.create.mock.calls[0][0];
			const itemData = createCall.data.items.create[0];
			// Should be filled from master: 2.5
			expect(itemData.netWeight).toBe(2.5);
			expect(itemData.weightUom).toBe("Kg");
			// netWeightPkg = 2.5 × 10 = 25
			expect(createCall.data.netWeightPkg).toBe(25);
		});

		it("preserves explicitly provided netWeight (does not overwrite with master)", async () => {
			mockPrisma.deliveryNote.findUnique.mockResolvedValue(MOCK_DELIVERY_NOTE);
			mockPrisma.packingSlip.findMany.mockResolvedValue([]);
			mockPrisma.packingSlipItem.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([MOCK_ITEM_MASTER]);
			mockPrisma.packingSlip.findFirst.mockResolvedValue(null);
			mockPrisma.packingSlip.create.mockResolvedValue(CREATED_PS);

			await service.createPackingSlip({
				deliveryNoteId: DELIVERY_NOTE_ID,
				fromCaseNo: 1,
				items: [
					{
						deliveryNoteItemId: DN_ITEM_ID,
						itemCode: "ITEM-001",
						itemName: "Widget",
						qty: 10,
						netWeight: 5.0, // Explicitly provided
						weightUom: "Lb",
					},
				],
			});

			const createCall = mockPrisma.packingSlip.create.mock.calls[0][0];
			const itemData = createCall.data.items.create[0];
			expect(itemData.netWeight).toBe(5.0);
			expect(itemData.weightUom).toBe("Lb");
		});
	});

	describe("createPackingSlip — validation", () => {
		it("throws NotFoundException when delivery note does not exist", async () => {
			mockPrisma.deliveryNote.findUnique.mockResolvedValue(null);

			await expect(
				service.createPackingSlip({
					deliveryNoteId: "nonexistent",
					fromCaseNo: 1,
					items: [
						{
							deliveryNoteItemId: DN_ITEM_ID,
							itemCode: "ITEM-001",
							itemName: "Widget",
							qty: 1,
						},
					],
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("throws BadRequestException when delivery note is not DRAFT", async () => {
			mockPrisma.deliveryNote.findUnique.mockResolvedValue({
				id: DELIVERY_NOTE_ID,
				status: "SUBMITTED",
			});

			await expect(
				service.createPackingSlip({
					deliveryNoteId: DELIVERY_NOTE_ID,
					fromCaseNo: 1,
					items: [
						{
							deliveryNoteItemId: DN_ITEM_ID,
							itemCode: "ITEM-001",
							itemName: "Widget",
							qty: 1,
						},
					],
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("createPackingSlip — toCaseNo defaults", () => {
		it("defaults toCaseNo to fromCaseNo when not provided", async () => {
			mockPrisma.deliveryNote.findUnique.mockResolvedValue(MOCK_DELIVERY_NOTE);
			mockPrisma.packingSlip.findMany.mockResolvedValue([]);
			mockPrisma.packingSlipItem.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([MOCK_ITEM_MASTER]);
			mockPrisma.packingSlip.findFirst.mockResolvedValue(null);
			mockPrisma.packingSlip.create.mockResolvedValue(CREATED_PS);

			await service.createPackingSlip({
				deliveryNoteId: DELIVERY_NOTE_ID,
				fromCaseNo: 5,
				items: [
					{
						deliveryNoteItemId: DN_ITEM_ID,
						itemCode: "ITEM-001",
						itemName: "Widget",
						qty: 1,
					},
				],
			});

			const createCall = mockPrisma.packingSlip.create.mock.calls[0][0];
			expect(createCall.data.fromCaseNo).toBe(5);
			expect(createCall.data.toCaseNo).toBe(5);
		});
	});

	describe("findAllPackingSlips — search", () => {
		it("passes search filter to Prisma query", async () => {
			mockPrisma.packingSlip.findMany.mockResolvedValue([]);

			await service.findAllPackingSlips({ search: "PS-2026" });

			const findCall = mockPrisma.packingSlip.findMany.mock.calls[0][0];
			expect(findCall.where.series).toEqual({
				contains: "PS-2026",
				mode: "insensitive",
			});
		});

		it("omits search filter when not provided", async () => {
			mockPrisma.packingSlip.findMany.mockResolvedValue([]);

			await service.findAllPackingSlips({});

			const findCall = mockPrisma.packingSlip.findMany.mock.calls[0][0];
			expect(findCall.where.series).toBeUndefined();
		});
	});
});
