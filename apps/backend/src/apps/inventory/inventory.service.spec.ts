import { Inventory } from "@aria/types";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../shared/prisma.service";
import { InventoryService } from "./inventory.service";

describe("InventoryService", () => {
	let service: InventoryService;

	const mockItem = {
		id: "clh1234567890",
		name: "Test Product",
		code: "TEST-CODE",
		quantity: 10,
		description: "Test description",
		disabled: false,
		maintainStock: false,
		allowAlternateItem: false,
		hasVariants: false,
		openingStock: 0,
		valuationRate: null,
		standardSellingRate: null,
		isZeroRated: false,
		isExempt: false,
		isFixedAsset: false,
		taxCode: null,
		shelfLifeInDays: null,
		warrantyPeriodInDays: null,
		endOfLife: null,
		weightPerUnit: null,
		weightUom: null,
		allowNegativeStock: false,
		valuationMethod: null,
		defaultMaterialRequestType: null,
		hasBatchNo: false,
		hasSerialNo: false,
		itemGroupId: null,
		itemGroupName: null,
		defaultUnitOfMeasureId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		barcodes: [],
		reorderSettings: [],
	};

	const mockPrisma = {
		inventoryItem: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
		},
		item: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
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
		$transaction: jest.fn(),
	};

	beforeEach(async () => {
		mockPrisma.$transaction.mockImplementation(
			async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
				callback(mockPrisma),
		);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				InventoryService,
				{ provide: PrismaService, useValue: mockPrisma },
			],
		}).compile();

		service = module.get<InventoryService>(InventoryService);
		jest.clearAllMocks();
	});

	it("should be defined", () => {
		expect(service).toBeDefined();
	});

	describe("findAll", () => {
		it("should return all items", async () => {
			mockPrisma.inventoryItem.findMany.mockResolvedValue([mockItem]);
			const result = await service.findAll();
			expect(result).toEqual([mockItem]);
			expect(mockPrisma.inventoryItem.findMany).toHaveBeenCalledWith({
				orderBy: { createdAt: "desc" },
				include: {
					itemGroup: true,
					barcodes: true,
					reorderSettings: true,
				},
			});
		});
	});

	describe("create", () => {
		it("should create a new item", async () => {
			const input = Inventory.createSchema.parse({
				name: "New Item",
				code: "NEW-CODE",
				quantity: 5,
			});
			mockPrisma.inventoryItem.create.mockResolvedValue(mockItem);

			const result = await service.create(input);
			expect(result).toEqual(mockItem);
			expect(mockPrisma.inventoryItem.create).toHaveBeenCalled();
		});

		it("should throw ConflictException if code exists", async () => {
			const input = Inventory.createSchema.parse({
				name: "Test",
				code: "TEST-CODE",
				quantity: 1,
			});
			const error = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.inventoryItem.create.mockRejectedValue(error);

			await expect(service.create(input)).rejects.toThrow(ConflictException);
		});
	});

	describe("update", () => {
		it("should update an item", async () => {
			const input = { id: mockItem.id, name: "Updated Name" };
			mockPrisma.inventoryItem.findUnique.mockResolvedValue(mockItem);
			mockPrisma.inventoryItem.update.mockResolvedValue({
				...mockItem,
				name: "Updated Name",
			});

			const result = await service.update(input);
			expect(result.name).toBe("Updated Name");
			expect(mockPrisma.inventoryItem.update).toHaveBeenCalled();
		});

		it("should throw NotFoundException if item does not exist", async () => {
			const input = { id: mockItem.id, name: "Test" };
			mockPrisma.inventoryItem.findUnique.mockResolvedValue(null);

			await expect(service.update(input)).rejects.toThrow(NotFoundException);
		});
	});

	describe("delete", () => {
		it("should delete an item", async () => {
			mockPrisma.inventoryItem.delete.mockResolvedValue(mockItem);

			const result = await service.delete(mockItem.id);
			expect(result).toEqual(mockItem);
			expect(mockPrisma.inventoryItem.delete).toHaveBeenCalledWith({
				where: { id: mockItem.id },
				include: {
					itemGroup: true,
					barcodes: true,
					reorderSettings: true,
				},
			});
		});

		it("should throw NotFoundException if item does not exist", async () => {
			const error = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{
					code: "P2025",
					clientVersion: "5.0.0",
				},
			);
			mockPrisma.inventoryItem.delete.mockRejectedValue(error);

			await expect(service.delete(mockItem.id)).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("deleteMany", () => {
		it("should delete multiple items", async () => {
			mockPrisma.inventoryItem.findMany.mockResolvedValue([
				{ id: mockItem.id },
				{ id: "clh1234567891" },
			]);
			mockPrisma.inventoryItem.deleteMany.mockResolvedValue({ count: 2 });

			const result = await service.deleteMany([mockItem.id, "clh1234567891"]);

			expect(result).toEqual({
				success: true,
				count: 2,
				ids: [mockItem.id, "clh1234567891"],
				missingIds: [],
			});
			expect(mockPrisma.inventoryItem.deleteMany).toHaveBeenCalledWith({
				where: {
					id: {
						in: [mockItem.id, "clh1234567891"],
					},
				},
			});
			expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
		});

		it("should report IDs that do not exist", async () => {
			mockPrisma.inventoryItem.findMany.mockResolvedValue([
				{ id: mockItem.id },
			]);
			mockPrisma.inventoryItem.deleteMany.mockResolvedValue({ count: 1 });

			const result = await service.deleteMany([
				mockItem.id,
				"clh9999999999",
				"clh8888888888",
			]);

			expect(result).toEqual({
				success: true,
				count: 1,
				ids: [mockItem.id],
				missingIds: ["clh9999999999", "clh8888888888"],
			});
		});
	});

	describe("findAllProductBundles", () => {
		it("should return all product bundles", async () => {
			const now = new Date();
			mockPrisma.productBundle.findMany.mockResolvedValue([
				{
					id: "bundle-1",
					parentItemId: "item-1",
					description: "Bundle desc",
					disabled: false,
					createdAt: now,
					updatedAt: now,
					parentItem: { id: "item-1", name: "Parent Item" },
					bundleItems: [],
				},
			]);

			const result = await service.findAllProductBundles();
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("bundle-1");
			expect(mockPrisma.productBundle.findMany).toHaveBeenCalled();
		});
	});

	describe("createProductBundle", () => {
		it("should create a product bundle", async () => {
			const now = new Date();
			const input = Inventory.createProductBundleSchema.parse({
				parentItemId: "clh1234567890abcde123456",
				description: "Bundle",
				disabled: false,
				bundleItems: [
					{
						itemId: "clh1234567890abcde123457",
						quantity: 2,
					},
				],
			});

			mockPrisma.item.findUnique.mockResolvedValue({ id: input.parentItemId });
			mockPrisma.item.findMany.mockResolvedValue([
				{ id: input.bundleItems[0].itemId },
			]);
			mockPrisma.productBundle.create.mockResolvedValue({
				id: "bundle-1",
				parentItemId: input.parentItemId,
				description: input.description,
				disabled: false,
				createdAt: now,
				updatedAt: now,
				parentItem: { id: input.parentItemId, name: "Parent Item" },
				bundleItems: [
					{
						id: "bundle-item-1",
						bundleId: "bundle-1",
						itemId: input.bundleItems[0].itemId,
						quantity: 2,
						description: null,
						UnitOfMeasurementId: null,
						createdAt: now,
						updatedAt: now,
						item: { id: input.bundleItems[0].itemId, name: "Item 1" },
						unitOfMeasurement: null,
					},
				],
			});

			const result = await service.createProductBundle(input);
			expect(result.id).toBe("bundle-1");
			expect(mockPrisma.productBundle.create).toHaveBeenCalled();
		});

		it("should throw NotFoundException when parent item does not exist", async () => {
			const input = Inventory.createProductBundleSchema.parse({
				parentItemId: "clh1234567890abcde123456",
				bundleItems: [
					{
						itemId: "clh1234567890abcde123457",
						quantity: 1,
					},
				],
			});
			mockPrisma.item.findUnique.mockResolvedValue(null);

			await expect(service.createProductBundle(input)).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("deleteProductBundle", () => {
		it("should delete a product bundle", async () => {
			mockPrisma.productBundle.delete.mockResolvedValue({
				id: "bundle-1",
			});

			const result = await service.deleteProductBundle("bundle-1");

			expect(result).toEqual({ success: true, id: "bundle-1" });
			expect(mockPrisma.productBundle.delete).toHaveBeenCalledWith({
				where: { id: "bundle-1" },
			});
		});
	});

	describe("findAllShippingRules", () => {
		it("should return all shipping rules", async () => {
			const now = new Date();
			mockPrisma.shippingRule.findMany.mockResolvedValue([
				{
					id: "rule-1",
					shippingRuleLabel: "Standard Shipping",
					shippingRuleType: "SELLING",
					disabled: false,
					calculateBasedOn: "FIXED",
					shippingAmount: 10,
					createdAt: now,
					updatedAt: now,
				},
			]);

			const result = await service.findAllShippingRules();

			expect(result).toHaveLength(1);
			expect(result[0].shippingRuleLabel).toBe("Standard Shipping");
			expect(mockPrisma.shippingRule.findMany).toHaveBeenCalledWith({
				orderBy: { createdAt: "desc" },
			});
		});
	});

	describe("findShippingRuleById", () => {
		it("should return shipping rule when found", async () => {
			const now = new Date();
			mockPrisma.shippingRule.findUnique.mockResolvedValue({
				id: "rule-1",
				shippingRuleLabel: "Standard Shipping",
				shippingRuleType: "SELLING",
				disabled: false,
				calculateBasedOn: "FIXED",
				shippingAmount: 10,
				createdAt: now,
				updatedAt: now,
			});

			const result = await service.findShippingRuleById("rule-1");

			expect(result?.id).toBe("rule-1");
			expect(mockPrisma.shippingRule.findUnique).toHaveBeenCalledWith({
				where: { id: "rule-1" },
			});
		});

		it("should return null when shipping rule is not found", async () => {
			mockPrisma.shippingRule.findUnique.mockResolvedValue(null);

			const result = await service.findShippingRuleById("missing-rule");

			expect(result).toBeNull();
		});
	});

	describe("createShippingRule", () => {
		it("should create a shipping rule", async () => {
			const now = new Date();
			const input = Inventory.createShippingRuleSchema.parse({
				shippingRuleLabel: "Priority Shipping",
				shippingRuleType: "SELLING",
				disabled: false,
				calculateBasedOn: "NET_TOTAL",
				shippingAmount: 25,
			});

			mockPrisma.shippingRule.findFirst.mockResolvedValue(null);
			mockPrisma.shippingRule.create.mockResolvedValue({
				id: "rule-1",
				...input,
				createdAt: now,
				updatedAt: now,
			});

			const result = await service.createShippingRule(input);

			expect(result.id).toBe("rule-1");
			expect(mockPrisma.shippingRule.create).toHaveBeenCalledWith({
				data: {
					shippingRuleLabel: "Priority Shipping",
					shippingRuleType: "SELLING",
					disabled: false,
					calculateBasedOn: "NET_TOTAL",
					shippingAmount: 25,
				},
			});
		});

		it("should throw ConflictException when shipping rule label already exists", async () => {
			const input = Inventory.createShippingRuleSchema.parse({
				shippingRuleLabel: "Priority Shipping",
				shippingRuleType: "SELLING",
				disabled: false,
				calculateBasedOn: "NET_TOTAL",
				shippingAmount: 25,
			});

			mockPrisma.shippingRule.findFirst.mockResolvedValue({ id: "rule-1" });

			await expect(service.createShippingRule(input)).rejects.toThrow(
				ConflictException,
			);
		});
	});

	describe("updateShippingRule", () => {
		it("should update an existing shipping rule", async () => {
			const now = new Date();
			mockPrisma.shippingRule.findFirst.mockResolvedValue(null);
			mockPrisma.shippingRule.update.mockResolvedValue({
				id: "rule-1",
				shippingRuleLabel: "Priority Shipping Updated",
				shippingRuleType: "BUYING",
				disabled: true,
				calculateBasedOn: "FIXED",
				shippingAmount: 30,
				createdAt: now,
				updatedAt: now,
			});

			const result = await service.updateShippingRule({
				id: "rule-1",
				shippingRuleLabel: "Priority Shipping Updated",
				shippingRuleType: "BUYING",
				disabled: true,
				calculateBasedOn: "FIXED",
				shippingAmount: 30,
			});

			expect(result.shippingRuleType).toBe("BUYING");
			expect(mockPrisma.shippingRule.update).toHaveBeenCalledWith({
				where: { id: "rule-1" },
				data: {
					shippingRuleLabel: "Priority Shipping Updated",
					shippingRuleType: "BUYING",
					disabled: true,
					calculateBasedOn: "FIXED",
					shippingAmount: 30,
				},
			});
		});

		it("should throw ConflictException when updating to an existing label", async () => {
			mockPrisma.shippingRule.findFirst.mockResolvedValue({ id: "rule-2" });

			await expect(
				service.updateShippingRule({
					id: "rule-1",
					shippingRuleLabel: "Priority Shipping",
				}),
			).rejects.toThrow(ConflictException);

			expect(mockPrisma.shippingRule.update).not.toHaveBeenCalled();
		});

		it("should throw NotFoundException when shipping rule does not exist", async () => {
			const error = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{
					code: "P2025",
					clientVersion: "5.0.0",
				},
			);
			mockPrisma.shippingRule.findFirst.mockResolvedValue(null);
			mockPrisma.shippingRule.update.mockRejectedValue(error);

			await expect(
				service.updateShippingRule({
					id: "rule-missing",
					shippingRuleLabel: "Missing",
				}),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("deleteShippingRule", () => {
		it("should delete a shipping rule", async () => {
			mockPrisma.shippingRule.delete.mockResolvedValue({ id: "rule-1" });

			const result = await service.deleteShippingRule("rule-1");

			expect(result).toEqual({ success: true, id: "rule-1" });
			expect(mockPrisma.shippingRule.delete).toHaveBeenCalledWith({
				where: { id: "rule-1" },
			});
		});

		it("should throw NotFoundException when shipping rule does not exist", async () => {
			const error = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{
					code: "P2025",
					clientVersion: "5.0.0",
				},
			);
			mockPrisma.shippingRule.delete.mockRejectedValue(error);

			await expect(service.deleteShippingRule("rule-missing")).rejects.toThrow(
				NotFoundException,
			);
		});
	});
});
