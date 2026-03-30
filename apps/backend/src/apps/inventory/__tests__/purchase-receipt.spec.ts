import {
	createTestContext,
	mockPurchaseReceipt,
	mockPurchaseReceiptItem,
	mockPurchaseReceiptTax,
	NotFoundException,
	Prisma,
} from "./inventory-test-helpers";

describe("InventoryService > Purchase Receipt", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
	});

	describe("findAllPurchaseReceipts", () => {
		it("should apply bounded pagination and optional filters", async () => {
			mockPrisma.purchaseReceipt.findMany.mockResolvedValue([
				mockPurchaseReceipt,
			]);

			const result = await service.findAllPurchaseReceipts({
				skip: -5,
				take: 999,
				search: "acme",
				status: "TO_BILL",
			});

			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe(mockPurchaseReceipt.id);
			expect(mockPrisma.purchaseReceipt.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 250,
					where: expect.objectContaining({
						status: "TO_BILL",
						OR: expect.any(Array),
					}),
				}),
			);
		});
	});

	describe("createPurchaseReceipt", () => {
		it("should create a purchase receipt with generated series and computed totals", async () => {
			mockPrisma.purchaseReceipt.findFirst.mockResolvedValue(null);
			mockPrisma.purchaseReceipt.create.mockResolvedValue(mockPurchaseReceipt);

			const result = await service.createPurchaseReceipt({
				supplier: "ACME Supplies",
				company: "Aria Corp",
				items: [{ itemCode: "PRE-ITM-001", acceptedQuantity: 5, rate: 100 }],
				taxes: [{ type: "On Net Total", accountHead: "VAT 5%", taxRate: 5 }],
			});

			expect(result.id).toBe(mockPurchaseReceipt.id);
			const callArgs = mockPrisma.purchaseReceipt.create.mock.calls[0][0] as {
				data: { series: string; totalAmount: number; grandTotal: number };
			};
			expect(callArgs.data.series).toMatch(/^MAT-PRE-\d{4}-\d{5}$/);
			expect(callArgs.data.totalAmount).toBe(500);
			expect(callArgs.data.grandTotal).toBe(525);
		});

		it("should retry once on a series uniqueness conflict and succeed", async () => {
			const conflict = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.purchaseReceipt.findFirst
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(null);
			mockPrisma.purchaseReceipt.create
				.mockRejectedValueOnce(conflict)
				.mockResolvedValueOnce(mockPurchaseReceipt);

			const result = await service.createPurchaseReceipt({
				supplier: "ACME Supplies",
				company: "Aria Corp",
				items: [{ itemCode: "PRE-ITM-001", acceptedQuantity: 5, rate: 100 }],
			});

			expect(result.id).toBe(mockPurchaseReceipt.id);
			expect(mockPrisma.purchaseReceipt.create).toHaveBeenCalledTimes(2);
		});
	});

	describe("updatePurchaseReceipt", () => {
		it("should patch nested items and taxes without replacing unchanged rows", async () => {
			mockPrisma.purchaseReceipt.findUnique.mockResolvedValue({
				id: mockPurchaseReceipt.id,
				isReturn: false,
				disableRoundedTotal: false,
			});
			mockPrisma.purchaseReceipt.update.mockResolvedValue({});
			mockPrisma.purchaseReceiptItem.findMany
				.mockResolvedValueOnce([{ id: mockPurchaseReceiptItem.id }])
				.mockResolvedValueOnce([
					{
						id: mockPurchaseReceiptItem.id,
						acceptedQuantity: 10,
						rejectedQuantity: 0,
						rate: 100,
					},
				]);
			mockPrisma.purchaseReceiptTax.findMany
				.mockResolvedValueOnce([{ id: mockPurchaseReceiptTax.id }])
				.mockResolvedValueOnce([
					{
						id: mockPurchaseReceiptTax.id,
						taxRate: 5,
						amount: 50,
					},
				]);
			mockPrisma.purchaseReceiptItem.deleteMany.mockResolvedValue({ count: 0 });
			mockPrisma.purchaseReceiptTax.deleteMany.mockResolvedValue({ count: 0 });
			mockPrisma.purchaseReceiptItem.update.mockResolvedValue(
				mockPurchaseReceiptItem,
			);
			mockPrisma.purchaseReceiptTax.update.mockResolvedValue(
				mockPurchaseReceiptTax,
			);
			mockPrisma.purchaseReceipt.findUniqueOrThrow.mockResolvedValue(
				mockPurchaseReceipt,
			);

			const result = await service.updatePurchaseReceipt({
				id: mockPurchaseReceipt.id,
				items: [
					{
						id: mockPurchaseReceiptItem.id,
						itemCode: "PRE-ITM-001",
						acceptedQuantity: 10,
						rate: 100,
					},
				],
				taxes: [
					{
						id: mockPurchaseReceiptTax.id,
						type: "On Net Total",
						accountHead: "VAT 5%",
						taxRate: 5,
					},
				],
			});

			expect(result.id).toBe(mockPurchaseReceipt.id);
			expect(mockPrisma.purchaseReceiptItem.deleteMany).toHaveBeenCalledWith({
				where: {
					purchaseReceiptId: mockPurchaseReceipt.id,
					id: { notIn: [mockPurchaseReceiptItem.id] },
				},
			});
			expect(mockPrisma.purchaseReceiptTax.deleteMany).toHaveBeenCalledWith({
				where: {
					purchaseReceiptId: mockPurchaseReceipt.id,
					id: { notIn: [mockPurchaseReceiptTax.id] },
				},
			});
			expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
		});
	});

	describe("deletePurchaseReceipt", () => {
		it("should delete a purchase receipt", async () => {
			mockPrisma.purchaseReceipt.delete.mockResolvedValue({});

			const result = await service.deletePurchaseReceipt(
				mockPurchaseReceipt.id,
			);

			expect(result).toEqual({ success: true, id: mockPurchaseReceipt.id });
			expect(mockPrisma.purchaseReceipt.delete).toHaveBeenCalledWith({
				where: { id: mockPurchaseReceipt.id },
			});
		});

		it("should throw NotFoundException when purchase receipt does not exist", async () => {
			const notFoundError = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{ code: "P2025", clientVersion: "5.0.0" },
			);
			mockPrisma.purchaseReceipt.delete.mockRejectedValue(notFoundError);

			await expect(service.deletePurchaseReceipt("missing-id")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("deleteManyPurchaseReceipts", () => {
		it("should deduplicate ids and bulk-delete purchase receipts", async () => {
			mockPrisma.purchaseReceipt.deleteMany.mockResolvedValue({ count: 1 });

			const result = await service.deleteManyPurchaseReceipts([
				mockPurchaseReceipt.id,
				mockPurchaseReceipt.id,
			]);

			expect(result).toEqual({
				success: true,
				count: 1,
				ids: [mockPurchaseReceipt.id],
			});
			expect(mockPrisma.purchaseReceipt.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: [mockPurchaseReceipt.id] } },
			});
		});
	});
});
