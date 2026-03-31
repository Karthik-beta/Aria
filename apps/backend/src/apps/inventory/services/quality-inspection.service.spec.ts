/**
 * Unit tests for quality-inspection sub-service.
 *
 * @module quality-inspection.service.spec
 */
import { ConflictException, NotFoundException } from "@nestjs/common";
import { QualityInspectionSubService } from "./quality-inspection.service";

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const now = new Date("2024-06-15T00:00:00Z");

interface MockPrisma {
	qiParameterGroup: {
		findMany: jest.Mock;
		findUnique: jest.Mock;
		findFirst: jest.Mock;
		create: jest.Mock;
		update: jest.Mock;
		delete: jest.Mock;
	};
	qiParameter: {
		findMany: jest.Mock;
		findUnique: jest.Mock;
		create: jest.Mock;
		update: jest.Mock;
		delete: jest.Mock;
	};
	qiTemplate: {
		findMany: jest.Mock;
		findUnique: jest.Mock;
		findUniqueOrThrow: jest.Mock;
		create: jest.Mock;
		update: jest.Mock;
		delete: jest.Mock;
		deleteMany: jest.Mock;
	};
	qiTemplateItem: {
		deleteMany: jest.Mock;
		createMany: jest.Mock;
	};
	$transaction: jest.Mock;
}

function buildMockPrisma(): MockPrisma {
	const mock: MockPrisma = {
		qiParameterGroup: {
			findMany: jest.fn().mockResolvedValue([]),
			findUnique: jest.fn().mockResolvedValue(null),
			findFirst: jest.fn().mockResolvedValue(null),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		qiParameter: {
			findMany: jest.fn().mockResolvedValue([]),
			findUnique: jest.fn().mockResolvedValue(null),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
		},
		qiTemplate: {
			findMany: jest.fn().mockResolvedValue([]),
			findUnique: jest.fn().mockResolvedValue(null),
			findUniqueOrThrow: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			delete: jest.fn(),
			deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
		},
		qiTemplateItem: {
			deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
			createMany: jest.fn().mockResolvedValue({ count: 0 }),
		},
		$transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => {
			return fn(mock);
		}),
	};
	return mock;
}

let mockPrisma: MockPrisma;
let service: QualityInspectionSubService;

beforeEach(() => {
	mockPrisma = buildMockPrisma();
	service = new QualityInspectionSubService(mockPrisma as never);
});

// ─── QI Parameter Groups ─────────────────────────────────────────────────────

describe("QI Parameter Groups", () => {
	describe("findAllQiParameterGroups", () => {
		it("returns mapped groups", async () => {
			mockPrisma.qiParameterGroup.findMany.mockResolvedValue([
				{ id: "g1", name: "Physical", createdAt: now, updatedAt: now },
			]);
			const result = await service.findAllQiParameterGroups();
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({
				id: "g1",
				name: "Physical",
				createdAt: now,
				updatedAt: now,
			});
		});
	});

	describe("createQiParameterGroup", () => {
		it("creates when name is unique", async () => {
			mockPrisma.qiParameterGroup.findUnique.mockResolvedValue(null);
			mockPrisma.qiParameterGroup.create.mockResolvedValue({
				id: "g2",
				name: "Chemical",
				createdAt: now,
				updatedAt: now,
			});
			const result = await service.createQiParameterGroup({
				name: "Chemical",
			});
			expect(result.name).toBe("Chemical");
			expect(mockPrisma.qiParameterGroup.create).toHaveBeenCalledWith({
				data: { name: "Chemical" },
			});
		});

		it("throws ConflictException for duplicate name", async () => {
			mockPrisma.qiParameterGroup.findUnique.mockResolvedValue({
				id: "g1",
				name: "Physical",
			});
			await expect(
				service.createQiParameterGroup({ name: "Physical" }),
			).rejects.toThrow(ConflictException);
		});
	});

	describe("updateQiParameterGroup", () => {
		it("updates when exists and name is unique", async () => {
			mockPrisma.qiParameterGroup.findUnique.mockResolvedValue({
				id: "g1",
				name: "Old",
				createdAt: now,
				updatedAt: now,
			});
			mockPrisma.qiParameterGroup.findFirst.mockResolvedValue(null);
			mockPrisma.qiParameterGroup.update.mockResolvedValue({
				id: "g1",
				name: "New",
				createdAt: now,
				updatedAt: now,
			});
			const result = await service.updateQiParameterGroup({
				id: "g1",
				name: "New",
			});
			expect(result.name).toBe("New");
		});

		it("throws NotFoundException when group not found", async () => {
			mockPrisma.qiParameterGroup.findUnique.mockResolvedValue(null);
			await expect(
				service.updateQiParameterGroup({ id: "missing", name: "X" }),
			).rejects.toThrow(NotFoundException);
		});

		it("throws ConflictException when renaming to existing name", async () => {
			mockPrisma.qiParameterGroup.findUnique.mockResolvedValue({
				id: "g1",
				name: "Old",
			});
			mockPrisma.qiParameterGroup.findFirst.mockResolvedValue({
				id: "g2",
				name: "Taken",
			});
			await expect(
				service.updateQiParameterGroup({ id: "g1", name: "Taken" }),
			).rejects.toThrow(ConflictException);
		});
	});

	describe("deleteQiParameterGroup", () => {
		it("deletes when exists", async () => {
			mockPrisma.qiParameterGroup.findUnique.mockResolvedValue({
				id: "g1",
				name: "X",
			});
			const result = await service.deleteQiParameterGroup("g1");
			expect(result).toEqual({ success: true, id: "g1" });
		});

		it("throws NotFoundException when not found", async () => {
			mockPrisma.qiParameterGroup.findUnique.mockResolvedValue(null);
			await expect(service.deleteQiParameterGroup("missing")).rejects.toThrow(
				NotFoundException,
			);
		});
	});
});

