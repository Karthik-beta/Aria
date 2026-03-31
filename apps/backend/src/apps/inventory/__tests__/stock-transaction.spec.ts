import {
	BadRequestException,
	createTestContext,
	type Inventory,
	mockMR,
	mockMRItem,
	mockStockEntry,
	mockStockEntryItem,
	NotFoundException,
	Prisma,
} from "./inventory-test-helpers";

describe("InventoryService > Stock Transaction", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
	});

	describe("findAllMaterialRequests", () => {
		it("should return all material requests ordered by createdAt desc", async () => {
			mockPrisma.materialRequest.findMany.mockResolvedValue([mockMR]);

			const result = await service.findAllMaterialRequests({});

			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe(mockMR.id);
			expect(result[0]?.series).toBe(mockMR.series);
			expect(mockPrisma.materialRequest.findMany).toHaveBeenCalledWith({
				where: {},
				orderBy: { createdAt: "desc" },
				include: { items: true },
				skip: 0,
				take: 250,
			});
		});

		it("should return an empty array when no requests exist", async () => {
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);

			const result = await service.findAllMaterialRequests({});

			expect(result).toEqual([]);
		});
	});

	describe("findMaterialRequestById", () => {
		it("should return a material request when found", async () => {
			mockPrisma.materialRequest.findUnique.mockResolvedValue(mockMR);

			const result = await service.findMaterialRequestById(mockMR.id);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(mockMR.id);
			expect(mockPrisma.materialRequest.findUnique).toHaveBeenCalledWith({
				where: { id: mockMR.id },
				include: { items: true },
			});
		});

		it("should return null when the material request is not found", async () => {
			mockPrisma.materialRequest.findUnique.mockResolvedValue(null);

			const result = await service.findMaterialRequestById("nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("createMaterialRequest", () => {
		const createInput: Inventory.CreateMaterialRequestInput = {
			company: "Aria Corp",
			purpose: "PURCHASE",
			items: [{ itemCode: "ITM-001", itemName: "Test Item", quantity: 5 }],
		};

		it("should create a material request with a generated series", async () => {
			mockPrisma.materialRequest.findFirst.mockResolvedValue(null);
			mockPrisma.materialRequest.create.mockResolvedValue(mockMR);

			const result = await service.createMaterialRequest(createInput);

			expect(result.id).toBe(mockMR.id);
			expect(mockPrisma.materialRequest.create).toHaveBeenCalledTimes(1);
			const callArgs = mockPrisma.materialRequest.create.mock.calls[0][0] as {
				data: { series: string; status: string };
			};
			expect(callArgs.data.series).toMatch(/^MAT-MR-\d{4}-\d{5}$/);
			expect(callArgs.data.status).toBe("DRAFT");
		});

		it("should increment series number based on the last existing series", async () => {
			mockPrisma.materialRequest.findFirst.mockResolvedValue({
				series: "MAT-MR-2026-00003",
			});
			mockPrisma.materialRequest.create.mockResolvedValue(mockMR);

			await service.createMaterialRequest(createInput);

			const callArgs = mockPrisma.materialRequest.create.mock.calls[0][0] as {
				data: { series: string };
			};
			expect(callArgs.data.series).toBe("MAT-MR-2026-00004");
		});

		it("should retry once on a series uniqueness conflict and succeed", async () => {
			const p2002 = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.materialRequest.findFirst
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(null);
			mockPrisma.materialRequest.create
				.mockRejectedValueOnce(p2002)
				.mockResolvedValueOnce(mockMR);

			const result = await service.createMaterialRequest(createInput);

			expect(result.id).toBe(mockMR.id);
			expect(mockPrisma.materialRequest.create).toHaveBeenCalledTimes(2);
		});

		it("should throw after 3 consecutive series conflicts (P2002)", async () => {
			const p2002 = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.materialRequest.findFirst.mockResolvedValue(null);
			mockPrisma.materialRequest.create.mockRejectedValue(p2002);

			await expect(
				service.createMaterialRequest(createInput),
			).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
			expect(mockPrisma.materialRequest.create).toHaveBeenCalledTimes(3);
		});
	});

	describe("updateMaterialRequest", () => {
		it("should throw NotFoundException when the material request does not exist", async () => {
			mockPrisma.materialRequest.findUnique.mockResolvedValue(null);

			await expect(
				service.updateMaterialRequest({ id: "nonexistent", company: "Corp" }),
			).rejects.toThrow(NotFoundException);
		});

		it("should update header fields and items in a transaction", async () => {
			mockPrisma.materialRequest.findUnique.mockResolvedValue({
				id: mockMR.id,
			});
			mockPrisma.materialRequestItem.findMany.mockResolvedValue([
				{ id: mockMRItem.id },
			]);
			mockPrisma.materialRequest.update.mockResolvedValue({});
			mockPrisma.materialRequestItem.deleteMany.mockResolvedValue({ count: 0 });
			mockPrisma.materialRequestItem.update.mockResolvedValue(mockMRItem);
			mockPrisma.materialRequest.findUniqueOrThrow.mockResolvedValue(mockMR);

			const result = await service.updateMaterialRequest({
				id: mockMR.id,
				company: "Updated Corp",
				items: [{ id: mockMRItem.id, itemCode: "ITM-001", quantity: 10 }],
			});

			expect(result.id).toBe(mockMR.id);
			expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
			expect(mockPrisma.materialRequest.update).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: mockMR.id } }),
			);
			expect(mockPrisma.materialRequestItem.deleteMany).toHaveBeenCalledWith({
				where: {
					materialRequestId: mockMR.id,
					id: { notIn: [mockMRItem.id] },
				},
			});
			expect(mockPrisma.materialRequestItem.update).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: mockMRItem.id } }),
			);
		});

		it("should reject item ids that belong to a different material request", async () => {
			mockPrisma.materialRequest.findUnique.mockResolvedValue({
				id: mockMR.id,
			});
			mockPrisma.materialRequestItem.findMany.mockResolvedValue([]);
			mockPrisma.materialRequest.update.mockResolvedValue({});
			mockPrisma.materialRequest.findUniqueOrThrow.mockResolvedValue(mockMR);

			await expect(
				service.updateMaterialRequest({
					id: mockMR.id,
					items: [{ id: "foreign-item-id", itemCode: "ITM-001", quantity: 1 }],
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("should create new items that have no id", async () => {
			mockPrisma.materialRequest.findUnique.mockResolvedValue({
				id: mockMR.id,
			});
			mockPrisma.materialRequestItem.findMany.mockResolvedValue([]);
			mockPrisma.materialRequest.update.mockResolvedValue({});
			mockPrisma.materialRequestItem.deleteMany.mockResolvedValue({ count: 0 });
			mockPrisma.materialRequestItem.create.mockResolvedValue(mockMRItem);
			mockPrisma.materialRequest.findUniqueOrThrow.mockResolvedValue(mockMR);

			await service.updateMaterialRequest({
				id: mockMR.id,
				items: [{ itemCode: "NEW-001", quantity: 3 }],
			});

			expect(mockPrisma.materialRequestItem.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						materialRequestId: mockMR.id,
						itemCode: "NEW-001",
					}),
				}),
			);
		});
	});

	describe("deleteMaterialRequest", () => {
		it("should delete the material request and return success", async () => {
			mockPrisma.materialRequest.delete.mockResolvedValue({});

			const result = await service.deleteMaterialRequest(mockMR.id);

			expect(result).toEqual({ success: true, id: mockMR.id });
			expect(mockPrisma.materialRequest.delete).toHaveBeenCalledWith({
				where: { id: mockMR.id },
			});
		});

		it("should throw NotFoundException when the record does not exist", async () => {
			const p2025 = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{ code: "P2025", clientVersion: "5.0.0" },
			);
			mockPrisma.materialRequest.delete.mockRejectedValue(p2025);

			await expect(
				service.deleteMaterialRequest("nonexistent"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("deleteManyMaterialRequests", () => {
		it("should bulk-delete and return the count", async () => {
			const ids = [mockMR.id, "clh123mr000002"];
			mockPrisma.materialRequest.deleteMany.mockResolvedValue({ count: 2 });

			const result = await service.deleteManyMaterialRequests(ids);

			expect(result).toEqual({ success: true, count: 2, ids });
			expect(mockPrisma.materialRequest.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: ids } },
			});
		});

		it("should deduplicate ids before deleting", async () => {
			const id = mockMR.id;
			mockPrisma.materialRequest.deleteMany.mockResolvedValue({ count: 1 });

			const result = await service.deleteManyMaterialRequests([id, id]);

			expect(result.ids).toEqual([id]);
			expect(mockPrisma.materialRequest.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: [id] } },
			});
		});

		it("should re-throw Prisma errors after logging", async () => {
			const dbError = new Prisma.PrismaClientKnownRequestError(
				"Foreign key constraint",
				{ code: "P2003", clientVersion: "5.0.0" },
			);
			mockPrisma.materialRequest.deleteMany.mockRejectedValue(dbError);

			await expect(
				service.deleteManyMaterialRequests([mockMR.id]),
			).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
		});
	});

	describe("findAllStockEntries", () => {
		it("should return all stock entries ordered by createdAt desc", async () => {
			mockPrisma.stockEntry.findMany.mockResolvedValue([mockStockEntry]);

			const result = await service.findAllStockEntries({});

			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe(mockStockEntry.id);
			expect(result[0]?.series).toBe(mockStockEntry.series);
			expect(mockPrisma.stockEntry.findMany).toHaveBeenCalledWith({
				where: {},
				orderBy: { createdAt: "desc" },
				include: { items: true },
				skip: 0,
				take: 250,
			});
		});

		it("should return an empty array when no entries exist", async () => {
			mockPrisma.stockEntry.findMany.mockResolvedValue([]);

			const result = await service.findAllStockEntries({});

			expect(result).toEqual([]);
		});
	});

	describe("findStockEntryById", () => {
		it("should return a stock entry when found", async () => {
			mockPrisma.stockEntry.findUnique.mockResolvedValue(mockStockEntry);

			const result = await service.findStockEntryById(mockStockEntry.id);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(mockStockEntry.id);
			expect(mockPrisma.stockEntry.findUnique).toHaveBeenCalledWith({
				where: { id: mockStockEntry.id },
				include: { items: true },
			});
		});

		it("should return null when the stock entry is not found", async () => {
			mockPrisma.stockEntry.findUnique.mockResolvedValue(null);

			const result = await service.findStockEntryById("nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("createStockEntry", () => {
		const createInput: Inventory.CreateStockEntryInput = {
			stockEntryType: "MATERIAL_RECEIPT",
			company: "Aria Corp",
			items: [{ itemCode: "STE-ITM-001", qty: 10, basicRate: 100 }],
		};

		it("should create a stock entry with a generated series", async () => {
			mockPrisma.stockEntry.findFirst.mockResolvedValue(null);
			mockPrisma.stockEntry.create.mockResolvedValue(mockStockEntry);

			const result = await service.createStockEntry(createInput);

			expect(result.id).toBe(mockStockEntry.id);
			expect(mockPrisma.stockEntry.create).toHaveBeenCalledTimes(1);
			const callArgs = mockPrisma.stockEntry.create.mock.calls[0][0] as {
				data: { series: string; status: string };
			};
			expect(callArgs.data.series).toMatch(/^MAT-STE-\d{4}-\d{5}$/);
			expect(callArgs.data.status).toBe("DRAFT");
		});

		it("should increment series based on the last existing series", async () => {
			mockPrisma.stockEntry.findFirst.mockResolvedValue({
				series: "MAT-STE-2026-00003",
			});
			mockPrisma.stockEntry.create.mockResolvedValue(mockStockEntry);

			await service.createStockEntry(createInput);

			const callArgs = mockPrisma.stockEntry.create.mock.calls[0][0] as {
				data: { series: string };
			};
			expect(callArgs.data.series).toBe("MAT-STE-2026-00004");
		});

		it("should retry once on a series uniqueness conflict and succeed", async () => {
			const p2002 = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.stockEntry.findFirst
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(null);
			mockPrisma.stockEntry.create
				.mockRejectedValueOnce(p2002)
				.mockResolvedValueOnce(mockStockEntry);

			const result = await service.createStockEntry(createInput);

			expect(result.id).toBe(mockStockEntry.id);
			expect(mockPrisma.stockEntry.create).toHaveBeenCalledTimes(2);
		});

		it("should throw after 3 consecutive series conflicts (P2002)", async () => {
			const p2002 = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.stockEntry.findFirst.mockResolvedValue(null);
			mockPrisma.stockEntry.create.mockRejectedValue(p2002);

			await expect(
				service.createStockEntry(createInput),
			).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
			expect(mockPrisma.stockEntry.create).toHaveBeenCalledTimes(3);
		});
	});

	describe("updateStockEntry", () => {
		it("should throw NotFoundException when the stock entry does not exist", async () => {
			mockPrisma.stockEntry.findUnique.mockResolvedValue(null);

			await expect(
				service.updateStockEntry({ id: "nonexistent", company: "Corp" }),
			).rejects.toThrow(NotFoundException);
		});

		it("should update header fields and items in a transaction", async () => {
			mockPrisma.stockEntry.findUnique.mockResolvedValue({
				id: mockStockEntry.id,
			});
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([
				{ id: mockStockEntryItem.id },
			]);
			mockPrisma.stockEntry.update.mockResolvedValue({});
			mockPrisma.stockEntryItem.deleteMany.mockResolvedValue({ count: 0 });
			mockPrisma.stockEntryItem.update.mockResolvedValue(mockStockEntryItem);
			mockPrisma.stockEntry.findUniqueOrThrow.mockResolvedValue(mockStockEntry);

			const result = await service.updateStockEntry({
				id: mockStockEntry.id,
				company: "Updated Corp",
				items: [
					{ id: mockStockEntryItem.id, itemCode: "STE-ITM-001", qty: 20 },
				],
			});

			expect(result.id).toBe(mockStockEntry.id);
			expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
			expect(mockPrisma.stockEntry.update).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: mockStockEntry.id } }),
			);
			expect(mockPrisma.stockEntryItem.deleteMany).toHaveBeenCalledWith({
				where: {
					stockEntryId: mockStockEntry.id,
					id: { notIn: [mockStockEntryItem.id] },
				},
			});
			expect(mockPrisma.stockEntryItem.update).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: mockStockEntryItem.id } }),
			);
		});

		it("should reject item ids that belong to a different stock entry", async () => {
			mockPrisma.stockEntry.findUnique.mockResolvedValue({
				id: mockStockEntry.id,
			});
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([]);
			mockPrisma.stockEntry.update.mockResolvedValue({});
			mockPrisma.stockEntry.findUniqueOrThrow.mockResolvedValue(mockStockEntry);

			await expect(
				service.updateStockEntry({
					id: mockStockEntry.id,
					items: [{ id: "foreign-item-id", itemCode: "STE-ITM-001", qty: 1 }],
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("should create new items that have no id", async () => {
			mockPrisma.stockEntry.findUnique.mockResolvedValue({
				id: mockStockEntry.id,
			});
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([]);
			mockPrisma.stockEntry.update.mockResolvedValue({});
			mockPrisma.stockEntryItem.deleteMany.mockResolvedValue({ count: 0 });
			mockPrisma.stockEntryItem.create.mockResolvedValue(mockStockEntryItem);
			mockPrisma.stockEntry.findUniqueOrThrow.mockResolvedValue(mockStockEntry);

			await service.updateStockEntry({
				id: mockStockEntry.id,
				items: [{ itemCode: "NEW-STE-001", qty: 5 }],
			});

			expect(mockPrisma.stockEntryItem.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						stockEntryId: mockStockEntry.id,
						itemCode: "NEW-STE-001",
					}),
				}),
			);
		});
	});

	describe("deleteStockEntry", () => {
		it("should delete the stock entry and return success", async () => {
			mockPrisma.stockEntry.delete.mockResolvedValue({});

			const result = await service.deleteStockEntry(mockStockEntry.id);

			expect(result).toEqual({ success: true, id: mockStockEntry.id });
			expect(mockPrisma.stockEntry.delete).toHaveBeenCalledWith({
				where: { id: mockStockEntry.id },
			});
		});

		it("should throw NotFoundException when the record does not exist", async () => {
			const p2025 = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{ code: "P2025", clientVersion: "5.0.0" },
			);
			mockPrisma.stockEntry.delete.mockRejectedValue(p2025);

			await expect(service.deleteStockEntry("nonexistent")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("deleteManyStockEntries", () => {
		it("should bulk-delete and return the count", async () => {
			const ids = [mockStockEntry.id, "clh123ste000002"];
			mockPrisma.stockEntry.deleteMany.mockResolvedValue({ count: 2 });

			const result = await service.deleteManyStockEntries(ids);

			expect(result).toEqual({ success: true, count: 2, ids });
			expect(mockPrisma.stockEntry.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: ids } },
			});
		});

		it("should deduplicate ids before deleting", async () => {
			const id = mockStockEntry.id;
			mockPrisma.stockEntry.deleteMany.mockResolvedValue({ count: 1 });

			const result = await service.deleteManyStockEntries([id, id]);

			expect(result.ids).toEqual([id]);
			expect(mockPrisma.stockEntry.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: [id] } },
			});
		});

		it("should re-throw Prisma errors after logging", async () => {
			const dbError = new Prisma.PrismaClientKnownRequestError(
				"Foreign key constraint",
				{ code: "P2003", clientVersion: "5.0.0" },
			);
			mockPrisma.stockEntry.deleteMany.mockRejectedValue(dbError);

			await expect(
				service.deleteManyStockEntries([mockStockEntry.id]),
			).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
		});
	});
});
