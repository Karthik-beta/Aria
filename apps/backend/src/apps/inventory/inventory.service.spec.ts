import { Inventory } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
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

	const mockUnitOfMeasure = {
		id: "clh123uom0000",
		name: "Nos",
		disabled: false,
		isWholeNumber: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockMRItem = {
		id: "clh123mr_item01",
		materialRequestId: "clh123mr000001",
		itemCode: "ITM-001",
		itemName: "Test Item",
		requiredBy: null as Date | null,
		quantity: 5,
		orderedQty: 0,
		receivedQty: 0,
		targetWarehouse: null as string | null,
		unitOfMeasure: null as string | null,
	};

	const mockMR = {
		id: "clh123mr000001",
		series: "MAT-MR-2026-00001",
		transactionDate: new Date("2026-01-15T00:00:00.000Z"),
		purpose: "PURCHASE" as const,
		company: "Aria Corp",
		requiredBy: null as Date | null,
		status: "DRAFT" as const,
		targetWarehouse: null as string | null,
		terms: null as string | null,
		termsContent: null as string | null,
		letterHead: null as string | null,
		printHeading: null as string | null,
		items: [mockMRItem],
		createdAt: new Date(),
		updatedAt: new Date(),
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
		unitOfMeasurement: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			createMany: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
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
		},
		materialRequestItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
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

	describe("findAllUnitsOfMeasure", () => {
		it("should return all units of measure", async () => {
			mockPrisma.unitOfMeasurement.findMany.mockResolvedValue([
				mockUnitOfMeasure,
			]);

			const result = await service.findAllUnitsOfMeasure();

			expect(result).toEqual([mockUnitOfMeasure]);
			expect(mockPrisma.unitOfMeasurement.findMany).toHaveBeenCalledWith({
				where: undefined,
				select: {
					id: true,
					name: true,
					disabled: true,
					isWholeNumber: true,
					createdAt: true,
					updatedAt: true,
				},
				orderBy: { name: "asc" },
			});
		});
	});

	describe("preloadStandardUnitsOfMeasure", () => {
		const seedEntries = [
			{ name: "Nos", disabled: false, isWholeNumber: true },
			{ name: "Box", disabled: false, isWholeNumber: true },
		];

		it("should insert all seed rows when no UOM exists", async () => {
			mockPrisma.unitOfMeasurement.findMany.mockResolvedValue([]);
			mockPrisma.unitOfMeasurement.createMany.mockResolvedValue({ count: 2 });

			const result = await service.preloadStandardUnitsOfMeasure(seedEntries);

			expect(mockPrisma.unitOfMeasurement.findMany).toHaveBeenCalledWith({
				select: { name: true },
			});
			expect(mockPrisma.unitOfMeasurement.createMany).toHaveBeenCalledWith({
				data: seedEntries,
			});
			expect(result).toEqual({ total: 2, inserted: 2 });
		});

		it("should insert only missing rows when database is partially populated", async () => {
			mockPrisma.unitOfMeasurement.findMany.mockResolvedValue([
				{ name: "nos" },
			]);
			mockPrisma.unitOfMeasurement.createMany.mockResolvedValue({ count: 1 });

			const result = await service.preloadStandardUnitsOfMeasure(seedEntries);

			expect(mockPrisma.unitOfMeasurement.createMany).toHaveBeenCalledWith({
				data: [{ name: "Box", disabled: false, isWholeNumber: true }],
			});
			expect(result).toEqual({ total: 2, inserted: 1 });
		});

		it("should not insert when all rows already exist (case-insensitive)", async () => {
			mockPrisma.unitOfMeasurement.findMany.mockResolvedValue([
				{ name: "nos" },
				{ name: "BOX" },
			]);

			const result = await service.preloadStandardUnitsOfMeasure(seedEntries);

			expect(mockPrisma.unitOfMeasurement.createMany).not.toHaveBeenCalled();
			expect(result).toEqual({ total: 2, inserted: 0 });
		});
	});

	describe("findUnitOfMeasureById", () => {
		it("should return a unit of measure when found", async () => {
			mockPrisma.unitOfMeasurement.findUnique.mockResolvedValue(
				mockUnitOfMeasure,
			);

			const result = await service.findUnitOfMeasureById(mockUnitOfMeasure.id);

			expect(result).toEqual(mockUnitOfMeasure);
		});

		it("should return null when a unit of measure is not found", async () => {
			mockPrisma.unitOfMeasurement.findUnique.mockResolvedValue(null);

			const result = await service.findUnitOfMeasureById("missing-uom");

			expect(result).toBeNull();
		});
	});

	describe("createUnitOfMeasure", () => {
		it("should create a unit of measure", async () => {
			const input = Inventory.createUnitOfMeasureSchema.parse({
				name: "Nos",
			});
			mockPrisma.unitOfMeasurement.findFirst.mockResolvedValue(null);
			mockPrisma.unitOfMeasurement.create.mockResolvedValue(mockUnitOfMeasure);

			const result = await service.createUnitOfMeasure(input);

			expect(result).toEqual(mockUnitOfMeasure);
			expect(mockPrisma.unitOfMeasurement.create).toHaveBeenCalledWith({
				data: {
					name: "Nos",
					disabled: false,
					isWholeNumber: true,
				},
				select: {
					id: true,
					name: true,
					disabled: true,
					isWholeNumber: true,
					createdAt: true,
					updatedAt: true,
				},
			});
		});

		it("should throw ConflictException when name already exists", async () => {
			const input = Inventory.createUnitOfMeasureSchema.parse({
				name: "Nos",
			});
			mockPrisma.unitOfMeasurement.findFirst.mockResolvedValue({
				id: "existing-uom",
			});

			await expect(service.createUnitOfMeasure(input)).rejects.toThrow(
				ConflictException,
			);
		});
	});

	describe("updateUnitOfMeasure", () => {
		it("should update a unit of measure", async () => {
			const input = Inventory.updateUnitOfMeasureSchema.parse({
				id: mockUnitOfMeasure.id,
				name: "Kilogram",
				disabled: true,
				isWholeNumber: false,
			});
			mockPrisma.unitOfMeasurement.findUnique.mockResolvedValue(
				mockUnitOfMeasure,
			);
			mockPrisma.unitOfMeasurement.findFirst.mockResolvedValue(null);
			mockPrisma.unitOfMeasurement.update.mockResolvedValue({
				...mockUnitOfMeasure,
				name: "Kilogram",
				disabled: true,
				isWholeNumber: false,
			});

			const result = await service.updateUnitOfMeasure(input);

			expect(result.name).toBe("Kilogram");
			expect(result.disabled).toBe(true);
			expect(result.isWholeNumber).toBe(false);
		});

		it("should throw NotFoundException when a unit of measure does not exist", async () => {
			mockPrisma.unitOfMeasurement.findUnique.mockResolvedValue(null);

			await expect(
				service.updateUnitOfMeasure({
					id: "missing-uom",
					name: "Kilogram",
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("should throw ConflictException when renaming to an existing unit", async () => {
			mockPrisma.unitOfMeasurement.findUnique.mockResolvedValue(
				mockUnitOfMeasure,
			);
			mockPrisma.unitOfMeasurement.findFirst.mockResolvedValue({
				id: "existing-uom",
			});

			await expect(
				service.updateUnitOfMeasure({
					id: mockUnitOfMeasure.id,
					name: "Box",
				}),
			).rejects.toThrow(ConflictException);
		});

		it("should fall back to a generic conflict message when the name is unavailable", async () => {
			mockPrisma.unitOfMeasurement.findUnique.mockResolvedValue({
				...mockUnitOfMeasure,
				name: undefined,
			} as unknown as typeof mockUnitOfMeasure);
			mockPrisma.unitOfMeasurement.update.mockRejectedValue(
				new Prisma.PrismaClientKnownRequestError("Duplicate", {
					code: "P2002",
					clientVersion: "5.0.0",
				}),
			);

			await expect(
				service.updateUnitOfMeasure({
					id: mockUnitOfMeasure.id,
					disabled: true,
				}),
			).rejects.toThrow("Unit of measure already exists");
		});
	});

	describe("deleteUnitOfMeasure", () => {
		it("should delete a unit of measure", async () => {
			mockPrisma.unitOfMeasurement.delete.mockResolvedValue(mockUnitOfMeasure);

			const result = await service.deleteUnitOfMeasure(mockUnitOfMeasure.id);

			expect(result).toEqual({
				success: true,
				id: mockUnitOfMeasure.id,
			});
			expect(mockPrisma.unitOfMeasurement.delete).toHaveBeenCalledWith({
				where: { id: mockUnitOfMeasure.id },
			});
		});

		it("should throw NotFoundException when a unit of measure does not exist", async () => {
			const error = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{
					code: "P2025",
					clientVersion: "5.0.0",
				},
			);
			mockPrisma.unitOfMeasurement.delete.mockRejectedValue(error);

			await expect(service.deleteUnitOfMeasure("missing-uom")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("findAllItemManufacturers", () => {
		it("should return all item manufacturers", async () => {
			const now = new Date();
			mockPrisma.itemManufacturer.findMany.mockResolvedValue([
				{
					id: "mf-1",
					itemId: "item-1",
					manufacturer: "Apple",
					manufacturerPartNumber: "APL-001",
					isDefault: true,
					createdAt: now,
					updatedAt: now,
					item: {
						id: "item-1",
						code: "01223",
						name: "iPhone 13",
						description: "Phone",
					},
				},
			]);

			const result = await service.findAllItemManufacturers();

			expect(result).toEqual([
				{
					id: "mf-1",
					itemId: "item-1",
					itemCode: "01223",
					itemName: "iPhone 13",
					itemDescription: "Phone",
					manufacturer: "Apple",
					manufacturerPartNumber: "APL-001",
					isDefault: true,
					createdAt: now,
					updatedAt: now,
				},
			]);
			expect(mockPrisma.itemManufacturer.findMany).toHaveBeenCalledWith({
				orderBy: { createdAt: "desc" },
				include: {
					item: {
						select: {
							id: true,
							code: true,
							name: true,
							description: true,
						},
					},
				},
			});
		});
	});

	describe("findItemManufacturerById", () => {
		it("should return item manufacturer when found", async () => {
			const now = new Date();
			mockPrisma.itemManufacturer.findUnique.mockResolvedValue({
				id: "mf-1",
				itemId: "item-1",
				manufacturer: "Apple",
				manufacturerPartNumber: "APL-001",
				isDefault: false,
				createdAt: now,
				updatedAt: now,
				item: {
					id: "item-1",
					code: "01223",
					name: "iPhone 13",
					description: "Phone",
				},
			});

			const result = await service.findItemManufacturerById("mf-1");

			expect(result?.id).toBe("mf-1");
			expect(result?.itemCode).toBe("01223");
		});

		it("should return null when item manufacturer is not found", async () => {
			mockPrisma.itemManufacturer.findUnique.mockResolvedValue(null);

			const result = await service.findItemManufacturerById("missing-mf");

			expect(result).toBeNull();
		});
	});

	describe("createItemManufacturer", () => {
		it("should create an item manufacturer", async () => {
			const now = new Date();
			const input = Inventory.createItemManufacturerSchema.parse({
				itemId: "clh1234567890abcde123450",
				manufacturer: "Apple",
				manufacturerPartNumber: "APL-001",
				isDefault: true,
			});

			mockPrisma.item.findMany.mockResolvedValue([{ id: input.itemId }]);
			mockPrisma.itemManufacturer.updateMany.mockResolvedValue({ count: 1 });
			mockPrisma.itemManufacturer.create.mockResolvedValue({
				id: "mf-1",
				itemId: input.itemId,
				manufacturer: input.manufacturer,
				manufacturerPartNumber: input.manufacturerPartNumber,
				isDefault: true,
				createdAt: now,
				updatedAt: now,
				item: {
					id: input.itemId,
					code: "01223",
					name: "iPhone 13",
					description: "Phone",
				},
			});

			const result = await service.createItemManufacturer(input);

			expect(result.id).toBe("mf-1");
			expect(result.isDefault).toBe(true);
			expect(mockPrisma.itemManufacturer.updateMany).toHaveBeenCalled();
			expect(mockPrisma.itemManufacturer.create).toHaveBeenCalled();
		});

		it("should throw ConflictException when duplicate exists", async () => {
			const input = Inventory.createItemManufacturerSchema.parse({
				itemId: "clh1234567890abcde123450",
				manufacturer: "Apple",
				manufacturerPartNumber: "APL-001",
				isDefault: false,
			});

			mockPrisma.item.findMany.mockResolvedValue([{ id: input.itemId }]);
			const error = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.itemManufacturer.create.mockRejectedValue(error);

			await expect(service.createItemManufacturer(input)).rejects.toThrow(
				ConflictException,
			);
		});

		it("should throw ConflictException with the default manufacturer message when the partial index is violated", async () => {
			const input = Inventory.createItemManufacturerSchema.parse({
				itemId: "clh1234567890abcde123450",
				manufacturer: "Apple",
				manufacturerPartNumber: "APL-002",
				isDefault: true,
			});

			mockPrisma.item.findMany.mockResolvedValue([{ id: input.itemId }]);
			mockPrisma.itemManufacturer.updateMany.mockResolvedValue({ count: 0 });
			const error = new Prisma.PrismaClientKnownRequestError(
				"Default manufacturer already exists",
				{
					code: "P2002",
					clientVersion: "5.0.0",
					meta: { target: ["itemId"] },
				},
			);
			mockPrisma.itemManufacturer.create.mockRejectedValue(error);

			const promise = service.createItemManufacturer(input);
			await expect(promise).rejects.toMatchObject({
				name: ConflictException.name,
				message: "An item can only have one default manufacturer",
			});
		});
	});

	describe("updateItemManufacturer", () => {
		it("should update an item manufacturer", async () => {
			const now = new Date();
			mockPrisma.itemManufacturer.findUnique.mockResolvedValue({
				id: "mf-1",
				itemId: "item-1",
				isDefault: false,
			});
			mockPrisma.itemManufacturer.update.mockResolvedValue({
				id: "mf-1",
				itemId: "item-1",
				manufacturer: "Apple",
				manufacturerPartNumber: "APL-UPDATED",
				isDefault: false,
				createdAt: now,
				updatedAt: now,
				item: {
					id: "item-1",
					code: "01223",
					name: "iPhone 13",
					description: "Phone",
				},
			});

			const result = await service.updateItemManufacturer({
				id: "mf-1",
				manufacturerPartNumber: "APL-UPDATED",
			});

			expect(result.manufacturerPartNumber).toBe("APL-UPDATED");
			expect(mockPrisma.itemManufacturer.update).toHaveBeenCalledWith({
				where: { id: "mf-1" },
				data: {
					manufacturerPartNumber: "APL-UPDATED",
				},
				include: {
					item: {
						select: {
							id: true,
							code: true,
							name: true,
							description: true,
						},
					},
				},
			});
		});

		it("should throw NotFoundException when item manufacturer does not exist", async () => {
			mockPrisma.itemManufacturer.findUnique.mockResolvedValue(null);

			await expect(
				service.updateItemManufacturer({
					id: "missing-mf",
					manufacturerPartNumber: "APL-UPDATED",
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("should throw ConflictException with default manufacturer message when partial index fails", async () => {
			mockPrisma.itemManufacturer.findUnique.mockResolvedValue({
				id: "mf-conflict",
				itemId: "item-conflict",
				isDefault: false,
			});

			mockPrisma.itemManufacturer.updateMany.mockResolvedValue({ count: 1 });
			const error = new Prisma.PrismaClientKnownRequestError(
				"Default manufacturer already exists",
				{
					code: "P2002",
					clientVersion: "5.0.0",
					meta: { target: ["itemId"] },
				},
			);
			mockPrisma.itemManufacturer.update.mockRejectedValue(error);

			const promise = service.updateItemManufacturer({
				id: "mf-conflict",
				isDefault: true,
			});

			await expect(promise).rejects.toMatchObject({
				name: ConflictException.name,
				message: "An item can only have one default manufacturer",
			});
		});
	});

	describe("deleteItemManufacturer", () => {
		it("should delete an item manufacturer", async () => {
			mockPrisma.itemManufacturer.delete.mockResolvedValue({
				id: "mf-1",
			});

			const result = await service.deleteItemManufacturer("mf-1");

			expect(result).toEqual({ success: true, id: "mf-1" });
			expect(mockPrisma.itemManufacturer.delete).toHaveBeenCalledWith({
				where: { id: "mf-1" },
			});
		});

		it("should throw NotFoundException when item manufacturer does not exist", async () => {
			const error = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{
					code: "P2025",
					clientVersion: "5.0.0",
				},
			);
			mockPrisma.itemManufacturer.delete.mockRejectedValue(error);

			await expect(
				service.deleteItemManufacturer("missing-mf"),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("findAllItemAlternatives", () => {
		it("should return all item alternatives", async () => {
			const now = new Date();
			mockPrisma.itemAlternate.findMany.mockResolvedValue([
				{
					id: "alt-1",
					itemId: "item-1",
					alternateItemId: "item-2",
					createdAt: now,
					updatedAt: now,
					item: { id: "item-1", name: "Item One", code: "ITEM-1" },
					alternateItem: { id: "item-2", name: "Item Two", code: "ITEM-2" },
				},
			]);

			const result = await service.findAllItemAlternatives();

			expect(result).toEqual([
				{
					id: "alt-1",
					itemId: "item-1",
					itemCode: "ITEM-1",
					itemName: "Item One",
					alternativeItemId: "item-2",
					alternativeItemCode: "ITEM-2",
					alternativeItemName: "Item Two",
					twoWay: false,
					createdAt: now,
					updatedAt: now,
				},
			]);
			expect(mockPrisma.itemAlternate.findMany).toHaveBeenCalled();
		});

		it("should deduplicate two-way mappings and mark them as two-way", async () => {
			const now = new Date();
			mockPrisma.itemAlternate.findMany.mockResolvedValue([
				{
					id: "alt-reverse",
					itemId: "item-2",
					alternateItemId: "item-1",
					createdAt: now,
					updatedAt: now,
					item: { id: "item-2", name: "Item Two", code: "ITEM-2" },
					alternateItem: { id: "item-1", name: "Item One", code: "ITEM-1" },
				},
				{
					id: "alt-canonical",
					itemId: "item-1",
					alternateItemId: "item-2",
					createdAt: now,
					updatedAt: now,
					item: { id: "item-1", name: "Item One", code: "ITEM-1" },
					alternateItem: { id: "item-2", name: "Item Two", code: "ITEM-2" },
				},
			]);

			const result = await service.findAllItemAlternatives();

			expect(result).toEqual([
				{
					id: "alt-canonical",
					itemId: "item-1",
					itemCode: "ITEM-1",
					itemName: "Item One",
					alternativeItemId: "item-2",
					alternativeItemCode: "ITEM-2",
					alternativeItemName: "Item Two",
					twoWay: true,
					createdAt: now,
					updatedAt: now,
				},
			]);
		});
	});

	describe("findItemAlternativeById", () => {
		it("should return item alternative with two-way flag when reverse exists", async () => {
			const now = new Date();
			mockPrisma.itemAlternate.findUnique
				.mockResolvedValueOnce({
					id: "alt-1",
					itemId: "item-1",
					alternateItemId: "item-2",
					createdAt: now,
					updatedAt: now,
					item: { id: "item-1", name: "Item One", code: "ITEM-1" },
					alternateItem: { id: "item-2", name: "Item Two", code: "ITEM-2" },
				})
				.mockResolvedValueOnce({ id: "alt-2" });

			const result = await service.findItemAlternativeById("alt-1");

			expect(result?.twoWay).toBe(true);
			expect(result?.itemCode).toBe("ITEM-1");
		});

		it("should return null when item alternative does not exist", async () => {
			mockPrisma.itemAlternate.findUnique.mockResolvedValue(null);

			const result = await service.findItemAlternativeById("missing-alt");

			expect(result).toBeNull();
		});
	});

	describe("createItemAlternative", () => {
		it("should create an item alternative", async () => {
			const now = new Date();
			const input = Inventory.createItemAlternativeSchema.parse({
				itemId: "clh1234567890abcde123450",
				alternativeItemId: "clh1234567890abcde123451",
				twoWay: false,
			});

			mockPrisma.item.findMany.mockResolvedValue([
				{ id: input.itemId },
				{ id: input.alternativeItemId },
			]);
			mockPrisma.itemAlternate.findUnique.mockResolvedValue(null);
			mockPrisma.itemAlternate.create.mockResolvedValue({
				id: "alt-1",
				itemId: input.itemId,
				alternateItemId: input.alternativeItemId,
				createdAt: now,
				updatedAt: now,
				item: { id: input.itemId, name: "Item A", code: "ITEM-A" },
				alternateItem: {
					id: input.alternativeItemId,
					name: "Item B",
					code: "ITEM-B",
				},
			});

			const result = await service.createItemAlternative(input);

			expect(result.id).toBe("alt-1");
			expect(result.twoWay).toBe(false);
			expect(mockPrisma.itemAlternate.upsert).not.toHaveBeenCalled();
		});

		it("should create reverse relation when two-way is enabled", async () => {
			const now = new Date();
			const input = Inventory.createItemAlternativeSchema.parse({
				itemId: "clh1234567890abcde123452",
				alternativeItemId: "clh1234567890abcde123453",
				twoWay: true,
			});

			mockPrisma.item.findMany.mockResolvedValue([
				{ id: input.itemId },
				{ id: input.alternativeItemId },
			]);
			mockPrisma.itemAlternate.findUnique
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ id: "alt-2" });
			mockPrisma.itemAlternate.create.mockResolvedValue({
				id: "alt-1",
				itemId: input.itemId,
				alternateItemId: input.alternativeItemId,
				createdAt: now,
				updatedAt: now,
				item: { id: input.itemId, name: "Item A", code: "ITEM-A" },
				alternateItem: {
					id: input.alternativeItemId,
					name: "Item B",
					code: "ITEM-B",
				},
			});
			mockPrisma.itemAlternate.upsert.mockResolvedValue({ id: "alt-2" });

			const result = await service.createItemAlternative(input);

			expect(result.twoWay).toBe(true);
			expect(mockPrisma.itemAlternate.upsert).toHaveBeenCalled();
		});

		it("should return twoWay true when reverse mapping already exists", async () => {
			const now = new Date();
			const input = Inventory.createItemAlternativeSchema.parse({
				itemId: "clh1234567890abcde123452",
				alternativeItemId: "clh1234567890abcde123453",
				twoWay: false,
			});

			mockPrisma.item.findMany.mockResolvedValue([
				{ id: input.itemId },
				{ id: input.alternativeItemId },
			]);
			mockPrisma.itemAlternate.findUnique
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ id: "alt-existing-reverse" });
			mockPrisma.itemAlternate.create.mockResolvedValue({
				id: "alt-1",
				itemId: input.itemId,
				alternateItemId: input.alternativeItemId,
				createdAt: now,
				updatedAt: now,
				item: { id: input.itemId, name: "Item A", code: "ITEM-A" },
				alternateItem: {
					id: input.alternativeItemId,
					name: "Item B",
					code: "ITEM-B",
				},
			});

			const result = await service.createItemAlternative(input);

			expect(result.twoWay).toBe(true);
			expect(mockPrisma.itemAlternate.upsert).not.toHaveBeenCalled();
		});

		it("should throw BadRequestException when item and alternative are the same", async () => {
			await expect(
				service.createItemAlternative({
					itemId: "clh1234567890abcde123454",
					alternativeItemId: "clh1234567890abcde123454",
					twoWay: false,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("should throw ConflictException when pair already exists", async () => {
			const input = Inventory.createItemAlternativeSchema.parse({
				itemId: "clh1234567890abcde123455",
				alternativeItemId: "clh1234567890abcde123456",
				twoWay: false,
			});

			mockPrisma.item.findMany.mockResolvedValue([
				{ id: input.itemId },
				{ id: input.alternativeItemId },
			]);
			mockPrisma.itemAlternate.findUnique.mockResolvedValue({
				id: "alt-existing",
			});

			await expect(service.createItemAlternative(input)).rejects.toThrow(
				ConflictException,
			);
		});
	});

	describe("updateItemAlternative", () => {
		it("should update an item alternative", async () => {
			const now = new Date();
			mockPrisma.itemAlternate.findUnique
				.mockResolvedValueOnce({
					id: "alt-1",
					itemId: "clh1234567890abcde123457",
					alternateItemId: "clh1234567890abcde123458",
				})
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(null);
			mockPrisma.item.findMany.mockResolvedValue([
				{ id: "clh1234567890abcde123459" },
				{ id: "clh1234567890abcde123460" },
			]);
			mockPrisma.itemAlternate.update.mockResolvedValue({
				id: "alt-1",
				itemId: "clh1234567890abcde123459",
				alternateItemId: "clh1234567890abcde123460",
				createdAt: now,
				updatedAt: now,
				item: {
					id: "clh1234567890abcde123459",
					name: "Item C",
					code: "ITEM-C",
				},
				alternateItem: {
					id: "clh1234567890abcde123460",
					name: "Item D",
					code: "ITEM-D",
				},
			});

			const result = await service.updateItemAlternative({
				id: "alt-1",
				itemId: "clh1234567890abcde123459",
				alternativeItemId: "clh1234567890abcde123460",
				twoWay: false,
			});

			expect(result.itemCode).toBe("ITEM-C");
			expect(result.twoWay).toBe(false);
			expect(mockPrisma.itemAlternate.deleteMany).toHaveBeenNthCalledWith(1, {
				where: {
					itemId: "clh1234567890abcde123458",
					alternateItemId: "clh1234567890abcde123457",
				},
			});
			expect(mockPrisma.itemAlternate.deleteMany).toHaveBeenNthCalledWith(2, {
				where: {
					itemId: "clh1234567890abcde123460",
					alternateItemId: "clh1234567890abcde123459",
				},
			});
		});

		it("should remove stale reverse mapping when pair changes and two-way is enabled", async () => {
			const now = new Date();
			mockPrisma.itemAlternate.findUnique
				.mockResolvedValueOnce({
					id: "alt-1",
					itemId: "clh1234567890abcde123461",
					alternateItemId: "clh1234567890abcde123462",
				})
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce({ id: "reverse-1" });
			mockPrisma.item.findMany.mockResolvedValue([
				{ id: "clh1234567890abcde123465" },
				{ id: "clh1234567890abcde123466" },
			]);
			mockPrisma.itemAlternate.update.mockResolvedValue({
				id: "alt-1",
				itemId: "clh1234567890abcde123465",
				alternateItemId: "clh1234567890abcde123466",
				createdAt: now,
				updatedAt: now,
				item: {
					id: "clh1234567890abcde123465",
					name: "Item E",
					code: "ITEM-E",
				},
				alternateItem: {
					id: "clh1234567890abcde123466",
					name: "Item F",
					code: "ITEM-F",
				},
			});
			mockPrisma.itemAlternate.upsert.mockResolvedValue({ id: "reverse-1" });

			const result = await service.updateItemAlternative({
				id: "alt-1",
				itemId: "clh1234567890abcde123465",
				alternativeItemId: "clh1234567890abcde123466",
				twoWay: true,
			});

			expect(result.twoWay).toBe(true);
			expect(mockPrisma.itemAlternate.upsert).toHaveBeenCalled();
			expect(mockPrisma.itemAlternate.deleteMany).toHaveBeenCalledWith({
				where: {
					itemId: "clh1234567890abcde123462",
					alternateItemId: "clh1234567890abcde123461",
				},
			});
		});

		it("should throw NotFoundException when item alternative does not exist", async () => {
			mockPrisma.itemAlternate.findUnique.mockResolvedValue(null);

			await expect(
				service.updateItemAlternative({
					id: "missing-alt",
					twoWay: false,
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("should throw BadRequestException for same item pair", async () => {
			mockPrisma.itemAlternate.findUnique.mockResolvedValue({
				id: "alt-1",
				itemId: "clh1234567890abcde123463",
				alternateItemId: "clh1234567890abcde123464",
			});

			await expect(
				service.updateItemAlternative({
					id: "alt-1",
					itemId: "clh1234567890abcde123463",
					alternativeItemId: "clh1234567890abcde123463",
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("deleteItemAlternative", () => {
		it("should delete an item alternative", async () => {
			mockPrisma.itemAlternate.findUnique.mockResolvedValue({
				itemId: "clh1234567890abcde123467",
				alternateItemId: "clh1234567890abcde123468",
			});
			mockPrisma.itemAlternate.deleteMany.mockResolvedValue({ count: 2 });

			const result = await service.deleteItemAlternative("alt-1");

			expect(result).toEqual({ success: true, id: "alt-1" });
			expect(mockPrisma.itemAlternate.deleteMany).toHaveBeenCalledWith({
				where: {
					OR: [
						{
							itemId: "clh1234567890abcde123467",
							alternateItemId: "clh1234567890abcde123468",
						},
						{
							itemId: "clh1234567890abcde123468",
							alternateItemId: "clh1234567890abcde123467",
						},
					],
				},
			});
		});

		it("should throw NotFoundException when item alternative does not exist", async () => {
			mockPrisma.itemAlternate.findUnique.mockResolvedValue(null);

			await expect(
				service.deleteItemAlternative("missing-alt"),
			).rejects.toThrow(NotFoundException);
		});
	});

	// ─── MaterialRequests ────────────────────────────────────────────────────────

	describe("findAllMaterialRequests", () => {
		it("should return all material requests ordered by createdAt desc", async () => {
			mockPrisma.materialRequest.findMany.mockResolvedValue([mockMR]);

			const result = await service.findAllMaterialRequests();

			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe(mockMR.id);
			expect(result[0]?.series).toBe(mockMR.series);
			expect(mockPrisma.materialRequest.findMany).toHaveBeenCalledWith({
				orderBy: { createdAt: "desc" },
				include: { items: true },
				take: 250,
			});
		});

		it("should return an empty array when no requests exist", async () => {
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);

			const result = await service.findAllMaterialRequests();

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
});
