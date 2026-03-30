import {
	ConflictException,
	createTestContext,
	mockDeliveryNote,
	mockDeliveryNoteItem,
	mockDeliveryTrip,
	mockDeliveryTripStop,
	mockPickList,
	mockPickListItem,
	NotFoundException,
	Prisma,
} from "./inventory-test-helpers";

describe("InventoryService > Delivery", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
	});

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

		it("should throw NotFoundException when record not found (P2025)", async () => {
			const notFoundError = new Prisma.PrismaClientKnownRequestError(
				"Record not found",
				{ code: "P2025", clientVersion: "5.0.0" },
			);
			mockPrisma.deliveryNote.delete.mockRejectedValue(notFoundError);

			await expect(service.deleteDeliveryNote("nonexistent")).rejects.toThrow(
				NotFoundException,
			);
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
			mockPrisma.deliveryTrip.findMany.mockResolvedValue([]);
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
			mockPrisma.deliveryTrip.findMany.mockResolvedValue([]);
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
			mockPrisma.deliveryTrip.findMany.mockResolvedValue([]);
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
});
