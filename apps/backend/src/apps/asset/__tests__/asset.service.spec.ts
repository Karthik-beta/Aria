/* eslint-disable */

import type { Asset } from "@aria/types";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetCoreService } from "../asset-core.service";

function createMockPrisma() {
	return {
		asset: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
			findUniqueOrThrow: jest.fn(),
		},
		assetCategory: {
			findUnique: jest.fn(),
		},
		assetActivity: {
			create: jest.fn(),
		},
		employee: {
			findUnique: jest.fn(),
		},
		documentSeriesCounter: {
			findUnique: jest.fn(),
		},
		client: {
			$queryRaw: jest.fn(),
		},
	};
}

function createTestContext() {
	const mockPrisma = createMockPrisma();
	mockPrisma.client.$queryRaw.mockResolvedValue([{ value: 1 }]);
	const service = new AssetCoreService(mockPrisma as unknown as PrismaService);
	return { service, mockPrisma };
}

const mockAssetRow = {
	id: "asset-123",
	series: "AST-2026-00001",
	assetName: "Office Laptop",
	itemCode: "LAP-001",
	barcode: "1234567890",
	assetCategoryId: "cat-123",
	company: "Test Corp",
	locationId: "loc-123",
	custodianId: null,
	custodian: null,
	department: "Engineering",
	purchaseDate: new Date("2026-01-01"),
	availableForUseDate: new Date("2026-01-02"),
	disposalDate: null,
	netPurchaseAmount: 50000,
	assetQuantity: 1,
	calculateDepreciation: false,
	openingAccumulatedDepreciation: 0,
	openingNumberOfBookedDepreciations: 0,
	isFullyDepreciated: false,
	valueAfterDepreciation: 50000,
	maintenanceRequired: false,
	assetOwner: "COMPANY",
	assetOwnerCompany: null,
	supplier: null,
	customer: null,
	policyNumber: null,
	insurer: null,
	insuredValue: null,
	insuranceStartDate: null,
	insuranceEndDate: null,
	depreciationMethod: null,
	totalNumberOfDepreciations: null,
	frequencyOfDepreciation: null,
	expectedValueAfterUsefulLife: null,
	depreciationStartDate: null,
	purchaseReceipt: null,
	purchaseInvoice: null,
	status: "DRAFT",
	activities: [],
	createdAt: new Date("2026-01-01"),
	updatedAt: new Date("2026-01-01"),
};

describe("AssetService > Barcode support", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma } = createTestContext());
	});

	describe("findAssetByBarcode", () => {
		it("returns mapped asset if found", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue(mockAssetRow);

			const result = await service.findAssetByBarcode("1234567890");

			expect(mockPrisma.asset.findUnique).toHaveBeenCalledWith({
				where: { barcode: "1234567890" },
				include: expect.any(Object),
			});
			expect(result).not.toBeNull();
			expect(result?.barcode).toBe("1234567890");
		});

		it("returns null if not found", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue(null);

			const result = await service.findAssetByBarcode("unknown");

			expect(result).toBeNull();
		});
	});

	describe("createAsset with barcode", () => {
		it("persists barcode when provided", async () => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);
			mockPrisma.documentSeriesCounter.findUnique.mockResolvedValue(null);
			mockPrisma.asset.findFirst.mockResolvedValue(null);
			mockPrisma.asset.create.mockResolvedValue(mockAssetRow);
			mockPrisma.asset.findUniqueOrThrow.mockResolvedValue(mockAssetRow);
			const input: Asset.CreateAssetInput = {
				assetName: "Office Laptop",
				company: "Test Corp",
				barcode: "1234567890",
			};

			const result = await service.createAsset(input);

			expect(mockPrisma.asset.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({
						barcode: "1234567890",
					}),
				}),
			);
			expect(result.barcode).toBe("1234567890");
		});
	});

	describe("updateAsset with barcode", () => {
		it("updates barcode when provided", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue(mockAssetRow);
			mockPrisma.asset.update.mockResolvedValue({
				...mockAssetRow,
				barcode: "9876543210",
			});

			const input: Asset.UpdateAssetInput = {
				id: "asset-123",
				barcode: "9876543210",
			};

			const result = await service.updateAsset(input);

			expect(mockPrisma.asset.update).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: "asset-123" },
					data: expect.objectContaining({
						barcode: "9876543210",
					}),
				}),
			);
			expect(result.barcode).toBe("9876543210");
		});
	});
});

