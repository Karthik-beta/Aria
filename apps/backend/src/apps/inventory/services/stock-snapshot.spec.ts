import {
	buildCommittedStockSnapshot,
	reconcileInventoryItemQuantities,
} from "./stock-snapshot";

function createSnapshotMockPrisma() {
	return {
		client: {
			$queryRaw: jest.fn().mockResolvedValue([]),
		},
		inventoryItem: {
			findMany: jest.fn().mockResolvedValue([]),
			update: jest.fn().mockResolvedValue(undefined),
		},
	};
}

describe("buildCommittedStockSnapshot", () => {
	it("aggregates committed purchase receipts, stock entries, and delivery notes", async () => {
		const prisma = createSnapshotMockPrisma();

		prisma.client.$queryRaw.mockResolvedValue([
			{ itemCode: "ITEM-A", quantity: 86 },
			{ itemCode: "ITEM-B", quantity: 50 },
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

		expect(prisma.client.$queryRaw).toHaveBeenCalledTimes(1);
		const query = prisma.client.$queryRaw.mock.calls[0][0] as {
			values?: unknown[];
		};
		expect(query.values).toEqual(
			expect.arrayContaining(["Aria Corp", "ITEM-001", "ITEM-002"]),
		);
	});
});

describe("reconcileInventoryItemQuantities", () => {
	it("writes rounded committed stock quantities back to tracked items", async () => {
		const prisma = createSnapshotMockPrisma();

		prisma.client.$queryRaw.mockResolvedValue([
			{ itemCode: "ITEM-A", quantity: 12.6 },
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
