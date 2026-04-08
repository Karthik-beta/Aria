import {
	BadRequestException,
	createTestContext,
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

	function getRawSqlCall(index = 0) {
		const query = mockPrisma.client.$queryRaw.mock.calls[index]?.[0] as
			| {
					strings?: string[];
					values?: unknown[];
			  }
			| undefined;

		return {
			text: query?.strings?.join(" ") ?? "",
			values: query?.values ?? [],
		};
	}

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
			mockPrisma.client.$queryRaw.mockReset();
			mockPrisma.item.findMany.mockReset();
			mockPrisma.client.$queryRaw.mockResolvedValue([
				{
					company: "Aria Corp",
					itemCode: mockStockEntryItem.itemCode,
					itemName: "Stock Test Item",
					warehouse: "Stores - GH",
					unitOfMeasure: "Nos",
					openingQty: 10,
					openingValue: 1000,
					inQty: 0,
					inValue: 0,
					outQty: 3,
					outValue: 300,
					lastPostingDate: new Date("2026-03-05T00:00:00.000Z"),
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
			expect(mockPrisma.client.$queryRaw).toHaveBeenCalledTimes(1);
			expect(getRawSqlCall().text).toContain(
				`GROUP BY company, "itemCode", warehouse`,
			);
		});

		it("should map filters and preserve zero-balance rows only when requested", async () => {
			mockPrisma.client.$queryRaw.mockReset();
			mockPrisma.item.findMany.mockReset();
			mockPrisma.client.$queryRaw.mockResolvedValue([]);
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

			const rawQuery = getRawSqlCall();
			expect(rawQuery.text).toContain(`status =`);
			expect(rawQuery.text).toContain(
				`GROUP BY company, "itemCode", warehouse`,
			);
			expect(rawQuery.values).toEqual(
				expect.arrayContaining([
					"DRAFT",
					"%Aria%",
					"%ITEM%",
					"ITEM-001",
					"stores - gh",
					"%Project%",
					new Date("2026-03-31T00:00:00.000Z"),
					"%nova%",
				]),
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
			mockPrisma.client.$queryRaw.mockReset();
			mockPrisma.client.$queryRaw.mockResolvedValue([
				{
					id: "clh123ste_item01:Stores - GH:IN",
					stockEntryId: mockStockEntry.id,
					stockEntryItemId: "clh123ste_item01",
					itemCode: "STE-ITM-001",
					itemName: "Stock Test Item",
					company: "Aria Corp",
					warehouse: "Stores - GH",
					postingDate: new Date("2026-03-22T00:00:00.000Z"),
					voucherNo: "MAT-STE-2026-00001",
					qtyChange: 4,
					incomingRate: 250,
					movementType: "IN",
					createdAt: new Date("2026-03-22T00:00:00.000Z"),
					updatedAt: new Date("2026-03-22T00:00:00.000Z"),
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
			mockPrisma.client.$queryRaw.mockReset();
			mockPrisma.client.$queryRaw.mockResolvedValue([]);

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

			const rawQuery = getRawSqlCall();
			expect(rawQuery.text).toContain(`ORDER BY "postingDate" DESC`);
			expect(rawQuery.values).toEqual(
				expect.arrayContaining([
					"DRAFT",
					"%Aria%",
					"%MAT-STE%",
					"%STE%",
					"stores - gh",
					new Date("2026-03-01T00:00:00.000Z"),
					new Date("2026-03-31T00:00:00.000Z"),
					"%stock%",
					0,
					250,
				]),
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
			mockPrisma.client.$queryRaw.mockReset();
			mockPrisma.client.$queryRaw.mockResolvedValue([
				{
					company: "Aria Corp",
					itemCode: "STE-ITM-001",
					itemName: "Stock Test Item",
					description: "Primary item",
					warehouse: "Stores - GH",
					unitOfMeasure: "Nos",
					actualQty: 11,
					plannedQty: 0,
					requestedQty: 30,
					orderedQty: 25,
					reservedQty: 5,
					reservedQtyForProduction: 4,
					reservedQtyForSubcontracting: 0,
					reservedQtyForProductionPlan: 0,
					lastActivityDate: new Date("2026-03-22T00:00:00.000Z"),
				},
			]);
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
			mockPrisma.client.$queryRaw.mockReset();
			mockPrisma.inventoryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();

			mockPrisma.client.$queryRaw.mockResolvedValue([
				{
					company: "Aria Corp",
					itemCode: "STE-ITM-001",
					itemName: "Stock Test Item",
					description: "Primary item",
					warehouse: "Stores - GH",
					unitOfMeasure: "Nos",
					actualQty: 2,
					plannedQty: 0,
					requestedQty: 0,
					orderedQty: 0,
					reservedQty: 0,
					reservedQtyForProduction: 0,
					reservedQtyForSubcontracting: 0,
					reservedQtyForProductionPlan: 0,
					lastActivityDate: new Date("2026-03-22T00:00:00.000Z"),
				},
				{
					company: "Aria Corp",
					itemCode: "STE-ITM-002",
					itemName: "Stock Test Item 2",
					description: "Secondary item",
					warehouse: "Stores - GH",
					unitOfMeasure: "Nos",
					actualQty: 9,
					plannedQty: 0,
					requestedQty: 0,
					orderedQty: 0,
					reservedQty: 0,
					reservedQtyForProduction: 0,
					reservedQtyForSubcontracting: 0,
					reservedQtyForProductionPlan: 0,
					lastActivityDate: new Date("2026-03-22T00:00:00.000Z"),
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
			mockPrisma.client.$queryRaw.mockReset();
			mockPrisma.inventoryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();

			mockPrisma.client.$queryRaw.mockResolvedValue([
				{
					company: "Aria Corp",
					itemCode: "STE-ITM-001",
					itemName: "Stock Test Item",
					description: "Primary item",
					warehouse: "Stores - GH",
					unitOfMeasure: "Nos",
					actualQty: 8,
					plannedQty: 0,
					requestedQty: 0,
					orderedQty: 0,
					reservedQty: 0,
					reservedQtyForProduction: 0,
					reservedQtyForSubcontracting: 0,
					reservedQtyForProductionPlan: 0,
					lastActivityDate: new Date("2026-03-22T00:00:00.000Z"),
				},
			]);
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
			mockPrisma.client.$queryRaw.mockReset();
			mockPrisma.inventoryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();

			mockPrisma.inventoryItem.findMany
				.mockResolvedValueOnce([{ code: "STE-ITM-001" }])
				.mockResolvedValueOnce([]);
			mockPrisma.item.findMany.mockResolvedValueOnce([{ code: "STE-ITM-001" }]);
			mockPrisma.client.$queryRaw.mockResolvedValue([]);

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

			const rawQuery = getRawSqlCall();
			expect(rawQuery.text).toContain(`se.status = 'SUBMITTED'`);
			expect(rawQuery.text).toContain(`dn.status IN ('DRAFT', 'TO_BILL')`);
			expect(rawQuery.values).toEqual(
				expect.arrayContaining([
					"%Aria%",
					"%STE%",
					"STE-ITM-001",
					"stores - gh",
					"%nova%",
				]),
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
			mockPrisma.client.$queryRaw.mockReset();
			mockPrisma.inventoryItem.findMany.mockReset();
			mockPrisma.item.findMany.mockReset();

			mockPrisma.client.$queryRaw
				.mockResolvedValueOnce([
					{
						id: "clh123ste_item01",
						itemCode: "STE-ITM-001",
						itemName: "Stock Test Item",
						description: "Primary item",
						qty: 10,
						basicRate: 100,
						basicAmount: 1000,
						unitOfMeasure: "Nos",
						sourceWarehouse: null,
						targetWarehouse: "Stores - GH",
						stockEntryId: mockStockEntry.id,
						series: mockStockEntry.series,
						company: "Aria Corp",
						status: "SUBMITTED",
						stockEntryType: "MATERIAL_RECEIPT",
						postingDate: new Date("2026-01-01T00:00:00.000Z"),
						defaultSourceWarehouse: null,
						defaultTargetWarehouse: "Stores - GH",
						project: null,
						remarks: null,
						createdAt: new Date("2026-01-01T00:00:00.000Z"),
						updatedAt: new Date("2026-01-01T00:00:00.000Z"),
					},
					{
						id: "clh123ste_item02",
						itemCode: "STE-ITM-001",
						itemName: "Stock Test Item",
						description: "Primary item",
						qty: 4,
						basicRate: 100,
						basicAmount: 400,
						unitOfMeasure: "Nos",
						sourceWarehouse: "Stores - GH",
						targetWarehouse: null,
						stockEntryId: "clh123ste000002",
						series: "MAT-STE-2026-00002",
						company: "Aria Corp",
						status: "SUBMITTED",
						stockEntryType: "MATERIAL_ISSUE",
						postingDate: new Date("2026-01-20T00:00:00.000Z"),
						defaultSourceWarehouse: "Stores - GH",
						defaultTargetWarehouse: null,
						project: null,
						remarks: null,
						createdAt: new Date("2026-01-20T00:00:00.000Z"),
						updatedAt: new Date("2026-01-20T00:00:00.000Z"),
					},
				])
				.mockResolvedValueOnce([]);
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
			mockPrisma.client.$queryRaw.mockReset();
			mockPrisma.item.findMany.mockReset();
			mockPrisma.client.$queryRaw.mockResolvedValue([]);
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

			const rawQuery = getRawSqlCall();
			expect(rawQuery.text).toContain(`se.status = 'SUBMITTED'`);
			expect(rawQuery.text).toContain(`LIMIT`);
			expect(rawQuery.values).toEqual(
				expect.arrayContaining([
					new Date("2026-03-31T00:00:00.000Z"),
					"%Aria%",
					"%STE%",
					"STE-ITM-001",
					"stores - gh",
				]),
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
