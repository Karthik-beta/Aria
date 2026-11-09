import {
	BadRequestException,
	ConflictException,
	createTestContext,
	Inventory,
	mockWarehouse,
} from "./inventory-test-helpers";

describe("InventoryService > Warehouse", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	describe("findWarehouses", () => {
		it("should return bounded warehouse rows with the total count", async () => {
			mockPrisma.warehouse.findMany.mockResolvedValue([mockWarehouse]);
			mockPrisma.warehouse.count.mockResolvedValue(1);

			const result = await service.findWarehouses({
				skip: 0,
				take: 20,
				search: "Stores",
				company: "Aria",
				disabled: false,
				isGroupWarehouse: false,
			});

			expect(result).toEqual({
				items: [
					{
						id: mockWarehouse.id,
						name: mockWarehouse.name,
						disabled: mockWarehouse.disabled,
						isGroupWarehouse: mockWarehouse.isGroupWarehouse,
						parentWarehouseId: mockWarehouse.parentWarehouseId,
						parentWarehouseName: null,
						company: mockWarehouse.company,
						isRejectedWarehouse: mockWarehouse.isRejectedWarehouse,
						phoneNo: mockWarehouse.phoneNo,
						mobileNo: mockWarehouse.mobileNo,
						addressLine1: mockWarehouse.addressLine1,
						addressLine2: mockWarehouse.addressLine2,
						city: mockWarehouse.city,
						state: mockWarehouse.state,
						pin: mockWarehouse.pin,
						warehouseType: mockWarehouse.warehouseType,
						defaultInTransitWarehouseId:
							mockWarehouse.defaultInTransitWarehouseId,
						defaultInTransitWarehouseName: null,
						createdAt: mockWarehouse.createdAt,
						updatedAt: mockWarehouse.updatedAt,
					},
				],
				totalCount: 1,
			});
			expect(mockPrisma.warehouse.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 20,
					select: expect.objectContaining({
						name: true,
						company: true,
					}),
				}),
			);
		});
	});

	describe("createWarehouse", () => {
		it("should create a warehouse and normalize optional fields", async () => {
			const input = Inventory.createWarehouseSchema.parse({
				name: " Stores - GH ",
				company: " Aria Corp ",
				phoneNo: "  ",
				warehouseType: " Retail ",
			});
			mockPrisma.warehouse.findFirst.mockResolvedValue(null);
			mockPrisma.warehouse.create.mockResolvedValue(mockWarehouse);

			const result = await service.createWarehouse(input);

			expect(result.name).toBe(mockWarehouse.name);
			expect(mockPrisma.warehouse.create).toHaveBeenCalledWith({
				data: expect.objectContaining({
					name: "Stores - GH",
					company: "Aria Corp",
					phoneNo: null,
					warehouseType: "Retail",
				}),
				select: expect.objectContaining({
					id: true,
					name: true,
					company: true,
				}),
			});
		});

		it("should reject duplicate warehouse names", async () => {
			const input = Inventory.createWarehouseSchema.parse({
				name: "Stores - GH",
				company: "Aria Corp",
			});
			mockPrisma.warehouse.findFirst.mockResolvedValue({ id: "duplicate-id" });

			await expect(service.createWarehouse(input)).rejects.toThrow(
				ConflictException,
			);
		});
	});

	describe("updateWarehouse", () => {
		it("should update a warehouse when the name stays stable", async () => {
			mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
			mockPrisma.warehouse.count.mockResolvedValue(0);
			mockPrisma.warehouse.update.mockResolvedValue({
				...mockWarehouse,
				disabled: true,
			});

			const result = await service.updateWarehouse({
				id: mockWarehouse.id,
				disabled: true,
			});

			expect(result.disabled).toBe(true);
			expect(mockPrisma.warehouse.update).toHaveBeenCalledWith({
				where: { id: mockWarehouse.id },
				data: expect.objectContaining({ disabled: true }),
				select: expect.objectContaining({
					id: true,
					name: true,
				}),
			});
		});

		it("should reject renaming a warehouse that is already referenced", async () => {
			mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
			mockPrisma.warehouse.findFirst.mockResolvedValue(null);
			mockPrisma.stockSettings.count.mockResolvedValue(1);
			mockPrisma.itemGroupDefault.count.mockResolvedValue(0);
			mockPrisma.itemReorder.count.mockResolvedValue(0);
			mockPrisma.materialRequest.count.mockResolvedValue(0);
			mockPrisma.materialRequestItem.count.mockResolvedValue(0);
			mockPrisma.stockEntry.count.mockResolvedValue(0);
			mockPrisma.stockEntryItem.count.mockResolvedValue(0);
			mockPrisma.deliveryNote.count.mockResolvedValue(0);
			mockPrisma.deliveryNoteItem.count.mockResolvedValue(0);
			mockPrisma.purchaseReceipt.count.mockResolvedValue(0);
			mockPrisma.purchaseReceiptItem.count.mockResolvedValue(0);
			mockPrisma.pickList.count.mockResolvedValue(0);
			mockPrisma.pickListItem.count.mockResolvedValue(0);

			await expect(
				service.updateWarehouse({
					id: mockWarehouse.id,
					name: "Stores - Dubai",
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("deleteWarehouse", () => {
		it("should delete a warehouse when it is not referenced", async () => {
			mockPrisma.warehouse.findUnique.mockResolvedValue({
				id: mockWarehouse.id,
				name: mockWarehouse.name,
			});
			mockPrisma.warehouse.count.mockResolvedValue(0);
			mockPrisma.stockSettings.count.mockResolvedValue(0);
			mockPrisma.itemGroupDefault.count.mockResolvedValue(0);
			mockPrisma.itemReorder.count.mockResolvedValue(0);
			mockPrisma.materialRequest.count.mockResolvedValue(0);
			mockPrisma.materialRequestItem.count.mockResolvedValue(0);
			mockPrisma.stockEntry.count.mockResolvedValue(0);
			mockPrisma.stockEntryItem.count.mockResolvedValue(0);
			mockPrisma.deliveryNote.count.mockResolvedValue(0);
			mockPrisma.deliveryNoteItem.count.mockResolvedValue(0);
			mockPrisma.purchaseReceipt.count.mockResolvedValue(0);
			mockPrisma.purchaseReceiptItem.count.mockResolvedValue(0);
			mockPrisma.pickList.count.mockResolvedValue(0);
			mockPrisma.pickListItem.count.mockResolvedValue(0);
			mockPrisma.warehouse.delete.mockResolvedValue(mockWarehouse);

			const result = await service.deleteWarehouse(mockWarehouse.id);

			expect(result).toEqual({ success: true, id: mockWarehouse.id });
			expect(mockPrisma.warehouse.delete).toHaveBeenCalledWith({
				where: { id: mockWarehouse.id },
			});
		});

		it("should reject deleting a warehouse with child warehouses", async () => {
			mockPrisma.warehouse.findUnique.mockResolvedValue({
				id: mockWarehouse.id,
				name: mockWarehouse.name,
			});
			mockPrisma.warehouse.count.mockResolvedValueOnce(1);

			await expect(service.deleteWarehouse(mockWarehouse.id)).rejects.toThrow(
				BadRequestException,
			);
		});
	});
});
