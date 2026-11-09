import {
	BadRequestException,
	createTestContext,
	mockInstallationNote,
	mockItem,
	mockSerialNo,
} from "./inventory-test-helpers";

describe("InventoryService > Installation Note", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
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

		it("should reject completing an installation note with an already installed serial number", async () => {
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
					status: "INSTALLED",
					deliveryNoteId: null,
					isDisabled: false,
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
							serialNoId: mockSerialNo.id,
							description: "Onsite setup",
							installedQty: 1,
						},
					],
				}),
			).rejects.toThrow(BadRequestException);
			expect(mockPrisma.serialNo.update).not.toHaveBeenCalled();
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
