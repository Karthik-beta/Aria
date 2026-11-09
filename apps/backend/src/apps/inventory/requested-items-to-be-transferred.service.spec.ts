import type { PrismaService } from "../../shared/prisma.service";
import { InventoryService } from "./inventory.service";

describe("InventoryService.findRequestedItemsToBeTransferred", () => {
	const mockPrisma = {
		materialRequest: {
			findMany: jest.fn(),
		},
		inventoryItem: {
			findMany: jest.fn(),
		},
	};

	let service: InventoryService;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new InventoryService(mockPrisma as unknown as PrismaService);
	});

	it("queries active transfer requests and enriches rows with item metadata", async () => {
		mockPrisma.materialRequest.findMany.mockResolvedValue([
			{
				id: "mr-1",
				series: "MAT-MRQ-2026-00001",
				transactionDate: new Date("2026-03-01T00:00:00.000Z"),
				purpose: "MATERIAL_TRANSFER",
				company: "Aria Corp",
				requiredBy: null,
				status: "APPROVED",
				targetWarehouse: "Stores - AC",
				items: [
					{
						id: "mri-1",
						itemCode: "ITEM-001",
						itemName: null,
						requiredBy: null,
						quantity: 10,
						orderedQty: 4,
						receivedQty: 0,
						targetWarehouse: null,
						unitOfMeasure: "Nos",
					},
				],
			},
		]);

		mockPrisma.inventoryItem.findMany.mockResolvedValue([
			{
				code: "ITEM-001",
				name: "Widget Alpha",
				description: "Primary widget",
			},
		]);

		const result = await service.findRequestedItemsToBeTransferred({
			company: "Aria",
			purpose: "MATERIAL_TRANSFER",
		});

		expect(mockPrisma.materialRequest.findMany).toHaveBeenCalledWith({
			where: {
				purpose: "MATERIAL_TRANSFER",
				status: {
					notIn: ["DRAFT", "CANCELLED"],
				},
				company: {
					contains: "Aria",
					mode: "insensitive",
				},
			},
			include: { items: true },
			orderBy: [{ transactionDate: "asc" }, { series: "asc" }],
		});

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]).toMatchObject({
			materialRequest: "MAT-MRQ-2026-00001",
			itemCode: "ITEM-001",
			itemName: "Widget Alpha",
			description: "Primary widget",
			targetWarehouse: "Stores - AC",
			qty: 10,
			transferredQty: 4,
			qtyToTransfer: 6,
		});
		expect(result.summary.totalQtyToTransfer).toBe(6);
	});

	it("filters rows in memory by item code and target warehouse", async () => {
		mockPrisma.materialRequest.findMany.mockResolvedValue([
			{
				id: "mr-1",
				series: "MAT-MRQ-2026-00001",
				transactionDate: new Date("2026-03-01T00:00:00.000Z"),
				purpose: "MATERIAL_TRANSFER",
				company: "Aria Corp",
				requiredBy: null,
				status: "APPROVED",
				targetWarehouse: "Stores - AC",
				items: [
					{
						id: "mri-1",
						itemCode: "ITEM-001",
						itemName: "Widget Alpha",
						requiredBy: null,
						quantity: 10,
						orderedQty: 4,
						receivedQty: 0,
						targetWarehouse: null,
						unitOfMeasure: "Nos",
					},
					{
						id: "mri-2",
						itemCode: "ITEM-002",
						itemName: "Bolt B12",
						requiredBy: null,
						quantity: 5,
						orderedQty: 0,
						receivedQty: 0,
						targetWarehouse: "Inspection - AC",
						unitOfMeasure: "Nos",
					},
				],
			},
		]);

		mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

		const result = await service.findRequestedItemsToBeTransferred({
			itemCode: "ITEM-002",
			targetWarehouse: "Inspection",
		});

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]).toMatchObject({
			id: "mri-2",
			itemCode: "ITEM-002",
			targetWarehouse: "Inspection - AC",
			qtyToTransfer: 5,
		});
		expect(result.summary).toMatchObject({
			requestCount: 1,
			rowCount: 1,
			totalQtyToTransfer: 5,
		});
	});
});
