import {
	buildCommittedStockSnapshot,
	reconcileInventoryItemQuantities,
} from "./stock-snapshot";

function createSnapshotMockPrisma() {
	return {
		inventoryItem: {
			findMany: jest.fn().mockResolvedValue([]),
			update: jest.fn().mockResolvedValue(undefined),
		},
		purchaseReceiptItem: {
			findMany: jest.fn().mockResolvedValue([]),
		},
		stockEntryItem: {
			findMany: jest.fn().mockResolvedValue([]),
		},
		deliveryNoteItem: {
			findMany: jest.fn().mockResolvedValue([]),
		},
	};
}

describe("buildCommittedStockSnapshot", () => {
	it("aggregates committed purchase receipts, stock entries, and delivery notes", async () => {
		const prisma = createSnapshotMockPrisma();

		prisma.purchaseReceiptItem.findMany.mockResolvedValue([
			{ itemCode: "ITEM-A", acceptedQuantity: 100 },
			{ itemCode: "ITEM-B", acceptedQuantity: 50 },
		]);
		prisma.stockEntryItem.findMany.mockResolvedValue([
			{
				itemCode: "ITEM-A",
				qty: 10,
				sourceWarehouse: null,
				targetWarehouse: "Main Warehouse",
				stockEntry: {
					defaultSourceWarehouse: null,
					defaultTargetWarehouse: null,
				},
			},
			{
				itemCode: "ITEM-A",
				qty: 4,
				sourceWarehouse: "Main Warehouse",
				targetWarehouse: null,
				stockEntry: {
					defaultSourceWarehouse: null,
					defaultTargetWarehouse: null,
				},
			},
			{
				itemCode: "ITEM-B",
				qty: 3,
				sourceWarehouse: null,
				targetWarehouse: null,
				stockEntry: {
					defaultSourceWarehouse: "Stores A",
					defaultTargetWarehouse: "Stores B",
				},
			},
		]);
		prisma.deliveryNoteItem.findMany.mockResolvedValue([
			{ itemCode: "ITEM-A", quantity: 20 },
		]);

		const snapshot = await buildCommittedStockSnapshot(prisma as never);

		expect(Object.fromEntries(snapshot)).toEqual({
			"ITEM-A": 86,
			"ITEM-B": 50,
		});
	});

	it("applies committed-document filters and trims item code inputs", async () => {
		const prisma = createSnapshotMockPrisma();

		await buildCommittedStockSnapshot(prisma as never, {
			company: "Aria Corp",
			itemCodes: [" ITEM-001 ", "", "ITEM-002"],
		});

		expect(prisma.purchaseReceiptItem.findMany).toHaveBeenCalledWith({
			where: {
				itemCode: { in: ["ITEM-001", "ITEM-002"] },
				purchaseReceipt: {
					status: { notIn: ["DRAFT", "CANCELLED"] },
					isReturn: false,
					company: "Aria Corp",
				},
			},
			select: {
				itemCode: true,
				acceptedQuantity: true,
			},
		});
		expect(prisma.stockEntryItem.findMany).toHaveBeenCalledWith({
			where: {
				itemCode: { in: ["ITEM-001", "ITEM-002"] },
				stockEntry: {
					status: "SUBMITTED",
					company: "Aria Corp",
				},
			},
			select: {
				itemCode: true,
				qty: true,
				sourceWarehouse: true,
				targetWarehouse: true,
				stockEntry: {
					select: {
						defaultSourceWarehouse: true,
						defaultTargetWarehouse: true,
					},
				},
			},
		});
		expect(prisma.deliveryNoteItem.findMany).toHaveBeenCalledWith({
			where: {
				itemCode: { in: ["ITEM-001", "ITEM-002"] },
				deliveryNote: {
					status: { notIn: ["DRAFT", "CANCELLED"] },
					isReturn: false,
					company: "Aria Corp",
				},
			},
			select: {
				itemCode: true,
				quantity: true,
			},
		});
	});
});

describe("reconcileInventoryItemQuantities", () => {
	it("writes rounded committed stock quantities back to tracked items", async () => {
		const prisma = createSnapshotMockPrisma();

		prisma.purchaseReceiptItem.findMany.mockResolvedValue([
			{ itemCode: "ITEM-A", acceptedQuantity: 12.6 },
		]);
		prisma.inventoryItem.findMany.mockResolvedValue([
			{ id: "item-1", code: "ITEM-A" },
			{ id: "item-2", code: "ITEM-B" },
		]);

		await reconcileInventoryItemQuantities(prisma as never, {
			company: "Aria Corp",
			itemCodes: ["ITEM-A", "ITEM-B"],
		});

		expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith({
			where: {
				maintainStock: true,
				code: { in: ["ITEM-A", "ITEM-B"] },
			},
			select: {
				id: true,
				code: true,
			},
		});
		expect(prisma.inventoryItem.update).toHaveBeenCalledTimes(2);
		expect(prisma.inventoryItem.update).toHaveBeenNthCalledWith(1, {
			where: { id: "item-1" },
			data: { quantity: 13 },
		});
		expect(prisma.inventoryItem.update).toHaveBeenNthCalledWith(2, {
			where: { id: "item-2" },
			data: { quantity: 0 },
		});
	});
});
