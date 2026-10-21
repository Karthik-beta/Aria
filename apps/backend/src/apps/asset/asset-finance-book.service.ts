/**
 * Asset Finance Book sub-service — CRUD for named finance books used by
 * independent depreciation schedules.
 *
 * @module AssetFinanceBookService
 */
import type { Asset } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { LIST_TAKE_MAX } from "./asset-service.shared";

@Injectable()
export class AssetFinanceBookService {
	constructor(private readonly prisma: PrismaService) {}

	/** Lists named finance books used by independent depreciation schedules. */
	async findAllFinanceBooks(params?: {
		skip?: number;
		take?: number;
		search?: string;
	}): Promise<Asset.FinanceBookListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);
		const where = params?.search
			? { name: { contains: params.search, mode: "insensitive" as const } }
			: {};
		const [items, totalCount] = await Promise.all([
			this.prisma.financeBook.findMany({
				where,
				orderBy: { name: "asc" },
				skip,
				take,
			}),
			this.prisma.financeBook.count({ where }),
		]);
		return { items, totalCount };
	}

	/** Creates a uniquely named finance book. */
	async createFinanceBook(input: { name: string }): Promise<Asset.FinanceBook> {
		const name = input.name.trim();
		const existing = await this.prisma.financeBook.findUnique({
			where: { name },
			select: { id: true },
		});
		if (existing) {
			throw new ConflictException(`Finance book "${name}" already exists`);
		}
		return this.prisma.financeBook.create({ data: { name } });
	}

	/** Renames an existing finance book. */
	async updateFinanceBook(input: {
		id: string;
		name: string;
	}): Promise<Asset.FinanceBook> {
		const existing = await this.prisma.financeBook.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing)
			throw new NotFoundException(`Finance book ${input.id} not found`);
		return this.prisma.financeBook.update({
			where: { id: input.id },
			data: { name: input.name.trim() },
		});
	}

	/** Deletes an unused finance book. */
	async deleteFinanceBook(id: string): Promise<{ success: true; id: string }> {
		const existing = await this.prisma.financeBook.findUnique({
			where: { id },
			select: {
				id: true,
				_count: {
					select: {
						assetFinanceBooks: true,
						categoryDefaults: true,
						companies: true,
					},
				},
			},
		});
		if (!existing) throw new NotFoundException(`Finance book ${id} not found`);
		const references =
			existing._count.assetFinanceBooks +
			existing._count.categoryDefaults +
			existing._count.companies;
		if (references > 0) {
			throw new BadRequestException(
				"Cannot delete a finance book that is in use",
			);
		}
		await this.prisma.financeBook.delete({ where: { id } });
		return { success: true, id };
	}
}
