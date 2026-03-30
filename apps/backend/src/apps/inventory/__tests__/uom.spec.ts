import {
	ConflictException,
	createTestContext,
	Inventory,
	mockUnitOfMeasure,
	NotFoundException,
	Prisma,
} from "./inventory-test-helpers";

describe("InventoryService > Unit of Measure", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		const ctx = createTestContext();
		service = ctx.service;
		mockPrisma = ctx.mockPrisma;
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
});
