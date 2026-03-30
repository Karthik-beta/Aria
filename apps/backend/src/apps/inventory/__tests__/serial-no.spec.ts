import {
	BadRequestException,
	createTestContext,
	mockItem,
	mockSerialNo,
	mockWarehouse,
} from "./inventory-test-helpers";

describe("InventoryService > Serial Number", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
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
});
