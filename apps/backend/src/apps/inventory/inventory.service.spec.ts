import { Inventory } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import type { PrismaService } from "../../shared/prisma.service";
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

	const mockItemAttributeValue = {
		id: "clh123iav0001",
		attributeId: "clh123ia0001",
		attributeValue: "Red",
		abbreviation: "R",
		position: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockItemAttribute = {
		id: "clh123ia0001",
		name: "Colour",
		disabled: false,
		numericValues: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		attributeValues: [mockItemAttributeValue],
	};

	const mockWarehouse = {
		id: "clh123warehouse0000",
		name: "Stores - GH",
		disabled: false,
		isGroupWarehouse: false,
		parentWarehouseId: null,
		company: "Aria Corp",
		isRejectedWarehouse: false,
		phoneNo: null,
		mobileNo: null,
		addressLine1: null,
		addressLine2: null,
		city: null,
		state: null,
		pin: null,
		warehouseType: "Retail",
		defaultInTransitWarehouseId: null,
		parentWarehouse: null,
		defaultInTransitWarehouse: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockSerialNo = {
		id: "clh123serial0000",
		serialNo: "SN-1001",
		itemId: mockItem.id,
		company: "Aria Corp",
		status: "AVAILABLE" as const,
		currentWarehouseId: mockWarehouse.id,
		purchaseReceiptId: null as string | null,
		deliveryNoteId: null as string | null,
		stockEntryId: null as string | null,
		pickListId: null as string | null,
		workOrder: "WO-1",
		purchaseDate: new Date("2026-03-20T00:00:00.000Z"),
		warrantyExpiryDate: new Date("2027-03-20T00:00:00.000Z"),
		serviceContractExpiryDate: null as Date | null,
		maintenanceStatus: "Active",
		notes: "Installed at site",
		isDisabled: false,
		createdAt: new Date("2026-03-20T00:00:00.000Z"),
		updatedAt: new Date("2026-03-21T00:00:00.000Z"),
		item: {
			id: mockItem.id,
			code: mockItem.code,
			name: mockItem.name,
		},
		currentWarehouse: {
			id: mockWarehouse.id,
			name: mockWarehouse.name,
		},
		purchaseReceipt: null,
		deliveryNote: null,
		stockEntry: null,
		pickList: null,
		history: [
			{
				id: "serial-history-1",
				serialNoId: "clh123serial0000",
				eventType: "CREATED" as const,
				fromStatus: null,
				toStatus: "AVAILABLE" as const,
				warehouseId: mockWarehouse.id,
				transactionLabel: null,
				notes: "Installed at site",
				createdAt: new Date("2026-03-20T00:00:00.000Z"),
				warehouse: {
					id: mockWarehouse.id,
					name: mockWarehouse.name,
				},
			},
		],
	};

	const mockBatch = {
		id: "clh123batch0000000001",
		batchId: "BATCH-1001",
		itemId: mockItem.id,
		itemCode: mockItem.code,
		itemName: mockItem.name,
		company: "Aria Corp",
		currentWarehouseId: mockWarehouse.id,
		currentWarehouseName: mockWarehouse.name,
		purchaseReceiptId: null as string | null,
		purchaseReceiptSeries: null as string | null,
		deliveryNoteId: null as string | null,
		deliveryNoteSeries: null as string | null,
		stockEntryId: null as string | null,
		stockEntrySeries: null as string | null,
		useBatchWiseValuation: false,
		manufacturingDate: new Date("2026-03-20T00:00:00.000Z"),
		expiryDate: new Date("2026-12-31T00:00:00.000Z"),
		description: "Tempered glass lot",
		quantity: 10,
		status: "ACTIVE" as const,
		isDisabled: false,
		createdAt: new Date("2026-03-20T00:00:00.000Z"),
		updatedAt: new Date("2026-03-21T00:00:00.000Z"),
		item: {
			id: mockItem.id,
			code: mockItem.code,
			name: mockItem.name,
		},
		currentWarehouse: {
			id: mockWarehouse.id,
			name: mockWarehouse.name,
		},
		purchaseReceipt: null,
		deliveryNote: null,
		stockEntry: null,
	};

	const mockInstallationNote = {
		id: "clinstallationnote00001",
		series: "MAT-INS-2026-00001",
		seriesPattern: "MAT-INS-.YYYY.-",
		installationDate: new Date("2026-03-26T00:00:00.000Z"),
		installationTime: "10:30:00",
		customer: "Acme Industries",
		customerName: "Acme Industries",
		customerAddress: "Dubai",
		contactPerson: "John",
		territory: "All Territories",
		customerGroup: "Corporate",
		company: "Aria Corp",
		status: "DRAFT" as const,
		deliveryNoteId: null as string | null,
		remarks: "Ready to install",
		deliveryNote: null,
		items: [
			{
				id: "clinstallationrow0001",
				installationNoteId: "clinstallationnote00001",
				itemId: mockItem.id,
				serialNoId: mockSerialNo.id,
				description: "Onsite setup",
				installedQty: 1,
				item: {
					id: mockItem.id,
					code: mockItem.code,
					name: mockItem.name,
				},
				serialNo: {
					id: mockSerialNo.id,
					serialNo: mockSerialNo.serialNo,
				},
			},
		],
		createdAt: new Date("2026-03-26T00:00:00.000Z"),
		updatedAt: new Date("2026-03-26T01:00:00.000Z"),
	};

	const mockStockSettingsInput = {
		itemNamingBy: "ITEM_CODE" as const,
		defaultWarehouse: null,
		defaultValuationMethod: "FIFO" as const,
		defaultStockUom: "Nos",
		autoInsertItemPriceIfMissing: false,
		updateExistingPriceListRate: false,
		allowToEditStockUomQtyForSalesDocuments: false,
		allowToEditStockUomQtyForPurchaseDocuments: false,
		overDeliveryReceiptAllowancePercent: 0,
		allowNegativeStock: false,
		showBarcodeFieldInStockTransactions: false,
		convertItemDescriptionToCleanHtmlInTransactions: false,
		overTransferAllowancePercent: 0,
		allowInternalTransfersAtArmsLengthPrice: false,
		overPickingAllowancePercent: 0,
		actionIfQualityInspectionIsNotSubmitted: "STOP" as const,
		actionIfQualityInspectionIsRejected: "STOP" as const,
		enableStockReservation: false,
		allowPartialReservation: false,
		autoReserveStockForSalesOrderOnPurchase: false,
		autoReserveSerialAndBatchNos: false,
		autoCreateSerialAndBatchBundleForOutward: false,
		disableSerialNoAndBatchSelector: false,
		haveDefaultNamingSeriesForBatchId: false,
		pickSerialBatchBasedOn: "FIFO" as const,
		useSerialBatchFields: false,
		doNotUpdateSerialBatchOnCreationOfAutoBundle: false,
		allowExistingSerialNoToBeManufacturedReceivedAgain: false,
		setSerialAndBatchBundleNamingBasedOnNamingSeries: false,
		raiseMaterialRequestWhenStockReachesReorderLevel: false,
		notifyByEmailOnCreationOfAutomaticMaterialRequest: false,
		allowMaterialTransferFromDeliveryNoteToSalesInvoice: false,
		allowMaterialTransferFromPurchaseReceiptToPurchaseInvoice: false,
		freezeStocksOlderThanDays: 60,
	};

	const mockStockSettings = {
		id: "clh123stocksettings0000",
		...mockStockSettingsInput,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockItemVariantSettings = {
		id: "clh123variantsettings0000",
		doNotUpdateVariantsOnSave: false,
		allowRenameAttributeValue: true,
		copyFields: [
			{
				id: "clh123variantfield0001",
				fieldKey: "description",
				position: 0,
			},
		],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	const mockStockEntryItem = {
		id: "clh123ste_item01",
		stockEntryId: "clh123ste000001",
		itemCode: "STE-ITM-001",
		itemName: "Stock Test Item",
		sourceWarehouse: null as string | null,
		targetWarehouse: null as string | null,
		description: null as string | null,
		qty: 10,
		basicRate: 100,
		basicAmount: 1000,
		unitOfMeasure: null as string | null,
	};

	const mockStockEntry = {
		id: "clh123ste000001",
		series: "MAT-STE-2026-00001",
		stockEntryType: "MATERIAL_RECEIPT" as const,
		postingDate: new Date("2026-01-15T00:00:00.000Z"),
		company: "Aria Corp",
		status: "DRAFT" as const,
		project: null as string | null,
		defaultSourceWarehouse: null as string | null,
		defaultTargetWarehouse: null as string | null,
		isOpening: false,
		remarks: null as string | null,
		printHeading: null as string | null,
		letterHead: null as string | null,
		inspectionRequired: false,
		items: [mockStockEntryItem],
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

	const mockProjectedPickListItem = {
		id: "clh123pick_item01",
		pickListId: "clh123pick000001",
		item: "STE-ITM-001",
		warehouse: "Stores - GH",
		qty: 6,
		stockQty: 10,
		pickedQty: 2,
	};

	const mockProjectedPickList = {
		id: "clh123pick000001",
		series: "STO-PICK-2026-00001",
		seriesPattern: "STO-PICK-.YYYY.-",
		status: "OPEN" as const,
		company: "Aria Corp",
		customer: null as string | null,
		purpose: "MATERIAL_TRANSFER_FOR_MANUFACTURE" as const,
		workOrder: null as string | null,
		warehouse: "Stores - GH",
		considerRejectedWarehouses: false,
		pickManually: false,
		ignorePricingRule: false,
		scanMode: false,
		promptQty: false,
		scanBarcode: null as string | null,
		groupSameItems: false,
		items: [mockProjectedPickListItem],
		createdAt: new Date("2026-03-20T00:00:00.000Z"),
		updatedAt: new Date("2026-03-21T00:00:00.000Z"),
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
		warehouse: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		serialNo: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		batch: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		installationNote: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			count: jest.fn(),
		},
		installationNoteItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
		itemGroupDefault: {
			count: jest.fn(),
		},
		itemReorder: {
			count: jest.fn(),
		},
		stockSettings: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
			count: jest.fn(),
		},
		itemVariantSettings: {
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			upsert: jest.fn(),
		},
		itemVariantSettingsField: {
			findMany: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			deleteMany: jest.fn(),
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
			count: jest.fn(),
		},
		materialRequestItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
			count: jest.fn(),
		},
		stockEntry: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		stockEntryItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
			count: jest.fn(),
		},
		deliveryNote: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		deliveryNoteItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
			count: jest.fn(),
		},
		purchaseReceipt: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		purchaseReceiptItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
			count: jest.fn(),
		},
		purchaseReceiptTax: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
		pickList: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
			count: jest.fn(),
		},
		pickListItem: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
			count: jest.fn(),
		},
		deliveryTrip: {
			findMany: jest.fn(),
			findFirst: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn(),
		},
		deliveryTripStop: {
			findMany: jest.fn(),
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
		itemAttribute: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		itemAttributeValue: {
			deleteMany: jest.fn(),
			update: jest.fn(),
			create: jest.fn(),
		},
		$transaction: jest.fn(),
	};

	beforeEach(() => {
		jest.clearAllMocks();

		mockPrisma.$transaction.mockImplementation(
			(
				input:
					| ((tx: typeof mockPrisma) => unknown)
					| readonly Promise<unknown>[],
			) => {
				if (typeof input === "function") {
					return input(mockPrisma);
				}

				return Promise.all(input);
			},
		);

		service = new InventoryService(mockPrisma as unknown as PrismaService);
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

	// ==========================================================================
	// Item Attribute
	// ==========================================================================

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

	// ─── StockEntries ─────────────────────────────────────────────────────────────

	describe("findAllStockEntries", () => {
		it("should return all stock entries ordered by createdAt desc", async () => {
			mockPrisma.stockEntry.findMany.mockResolvedValue([mockStockEntry]);

			const result = await service.findAllStockEntries();

			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe(mockStockEntry.id);
			expect(result[0]?.series).toBe(mockStockEntry.series);
			expect(mockPrisma.stockEntry.findMany).toHaveBeenCalledWith({
				orderBy: { createdAt: "desc" },
				include: { items: true },
				take: 250,
			});
		});

		it("should return an empty array when no entries exist", async () => {
			mockPrisma.stockEntry.findMany.mockResolvedValue([]);

			const result = await service.findAllStockEntries();

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

	describe("findStockLedger", () => {
		it("should return derived ledger rows for bounded stock entry items", async () => {
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([
				{
					...mockStockEntryItem,
					stockEntry: {
						...mockStockEntry,
						defaultTargetWarehouse: "Stores - GH",
					},
				},
			]);
			mockPrisma.item.findMany.mockResolvedValue([
				{
					code: mockStockEntryItem.itemCode,
					valuationRate: 45071.79,
					itemGroup: { groupName: "Phones" },
					brand: { name: "Apple" },
				},
			]);

			const result = await service.findStockLedger({ take: 25 });

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				voucherNo: mockStockEntry.series,
				itemCode: mockStockEntryItem.itemCode,
				itemGroupName: "Phones",
				brandName: "Apple",
				valuationRate: 45071.79,
				warehouse: "Stores - GH",
				qtyIn: mockStockEntryItem.qty,
				qtyOut: 0,
				balanceQty: mockStockEntryItem.qty,
			});
			expect(mockPrisma.stockEntryItem.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 25,
					include: { stockEntry: true },
				}),
			);
		});

		it("should map filters into the stock entry item query", async () => {
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([]);
			mockPrisma.item.findMany
				.mockResolvedValueOnce([{ code: "ITEM-001" }])
				.mockResolvedValueOnce([]);

			await service.findStockLedger({
				take: 500,
				skip: -10,
				search: "receipt",
				company: "Aria",
				warehouse: "Stores - GH",
				itemCode: "ITEM",
				itemGroup: "Phones",
				brand: "Apple",
				voucherNo: "MAT-STE",
				stockEntryType: "MATERIAL_RECEIPT",
				status: "DRAFT",
				project: "Project",
				dateFrom: new Date("2026-01-01T00:00:00.000Z"),
				dateTo: new Date("2026-01-31T00:00:00.000Z"),
			});

			expect(mockPrisma.stockEntryItem.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 250,
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								itemCode: expect.objectContaining({ contains: "ITEM" }),
							}),
							expect.objectContaining({
								itemCode: expect.objectContaining({ in: ["ITEM-001"] }),
							}),
							expect.objectContaining({
								stockEntry: expect.objectContaining({
									company: expect.objectContaining({ contains: "Aria" }),
									series: expect.objectContaining({ contains: "MAT-STE" }),
									stockEntryType: "MATERIAL_RECEIPT",
									status: "DRAFT",
									project: expect.objectContaining({ contains: "Project" }),
									postingDate: expect.objectContaining({
										gte: new Date("2026-01-01T00:00:00.000Z"),
										lte: new Date("2026-01-31T00:00:00.000Z"),
									}),
								}),
							}),
						]),
					}),
				}),
			);
			expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						itemGroup: expect.objectContaining({
							groupName: expect.objectContaining({ contains: "Phones" }),
						}),
						brand: expect.objectContaining({
							name: expect.objectContaining({ contains: "Apple" }),
						}),
					}),
				}),
			);
		});

		it("should reject an invalid date range", async () => {
			await expect(
				service.findStockLedger({
					dateFrom: new Date("2026-02-01T00:00:00.000Z"),
					dateTo: new Date("2026-01-01T00:00:00.000Z"),
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("findStockBalance", () => {
		it("should aggregate opening, inward, outward, and closing balances", async () => {
			mockPrisma.stockEntryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([
				{
					...mockStockEntryItem,
					qty: 10,
					basicAmount: 1000,
					stockEntry: {
						...mockStockEntry,
						status: "SUBMITTED",
						postingDate: new Date("2026-02-20T00:00:00.000Z"),
						defaultTargetWarehouse: "Stores - GH",
					},
				},
				{
					...mockStockEntryItem,
					qty: 3,
					basicAmount: 300,
					sourceWarehouse: "Stores - GH",
					stockEntry: {
						...mockStockEntry,
						id: "clh123ste000002",
						series: "MAT-STE-2026-00002",
						stockEntryType: "MATERIAL_ISSUE",
						status: "SUBMITTED",
						postingDate: new Date("2026-03-05T00:00:00.000Z"),
						defaultTargetWarehouse: null,
					},
				},
			]);
			mockPrisma.item.findMany.mockResolvedValue([
				{
					code: mockStockEntryItem.itemCode,
					valuationRate: 125,
					itemGroup: { groupName: "Phones" },
					brand: { name: "Apple" },
				},
			]);

			const result = await service.findStockBalance({
				dateFrom: new Date("2026-03-01T00:00:00.000Z"),
				take: 25,
			});

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				company: "Aria Corp",
				itemCode: mockStockEntryItem.itemCode,
				itemGroupName: "Phones",
				brandName: "Apple",
				warehouse: "Stores - GH",
				openingQty: 10,
				openingValue: 1000,
				inQty: 0,
				outQty: 3,
				outValue: 300,
				balanceQty: 7,
				valuationRate: 125,
				balanceValue: 875,
			});
			expect(mockPrisma.stockEntryItem.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					include: { stockEntry: true },
					where: expect.objectContaining({
						stockEntry: expect.objectContaining({ status: "SUBMITTED" }),
					}),
				}),
			);
		});

		it("should map filters and preserve zero-balance rows only when requested", async () => {
			mockPrisma.stockEntryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([]);
			mockPrisma.item.findMany
				.mockResolvedValueOnce([{ code: "ITEM-001" }])
				.mockResolvedValueOnce([]);

			await service.findStockBalance({
				take: 500,
				skip: -1,
				search: "nova",
				company: "Aria",
				warehouse: "Stores - GH",
				itemCode: "ITEM",
				itemGroup: "Phones",
				brand: "Apple",
				project: "Project",
				status: "DRAFT",
				dateTo: new Date("2026-03-31T00:00:00.000Z"),
				includeZeroStockItems: true,
			});

			expect(mockPrisma.stockEntryItem.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								itemCode: expect.objectContaining({ contains: "ITEM" }),
							}),
							expect.objectContaining({
								itemCode: expect.objectContaining({ in: ["ITEM-001"] }),
							}),
							expect.objectContaining({
								stockEntry: expect.objectContaining({
									company: expect.objectContaining({ contains: "Aria" }),
									status: "DRAFT",
									project: expect.objectContaining({ contains: "Project" }),
									postingDate: expect.objectContaining({
										lte: new Date("2026-03-31T00:00:00.000Z"),
									}),
								}),
							}),
						]),
					}),
				}),
			);
			expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						itemGroup: expect.objectContaining({
							groupName: expect.objectContaining({ contains: "Phones" }),
						}),
						brand: expect.objectContaining({
							name: expect.objectContaining({ contains: "Apple" }),
						}),
					}),
				}),
			);
		});

		it("should reject an invalid stock balance date range", async () => {
			await expect(
				service.findStockBalance({
					dateFrom: new Date("2026-04-01T00:00:00.000Z"),
					dateTo: new Date("2026-03-01T00:00:00.000Z"),
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("findWarehouseWiseStockBalance", () => {
		it("should map stock movement rows into warehouse-wise balance rows", async () => {
			mockPrisma.stockEntryItem.findMany.mockReset();
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([
				{
					...mockStockEntryItem,
					id: "clh123ste_item01",
					itemCode: "STE-ITM-001",
					itemName: "Stock Test Item",
					qty: 4,
					basicRate: 250,
					basicAmount: 1000,
					stockEntry: {
						...mockStockEntry,
						status: "SUBMITTED",
						defaultTargetWarehouse: "Stores - GH",
						postingDate: new Date("2026-03-22T00:00:00.000Z"),
					},
				},
			]);

			const result = await service.findWarehouseWiseStockBalance({ take: 25 });

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				itemCode: "STE-ITM-001",
				itemName: "Stock Test Item",
				warehouse: "Stores - GH",
				voucherNo: "MAT-STE-2026-00001",
				qtyChange: 4,
				incomingRate: 250,
				company: "Aria Corp",
				movementType: "IN",
			});
		});

		it("should map filters and bound pagination for warehouse-wise rows", async () => {
			mockPrisma.stockEntryItem.findMany.mockReset();
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([]);

			await service.findWarehouseWiseStockBalance({
				take: 999,
				skip: -4,
				search: "stock",
				company: "Aria",
				warehouse: "Stores - GH",
				itemCode: "STE",
				voucherNo: "MAT-STE",
				status: "DRAFT",
				dateFrom: new Date("2026-03-01T00:00:00.000Z"),
				dateTo: new Date("2026-03-31T00:00:00.000Z"),
			});

			expect(mockPrisma.stockEntryItem.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								itemCode: expect.objectContaining({ contains: "STE" }),
							}),
							expect.objectContaining({
								stockEntry: expect.objectContaining({
									status: "DRAFT",
									company: expect.objectContaining({ contains: "Aria" }),
									series: expect.objectContaining({ contains: "MAT-STE" }),
									postingDate: expect.objectContaining({
										gte: new Date("2026-03-01T00:00:00.000Z"),
										lte: new Date("2026-03-31T00:00:00.000Z"),
									}),
								}),
							}),
						]),
					}),
				}),
			);
		});

		it("should reject invalid date ranges", async () => {
			await expect(
				service.findWarehouseWiseStockBalance({
					dateFrom: new Date("2026-04-01T00:00:00.000Z"),
					dateTo: new Date("2026-03-01T00:00:00.000Z"),
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("findStockProjectedQty", () => {
		it("should combine stock, request, and reservation buckets into projected quantities", async () => {
			mockPrisma.stockEntryItem.findMany
				.mockResolvedValueOnce([
					{
						...mockStockEntryItem,
						qty: 11,
						basicAmount: 1100,
						stockEntry: {
							...mockStockEntry,
							status: "SUBMITTED",
							defaultTargetWarehouse: "Stores - GH",
						},
					},
				])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);
			mockPrisma.materialRequest.findMany.mockResolvedValue([
				{
					...mockMR,
					status: "PARTIALLY_ORDERED",
					company: "Aria Corp",
					items: [
						{
							...mockMRItem,
							itemCode: "STE-ITM-001",
							quantity: 55,
							orderedQty: 25,
							receivedQty: 0,
							targetWarehouse: "Stores - GH",
						},
					],
				},
			]);
			mockPrisma.deliveryNote.findMany.mockResolvedValue([
				{
					id: "clh123dn000001",
					series: "MAT-DN-2026-00001",
					postingDate: new Date("2026-03-22T00:00:00.000Z"),
					customer: "Test Customer",
					company: "Aria Corp",
					status: "TO_BILL" as const,
					isReturn: false,
					currency: null,
					priceList: null,
					sourceWarehouse: "Stores - GH",
					totalQuantity: 5,
					totalAmount: 0,
					grandTotal: 0,
					roundingAdjustment: 0,
					roundedTotal: 0,
					additionalDiscountOn: null,
					additionalDiscountPercent: null,
					additionalDiscountAmount: null,
					shippingAddress: null,
					dispatchAddress: null,
					companyAddress: null,
					companyContact: null,
					companyTRN: null,
					terms: null,
					termsContent: null,
					transporter: null,
					driverName: null,
					driver: null,
					transportReceiptDate: null,
					transportReceiptNo: null,
					vehicleNo: null,
					customerPoNo: null,
					customerPoDate: null,
					salesPartner: null,
					commissionRate: null,
					letterHead: null,
					printHeading: null,
					printWithoutAmount: false,
					groupSameItems: false,
					permitNumber: null,
					vatEmirate: null,
					project: null,
					items: [
						{
							id: "clh123dn_item01",
							deliveryNoteId: "clh123dn000001",
							itemCode: "STE-ITM-001",
							itemName: "Stock Test Item",
							description: null,
							quantity: 5,
							uom: "Nos",
							rate: 0,
							amount: 0,
							warehouse: "Stores - GH",
						},
					],
					createdAt: new Date("2026-03-22T00:00:00.000Z"),
					updatedAt: new Date("2026-03-22T00:00:00.000Z"),
				},
			]);
			mockPrisma.pickList.findMany.mockResolvedValue([mockProjectedPickList]);
			mockPrisma.inventoryItem.findMany
				.mockResolvedValueOnce([
					{
						id: "inv-item-001",
						name: "Stock Test Item",
						code: "STE-ITM-001",
						description: "Primary item",
						disabled: false,
						maintainStock: true,
						allowAlternateItem: false,
						hasVariants: false,
						openingStock: 0,
						valuationRate: 100,
						standardSellingRate: 0,
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
						itemGroupId: "group-001",
						defaultUnitOfMeasureId: "uom-001",
						quantity: 0,
						createdAt: new Date(),
						updatedAt: new Date(),
						itemGroup: { groupName: "Phones" },
						reorderSettings: [
							{
								id: "reorder-001",
								itemId: "inv-item-001",
								warehouse: "Stores - GH",
								reorderLevel: 60,
								reorderQty: 10,
								materialRequestType: null,
							},
						],
					},
				])
				.mockResolvedValueOnce([]);
			mockPrisma.item.findMany.mockResolvedValue([
				{ code: "STE-ITM-001", brand: { name: "Apple" } },
			]);

			const result = await service.findStockProjectedQty({ take: 25 });

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				company: "Aria Corp",
				itemCode: "STE-ITM-001",
				warehouse: "Stores - GH",
				actualQty: 11,
				requestedQty: 30,
				orderedQty: 25,
				reservedQty: 5,
				reservedQtyForProduction: 4,
				projectedQty: 57,
				reorderLevel: 60,
				shortageQty: 3,
			});
		});
	});

	describe("findStockSummary", () => {
		it("should derive sorted stock summary rows from projected quantities", async () => {
			mockPrisma.stockEntryItem.findMany.mockReset();
			mockPrisma.materialRequest.findMany.mockReset();
			mockPrisma.deliveryNote.findMany.mockReset();
			mockPrisma.pickList.findMany.mockReset();
			mockPrisma.inventoryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();

			mockPrisma.stockEntryItem.findMany
				.mockResolvedValueOnce([
					{
						...mockStockEntryItem,
						itemCode: "STE-ITM-001",
						itemName: "Stock Test Item",
						qty: 2,
						basicAmount: 200,
						stockEntry: {
							...mockStockEntry,
							status: "SUBMITTED",
							defaultTargetWarehouse: "Stores - GH",
						},
					},
					{
						...mockStockEntryItem,
						id: "clh123ste_item02",
						itemCode: "STE-ITM-002",
						itemName: "Stock Test Item 2",
						qty: 9,
						basicAmount: 900,
						stockEntry: {
							...mockStockEntry,
							id: "clh123ste000002",
							series: "MAT-STE-2026-00002",
							status: "SUBMITTED",
							defaultTargetWarehouse: "Stores - GH",
						},
					},
				])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);
			mockPrisma.deliveryNote.findMany.mockResolvedValue([]);
			mockPrisma.pickList.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([
				{
					id: "inv-item-001",
					name: "Stock Test Item",
					code: "STE-ITM-001",
					description: "Primary item",
					disabled: false,
					maintainStock: true,
					allowAlternateItem: false,
					hasVariants: false,
					openingStock: 0,
					valuationRate: 100,
					standardSellingRate: 0,
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
					itemGroupId: "group-001",
					defaultUnitOfMeasureId: "uom-001",
					quantity: 0,
					createdAt: new Date(),
					updatedAt: new Date(),
					defaultUnitOfMeasure: { name: "Nos" },
					itemGroup: { groupName: "Phones" },
					reorderSettings: [
						{
							id: "reorder-001",
							itemId: "inv-item-001",
							warehouse: "Stores - GH",
							reorderLevel: 10,
							reorderQty: 5,
							materialRequestType: null,
						},
					],
				},
				{
					id: "inv-item-002",
					name: "Stock Test Item 2",
					code: "STE-ITM-002",
					description: "Secondary item",
					disabled: false,
					maintainStock: true,
					allowAlternateItem: false,
					hasVariants: false,
					openingStock: 0,
					valuationRate: 100,
					standardSellingRate: 0,
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
					itemGroupId: "group-001",
					defaultUnitOfMeasureId: "uom-001",
					quantity: 0,
					createdAt: new Date(),
					updatedAt: new Date(),
					defaultUnitOfMeasure: { name: "Nos" },
					itemGroup: { groupName: "Phones" },
					reorderSettings: [
						{
							id: "reorder-002",
							itemId: "inv-item-002",
							warehouse: "Stores - GH",
							reorderLevel: 5,
							reorderQty: 2,
							materialRequestType: null,
						},
					],
				},
			]);
			mockPrisma.item.findMany.mockResolvedValue([
				{ code: "STE-ITM-001", brand: { name: "Apple" } },
				{ code: "STE-ITM-002", brand: { name: "Apple" } },
			]);

			const result = await service.findStockSummary({
				metric: "SHORTAGE_QTY",
				take: 25,
			});

			expect(result).toHaveLength(2);
			expect(result[0]).toMatchObject({
				itemCode: "STE-ITM-001",
				primaryMetric: "SHORTAGE_QTY",
				primaryMetricValue: 8,
				stockHealth: "LOW",
				recommendedAction: "MOVE_AND_ADD",
			});
			expect(result[1]).toMatchObject({
				itemCode: "STE-ITM-002",
				primaryMetricValue: 0,
				stockHealth: "SURPLUS",
			});
		});
	});

	describe("findItemPriceStock", () => {
		it("should combine stock availability with buying and selling rates", async () => {
			mockPrisma.stockEntryItem.findMany.mockReset();
			mockPrisma.materialRequest.findMany.mockReset();
			mockPrisma.deliveryNote.findMany.mockReset();
			mockPrisma.pickList.findMany.mockReset();
			mockPrisma.inventoryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();

			mockPrisma.stockEntryItem.findMany
				.mockResolvedValueOnce([
					{
						...mockStockEntryItem,
						itemCode: "STE-ITM-001",
						itemName: "Stock Test Item",
						qty: 8,
						basicAmount: 800,
						stockEntry: {
							...mockStockEntry,
							status: "SUBMITTED",
							defaultTargetWarehouse: "Stores - GH",
						},
					},
				])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);
			mockPrisma.deliveryNote.findMany.mockResolvedValue([]);
			mockPrisma.pickList.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany
				.mockResolvedValueOnce([
					{
						id: "inv-item-001",
						name: "Stock Test Item",
						code: "STE-ITM-001",
						description: "Primary item",
						disabled: false,
						maintainStock: true,
						allowAlternateItem: false,
						hasVariants: false,
						openingStock: 0,
						valuationRate: 100,
						standardSellingRate: 200,
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
						itemGroupId: "group-001",
						defaultUnitOfMeasureId: "uom-001",
						quantity: 0,
						createdAt: new Date(),
						updatedAt: new Date(),
						defaultUnitOfMeasure: { name: "Nos" },
						itemGroup: { groupName: "Phones" },
						reorderSettings: [],
					},
				])
				.mockResolvedValueOnce([
					{
						code: "STE-ITM-001",
						valuationRate: 100,
						standardSellingRate: 200,
					},
				]);
			mockPrisma.item.findMany.mockResolvedValue([
				{ code: "STE-ITM-001", brand: { name: "Apple" } },
			]);

			const result = await service.findItemPriceStock({ take: 25 });

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				itemCode: "STE-ITM-001",
				warehouse: "Stores - GH",
				availableQty: 8,
				buyingPriceList: "Standard Buying",
				buyingRate: 100,
				sellingPriceList: "Standard Selling",
				sellingRate: 200,
			});
		});

		it("should map filters into movement query and bound pagination", async () => {
			mockPrisma.stockEntryItem.findMany.mockReset();
			mockPrisma.materialRequest.findMany.mockReset();
			mockPrisma.deliveryNote.findMany.mockReset();
			mockPrisma.pickList.findMany.mockReset();
			mockPrisma.inventoryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();

			mockPrisma.stockEntryItem.findMany
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);
			mockPrisma.materialRequest.findMany.mockResolvedValue([]);
			mockPrisma.deliveryNote.findMany.mockResolvedValue([]);
			mockPrisma.pickList.findMany.mockResolvedValue([]);
			mockPrisma.inventoryItem.findMany
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([]);
			mockPrisma.item.findMany
				.mockResolvedValueOnce([{ code: "STE-ITM-001" }])
				.mockResolvedValueOnce([]);

			await service.findItemPriceStock({
				take: 999,
				skip: -2,
				company: "Aria",
				warehouse: "Stores - GH",
				itemCode: "STE",
				itemGroup: "Phones",
				brand: "Apple",
				search: "nova",
				includeZeroStockItems: true,
			});

			expect(mockPrisma.stockEntryItem.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								itemCode: expect.objectContaining({ contains: "STE" }),
							}),
							expect.objectContaining({
								itemCode: expect.objectContaining({ in: ["STE-ITM-001"] }),
							}),
							expect.objectContaining({
								stockEntry: expect.objectContaining({
									status: "SUBMITTED",
									company: expect.objectContaining({ contains: "Aria" }),
								}),
							}),
						]),
					}),
				}),
			);
			expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						brand: expect.objectContaining({
							name: expect.objectContaining({ contains: "Apple" }),
						}),
					}),
				}),
			);
		});
	});

	describe("findStockAgeing", () => {
		it("should derive FIFO stock ageing rows with bucket values and metadata", async () => {
			mockPrisma.stockEntryItem.findMany.mockReset();
			mockPrisma.inventoryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();

			mockPrisma.stockEntryItem.findMany.mockResolvedValue([
				{
					...mockStockEntryItem,
					itemCode: "STE-ITM-001",
					itemName: "Stock Test Item",
					qty: 10,
					basicRate: 100,
					basicAmount: 1000,
					stockEntry: {
						...mockStockEntry,
						status: "SUBMITTED",
						postingDate: new Date("2026-01-01T00:00:00.000Z"),
						defaultTargetWarehouse: "Stores - GH",
					},
				},
				{
					...mockStockEntryItem,
					id: "clh123ste_item02",
					itemCode: "STE-ITM-001",
					itemName: "Stock Test Item",
					sourceWarehouse: "Stores - GH",
					targetWarehouse: null,
					qty: 4,
					basicRate: 100,
					basicAmount: 400,
					stockEntry: {
						...mockStockEntry,
						id: "clh123ste000002",
						series: "MAT-STE-2026-00002",
						stockEntryType: "MATERIAL_ISSUE",
						status: "SUBMITTED",
						postingDate: new Date("2026-01-20T00:00:00.000Z"),
						defaultSourceWarehouse: "Stores - GH",
						defaultTargetWarehouse: null,
					},
				},
			]);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([
				{
					id: "inv-item-001",
					name: "Stock Test Item",
					code: "STE-ITM-001",
					description: "Primary item",
					disabled: false,
					maintainStock: true,
					allowAlternateItem: false,
					hasVariants: false,
					openingStock: 0,
					valuationRate: 100,
					standardSellingRate: 0,
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
					itemGroupId: "group-001",
					defaultUnitOfMeasureId: "uom-001",
					quantity: 0,
					createdAt: new Date(),
					updatedAt: new Date(),
					defaultUnitOfMeasure: { name: "Nos" },
					itemGroup: { groupName: "Phones" },
				},
			]);
			mockPrisma.item.findMany.mockResolvedValue([
				{ code: "STE-ITM-001", brand: { name: "Apple" } },
			]);

			const result = await service.findStockAgeing({
				asOfDate: new Date("2026-02-10T00:00:00.000Z"),
				ageingRanges: "30,60,90",
				showWarehouseWiseStock: true,
				take: 25,
			});

			expect(result).toHaveLength(1);
			expect(result[0]).toMatchObject({
				company: "Aria Corp",
				itemCode: "STE-ITM-001",
				itemGroupName: "Phones",
				brandName: "Apple",
				warehouse: "Stores - GH",
				unitOfMeasure: "Nos",
				availableQty: 6,
				averageAge: 40,
				averageRate: 100,
			});
			expect(result[0]?.buckets).toEqual([
				{ index: 0, minAge: 0, maxAge: 30, quantity: 0, value: 0 },
				{ index: 1, minAge: 31, maxAge: 60, quantity: 6, value: 600 },
				{ index: 2, minAge: 61, maxAge: 90, quantity: 0, value: 0 },
				{ index: 3, minAge: 91, maxAge: null, quantity: 0, value: 0 },
			]);
		});

		it("should map filters into the ageing movement query", async () => {
			mockPrisma.stockEntryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();
			mockPrisma.stockEntryItem.findMany.mockResolvedValue([]);
			mockPrisma.item.findMany.mockResolvedValue([{ code: "STE-ITM-001" }]);

			await service.findStockAgeing({
				take: 500,
				skip: -4,
				company: "Aria",
				warehouse: "Stores - GH",
				itemCode: "STE",
				brand: "Apple",
				asOfDate: new Date("2026-03-31T00:00:00.000Z"),
			});

			expect(mockPrisma.stockEntryItem.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								stockEntry: expect.objectContaining({
									status: "SUBMITTED",
									company: expect.objectContaining({ contains: "Aria" }),
									postingDate: expect.objectContaining({
										lte: new Date("2026-03-31T00:00:00.000Z"),
									}),
								}),
							}),
							expect.objectContaining({
								itemCode: expect.objectContaining({ contains: "STE" }),
							}),
							expect.objectContaining({
								itemCode: expect.objectContaining({ in: ["STE-ITM-001"] }),
							}),
						]),
					}),
					include: { stockEntry: true },
				}),
			);
			expect(mockPrisma.item.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						brand: expect.objectContaining({
							name: expect.objectContaining({ contains: "Apple" }),
						}),
					}),
				}),
			);
		});

		it("should reject invalid ageing range input", async () => {
			await expect(
				service.findStockAgeing({ ageingRanges: "30,bad,90" }),
			).rejects.toThrow(BadRequestException);
		});
	});

	// ── Delivery Note ──────────────────────────────────────────────────────────

	const mockDeliveryNoteItem = {
		id: "clh123dn_item01",
		deliveryNoteId: "clh123dn000001",
		itemCode: "DN-ITM-001",
		itemName: "Delivery Test Item",
		description: null as string | null,
		quantity: 5,
		uom: null as string | null,
		rate: 200,
		amount: 1000,
		warehouse: null as string | null,
	};

	const mockDeliveryNote = {
		id: "clh123dn000001",
		series: "MAT-DN-2026-00001",
		customer: "Test Customer",
		company: "Aria Corp",
		status: "DRAFT" as const,
		postingDate: new Date("2026-01-15T00:00:00.000Z"),
		isReturn: false,
		currency: null as string | null,
		priceList: null as string | null,
		sourceWarehouse: null as string | null,
		totalQuantity: 5,
		totalNetWeight: null as number | null,
		totalAmount: 1000,
		additionalDiscountOn: null as string | null,
		additionalDiscountPercent: null as number | null,
		additionalDiscountAmount: null as number | null,
		grandTotal: 1000,
		roundingAdjustment: null as number | null,
		shippingAddress: null as string | null,
		dispatchAddress: null as string | null,
		companyAddress: null as string | null,
		companyContact: null as string | null,
		companyTRN: null as string | null,
		terms: null as string | null,
		termsContent: null as string | null,
		transporter: null as string | null,
		driverName: null as string | null,
		driver: null as string | null,
		transportReceiptDate: null as Date | null,
		transportReceiptNo: null as string | null,
		vehicleNo: null as string | null,
		customerPoNo: null as string | null,
		customerPoDate: null as Date | null,
		salesPartner: null as string | null,
		commissionRate: null as number | null,
		letterHead: null as string | null,
		printHeading: null as string | null,
		printWithoutAmount: false,
		groupSameItems: false,
		permitNumber: null as string | null,
		vatEmirate: null as string | null,
		project: null as string | null,
		items: [mockDeliveryNoteItem],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	describe("findAllDeliveryNotes", () => {
		it("should return all delivery notes mapped to domain type", async () => {
			mockPrisma.deliveryNote.findMany.mockResolvedValue([mockDeliveryNote]);

			const result = await service.findAllDeliveryNotes();

			expect(result[0]?.id).toBe(mockDeliveryNote.id);
			expect(result[0]?.series).toBe(mockDeliveryNote.series);
			expect(mockPrisma.deliveryNote.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ include: { items: true } }),
			);
		});
	});

	describe("findDeliveryNoteById", () => {
		it("should return a delivery note by id", async () => {
			mockPrisma.deliveryNote.findUnique.mockResolvedValue(mockDeliveryNote);

			const result = await service.findDeliveryNoteById(mockDeliveryNote.id);

			expect(result?.id).toBe(mockDeliveryNote.id);
			expect(mockPrisma.deliveryNote.findUnique).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: mockDeliveryNote.id } }),
			);
		});

		it("should return null when not found", async () => {
			mockPrisma.deliveryNote.findUnique.mockResolvedValue(null);

			const result = await service.findDeliveryNoteById("nonexistent");

			expect(result).toBeNull();
		});
	});

	describe("createDeliveryNote", () => {
		it("should create a delivery note with a generated series", async () => {
			mockPrisma.deliveryNote.findFirst.mockResolvedValue(null);
			mockPrisma.deliveryNote.create.mockResolvedValue(mockDeliveryNote);

			const result = await service.createDeliveryNote({
				customer: "Test Customer",
				company: "Aria Corp",
				items: [{ itemCode: "DN-ITM-001", quantity: 5, rate: 200 }],
			});

			expect(result.id).toBe(mockDeliveryNote.id);
			expect(mockPrisma.deliveryNote.create).toHaveBeenCalled();
		});

		it("should retry series generation on P2002 conflict", async () => {
			const conflictError = new Prisma.PrismaClientKnownRequestError(
				"Unique constraint",
				{ code: "P2002", clientVersion: "5.0.0" },
			);
			mockPrisma.deliveryNote.findFirst.mockResolvedValue(null);
			mockPrisma.deliveryNote.create
				.mockRejectedValueOnce(conflictError)
				.mockResolvedValueOnce(mockDeliveryNote);

			const result = await service.createDeliveryNote({
				customer: "Test Customer",
				company: "Aria Corp",
				items: [{ itemCode: "DN-ITM-001", quantity: 5, rate: 200 }],
			});

			expect(result.id).toBe(mockDeliveryNote.id);
			expect(mockPrisma.deliveryNote.create).toHaveBeenCalledTimes(2);
		});
	});

	describe("updateDeliveryNote", () => {
		it("should update a delivery note and upsert items in a transaction", async () => {
			mockPrisma.deliveryNote.findUnique.mockResolvedValue({
				id: mockDeliveryNote.id,
			});
			mockPrisma.deliveryNoteItem.findMany.mockResolvedValue([
				{
					id: mockDeliveryNoteItem.id,
					quantity: 10,
					rate: 200,
				},
			]);
			mockPrisma.deliveryNoteItem.update.mockResolvedValue(
				mockDeliveryNoteItem,
			);
			mockPrisma.deliveryNote.findUniqueOrThrow.mockResolvedValue(
				mockDeliveryNote,
			);

			const result = await service.updateDeliveryNote({
				id: mockDeliveryNote.id,
				customer: "Updated Customer",
				items: [
					{
						id: mockDeliveryNoteItem.id,
						itemCode: "DN-ITM-001",
						quantity: 10,
					},
				],
			});

			expect(result.id).toBe(mockDeliveryNote.id);
			expect(mockPrisma.$transaction).toHaveBeenCalled();
		});
	});

	describe("deleteDeliveryNote", () => {
		it("should delete a delivery note and return success", async () => {
			mockPrisma.deliveryNote.delete.mockResolvedValue(mockDeliveryNote);

			const result = await service.deleteDeliveryNote(mockDeliveryNote.id);

			expect(result).toEqual({
				success: true,
				id: mockDeliveryNote.id,
			});
			expect(mockPrisma.deliveryNote.delete).toHaveBeenCalledWith({
				where: { id: mockDeliveryNote.id },
			});
		});

		it("should return success: false when record not found (P2025)", async () => {
			const notFoundError = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{ code: "P2025", clientVersion: "5.0.0" },
			);
			mockPrisma.deliveryNote.delete.mockRejectedValue(notFoundError);

			const result = await service.deleteDeliveryNote("nonexistent");

			expect(result).toEqual({ success: false, id: "nonexistent" });
		});
	});

	describe("deleteManyDeliveryNotes", () => {
		it("should bulk-delete and return the count", async () => {
			const ids = [mockDeliveryNote.id, "clh123dn000002"];
			mockPrisma.deliveryNote.deleteMany.mockResolvedValue({ count: 2 });

			const result = await service.deleteManyDeliveryNotes(ids);

			expect(result).toEqual({ success: true, count: 2, ids });
			expect(mockPrisma.deliveryNote.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: ids } },
			});
		});

		it("should deduplicate ids before deleting", async () => {
			const id = mockDeliveryNote.id;
			mockPrisma.deliveryNote.deleteMany.mockResolvedValue({ count: 1 });

			const result = await service.deleteManyDeliveryNotes([id, id]);

			expect(result.ids).toEqual([id]);
			expect(mockPrisma.deliveryNote.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: [id] } },
			});
		});

		it("should re-throw Prisma errors after logging", async () => {
			const dbError = new Prisma.PrismaClientKnownRequestError(
				"Foreign key constraint",
				{ code: "P2003", clientVersion: "5.0.0" },
			);
			mockPrisma.deliveryNote.deleteMany.mockRejectedValue(dbError);

			await expect(
				service.deleteManyDeliveryNotes([mockDeliveryNote.id]),
			).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
		});
	});

	// ── Purchase Receipt ────────────────────────────────────────────────────────

	const mockPurchaseReceiptItem = {
		id: "clh123pre_item01",
		purchaseReceiptId: "clh123pre000001",
		itemCode: "PRE-ITM-001",
		itemName: "Purchase Test Item",
		description: null as string | null,
		acceptedQuantity: 5,
		rejectedQuantity: 0,
		rate: 100,
		amount: 500,
		uom: null as string | null,
		acceptedWarehouse: "Main Warehouse",
		rejectedWarehouse: null as string | null,
	};

	const mockPurchaseReceiptTax = {
		id: "clh123pre_tax01",
		purchaseReceiptId: "clh123pre000001",
		type: "On Net Total",
		accountHead: "VAT 5%",
		taxRate: 5,
		amount: 25,
		total: 525,
	};

	const mockPurchaseReceipt = {
		id: "clh123pre000001",
		series: "MAT-PRE-2026-00001",
		seriesPattern: "MAT-PRE-.YYYY.-",
		postingDate: new Date("2026-03-23T00:00:00.000Z"),
		postingTime: "12:30:00",
		editPostingDateTime: false,
		supplier: "ACME Supplies",
		company: "Aria Corp",
		status: "DRAFT" as const,
		isReturn: false,
		applyPutawayRule: false,
		supplierDeliveryNote: null as string | null,
		acceptedWarehouse: "Main Warehouse",
		rejectedWarehouse: null as string | null,
		isSubcontracted: false,
		currency: "INR",
		priceList: null as string | null,
		totalQuantity: 5,
		totalAcceptedQuantity: 5,
		totalRejectedQuantity: 0,
		totalAmount: 500,
		taxesAndChargesAdded: 25,
		taxesAndChargesDeducted: 0,
		totalTaxesAndCharges: 25,
		grandTotal: 525,
		roundingAdjustment: 0,
		roundedTotal: 525,
		disableRoundedTotal: false,
		supplierAddress: null as string | null,
		contactPerson: null as string | null,
		shippingAddressTemplate: null as string | null,
		companyTRN: null as string | null,
		billingAddress: null as string | null,
		terms: null as string | null,
		termsContent: null as string | null,
		letterHead: null as string | null,
		printHeading: null as string | null,
		groupSameItems: false,
		permitNumber: null as string | null,
		recoverableStandardRatedExpenses: 0,
		reverseChargeApplicable: "N" as const,
		transporterName: null as string | null,
		vehicleNumber: null as string | null,
		vehicleDate: null as Date | null,
		instructions: null as string | null,
		remarks: null as string | null,
		isInternalSupplier: false,
		items: [mockPurchaseReceiptItem],
		taxes: [mockPurchaseReceiptTax],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

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

	// ── Pick List ─────────────────────────────────────────────────────────────

	const mockPickListItem = {
		id: "clh123pklitem01",
		pickListId: "clh123pkl000001",
		item: "ITEM-001",
		warehouse: "Main Warehouse" as string | null,
		qty: 5,
		stockQty: null as number | null,
		pickedQty: null as number | null,
	};

	const mockPickList = {
		id: "clh123pkl000001",
		series: "STO-PICK-2026-00001",
		seriesPattern: "STO-PICK-.YYYY.-",
		status: "DRAFT" as const,
		company: "Aria Corp",
		customer: null as string | null,
		purpose: "MATERIAL_TRANSFER_FOR_MANUFACTURE" as const,
		workOrder: null as string | null,
		warehouse: null as string | null,
		considerRejectedWarehouses: false,
		pickManually: false,
		ignorePricingRule: false,
		scanMode: false,
		promptQty: false,
		scanBarcode: null as string | null,
		groupSameItems: false,
		items: [mockPickListItem],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	describe("findAllPickLists", () => {
		it("should apply bounded pagination and optional filters", async () => {
			mockPrisma.pickList.findMany.mockResolvedValue([mockPickList]);

			const result = await service.findAllPickLists({
				skip: -5,
				take: 999,
				search: "aria",
				status: "OPEN",
			});

			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe(mockPickList.id);
			expect(mockPrisma.pickList.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 250,
					where: expect.objectContaining({
						status: "OPEN",
						OR: expect.any(Array),
					}),
				}),
			);
		});
	});

	describe("createPickList", () => {
		it("should create a pick list with a generated series", async () => {
			mockPrisma.pickList.findFirst.mockResolvedValue(null);
			mockPrisma.pickList.create.mockResolvedValue(mockPickList);

			const result = await service.createPickList({
				company: "Aria Corp",
				items: [{ item: "ITEM-001", qty: 5 }],
			});

			expect(result.id).toBe(mockPickList.id);
			const callArgs = mockPrisma.pickList.create.mock.calls[0][0] as {
				data: { series: string };
			};
			expect(callArgs.data.series).toMatch(/^STO-PICK-\d{4}-\d{5}$/);
		});

		it("should retry on a series uniqueness conflict and succeed", async () => {
			const conflict = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.pickList.findFirst
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(null);
			mockPrisma.pickList.create
				.mockRejectedValueOnce(conflict)
				.mockResolvedValueOnce(mockPickList);

			const result = await service.createPickList({ company: "Aria Corp" });

			expect(result.id).toBe(mockPickList.id);
			expect(mockPrisma.pickList.create).toHaveBeenCalledTimes(2);
		});

		it("should throw ConflictException after 3 failed series attempts", async () => {
			const conflict = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.pickList.findFirst.mockResolvedValue(null);
			mockPrisma.pickList.create.mockRejectedValue(conflict);

			await expect(
				service.createPickList({ company: "Aria Corp" }),
			).rejects.toThrow(ConflictException);
			expect(mockPrisma.pickList.create).toHaveBeenCalledTimes(3);
		});
	});

	describe("updatePickList", () => {
		it("should patch nested items without replacing unchanged rows", async () => {
			mockPrisma.pickList.findUnique.mockResolvedValue({ id: mockPickList.id });
			mockPrisma.pickList.update.mockResolvedValue({});
			mockPrisma.pickListItem.findMany.mockResolvedValue([
				{ id: mockPickListItem.id },
			]);
			mockPrisma.pickListItem.deleteMany.mockResolvedValue({ count: 0 });
			mockPrisma.pickListItem.update.mockResolvedValue(mockPickListItem);
			mockPrisma.pickList.findUniqueOrThrow.mockResolvedValue(mockPickList);

			const result = await service.updatePickList({
				id: mockPickList.id,
				items: [{ id: mockPickListItem.id, item: "ITEM-001", qty: 10 }],
			});

			expect(result.id).toBe(mockPickList.id);
			expect(mockPrisma.pickListItem.deleteMany).toHaveBeenCalledWith({
				where: {
					pickListId: mockPickList.id,
					id: { notIn: [mockPickListItem.id] },
				},
			});
			expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
		});

		it("should throw NotFoundException when pick list does not exist", async () => {
			mockPrisma.pickList.findUnique.mockResolvedValue(null);

			await expect(
				service.updatePickList({ id: "missing-id", company: "X" }),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("deletePickList", () => {
		it("should delete a pick list", async () => {
			mockPrisma.pickList.delete.mockResolvedValue({});

			const result = await service.deletePickList(mockPickList.id);

			expect(result).toEqual({ success: true, id: mockPickList.id });
			expect(mockPrisma.pickList.delete).toHaveBeenCalledWith({
				where: { id: mockPickList.id },
			});
		});

		it("should throw NotFoundException when pick list does not exist", async () => {
			const notFoundError = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{ code: "P2025", clientVersion: "5.0.0" },
			);
			mockPrisma.pickList.delete.mockRejectedValue(notFoundError);

			await expect(service.deletePickList("missing-id")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("deleteManyPickLists", () => {
		it("should deduplicate ids and bulk-delete pick lists", async () => {
			mockPrisma.pickList.deleteMany.mockResolvedValue({ count: 1 });

			const result = await service.deleteManyPickLists([
				mockPickList.id,
				mockPickList.id,
			]);

			expect(result).toEqual({
				success: true,
				count: 1,
				ids: [mockPickList.id],
			});
			expect(mockPrisma.pickList.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: [mockPickList.id] } },
			});
		});
	});

	// ── Delivery Trip ──────────────────────────────────────────────────────────

	const mockDeliveryTripStop = {
		id: "clh123dtstop001",
		deliveryTripId: "clh123dt000001",
		stopNumber: 1,
		customer: "Customer A",
		addressName: "456 Oak Ave",
		locked: false,
		deliveryNote: null,
		estimatedArrival: null,
	};

	const mockDeliveryTrip = {
		id: "clh123dt000001",
		series: "MAT-DT-2026-00001",
		seriesPattern: "MAT-DT-.YYYY.-",
		status: "DRAFT",
		company: "Aria Corp",
		driver: "John Doe",
		driverAddress: "123 Main St",
		vehicle: "Truck-01",
		departureTime: new Date("2026-04-01T08:00:00.000Z"),
		initialEmailNotificationSent: false,
		createdAt: new Date(),
		updatedAt: new Date(),
		stops: [mockDeliveryTripStop],
	};

	describe("findAllDeliveryTrips", () => {
		it("should apply bounded pagination and optional filters", async () => {
			mockPrisma.deliveryTrip.findMany.mockResolvedValue([mockDeliveryTrip]);

			const result = await service.findAllDeliveryTrips({
				skip: -5,
				take: 999,
				search: "aria",
				status: "DRAFT",
			});

			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe(mockDeliveryTrip.id);
			expect(mockPrisma.deliveryTrip.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 250,
					where: expect.objectContaining({
						status: "DRAFT",
						OR: expect.any(Array),
					}),
				}),
			);
		});
	});

	describe("createDeliveryTrip", () => {
		it("should create a delivery trip with a generated series", async () => {
			mockPrisma.deliveryTrip.findFirst.mockResolvedValue(null);
			mockPrisma.deliveryTrip.create.mockResolvedValue(mockDeliveryTrip);

			const result = await service.createDeliveryTrip({
				company: "Aria Corp",
				stops: [{ stopNumber: 1, addressName: "456 Oak Ave" }],
			});

			expect(result.id).toBe(mockDeliveryTrip.id);
			const callArgs = mockPrisma.deliveryTrip.create.mock.calls[0][0] as {
				data: { series: string };
			};
			expect(callArgs.data.series).toMatch(/^MAT-DT-\d{4}-\d{5}$/);
		});

		it("should retry on a series uniqueness conflict and succeed", async () => {
			const conflict = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.deliveryTrip.findFirst
				.mockResolvedValueOnce(null)
				.mockResolvedValueOnce(null);
			mockPrisma.deliveryTrip.create
				.mockRejectedValueOnce(conflict)
				.mockResolvedValueOnce(mockDeliveryTrip);

			const result = await service.createDeliveryTrip({ company: "Aria Corp" });

			expect(result.id).toBe(mockDeliveryTrip.id);
			expect(mockPrisma.deliveryTrip.create).toHaveBeenCalledTimes(2);
		});

		it("should throw ConflictException after 3 failed series attempts", async () => {
			const conflict = new Prisma.PrismaClientKnownRequestError("Duplicate", {
				code: "P2002",
				clientVersion: "5.0.0",
			});
			mockPrisma.deliveryTrip.findFirst.mockResolvedValue(null);
			mockPrisma.deliveryTrip.create.mockRejectedValue(conflict);

			await expect(
				service.createDeliveryTrip({ company: "Aria Corp" }),
			).rejects.toThrow(ConflictException);
			expect(mockPrisma.deliveryTrip.create).toHaveBeenCalledTimes(3);
		});
	});

	describe("updateDeliveryTrip", () => {
		it("should patch nested stops without replacing unchanged rows", async () => {
			mockPrisma.deliveryTrip.findUnique.mockResolvedValue({
				id: mockDeliveryTrip.id,
			});
			mockPrisma.deliveryTrip.update.mockResolvedValue({});
			mockPrisma.deliveryTripStop.findMany.mockResolvedValue([
				{ id: mockDeliveryTripStop.id },
			]);
			mockPrisma.deliveryTripStop.deleteMany.mockResolvedValue({ count: 0 });
			mockPrisma.deliveryTripStop.update.mockResolvedValue(
				mockDeliveryTripStop,
			);
			mockPrisma.deliveryTrip.findUniqueOrThrow.mockResolvedValue(
				mockDeliveryTrip,
			);

			const result = await service.updateDeliveryTrip({
				id: mockDeliveryTrip.id,
				stops: [
					{
						id: mockDeliveryTripStop.id,
						stopNumber: 1,
						addressName: "456 Oak Ave",
					},
				],
			});

			expect(result.id).toBe(mockDeliveryTrip.id);
			expect(mockPrisma.deliveryTripStop.deleteMany).toHaveBeenCalledWith({
				where: {
					deliveryTripId: mockDeliveryTrip.id,
					id: { notIn: [mockDeliveryTripStop.id] },
				},
			});
			expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
		});

		it("should throw NotFoundException when delivery trip does not exist", async () => {
			mockPrisma.deliveryTrip.findUnique.mockResolvedValue(null);

			await expect(
				service.updateDeliveryTrip({ id: "missing-id", company: "X" }),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("deleteDeliveryTrip", () => {
		it("should delete a delivery trip", async () => {
			mockPrisma.deliveryTrip.delete.mockResolvedValue({});

			const result = await service.deleteDeliveryTrip(mockDeliveryTrip.id);

			expect(result).toEqual({ success: true, id: mockDeliveryTrip.id });
			expect(mockPrisma.deliveryTrip.delete).toHaveBeenCalledWith({
				where: { id: mockDeliveryTrip.id },
			});
		});

		it("should throw NotFoundException when delivery trip does not exist", async () => {
			const notFoundError = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{ code: "P2025", clientVersion: "5.0.0" },
			);
			mockPrisma.deliveryTrip.delete.mockRejectedValue(notFoundError);

			await expect(service.deleteDeliveryTrip("missing-id")).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe("deleteManyDeliveryTrips", () => {
		it("should deduplicate ids and bulk-delete delivery trips", async () => {
			mockPrisma.deliveryTrip.deleteMany.mockResolvedValue({ count: 1 });

			const result = await service.deleteManyDeliveryTrips([
				mockDeliveryTrip.id,
				mockDeliveryTrip.id,
			]);

			expect(result).toEqual({
				success: true,
				count: 1,
				ids: [mockDeliveryTrip.id],
			});
			expect(mockPrisma.deliveryTrip.deleteMany).toHaveBeenCalledWith({
				where: { id: { in: [mockDeliveryTrip.id] } },
			});
		});
	});

	describe("serial numbers", () => {
		it("should list serial numbers with bounded filters", async () => {
			mockPrisma.serialNo.findMany.mockResolvedValue([mockSerialNo]);
			mockPrisma.serialNo.count.mockResolvedValue(1);

			const result = await service.findSerialNos({
				search: "SN-1001",
				status: "AVAILABLE",
				take: 25,
			});

			expect(result.totalCount).toBe(1);
			expect(result.items[0]?.serialNo).toBe("SN-1001");
			expect(mockPrisma.serialNo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 25,
				}),
			);
		});

		it("should list service contract expiry rows with derived states", async () => {
			const today = new Date();
			today.setUTCHours(0, 0, 0, 0);
			const expiredDate = new Date(today);
			expiredDate.setUTCDate(expiredDate.getUTCDate() - 5);
			const dueSoonDate = new Date(today);
			dueSoonDate.setUTCDate(dueSoonDate.getUTCDate() + 10);

			mockPrisma.serialNo.findMany.mockResolvedValue([
				{
					...mockSerialNo,
					id: "serial-expired",
					serialNo: "SN-EXPIRED",
					serviceContractExpiryDate: expiredDate,
				},
				{
					...mockSerialNo,
					id: "serial-due-soon",
					serialNo: "SN-DUE-SOON",
					serviceContractExpiryDate: dueSoonDate,
				},
			]);
			mockPrisma.serialNo.count.mockResolvedValue(2);

			const result = await service.findSerialNoServiceContractExpiry({
				status: "AVAILABLE",
				expiringWithinDays: 30,
				take: 20,
			});

			expect(result.totalCount).toBe(2);
			expect(result.items[0]?.expiryState).toBe("EXPIRED");
			expect(result.items[1]?.expiryState).toBe("DUE_SOON");
			expect(mockPrisma.serialNo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 20,
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								serviceContractExpiryDate: { not: null },
							}),
							expect.objectContaining({ status: "AVAILABLE" }),
						]),
					}),
				}),
			);
		});

		it("should apply expiry-state windows for service contract expiry rows", async () => {
			mockPrisma.serialNo.findMany.mockResolvedValue([]);
			mockPrisma.serialNo.count.mockResolvedValue(0);

			await service.findSerialNoServiceContractExpiry({
				expiryState: "ACTIVE",
				expiringWithinDays: 15,
			});

			expect(mockPrisma.serialNo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								serviceContractExpiryDate: expect.objectContaining({
									gt: expect.any(Date),
								}),
							}),
						]),
					}),
				}),
			);
		});

		it("should list warranty expiry rows with derived states", async () => {
			const today = new Date();
			today.setUTCHours(0, 0, 0, 0);
			const expiredDate = new Date(today);
			expiredDate.setUTCDate(expiredDate.getUTCDate() - 5);
			const dueSoonDate = new Date(today);
			dueSoonDate.setUTCDate(dueSoonDate.getUTCDate() + 10);

			mockPrisma.serialNo.findMany.mockResolvedValue([
				{
					...mockSerialNo,
					id: "serial-warranty-expired",
					serialNo: "SN-WE-1",
					warrantyExpiryDate: expiredDate,
					serviceContractExpiryDate: null,
				},
				{
					...mockSerialNo,
					id: "serial-warranty-due-soon",
					serialNo: "SN-WD-1",
					warrantyExpiryDate: dueSoonDate,
					serviceContractExpiryDate: null,
				},
			]);
			mockPrisma.serialNo.count.mockResolvedValue(2);

			const result = await service.findSerialNoWarrantyExpiry({
				status: "AVAILABLE",
				expiringWithinDays: 30,
				take: 20,
			});

			expect(result.totalCount).toBe(2);
			expect(result.items[0]?.expiryState).toBe("EXPIRED");
			expect(result.items[1]?.expiryState).toBe("DUE_SOON");
			expect(mockPrisma.serialNo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 20,
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								warrantyExpiryDate: { not: null },
							}),
							expect.objectContaining({ status: "AVAILABLE" }),
						]),
					}),
				}),
			);
		});

		it("should apply expiry-state windows for warranty expiry rows", async () => {
			mockPrisma.serialNo.findMany.mockResolvedValue([]);
			mockPrisma.serialNo.count.mockResolvedValue(0);

			await service.findSerialNoWarrantyExpiry({
				expiryState: "ACTIVE",
				expiringWithinDays: 15,
			});

			expect(mockPrisma.serialNo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								warrantyExpiryDate: expect.objectContaining({
									gt: expect.any(Date),
								}),
							}),
						]),
					}),
				}),
			);
		});

		it("should filter warranty expiry by EXPIRED state", async () => {
			mockPrisma.serialNo.findMany.mockResolvedValue([]);
			mockPrisma.serialNo.count.mockResolvedValue(0);

			await service.findSerialNoWarrantyExpiry({
				expiryState: "EXPIRED",
				expiringWithinDays: 30,
			});

			expect(mockPrisma.serialNo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								warrantyExpiryDate: expect.objectContaining({
									lt: expect.any(Date),
								}),
							}),
						]),
					}),
				}),
			);
		});

		it("should apply date range filter for warranty expiry", async () => {
			mockPrisma.serialNo.findMany.mockResolvedValue([]);
			mockPrisma.serialNo.count.mockResolvedValue(0);

			await service.findSerialNoWarrantyExpiry({
				expiryDateFrom: new Date("2026-04-01T00:00:00.000Z"),
				expiryDateTo: new Date("2026-04-30T00:00:00.000Z"),
			});

			expect(mockPrisma.serialNo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({
								warrantyExpiryDate: expect.objectContaining({
									gte: expect.any(Date),
									lte: expect.any(Date),
								}),
							}),
						]),
					}),
				}),
			);
		});

		it("should exclude disabled serial numbers from warranty expiry by default", async () => {
			mockPrisma.serialNo.findMany.mockResolvedValue([]);
			mockPrisma.serialNo.count.mockResolvedValue(0);

			await service.findSerialNoWarrantyExpiry();

			expect(mockPrisma.serialNo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({ isDisabled: false }),
						]),
					}),
				}),
			);
		});

		it("should skip serial nos without warrantyExpiryDate even when in result set", async () => {
			mockPrisma.serialNo.findMany.mockResolvedValue([
				{
					...mockSerialNo,
					warrantyExpiryDate: null,
					serviceContractExpiryDate: null,
				},
			]);
			mockPrisma.serialNo.count.mockResolvedValue(1);

			const result = await service.findSerialNoWarrantyExpiry();

			expect(result.items).toHaveLength(0);
			expect(result.totalCount).toBe(1);
		});

		it("should list serial number status rows with derived status ageing", async () => {
			const statusChangedAt = new Date("2026-03-24T00:00:00.000Z");

			mockPrisma.serialNo.findMany.mockResolvedValue([
				{
					...mockSerialNo,
					history: [
						{
							...mockSerialNo.history[0],
							id: "serial-history-2",
							eventType: "STATUS_CHANGED",
							fromStatus: "DRAFT",
							toStatus: "AVAILABLE",
							createdAt: statusChangedAt,
						},
					],
				},
			]);
			mockPrisma.serialNo.count.mockResolvedValue(1);

			const result = await service.findSerialNoStatus({
				status: "AVAILABLE",
				take: 20,
			});

			expect(result.totalCount).toBe(1);
			expect(result.items[0]?.status).toBe("AVAILABLE");
			expect(result.items[0]?.lastStatusChangedAt).toEqual(statusChangedAt);
			expect(result.items[0]?.daysInCurrentStatus).toBeGreaterThanOrEqual(0);
			expect(mockPrisma.serialNo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 20,
					where: expect.objectContaining({
						AND: expect.arrayContaining([
							expect.objectContaining({ status: "AVAILABLE" }),
						]),
					}),
				}),
			);
		});

		it("should list serial number status rows without disabled records by default", async () => {
			mockPrisma.serialNo.findMany.mockResolvedValue([]);
			mockPrisma.serialNo.count.mockResolvedValue(0);

			await service.findSerialNoStatus();

			expect(mockPrisma.serialNo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: expect.objectContaining({ isDisabled: false }),
				}),
			);
		});

		it("should create a serial number when the item supports serial tracking", async () => {
			mockPrisma.inventoryItem.findUnique.mockResolvedValue({
				id: mockItem.id,
				code: mockItem.code,
				name: mockItem.name,
				hasSerialNo: true,
				disabled: false,
			});
			mockPrisma.warehouse.findUnique.mockResolvedValue({
				id: mockWarehouse.id,
				name: mockWarehouse.name,
				company: "Aria Corp",
				disabled: false,
			});
			mockPrisma.serialNo.create.mockResolvedValue(mockSerialNo);

			const result = await service.createSerialNo({
				serialNo: "SN-1001",
				itemId: mockItem.id,
				company: "Aria Corp",
				status: "AVAILABLE",
				currentWarehouseId: mockWarehouse.id,
				isDisabled: false,
			});

			expect(result.serialNo).toBe("SN-1001");
			expect(mockPrisma.serialNo.create).toHaveBeenCalled();
		});

		it("should reject invalid status transitions when updating a serial number", async () => {
			mockPrisma.serialNo.findUnique.mockResolvedValue({
				id: mockSerialNo.id,
				serialNo: mockSerialNo.serialNo,
				itemId: mockSerialNo.itemId,
				company: mockSerialNo.company,
				status: "DISPOSED",
				currentWarehouseId: null,
				purchaseReceiptId: null,
				deliveryNoteId: null,
				stockEntryId: null,
				pickListId: null,
				workOrder: null,
				purchaseDate: null,
				warrantyExpiryDate: null,
				serviceContractExpiryDate: null,
				maintenanceStatus: null,
				notes: null,
				isDisabled: false,
			});

			await expect(
				service.updateSerialNo({
					id: mockSerialNo.id,
					status: "AVAILABLE",
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("should prevent deleting linked serial numbers", async () => {
			mockPrisma.serialNo.findUnique.mockResolvedValue({
				id: mockSerialNo.id,
				status: "AVAILABLE",
				purchaseReceiptId: "receipt-1",
				deliveryNoteId: null,
				stockEntryId: null,
				pickListId: null,
			});

			await expect(service.deleteSerialNo(mockSerialNo.id)).rejects.toThrow(
				BadRequestException,
			);
		});
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

	describe("installation notes", () => {
		it("should list installation notes with bounded filters", async () => {
			mockPrisma.installationNote.findMany.mockResolvedValue([
				mockInstallationNote,
			]);
			mockPrisma.installationNote.count.mockResolvedValue(1);

			const result = await service.findInstallationNotes({
				search: "Acme",
				status: "DRAFT",
				take: 25,
			});

			expect(result.totalCount).toBe(1);
			expect(result.items[0]?.series).toBe("MAT-INS-2026-00001");
			expect(mockPrisma.installationNote.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 0,
					take: 25,
				}),
			);
		});

		it("should create an installation note and install linked serials", async () => {
			mockPrisma.installationNote.findFirst.mockResolvedValue(null);
			mockPrisma.inventoryItem.findMany.mockResolvedValue([
				{
					id: mockItem.id,
					code: mockItem.code,
					name: mockItem.name,
					hasSerialNo: true,
					disabled: false,
				},
			]);
			mockPrisma.serialNo.findMany.mockResolvedValue([
				{
					id: mockSerialNo.id,
					serialNo: mockSerialNo.serialNo,
					itemId: mockItem.id,
					company: "Aria Corp",
					status: "DELIVERED",
					deliveryNoteId: null,
					isDisabled: false,
				},
			]);
			mockPrisma.installationNote.create.mockResolvedValue(
				mockInstallationNote,
			);
			mockPrisma.serialNo.update.mockResolvedValue(mockSerialNo);

			const result = await service.createInstallationNote({
				customer: "Acme Industries",
				company: "Aria Corp",
				status: "COMPLETED",
				items: [
					{
						itemId: mockItem.id,
						serialNoId: mockSerialNo.id,
						description: "Onsite setup",
						installedQty: 1,
					},
				],
			});

			expect(result.series).toBe("MAT-INS-2026-00001");
			expect(mockPrisma.serialNo.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: mockSerialNo.id },
					data: expect.objectContaining({
						status: "INSTALLED",
					}),
				}),
			);
		});

		it("should reject completed installation notes without required serial numbers", async () => {
			mockPrisma.inventoryItem.findMany.mockResolvedValue([
				{
					id: mockItem.id,
					code: mockItem.code,
					name: mockItem.name,
					hasSerialNo: true,
					disabled: false,
				},
			]);

			await expect(
				service.createInstallationNote({
					customer: "Acme Industries",
					company: "Aria Corp",
					status: "COMPLETED",
					items: [
						{
							itemId: mockItem.id,
							installedQty: 1,
						},
					],
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("should prevent deleting non-draft installation notes", async () => {
			mockPrisma.installationNote.findUnique.mockResolvedValue({
				id: mockInstallationNote.id,
				status: "COMPLETED",
			});

			await expect(
				service.deleteInstallationNote(mockInstallationNote.id),
			).rejects.toThrow(BadRequestException);
		});
	});
});
