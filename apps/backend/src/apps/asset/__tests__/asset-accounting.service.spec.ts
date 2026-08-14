import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client";
import { AssetAccountingService } from "../asset-accounting.service";

const ORGANIZATION_ID = "organization-1";

function createTransaction() {
	return {
		$queryRaw: jest.fn().mockResolvedValue([{ value: 8 }]),
		company: {
			findFirst: jest.fn().mockResolvedValue({
				id: "company-1",
				name: "Pivotr Technologies Private Limited",
				disabled: false,
				accountsFrozenThrough: null,
			}),
		},
		asset: {
			findFirst: jest.fn().mockResolvedValue({ id: "asset-1" }),
		},
		assetAccountingEntry: {
			findFirst: jest
				.fn()
				.mockImplementation(async (args: { where?: { AND?: unknown[] } }) => {
					const where = args.where;
					if (
						where?.AND?.some((part) => {
							if (!part || typeof part !== "object") return false;
							return "sourceType" in part || "id" in part;
						})
					)
						return null;
					return { series: "AAE-2026-00007" };
				}),
			create: jest.fn().mockResolvedValue({
				id: "entry-1",
				series: "AAE-2026-00008",
				status: "POSTED",
			}),
			updateMany: jest.fn().mockResolvedValue({ count: 1 }),
		},
	};
}

const balancedEntry = {
	companyId: "company-1",
	assetId: "asset-1",
	sourceType: "REPAIR" as const,
	sourceId: "repair-1",
	postingDate: "2026-08-09",
	remarks: "Capitalized repair REP-2026-00001",
	lines: [
		{
			account: "Plant and Machinery - PTPL",
			debitAmount: 2500,
			creditAmount: 0,
		},
		{
			account: "Repairs and Maintenance - PTPL",
			debitAmount: 0,
			creditAmount: 2500,
		},
	],
};