// ─── QI Parameters ───────────────────────────────────────────────────────────

describe("QI Parameters", () => {
	const mockParam = {
		id: "p1",
		parameter: "Hardness",
		description: null,
		groupId: "g1",
		group: { id: "g1", name: "Physical" },
		createdAt: now,
		updatedAt: now,
	};

	describe("createQiParameter", () => {
		it("creates parameter when unique", async () => {
			mockPrisma.qiParameter.findUnique.mockResolvedValue(null);
			mockPrisma.qiParameterGroup.findUnique.mockResolvedValue({
				id: "g1",
				name: "Physical",
			});
			mockPrisma.qiParameter.create.mockResolvedValue(mockParam);
			const result = await service.createQiParameter({
				parameter: "Hardness",
				groupId: "g1",
			});
			expect(result.parameter).toBe("Hardness");
			expect(result.groupName).toBe("Physical");
		});

		it("throws ConflictException for duplicate parameter name", async () => {
			mockPrisma.qiParameter.findUnique.mockResolvedValue(mockParam);
			await expect(
				service.createQiParameter({ parameter: "Hardness" }),
			).rejects.toThrow(ConflictException);
		});

		it("throws NotFoundException for invalid groupId", async () => {
			mockPrisma.qiParameter.findUnique.mockResolvedValue(null);
			mockPrisma.qiParameterGroup.findUnique.mockResolvedValue(null);
			await expect(
				service.createQiParameter({
					parameter: "New",
					groupId: "nonexistent",
				}),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("findQiParameterById", () => {
		it("returns mapped parameter when found", async () => {
			mockPrisma.qiParameter.findUnique.mockResolvedValue(mockParam);
			const result = await service.findQiParameterById("p1");
			expect(result).not.toBeNull();
			expect(result?.id).toBe("p1");
		});

		it("returns null when not found", async () => {
			mockPrisma.qiParameter.findUnique.mockResolvedValue(null);
			const result = await service.findQiParameterById("missing");
			expect(result).toBeNull();
		});
	});

	describe("updateQiParameter", () => {
		it("throws NotFoundException when parameter not found", async () => {
			mockPrisma.qiParameter.findUnique.mockResolvedValue(null);
			await expect(
				service.updateQiParameter({ id: "missing" }),
			).rejects.toThrow(NotFoundException);
		});

		it("throws ConflictException when renaming to existing name", async () => {
			mockPrisma.qiParameter.findUnique
				.mockResolvedValueOnce({
					id: "p1",
					parameter: "Old",
					groupId: null,
				})
				.mockResolvedValueOnce({
					id: "p2",
					parameter: "Taken",
				});
			await expect(
				service.updateQiParameter({ id: "p1", parameter: "Taken" }),
			).rejects.toThrow(ConflictException);
		});

		it("validates groupId if provided", async () => {
			mockPrisma.qiParameter.findUnique.mockResolvedValue({
				id: "p1",
				parameter: "X",
				groupId: null,
			});
			mockPrisma.qiParameterGroup.findUnique.mockResolvedValue(null);
			await expect(
				service.updateQiParameter({ id: "p1", groupId: "bad-group" }),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("deleteQiParameter", () => {
		it("deletes when exists", async () => {
			mockPrisma.qiParameter.findUnique.mockResolvedValue(mockParam);
			const result = await service.deleteQiParameter("p1");
			expect(result).toEqual({ success: true, id: "p1" });
		});

		it("throws NotFoundException when not found", async () => {
			mockPrisma.qiParameter.findUnique.mockResolvedValue(null);
			await expect(service.deleteQiParameter("gone")).rejects.toThrow(
				NotFoundException,
			);
		});
	});
});

// ─── QI Templates ────────────────────────────────────────────────────────────

describe("QI Templates", () => {
	const mockTemplate = {
		id: "t1",
		name: "Standard QI",
		items: [
			{
				id: "ti1",
				templateId: "t1",
				parameterId: "p1",
				sortOrder: 0,
				numeric: true,
				formulaBased: false,
				value: null,
				minValue: 0,
				maxValue: 100,
				acceptanceFormula: null,
				parameter: {
					id: "p1",
					parameter: "Hardness",
					groupId: "g1",
					group: { id: "g1", name: "Physical" },
				},
			},
		],
		createdAt: now,
		updatedAt: now,
	};

	describe("findAllQiTemplates", () => {
		it("returns mapped templates", async () => {
			mockPrisma.qiTemplate.findMany.mockResolvedValue([mockTemplate]);
			const result = await service.findAllQiTemplates();
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Standard QI");
			expect(result[0].items[0].parameterName).toBe("Hardness");
		});
	});

	describe("findQiTemplateById", () => {
		it("returns null when not found", async () => {
			mockPrisma.qiTemplate.findUnique.mockResolvedValue(null);
			expect(await service.findQiTemplateById("x")).toBeNull();
		});
	});

	describe("createQiTemplate", () => {
		it("throws ConflictException for duplicate name", async () => {
			mockPrisma.qiTemplate.findUnique.mockResolvedValue(mockTemplate);
			await expect(
				service.createQiTemplate({
					name: "Standard QI",
					items: [],
				}),
			).rejects.toThrow(ConflictException);
		});

		it("throws NotFoundException for missing parameter IDs", async () => {
			mockPrisma.qiTemplate.findUnique.mockResolvedValue(null);
			mockPrisma.qiParameter.findMany.mockResolvedValue([]); // none found
			await expect(
				service.createQiTemplate({
					name: "New",
					items: [{ parameterId: "missing-param" }],
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("creates template with valid data", async () => {
			mockPrisma.qiTemplate.findUnique.mockResolvedValue(null);
			mockPrisma.qiParameter.findMany.mockResolvedValue([{ id: "p1" }]);
			mockPrisma.qiTemplate.create.mockResolvedValue(mockTemplate);
			const result = await service.createQiTemplate({
				name: "Standard QI",
				items: [{ parameterId: "p1" }],
			});
			expect(result.name).toBe("Standard QI");
		});
	});

	describe("updateQiTemplate", () => {
		it("throws NotFoundException when template not found", async () => {
			mockPrisma.qiTemplate.findUnique.mockResolvedValue(null);
			await expect(service.updateQiTemplate({ id: "missing" })).rejects.toThrow(
				NotFoundException,
			);
		});

		it("throws ConflictException when renaming to existing name", async () => {
			mockPrisma.qiTemplate.findUnique
				.mockResolvedValueOnce({ id: "t1", name: "Old" })
				.mockResolvedValueOnce({ id: "t2", name: "Taken" });
			await expect(
				service.updateQiTemplate({ id: "t1", name: "Taken" }),
			).rejects.toThrow(ConflictException);
		});

		it("validates parameter IDs when items provided", async () => {
			mockPrisma.qiTemplate.findUnique.mockResolvedValue({
				id: "t1",
				name: "X",
			});
			mockPrisma.qiParameter.findMany.mockResolvedValue([]); // none found
			await expect(
				service.updateQiTemplate({
					id: "t1",
					items: [{ parameterId: "missing" }],
				}),
			).rejects.toThrow(NotFoundException);
		});

		it("runs in a transaction when updating items", async () => {
			mockPrisma.qiTemplate.findUnique.mockResolvedValue({
				id: "t1",
				name: "X",
			});
			mockPrisma.qiParameter.findMany.mockResolvedValue([{ id: "p1" }]);
			mockPrisma.qiTemplate.findUniqueOrThrow.mockResolvedValue(mockTemplate);
			await service.updateQiTemplate({
				id: "t1",
				items: [{ parameterId: "p1" }],
			});
			expect(mockPrisma.$transaction).toHaveBeenCalled();
		});
	});

	describe("deleteQiTemplate", () => {
		it("throws NotFoundException when not found", async () => {
			mockPrisma.qiTemplate.findUnique.mockResolvedValue(null);
			await expect(service.deleteQiTemplate("x")).rejects.toThrow(
				NotFoundException,
			);
		});

		it("deletes when exists", async () => {
			mockPrisma.qiTemplate.findUnique.mockResolvedValue(mockTemplate);
			const result = await service.deleteQiTemplate("t1");
			expect(result).toEqual({ success: true, id: "t1" });
		});
	});

	describe("deleteManyQiTemplates", () => {
		it("deduplicates IDs and returns count", async () => {
			mockPrisma.qiTemplate.deleteMany.mockResolvedValue({ count: 2 });
			const result = await service.deleteManyQiTemplates(["t1", "t2", "t1"]);
			expect(result.count).toBe(2);
			expect(result.ids).toEqual(["t1", "t2"]);
		});
	});
});
