import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../../../shared/prisma.service";
import { AssetFinanceBookService } from "../asset-finance-book.service";

function createMockPrisma() {
	return {
		financeBook: {
			findMany: mock((_args?: unknown) => Promise.resolve([] as unknown[])),
			count: mock((_args?: unknown) => Promise.resolve(0)),
			findUnique: mock((_args?: unknown) => Promise.resolve(null as unknown)),
			create: mock((args: { data: { name: string } }) =>
				Promise.resolve({ id: "fb-new", ...args.data }),
			),
			update: mock((args: { where: { id: string }; data: { name: string } }) =>
				Promise.resolve({ id: args.where.id, ...args.data }),
			),
			delete: mock((_args?: unknown) => Promise.resolve({})),
		},
	};
}

function setup() {
	const prisma = createMockPrisma();
	const service = new AssetFinanceBookService(
		prisma as unknown as PrismaService,
	);
	return { service, prisma };
}

type Ctx = ReturnType<typeof setup>;

describe("AssetFinanceBookService", () => {
	let service: Ctx["service"];
	let prisma: Ctx["prisma"];

	beforeEach(() => {
		({ service, prisma } = setup());
	});

	describe("findAllFinanceBooks", () => {
		it("uses default pagination ordered by name and returns items and totalCount", async () => {
			const rows = [{ id: "a", name: "A" }];
			prisma.financeBook.findMany.mockResolvedValueOnce(rows);
			prisma.financeBook.count.mockResolvedValueOnce(7);

			const result = await service.findAllFinanceBooks();

			expect(result).toEqual({ items: rows, totalCount: 7 } as never);
			expect(prisma.financeBook.findMany).toHaveBeenCalledWith({
				where: {},
				orderBy: { name: "asc" },
				skip: 0,
				take: 250,
			});
			expect(prisma.financeBook.count).toHaveBeenCalledWith({ where: {} });
		});

		it("clamps take to 250 and floors it at 1", async () => {
			await service.findAllFinanceBooks({ take: 1000 });
			await service.findAllFinanceBooks({ take: 0 });
			const calls = prisma.financeBook.findMany.mock.calls as unknown as [
				{ take: number },
			][];
			expect(calls[0][0].take).toBe(250);
			expect(calls[1][0].take).toBe(1);
		});

		it("clamps a negative skip to 0 and passes a positive skip through", async () => {
			await service.findAllFinanceBooks({ skip: -5 });
			await service.findAllFinanceBooks({ skip: 20 });
			const calls = prisma.financeBook.findMany.mock.calls as unknown as [
				{ skip: number },
			][];
			expect(calls[0][0].skip).toBe(0);
			expect(calls[1][0].skip).toBe(20);
		});

		it("applies a case-insensitive contains search to items and count", async () => {
			await service.findAllFinanceBooks({ search: "tax" });
			const where = { name: { contains: "tax", mode: "insensitive" } };
			expect(prisma.financeBook.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ where }),
			);
			expect(prisma.financeBook.count).toHaveBeenCalledWith({ where });
		});
	});

	describe("createFinanceBook", () => {
		it("trims the name for lookup and creation", async () => {
			const result = await service.createFinanceBook({ name: "  IFRS  " });
			expect(prisma.financeBook.findUnique).toHaveBeenCalledWith({
				where: { name: "IFRS" },
				select: { id: true },
			});
			expect(prisma.financeBook.create).toHaveBeenCalledWith({
				data: { name: "IFRS" },
			});
			expect(result).toEqual({ id: "fb-new", name: "IFRS" } as never);
		});

		it("throws ConflictException and does not create when the name exists", async () => {
			prisma.financeBook.findUnique.mockResolvedValueOnce({ id: "fb-1" });
			await expect(
				service.createFinanceBook({ name: " IFRS " }),
			).rejects.toBeInstanceOf(ConflictException);
			expect(prisma.financeBook.create).not.toHaveBeenCalled();
		});

		it('uses the message Finance book "X" already exists', async () => {
			prisma.financeBook.findUnique.mockResolvedValueOnce({ id: "fb-1" });
			const error = await service
				.createFinanceBook({ name: "IFRS" })
				.catch((e: Error) => e);
			expect((error as Error).message).toBe(
				'Finance book "IFRS" already exists',
			);
		});
	});

	describe("updateFinanceBook", () => {
		it("throws NotFoundException for an unknown id", async () => {
			await expect(
				service.updateFinanceBook({ id: "missing", name: "X" }),
			).rejects.toBeInstanceOf(NotFoundException);
			expect(prisma.financeBook.update).not.toHaveBeenCalled();
		});

		it("trims the name and updates the book", async () => {
			prisma.financeBook.findUnique.mockResolvedValueOnce({ id: "fb-1" });
			const result = await service.updateFinanceBook({
				id: "fb-1",
				name: "  Renamed ",
			});
			expect(prisma.financeBook.update).toHaveBeenCalledWith({
				where: { id: "fb-1" },
				data: { name: "Renamed" },
			});
			expect(result).toEqual({ id: "fb-1", name: "Renamed" } as never);
		});

		it("does not look up other books by name before renaming", async () => {
			// TODO: renaming to an existing name is not pre-checked; the database
			// unique constraint is the only guard. Only the id lookup happens here.
			prisma.financeBook.findUnique.mockResolvedValueOnce({ id: "fb-1" });
			await service.updateFinanceBook({ id: "fb-1", name: "Taken" });
			expect(prisma.financeBook.findUnique).toHaveBeenCalledTimes(1);
			expect(prisma.financeBook.findUnique).toHaveBeenCalledWith({
				where: { id: "fb-1" },
				select: { id: true },
			});
		});
	});

	describe("deleteFinanceBook", () => {
		const counts = (
			assetFinanceBooks: number,
			categoryDefaults: number,
			companies: number,
		) => ({
			id: "fb-1",
			_count: { assetFinanceBooks, categoryDefaults, companies },
		});

		it("throws NotFoundException for an unknown id", async () => {
			await expect(service.deleteFinanceBook("missing")).rejects.toBeInstanceOf(
				NotFoundException,
			);
			expect(prisma.financeBook.delete).not.toHaveBeenCalled();
		});

		for (const [label, row] of [
			["asset books", counts(1, 0, 0)],
			["category defaults", counts(0, 2, 0)],
			["companies", counts(0, 0, 3)],
		] as const) {
			it(`blocks deletion when referenced by ${label}`, async () => {
				prisma.financeBook.findUnique.mockResolvedValueOnce(row);
				const error = await service
					.deleteFinanceBook("fb-1")
					.catch((e: unknown) => e);
				expect(error).toBeInstanceOf(BadRequestException);
				expect((error as Error).message).toBe(
					"Cannot delete a finance book that is in use",
				);
				expect(prisma.financeBook.delete).not.toHaveBeenCalled();
			});
		}

		it("deletes an unused book and returns success", async () => {
			prisma.financeBook.findUnique.mockResolvedValueOnce(counts(0, 0, 0));
			const result = await service.deleteFinanceBook("fb-1");
			expect(result).toEqual({ success: true, id: "fb-1" });
			expect(prisma.financeBook.delete).toHaveBeenCalledWith({
				where: { id: "fb-1" },
			});
		});
	});
});
