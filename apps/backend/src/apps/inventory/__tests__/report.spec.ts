import {
	BadRequestException,
	createTestContext,
	mockMR,
	mockMRItem,
	mockProjectedPickList,
	mockStockEntry,
	mockStockEntryItem,
} from "./inventory-test-helpers";

describe("InventoryService > Report", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
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
});
