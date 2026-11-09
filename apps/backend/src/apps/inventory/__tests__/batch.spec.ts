import {
	BadRequestException,
	createTestContext,
	mockBatch,
	mockItem,
	mockWarehouse,
} from "./inventory-test-helpers";

describe("InventoryService > Batch", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
	});

	describe("batches", () => {
		it("should list batches with bounded filters", async () => {
			mockPrisma.batch.findMany.mockResolvedValue([mockBatch]);
			mockPrisma.batch.count.mockResolvedValue(1);

			const result = await service.findBatches({
				search: "BATCH-1001",
				status: "ACTIVE",
				take: 25,
			});

			expect(result.totalCount).toBe(1);
			expect(result.items[0]?.batchId).toBe("BATCH-1001");
			expect(mockPrisma.batch.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 25,
				}),
			);
		});

		it("should create a batch when the item supports batch tracking", async () => {
			mockPrisma.inventoryItem.findUnique.mockResolvedValue({
				id: mockItem.id,
				code: mockItem.code,
				name: mockItem.name,
				hasBatchNo: true,
				disabled: false,
			});
			mockPrisma.warehouse.findUnique.mockResolvedValue({
				id: mockWarehouse.id,
				name: mockWarehouse.name,
				company: "Aria Corp",
				disabled: false,
			});
			mockPrisma.batch.create.mockResolvedValue(mockBatch);

			const result = await service.createBatch({
				batchId: "BATCH-1001",
				itemId: mockItem.id,
				company: "Aria Corp",
				currentWarehouseId: mockWarehouse.id,
				useBatchWiseValuation: false,
				quantity: 10,
				isDisabled: false,
			});

			expect(result.batchId).toBe("BATCH-1001");
			expect(mockPrisma.batch.create).toHaveBeenCalled();
		});

		it("should reject quantity without a warehouse", async () => {
			mockPrisma.inventoryItem.findUnique.mockResolvedValue({
				id: mockItem.id,
				code: mockItem.code,
				name: mockItem.name,
				hasBatchNo: true,
				disabled: false,
			});

			await expect(
				service.createBatch({
					batchId: "BATCH-1002",
					itemId: mockItem.id,
					company: "Aria Corp",
					useBatchWiseValuation: false,
					quantity: 5,
					isDisabled: false,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("should reject changing item or warehouse while quantity exists", async () => {
			mockPrisma.batch.findUnique.mockResolvedValueOnce({
				id: mockBatch.id,
				batchId: mockBatch.batchId,
				itemId: mockBatch.itemId,
				company: mockBatch.company,
				currentWarehouseId: mockBatch.currentWarehouseId,
				purchaseReceiptId: null,
				deliveryNoteId: null,
				stockEntryId: null,
				useBatchWiseValuation: false,
				manufacturingDate: mockBatch.manufacturingDate,
				expiryDate: mockBatch.expiryDate,
				description: mockBatch.description,
				quantity: 10,
				isDisabled: false,
			});

			await expect(
				service.updateBatch({
					id: mockBatch.id,
					currentWarehouseId: "clh123warehouse0009",
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("should prevent deleting a linked batch with stock on hand", async () => {
			mockPrisma.batch.findUnique.mockResolvedValue({
				id: mockBatch.id,
				quantity: 10,
				purchaseReceiptId: "receipt-1",
				deliveryNoteId: null,
				stockEntryId: null,
			});

			await expect(service.deleteBatch(mockBatch.id)).rejects.toThrow(
				BadRequestException,
			);
		});
	});
});
