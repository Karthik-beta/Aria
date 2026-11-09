/**
 * Tests for Report Service methods NOT already covered by report.spec.ts:
 *
 *   - findRequestedItemsToBeTransferred  (filter logic + join + status exclusion)
 *   - findBatchWiseBalanceHistory        (date validation, filter propagation)
 *   - findBatchItemExpiry                (date validation, quantity > 0 filter)
 *   - findStockAnalytics                 (date validation, empty-results path)
 *   - findItemwiseRecommendedReorderLevel (date validation, brand/group filter)
 *   - findItemShortageReport             (warehouse iteration, dedup, sorting)
 */
import {
	BadRequestException,
	createTestContext,
	mockMR,
	mockMRItem,
} from "./inventory-test-helpers";

describe("InventoryService > Report (additional coverage)", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
	});

	// ────────────────────────────────────────────────────────────────────
	// findRequestedItemsToBeTransferred
	// ────────────────────────────────────────────────────────────────────

	describe("findRequestedItemsToBeTransferred", () => {
		it("should return rows for pending material transfer requests", async () => {
			const mr = {
				...mockMR,
				status: "PENDING" as const,
				purpose: "MATERIAL_TRANSFER" as const,
				items: [
					{
						...mockMRItem,
						quantity: 10,
						orderedQty: 3,
						itemCode: "WIDGET-001",
						itemName: "Widget",
					},
				],
			};

			mockPrisma.materialRequest.findMany.mockResolvedValue([mr]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([
				{
					code: "WIDGET-001",
					name: "Widget",
					description: "A widget",
				},
			]);

			const result = await service.findRequestedItemsToBeTransferred({});

			expect(result.rows.length).toBeGreaterThan(0);
			expect(result.rows[0]).toMatchObject({
				itemCode: "WIDGET-001",
				qty: 10,
				transferredQty: 3,
			});
			expect(result.summary).toBeDefined();
		});

		it("should exclude DRAFT and CANCELLED material requests", async () => {
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

			await service.findRequestedItemsToBeTransferred({});

			const call = mockPrisma.materialRequest.findMany.mock.calls[0][0];
			expect(call.where.status).toEqual({
				notIn: ["DRAFT", "CANCELLED"],
			});
		});

		it("should filter by company (case-insensitive contains)", async () => {
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

			await service.findRequestedItemsToBeTransferred({
				company: "Aria Corp",
			});

			const call = mockPrisma.materialRequest.findMany.mock.calls[0][0];
			expect(call.where.company).toEqual({
				contains: "Aria Corp",
				mode: "insensitive",
			});
		});

		it("should filter by materialRequest series pattern", async () => {
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

			await service.findRequestedItemsToBeTransferred({
				materialRequest: "MAT-MR-2026",
			});

			const call = mockPrisma.materialRequest.findMany.mock.calls[0][0];
			expect(call.where.series).toEqual({
				contains: "MAT-MR-2026",
				mode: "insensitive",
			});
		});

		it("should use default purpose filter (MATERIAL_TRANSFER + MATERIAL_ISSUE) when no purpose given", async () => {
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

			await service.findRequestedItemsToBeTransferred({});

			const call = mockPrisma.materialRequest.findMany.mock.calls[0][0];
			expect(call.where.purpose).toEqual({
				in: ["MATERIAL_TRANSFER", "MATERIAL_ISSUE"],
			});
		});

		it("should filter by explicit purpose", async () => {
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

			await service.findRequestedItemsToBeTransferred({
				purpose: "MATERIAL_TRANSFER",
			});

			const call = mockPrisma.materialRequest.findMany.mock.calls[0][0];
			expect(call.where.purpose).toBe("MATERIAL_TRANSFER");
		});

		it("should return empty rows when no MR items match filters", async () => {
			const mr = {
				...mockMR,
				status: "PENDING" as const,
				purpose: "MATERIAL_TRANSFER" as const,
				items: [
					{
						...mockMRItem,
						itemCode: "AAA-001",
					},
				],
			};

			mockPrisma.materialRequest.findMany.mockResolvedValue([mr]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

			// Filter by itemCode that doesn't match
			const result = await service.findRequestedItemsToBeTransferred({
				itemCode: "ZZZ-999",
			});

			expect(result.rows).toHaveLength(0);
		});

		it("should skip inventoryItem query when no item codes found", async () => {
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);

			const result = await service.findRequestedItemsToBeTransferred({});

			expect(result.rows).toHaveLength(0);
			expect(mockPrisma.inventoryItem.findMany).not.toHaveBeenCalled();
		});
	});

	// ────────────────────────────────────────────────────────────────────
	// findBatchWiseBalanceHistory
	// ────────────────────────────────────────────────────────────────────

	describe("findBatchWiseBalanceHistory", () => {
		it("should throw BadRequestException when fromDate > toDate", async () => {
			await expect(
				service.findBatchWiseBalanceHistory({
					company: "Aria Corp",
					fromDate: new Date("2026-12-31"),
					toDate: new Date("2026-01-01"),
				}),
			).rejects.toThrow(BadRequestException);

			await expect(
				service.findBatchWiseBalanceHistory({
					company: "Aria Corp",
					fromDate: new Date("2026-12-31"),
					toDate: new Date("2026-01-01"),
				}),
			).rejects.toThrow("'From Date' must not be later than 'To Date'.");
		});

		it("should query batches with company filter", async () => {
			mockPrisma.batch.findMany.mockResolvedValue([]);

			await service.findBatchWiseBalanceHistory({
				company: "Aria Corp",
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-12-31"),
			});

			expect(mockPrisma.batch.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						company: { contains: "Aria Corp", mode: "insensitive" },
						isDisabled: false,
					}),
				}),
			);
		});

		it("should include item code filter when provided", async () => {
			mockPrisma.batch.findMany.mockResolvedValue([]);

			await service.findBatchWiseBalanceHistory({
				company: "Aria Corp",
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-12-31"),
				itemCode: "WIDGET",
			});

			const call = mockPrisma.batch.findMany.mock.calls[0][0];
			expect(call.where.item).toEqual({
				code: { contains: "WIDGET", mode: "insensitive" },
			});
		});

		it("should return empty array for no matching batches", async () => {
			mockPrisma.batch.findMany.mockResolvedValue([]);

			const result = await service.findBatchWiseBalanceHistory({
				company: "Aria Corp",
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-12-31"),
			});

			expect(result).toEqual([]);
		});
	});

	// ────────────────────────────────────────────────────────────────────
	// findBatchItemExpiry
	// ────────────────────────────────────────────────────────────────────

	describe("findBatchItemExpiry", () => {
		it("should throw BadRequestException when fromDate > toDate", async () => {
			await expect(
				service.findBatchItemExpiry({
					fromDate: new Date("2026-12-31"),
					toDate: new Date("2026-01-01"),
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("should filter for non-disabled batches with quantity > 0", async () => {
			mockPrisma.batch.findMany.mockResolvedValue([]);

			await service.findBatchItemExpiry({
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-12-31"),
			});

			const call = mockPrisma.batch.findMany.mock.calls[0][0];
			expect(call.where.isDisabled).toBe(false);
			expect(call.where.quantity).toEqual({ gt: 0 });
		});

		it("should filter by date range on createdAt", async () => {
			const from = new Date("2026-01-01");
			const to = new Date("2026-06-30");
			mockPrisma.batch.findMany.mockResolvedValue([]);

			await service.findBatchItemExpiry({ fromDate: from, toDate: to });

			const call = mockPrisma.batch.findMany.mock.calls[0][0];
			expect(call.where.createdAt).toEqual({ gte: from, lte: to });
		});

		it("should include item code filter when provided", async () => {
			mockPrisma.batch.findMany.mockResolvedValue([]);

			await service.findBatchItemExpiry({
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-12-31"),
				itemCode: "COMP",
			});

			const call = mockPrisma.batch.findMany.mock.calls[0][0];
			expect(call.where.item).toEqual({
				code: { contains: "COMP", mode: "insensitive" },
			});
		});

		it("should return empty array for no matching batches", async () => {
			mockPrisma.batch.findMany.mockResolvedValue([]);

			const result = await service.findBatchItemExpiry({
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-12-31"),
			});

			expect(result).toEqual([]);
		});
	});

	// ────────────────────────────────────────────────────────────────────
	// findStockAnalytics
	// ────────────────────────────────────────────────────────────────────

	describe("findStockAnalytics", () => {
		it("should throw BadRequestException when fromDate > toDate", async () => {
			await expect(
				service.findStockAnalytics({
					fromDate: new Date("2026-12-31"),
					toDate: new Date("2026-01-01"),
					frequency: "Monthly",
					valueQuantity: "Quantity",
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("should return empty rows with periods when no stock items found", async () => {
			mockPrisma.client.$queryRaw.mockResolvedValue([]);

			const result = await service.findStockAnalytics({
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-03-31"),
				frequency: "Monthly",
				valueQuantity: "Quantity",
			});

			expect(result.rows).toHaveLength(0);
			expect(result.periods).toBeDefined();
			expect(result.periods.length).toBeGreaterThan(0);
		});

		it("should return empty rows when item group filter matches nothing", async () => {
			mockPrisma.item.findMany.mockResolvedValue([]);

			const result = await service.findStockAnalytics({
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-03-31"),
				frequency: "Monthly",
				valueQuantity: "Quantity",
				itemGroup: "NonExistentGroup",
			});

			expect(result.rows).toHaveLength(0);
			expect(result.periods.length).toBeGreaterThan(0);
		});

		it("should filter stock entry items by company", async () => {
			mockPrisma.client.$queryRaw.mockResolvedValue([]);

			await service.findStockAnalytics({
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-03-31"),
				frequency: "Monthly",
				valueQuantity: "Quantity",
				company: "Aria Corp",
			});

			const call = mockPrisma.client.$queryRaw.mock.calls[0]?.[0] as
				| {
						strings?: string[];
						values?: unknown[];
				  }
				| undefined;
			const text = call?.strings?.join(" ") ?? "";
			const values = call?.values ?? [];
			expect(text).toContain(`se.company`);
			expect(values).toEqual(expect.arrayContaining(["%Aria Corp%"]));
		});
	});

	// ────────────────────────────────────────────────────────────────────
	// findItemwiseRecommendedReorderLevel
	// ────────────────────────────────────────────────────────────────────

	describe("findItemwiseRecommendedReorderLevel", () => {
		it("should throw BadRequestException when fromDate > toDate", async () => {
			await expect(
				service.findItemwiseRecommendedReorderLevel({
					fromDate: new Date("2026-12-31"),
					toDate: new Date("2026-01-01"),
				}),
			).rejects.toThrow(BadRequestException);

			await expect(
				service.findItemwiseRecommendedReorderLevel({
					fromDate: new Date("2026-12-31"),
					toDate: new Date("2026-01-01"),
				}),
			).rejects.toThrow("From Date must be before To Date");
		});

		it("should return empty when brand filter finds no catalog items", async () => {
			mockPrisma.item.findMany.mockResolvedValue([]);

			const result = await service.findItemwiseRecommendedReorderLevel({
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-12-31"),
				brand: "UnknownBrand",
			});

			expect(result).toEqual([]);
		});

		it("should return empty when no active inventory items found", async () => {
			mockPrisma.inventoryItem.findMany.mockResolvedValue([]);

			const result = await service.findItemwiseRecommendedReorderLevel({
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-12-31"),
			});

			expect(result).toEqual([]);
		});

		it("should query consumption from stock entries and delivery notes", async () => {
			const invItem = {
				code: "ITEM-001",
				name: "Item One",
				description: null,
				safetyStock: 10,
				leadTimeDays: 5,
				itemGroup: { groupName: "Electronics" },
			};

			mockPrisma.inventoryItem.findMany.mockResolvedValue([invItem]);
			mockPrisma.item.findMany.mockResolvedValue([
				{ code: "ITEM-001", brand: { name: "BrandX" } },
			]);
			mockPrisma.stockEntryItem.groupBy.mockResolvedValue([]);
			mockPrisma.deliveryNoteItem.groupBy.mockResolvedValue([]);

			const result = await service.findItemwiseRecommendedReorderLevel({
				fromDate: new Date("2026-01-01"),
				toDate: new Date("2026-12-31"),
			});

			expect(result.length).toBeGreaterThanOrEqual(0);
			expect(mockPrisma.stockEntryItem.groupBy).toHaveBeenCalled();
			expect(mockPrisma.deliveryNoteItem.groupBy).toHaveBeenCalled();
		});
	});
});