describe("AssetService > Custodian (Employee link)", () => {
	let service: ReturnType<typeof createTestContext>["service"];
	let mockPrisma: ReturnType<typeof createTestContext>["mockPrisma"];

	const jane = {
		id: "emp-jane",
		employeeId: "HR-EMP-00001",
		employeeName: "Jane Doe",
		company: "Test Corp",
	};
	const john = {
		id: "emp-john",
		employeeId: "HR-EMP-00002",
		employeeName: "John Roe",
		company: null,
	};

	const activities = () =>
		mockPrisma.assetActivity.create.mock.calls.map(
			([arg]: [{ data: { activity: string } }]) => arg.data.activity,
		);

	beforeEach(() => {
		jest.clearAllMocks();
		({ service, mockPrisma } = createTestContext());
	});

	describe("createAsset", () => {
		beforeEach(() => {
			mockPrisma.assetCategory.findUnique.mockResolvedValue(null);
			mockPrisma.documentSeriesCounter.findUnique.mockResolvedValue(null);
			mockPrisma.asset.findFirst.mockResolvedValue(null);
			mockPrisma.asset.create.mockResolvedValue(mockAssetRow);
			mockPrisma.asset.findUniqueOrThrow.mockResolvedValue({
				...mockAssetRow,
				custodianId: jane.id,
				custodian: jane,
			});
		});

		it("links the employee and logs an issue activity", async () => {
			mockPrisma.employee.findUnique.mockResolvedValue(jane);

			const result = await service.createAsset({
				assetName: "Office Laptop",
				company: "Test Corp",
				custodianId: jane.id,
			});

			expect(mockPrisma.asset.create).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ custodianId: jane.id }),
				}),
			);
			expect(activities()).toContain(
				"Asset issued to Employee Jane Doe (HR-EMP-00001)",
			);
			expect(result.custodianId).toBe(jane.id);
			expect(result.custodianEmployeeId).toBe("HR-EMP-00001");
			expect(result.custodianName).toBe("Jane Doe");
		});

		it("does not log a custodian activity when none is set", async () => {
			mockPrisma.asset.findUniqueOrThrow.mockResolvedValue(mockAssetRow);

			await service.createAsset({
				assetName: "Office Laptop",
				company: "Test Corp",
			});

			expect(mockPrisma.employee.findUnique).not.toHaveBeenCalled();
			expect(activities()).toEqual([
				`Asset created with series ${mockAssetRow.series}`,
			]);
		});

		it("rejects an unknown employee", async () => {
			mockPrisma.employee.findUnique.mockResolvedValue(null);

			await expect(
				service.createAsset({
					assetName: "Office Laptop",
					company: "Test Corp",
					custodianId: "missing",
				}),
			).rejects.toThrow("Employee missing not found");
			expect(mockPrisma.asset.create).not.toHaveBeenCalled();
		});

		it("rejects an employee from another company", async () => {
			mockPrisma.employee.findUnique.mockResolvedValue({
				...jane,
				company: "Other Corp",
			});

			await expect(
				service.createAsset({
					assetName: "Office Laptop",
					company: "Test Corp",
					custodianId: jane.id,
				}),
			).rejects.toThrow(
				"Employee HR-EMP-00001 does not belong to company Test Corp",
			);
		});
	});

	describe("updateAsset", () => {
		it("logs an issue activity when the custodian changes", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue({
				...mockAssetRow,
				custodianId: jane.id,
				custodian: jane,
			});
			mockPrisma.employee.findUnique.mockResolvedValue(john);
			mockPrisma.asset.update.mockResolvedValue({
				...mockAssetRow,
				custodianId: john.id,
				custodian: john,
			});

			const result = await service.updateAsset({
				id: mockAssetRow.id,
				custodianId: john.id,
			});

			expect(mockPrisma.asset.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ custodianId: john.id }),
				}),
			);
			expect(activities()).toEqual([
				"Asset updated",
				"Asset issued to Employee John Roe (HR-EMP-00002)",
			]);
			expect(result.custodianName).toBe("John Roe");
		});

		it("logs a return activity when the custodian is cleared", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue({
				...mockAssetRow,
				custodianId: jane.id,
				custodian: jane,
			});
			mockPrisma.asset.update.mockResolvedValue(mockAssetRow);

			await service.updateAsset({ id: mockAssetRow.id, custodianId: null });

			expect(mockPrisma.asset.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ custodianId: null }),
				}),
			);
			expect(activities()).toEqual([
				"Asset updated",
				"Asset returned from Employee Jane Doe (HR-EMP-00001)",
			]);
		});

		it("does not log a custodian activity when it is unchanged", async () => {
			mockPrisma.asset.findUnique.mockResolvedValue({
				...mockAssetRow,
				custodianId: jane.id,
				custodian: jane,
			});
			mockPrisma.asset.update.mockResolvedValue(mockAssetRow);

			await service.updateAsset({ id: mockAssetRow.id, custodianId: jane.id });

			expect(mockPrisma.employee.findUnique).not.toHaveBeenCalled();
			expect(mockPrisma.asset.update).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.not.objectContaining({ custodianId: expect.anything() }),
				}),
			);
			expect(activities()).toEqual(["Asset updated"]);
		});
	});
});