describe("AssetAccountingService", () => {
	it("creates a balanced posted entry with deterministic source identity", async () => {
		const service = new AssetAccountingService();
		const tx = createTransaction();

		const result = await service.createPostedEntry(
			tx as unknown as Prisma.TransactionClient,
			ORGANIZATION_ID,
			balancedEntry,
		);

		expect(result).toEqual({
			id: "entry-1",
			series: "AAE-2026-00008",
			status: "POSTED",
		});
		expect(tx.assetAccountingEntry.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				sourceType: "REPAIR",
				sourceId: "repair-1",
				status: "POSTED",
				lines: {
					create: [
						expect.objectContaining({
							lineType: "DEBIT",
							account: "Plant and Machinery - PTPL",
						}),
						expect.objectContaining({
							lineType: "CREDIT",
							account: "Repairs and Maintenance - PTPL",
						}),
					],
				},
			}),
			select: { id: true, series: true, status: true },
		});
	});

	it("uses the canonical posting date year for document series", async () => {
		const service = new AssetAccountingService();
		const tx = createTransaction();

		await service.createPostedEntry(
			tx as unknown as Prisma.TransactionClient,
			ORGANIZATION_ID,
			{
				...balancedEntry,
				postingDate: "2027-01-01",
				sourceId: "repair-year-boundary",
			},
		);

		expect(tx.assetAccountingEntry.create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					series: "AAE-2027-00008",
					postingDate: new Date("2027-01-01T00:00:00.000Z"),
				}),
			}),
		);
	});

	it("returns an existing posted source entry on an idempotent retry", async () => {
		const service = new AssetAccountingService();
		const tx = createTransaction();
		tx.assetAccountingEntry.findFirst.mockResolvedValue({
			id: "existing",
			series: "AAE-2026-00001",
			status: "POSTED",
		});

		await expect(
			service.createPostedEntry(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				balancedEntry,
			),
		).resolves.toEqual({
			id: "existing",
			series: "AAE-2026-00001",
			status: "POSTED",
		});
		expect(tx.assetAccountingEntry.create).not.toHaveBeenCalled();
	});

	it("rejects unbalanced or two-sided lines", async () => {
		const service = new AssetAccountingService();
		const tx = createTransaction();

		await expect(
			service.createPostedEntry(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				{
					...balancedEntry,
					lines: [
						{ account: "Asset", debitAmount: 100, creditAmount: 0 },
						{ account: "Expense", debitAmount: 0, creditAmount: 99 },
					],
				},
			),
		).rejects.toThrow(BadRequestException);

		await expect(
			service.createPostedEntry(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				{
					...balancedEntry,
					lines: [
						{ account: "Asset", debitAmount: 100, creditAmount: 100 },
						{ account: "Expense", debitAmount: 0, creditAmount: 100 },
					],
				},
			),
		).rejects.toThrow("exactly one");
	});

	it("rejects entries in a frozen accounting period", async () => {
		const service = new AssetAccountingService();
		const tx = createTransaction();
		tx.company.findFirst.mockResolvedValue({
			id: "company-1",
			name: "Pivotr Technologies Private Limited",
			disabled: false,
			accountsFrozenThrough: new Date("2026-08-31T00:00:00.000Z"),
		});

		await expect(
			service.createPostedEntry(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				balancedEntry,
			),
		).rejects.toThrow("frozen through");
	});

	it("rejects reuse of a reversed source entry", async () => {
		const service = new AssetAccountingService();
		const tx = createTransaction();
		tx.assetAccountingEntry.findFirst.mockResolvedValue({
			id: "existing",
			series: "AAE-2026-00001",
			status: "REVERSED",
		});

		await expect(
			service.createPostedEntry(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				balancedEntry,
			),
		).rejects.toThrow(ConflictException);
	});

	it("reverses once and treats repeated reversal as idempotent", async () => {
		const service = new AssetAccountingService();
		const tx = createTransaction();
		tx.assetAccountingEntry.findFirst.mockResolvedValue({
			status: "POSTED",
			companyId: "company-1",
			company: { name: "Pivotr Technologies Private Limited" },
			postingDate: new Date("2026-08-09T00:00:00.000Z"),
		});

		await service.reversePostedEntry(
			tx as unknown as Prisma.TransactionClient,
			ORGANIZATION_ID,
			"entry-1",
		);
		expect(tx.assetAccountingEntry.updateMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					AND: expect.arrayContaining([
						{ id: "entry-1", status: "POSTED" },
						{ company: { is: { organizationId: ORGANIZATION_ID } } },
					]),
				}),
				data: { status: "REVERSED", reversedAt: expect.any(Date) },
			}),
		);

		tx.assetAccountingEntry.findFirst.mockResolvedValue({
			status: "REVERSED",
			companyId: "company-1",
			company: { name: "Pivotr Technologies Private Limited" },
			postingDate: new Date("2026-08-09T00:00:00.000Z"),
		});
		await expect(
			service.reversePostedEntry(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				"entry-1",
			),
		).resolves.toBeUndefined();
	});

	it("rejects reversal when the entry does not exist", async () => {
		const service = new AssetAccountingService();
		const tx = createTransaction();
		tx.assetAccountingEntry.findFirst.mockResolvedValue(null);

		await expect(
			service.reversePostedEntry(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				"missing",
			),
		).rejects.toThrow(NotFoundException);
	});

	it("rejects reversal of an entry in a frozen accounting period", async () => {
		const service = new AssetAccountingService();
		const tx = createTransaction();
		tx.assetAccountingEntry.findFirst.mockResolvedValue({
			status: "POSTED",
			company: "Pivotr Technologies Private Limited",
			postingDate: new Date("2026-08-09T00:00:00.000Z"),
		});
		tx.company.findFirst.mockResolvedValue({
			id: "company-1",
			name: "Pivotr Technologies Private Limited",
			accountsFrozenThrough: new Date("2026-08-31T00:00:00.000Z"),
		});

		await expect(
			service.reversePostedEntry(
				tx as unknown as Prisma.TransactionClient,
				ORGANIZATION_ID,
				"entry-1",
			),
		).rejects.toThrow("frozen through");
		expect(tx.assetAccountingEntry.updateMany).not.toHaveBeenCalled();
	});
});
