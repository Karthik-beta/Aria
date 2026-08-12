import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client";
import { AssetStockPostingService } from "../asset-stock-posting.service";

const ORGANIZATION_ID = "organization-1";

function createTransaction() {
	return {
		$queryRaw: jest.fn().mockResolvedValue([{ value: 3 }]),
		company: {
			findFirst: jest.fn().mockResolvedValue({
				id: "company-1",
				name: "Pivotr Technologies Private Limited",
				disabled: false,
			}),
		},
		warehouse: {
			findMany: jest.fn().mockResolvedValue([
				{
					name: "Stores - PTPL",
					disabled: false,
					isGroupWarehouse: false,
				},
			]),
		},
		inventoryItem: {
			findMany: jest.fn().mockResolvedValue([
				{
					code: "SPARE-BEARING",
					name: "Industrial Bearing",
					defaultUnitOfMeasure: { name: "Nos" },
				},
			]),
		},
		stockEntry: {
			findFirst: jest.fn().mockResolvedValue({ series: "MAT-STE-2026-00002" }),
			create: jest.fn().mockResolvedValue({
				id: "stock-entry-1",
				series: "MAT-STE-2026-00003",
			}),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
			findUnique: jest.fn(),
		},
	};
}

const validInput = {
	companyId: "company-1",
	postingDate: new Date("2026-08-09T00:00:00.000Z"),
	sourceType: "ASSET_REPAIR" as const,
	sourceId: "repair-1",
	lines: [
		{
			itemCode: "SPARE-BEARING",
			warehouse: "Stores - PTPL",
			quantity: 2,
			valuationRate: 750,
		},
	],
};

describe("AssetStockPostingService", () => {
	it("creates a submitted material issue inside the caller transaction", async () => {
		const service = new AssetStockPostingService();
		const tx = createTransaction();

		const result = await service.createMaterialIssue(
			tx as unknown as Prisma.TransactionClient,
			ORGANIZATION_ID,
			validInput,
		);

		expect(result).toEqual({
			id: "stock-entry-1",
			series: "MAT-STE-2026-00003",
		});
		expect(tx.stockEntry.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				stockEntryType: "MATERIAL_ISSUE",
				status: "SUBMITTED",
				company: "Pivotr Technologies Private Limited",
				remarks: "ASSET_REPAIR repair-1",
				items: {
					create: [
						expect.objectContaining({
							itemCode: "SPARE-BEARING",
							sourceWarehouse: "Stores - PTPL",
							qty: 2,
							basicRate: 750,
							basicAmount: 1500,
						}),
					],
				},
			}),
			select: { id: true, series: true },
		});
	});

	it("rejects duplicate item and warehouse lines", async () => {
		const service = new AssetStockPostingService();
		const tx = createTransaction();

		await expect(
			service.createMaterialIssue(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				{
					...validInput,
					lines: [...validInput.lines, ...validInput.lines],
				},
			),
		).rejects.toThrow(BadRequestException);
		expect(tx.stockEntry.create).not.toHaveBeenCalled();
	});

	it("rejects warehouses outside the document company", async () => {
		const service = new AssetStockPostingService();
		const tx = createTransaction();
		tx.warehouse.findMany.mockResolvedValue([]);

		await expect(
			service.createMaterialIssue(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				validInput,
			),
		).rejects.toThrow("does not belong");
	});

	it("rejects items that do not maintain stock", async () => {
		const service = new AssetStockPostingService();
		const tx = createTransaction();
		tx.inventoryItem.findMany.mockResolvedValue([]);

		await expect(
			service.createMaterialIssue(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				validInput,
			),
		).rejects.toThrow("does not maintain stock");
	});

	it("cancels a submitted material issue and treats retries as idempotent", async () => {
		const service = new AssetStockPostingService();
		const tx = createTransaction();

		await service.cancelMaterialIssue(
			tx as unknown as Prisma.TransactionClient,
			ORGANIZATION_ID,
			"company-1",
			"stock-entry-1",
			"ASSET_REPAIR",
			"repair-1",
		);
		expect(tx.stockEntry.updateMany).toHaveBeenCalledWith({
			where: expect.objectContaining({
				AND: expect.arrayContaining([
					{ id: "stock-entry-1", status: "SUBMITTED" },
					{ company: "Pivotr Technologies Private Limited" },
				]),
			}),
			data: { status: "CANCELLED" },
		});

		tx.stockEntry.updateMany.mockResolvedValue({ count: 0 });
		tx.stockEntry.findFirst.mockResolvedValue({ status: "CANCELLED" });
		await expect(
			service.cancelMaterialIssue(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				"company-1",
				"stock-entry-1",
				"ASSET_REPAIR",
				"repair-1",
			),
		).resolves.toBeUndefined();
	});

	it("rejects cancellation when the material issue is missing", async () => {
		const service = new AssetStockPostingService();
		const tx = createTransaction();
		tx.stockEntry.updateMany.mockResolvedValue({ count: 0 });
		tx.stockEntry.findFirst.mockResolvedValue(null);

		await expect(
			service.cancelMaterialIssue(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				"company-1",
				"missing",
				"ASSET_REPAIR",
				"repair-1",
			),
		).rejects.toThrow(NotFoundException);
	});
});
