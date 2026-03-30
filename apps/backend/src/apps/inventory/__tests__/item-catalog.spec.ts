import {
	BadRequestException,
	ConflictException,
	createTestContext,
	Inventory,
	mockItem,
	mockItemAttribute,
	mockItemAttributeValue,
	NotFoundException,
	Prisma,
} from "./inventory-test-helpers";

describe("InventoryService > Item Catalog", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
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

	describe("findAllItemAttributes", () => {
		it("should return all item attributes with nested values", async () => {
			mockPrisma.itemAttribute.findMany.mockResolvedValue([mockItemAttribute]);

			const result = await service.findAllItemAttributes();

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				id: mockItemAttribute.id,
				name: mockItemAttribute.name,
				disabled: mockItemAttribute.disabled,
				numericValues: mockItemAttribute.numericValues,
				fromRange: 0,
				toRange: 0,
				increment: 0,
			});
			expect(result[0].attributeValues).toHaveLength(1);
			expect(result[0].attributeValues[0]).toMatchObject({
				attributeValue: "Red",
				abbreviation: "R",
			});
		});

		it("should pass the search filter when provided", async () => {
			mockPrisma.itemAttribute.findMany.mockResolvedValue([]);

			await service.findAllItemAttributes("Colour");

			expect(mockPrisma.itemAttribute.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { name: { contains: "Colour", mode: "insensitive" } },
				}),
			);
		});
	});

	describe("findItemAttributeById", () => {
		it("should return an item attribute by id", async () => {
			mockPrisma.itemAttribute.findUnique.mockResolvedValue(mockItemAttribute);

			const result = await service.findItemAttributeById(mockItemAttribute.id);

			expect(result.id).toBe(mockItemAttribute.id);
			expect(result.name).toBe(mockItemAttribute.name);
		});

		it("should throw NotFoundException when id does not exist", async () => {
			mockPrisma.itemAttribute.findUnique.mockResolvedValue(null);

			await expect(service.findItemAttributeById("missing-id")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("createItemAttribute", () => {
		it("should create an item attribute with nested values", async () => {
			mockPrisma.itemAttribute.create.mockResolvedValue(mockItemAttribute);

			const result = await service.createItemAttribute({
				name: "Colour",
				disabled: false,
				numericValues: false,
				fromRange: 0,
				toRange: 0,
				increment: 0,
				attributeValues: [{ attributeValue: "Red", abbreviation: "R" }],
			});

			expect(result.name).toBe("Colour");
			expect(mockPrisma.itemAttribute.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						name: "Colour",
						attributeValues: {
							create: [
								expect.objectContaining({
									attributeValue: "Red",
									abbreviation: "R",
									position: 0,
								}),
							],
						},
					}),
				}),
			);
		});

		it("should create a numeric item attribute with range fields", async () => {
			const numericMock = {
				...mockItemAttribute,
				numericValues: true,
				fromRange: 1,
				toRange: 100,
				increment: 5,
				attributeValues: [],
			};
			mockPrisma.itemAttribute.create.mockResolvedValue(numericMock);

			const result = await service.createItemAttribute({
				name: "Diameter",
				disabled: false,
				numericValues: true,
				fromRange: 1,
				toRange: 100,
				increment: 5,
				attributeValues: [],
			});

			expect(result.numericValues).toBe(true);
			expect(result.fromRange).toBe(1);
			expect(result.toRange).toBe(100);
			expect(result.increment).toBe(5);
			expect(mockPrisma.itemAttribute.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						name: "Diameter",
						numericValues: true,
						fromRange: 1,
						toRange: 100,
						increment: 5,
					}),
				}),
			);
		});

		it("should throw ConflictException on duplicate name (P2002)", async () => {
			const error = new Prisma.PrismaClientKnownRequestError(
				"Unique constraint failed",
				{ code: "P2002", clientVersion: "5.0.0" },
			);
			mockPrisma.itemAttribute.create.mockRejectedValue(error);

			await expect(
				service.createItemAttribute({
					name: "Colour",
					disabled: false,
					numericValues: false,
					fromRange: 0,
					toRange: 0,
					increment: 0,
					attributeValues: [],
				}),
			).rejects.toThrow(ConflictException);
		});
	});

	describe("updateItemAttribute", () => {
		it("should update scalar fields and upsert attribute values", async () => {
			mockPrisma.itemAttribute.findUnique.mockResolvedValue(mockItemAttribute);
			mockPrisma.itemAttribute.update.mockResolvedValue(mockItemAttribute);
			mockPrisma.itemAttributeValue.deleteMany.mockResolvedValue({ count: 0 });
			mockPrisma.itemAttributeValue.update.mockResolvedValue(
				mockItemAttributeValue,
			);
			mockPrisma.itemAttribute.findUniqueOrThrow.mockResolvedValue(
				mockItemAttribute,
			);

			const result = await service.updateItemAttribute({
				id: mockItemAttribute.id,
				name: "Colour",
				attributeValues: [
					{
						id: mockItemAttributeValue.id,
						attributeValue: "Red",
						abbreviation: "R",
					},
				],
			});

			expect(result.id).toBe(mockItemAttribute.id);
			// existing value should be updated, not created
			expect(mockPrisma.itemAttributeValue.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockItemAttributeValue.id },
					data: expect.objectContaining({ attributeValue: "Red" }),
				}),
			);
		});

		it("should create new attribute values when no id is provided", async () => {
			mockPrisma.itemAttribute.findUnique.mockResolvedValue(mockItemAttribute);
			mockPrisma.itemAttribute.update.mockResolvedValue(mockItemAttribute);
			mockPrisma.itemAttributeValue.deleteMany.mockResolvedValue({ count: 0 });
			mockPrisma.itemAttributeValue.create.mockResolvedValue(
				mockItemAttributeValue,
			);
			mockPrisma.itemAttribute.findUniqueOrThrow.mockResolvedValue(
				mockItemAttribute,
			);

			await service.updateItemAttribute({
				id: mockItemAttribute.id,
				attributeValues: [{ attributeValue: "Blue", abbreviation: "B" }],
			});

			expect(mockPrisma.itemAttributeValue.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						attributeValue: "Blue",
						abbreviation: "B",
					}),
				}),
			);
		});

		it("should throw NotFoundException when attribute does not exist", async () => {
			mockPrisma.itemAttribute.findUnique.mockResolvedValue(null);

			await expect(
				service.updateItemAttribute({
					id: "missing-id",
					name: "X",
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("should throw ConflictException on duplicate name (P2002)", async () => {
			mockPrisma.itemAttribute.findUnique.mockResolvedValue(mockItemAttribute);
			const error = new Prisma.PrismaClientKnownRequestError(
				"Unique constraint failed",
				{ code: "P2002", clientVersion: "5.0.0" },
			);
			mockPrisma.itemAttribute.update.mockRejectedValue(error);

			await expect(
				service.updateItemAttribute({
					id: mockItemAttribute.id,
					name: "Colour",
				}),
			).rejects.toThrow(ConflictException);
		});
	});

	describe("deleteItemAttribute", () => {
		it("should delete an item attribute by id", async () => {
			mockPrisma.itemAttribute.delete.mockResolvedValue(mockItemAttribute);

			const result = await service.deleteItemAttribute(mockItemAttribute.id);

			expect(result).toEqual({
				success: true,
				id: mockItemAttribute.id,
			});
			expect(mockPrisma.itemAttribute.delete).toHaveBeenCalledWith({
				where: { id: mockItemAttribute.id },
			});
		});

		it("should throw NotFoundException when item attribute does not exist", async () => {
			const error = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{ code: "P2025", clientVersion: "5.0.0" },
			);
			mockPrisma.itemAttribute.delete.mockRejectedValue(error);

			await expect(service.deleteItemAttribute("missing-id")).rejects.toThrow(
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
});
