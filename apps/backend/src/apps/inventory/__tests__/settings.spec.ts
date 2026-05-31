import {
	BadRequestException,
	createTestContext,
	Inventory,
	mockItemVariantSettings,
	mockStockSettings,
	mockStockSettingsInput,
} from "./inventory-test-helpers";

describe("InventoryService > Settings", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
	});

	describe("findStockSettings", () => {
		it("should return the existing singleton stock settings", async () => {
			mockPrisma.stockSettings.findUnique.mockResolvedValue(mockStockSettings);

			const result = await service.findStockSettings();

			expect(result).toEqual(mockStockSettings);
			expect(mockPrisma.stockSettings.findUnique).toHaveBeenCalledWith({
				where: { singletonKey: "default" },
				select: expect.objectContaining({
					id: true,
					itemNamingBy: true,
					defaultStockUom: true,
					freezeStocksOlderThanDays: true,
				}),
			});
			expect(mockPrisma.stockSettings.upsert).not.toHaveBeenCalled();
		});

		it("should create the singleton stock settings when missing", async () => {
			mockPrisma.stockSettings.findUnique.mockResolvedValue(null);
			mockPrisma.stockSettings.upsert.mockResolvedValue(mockStockSettings);

			const result = await service.findStockSettings();

			expect(result.id).toBe(mockStockSettings.id);
			expect(mockPrisma.stockSettings.upsert).toHaveBeenCalledWith({
				where: { singletonKey: "default" },
				update: {},
				create: { singletonKey: "default" },
				select: expect.objectContaining({
					id: true,
					itemNamingBy: true,
					defaultStockUom: true,
					freezeStocksOlderThanDays: true,
				}),
			});
		});
	});

	describe("findItemVariantSettings", () => {
		it("should return the existing singleton item variant settings", async () => {
			mockPrisma.itemVariantSettings.findUnique.mockResolvedValue(
				mockItemVariantSettings,
			);

			const result = await service.findItemVariantSettings();

			expect(result).toEqual({
				id: mockItemVariantSettings.id,
				doNotUpdateVariantsOnSave: false,
				allowRenameAttributeValue: true,
				copyFields: [
					{
						id: "clh123variantfield0001",
						fieldKey: "description",
						label: "Details",
						category: "Basics",
						itemProperty: "description",
						position: 0,
					},
				],
				createdAt: mockItemVariantSettings.createdAt,
				updatedAt: mockItemVariantSettings.updatedAt,
			});
			expect(mockPrisma.itemVariantSettings.findUnique).toHaveBeenCalledWith({
				where: { singletonKey: "default" },
				select: expect.objectContaining({
					id: true,
					doNotUpdateVariantsOnSave: true,
					copyFields: expect.any(Object),
				}),
			});
		});

		it("should create the singleton item variant settings when missing", async () => {
			mockPrisma.itemVariantSettings.findUnique.mockResolvedValue(null);
			mockPrisma.itemVariantSettings.upsert.mockResolvedValue({
				...mockItemVariantSettings,
				copyFields: [],
			});

			const result = await service.findItemVariantSettings();

			expect(result.copyFields).toEqual([]);
			expect(mockPrisma.itemVariantSettings.upsert).toHaveBeenCalledWith({
				where: { singletonKey: "default" },
				update: {},
				create: { singletonKey: "default" },
				select: expect.objectContaining({
					id: true,
					copyFields: expect.any(Object),
				}),
			});
		});
	});

	describe("updateItemVariantSettings", () => {
		it("should patch copy field rows without recreating preserved rows", async () => {
			const existingFields = [
				{
					id: "clh123variantfield0001",
					settingsId: mockItemVariantSettings.id,
					fieldKey: "description",
					position: 0,
				},
				{
					id: "clh123variantfield0002",
					settingsId: mockItemVariantSettings.id,
					fieldKey: "disabled",
					position: 1,
				},
			];

			mockPrisma.itemVariantSettings.upsert.mockResolvedValue({
				id: mockItemVariantSettings.id,
			});
			mockPrisma.itemVariantSettingsField.findMany.mockResolvedValue(
				existingFields,
			);
			mockPrisma.itemVariantSettingsField.deleteMany.mockResolvedValue({
				count: 1,
			});
			mockPrisma.itemVariantSettings.findUniqueOrThrow.mockResolvedValue({
				...mockItemVariantSettings,
				copyFields: [
					{
						id: "clh123variantfield0001",
						fieldKey: "description",
						position: 0,
					},
					{
						id: "clh123variantfield0003",
						fieldKey: "stock_uom",
						position: 1,
					},
				],
			});

			const result = await service.updateItemVariantSettings({
				doNotUpdateVariantsOnSave: true,
				allowRenameAttributeValue: false,
				copyFields: [
					{
						id: "clh123variantfield0001",
						fieldKey: "description",
					},
					{
						fieldKey: "stock_uom",
					},
				],
			});

			expect(mockPrisma.itemVariantSettingsField.update).toHaveBeenCalledWith({
				where: { id: "clh123variantfield0001" },
				data: { fieldKey: "description", position: 0 },
			});
			expect(mockPrisma.itemVariantSettingsField.create).toHaveBeenCalledWith({
				data: {
					settingsId: mockItemVariantSettings.id,
					fieldKey: "stock_uom",
					position: 1,
				},
			});
			expect(
				mockPrisma.itemVariantSettingsField.deleteMany,
			).toHaveBeenCalledWith({
				where: {
					settingsId: mockItemVariantSettings.id,
					id: { in: ["clh123variantfield0002"] },
				},
			});
			expect(result.copyFields).toEqual([
				{
					id: "clh123variantfield0001",
					fieldKey: "description",
					label: "Details",
					category: "Basics",
					itemProperty: "description",
					position: 0,
				},
				{
					id: "clh123variantfield0003",
					fieldKey: "stock_uom",
					label: "Stock UOM",
					category: "Basics",
					itemProperty: "defaultUnitOfMeasureId",
					position: 1,
				},
			]);
		});

		it("should reject duplicate copy fields", async () => {
			await expect(
				service.updateItemVariantSettings({
					doNotUpdateVariantsOnSave: false,
					allowRenameAttributeValue: false,
					copyFields: [
						{ fieldKey: "description" },
						{ fieldKey: "description" },
					],
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("updateStockSettings", () => {
		it("should upsert stock settings and canonicalize the default stock UOM", async () => {
			const input = Inventory.updateStockSettingsSchema.parse({
				...mockStockSettingsInput,
				defaultWarehouse: " Stores - GH ",
				defaultStockUom: "nos",
			});
			mockPrisma.unitOfMeasurement.findFirst.mockResolvedValue({ name: "Nos" });
			mockPrisma.stockSettings.upsert.mockResolvedValue({
				...mockStockSettings,
				defaultWarehouse: "Stores - GH",
				defaultStockUom: "Nos",
			});

			const result = await service.updateStockSettings(input);

			expect(result.defaultWarehouse).toBe("Stores - GH");
			expect(result.defaultStockUom).toBe("Nos");
			expect(mockPrisma.stockSettings.upsert).toHaveBeenCalledWith({
				where: { singletonKey: "default" },
				update: expect.objectContaining({
					defaultWarehouse: "Stores - GH",
					defaultStockUom: "Nos",
				}),
				create: expect.objectContaining({
					singletonKey: "default",
					defaultWarehouse: "Stores - GH",
					defaultStockUom: "Nos",
				}),
				select: expect.objectContaining({
					id: true,
					itemNamingBy: true,
					defaultStockUom: true,
					freezeStocksOlderThanDays: true,
				}),
			});
		});

		it("should reject a default stock UOM that does not exist", async () => {
			const input = Inventory.updateStockSettingsSchema.parse({
				...mockStockSettingsInput,
				defaultStockUom: "Ghost UOM",
			});
			mockPrisma.unitOfMeasurement.findFirst.mockResolvedValue(null);

			await expect(service.updateStockSettings(input)).rejects.toThrow(
				BadRequestException,
			);
			expect(mockPrisma.stockSettings.upsert).not.toHaveBeenCalled();
		});
	});
});
