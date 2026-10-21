/**
 * Asset Category sub-service — CRUD for asset categories, including
 * finance book defaults and category accounts.
 *
 * Follows the ERPNext Asset Category doctype.
 *
 * @module AssetCategoryService
 */
import type { Asset } from "@aria/types";
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { toAssetCategory } from "./asset.types";
import { LIST_TAKE_MAX, normalizeOptionalText } from "./asset-service.shared";

@Injectable()
export class AssetCategoryService {
	private readonly assetCategoryInclude = {
		financeBookDefaults: {
			include: { financeBook: { select: { name: true } } },
			orderBy: { createdAt: "asc" as const },
		},
		accounts: {
			include: { company: { select: { name: true } } },
			orderBy: { createdAt: "asc" as const },
		},
	} as const;

	constructor(private readonly prisma: PrismaService) {}

	async findAllAssetCategories(
		params?: Asset.ListAssetCategoriesInput,
	): Promise<Asset.AssetCategoryListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.search) {
			where.name = { contains: params.search, mode: "insensitive" };
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetCategory.findMany({
				where,
				include: this.assetCategoryInclude,
				orderBy: { name: "asc" },
				skip,
				take,
			}),
			this.prisma.assetCategory.count({ where }),
		]);

		return { items: items.map(toAssetCategory), totalCount };
	}

	async findAssetCategoryById(id: string): Promise<Asset.AssetCategory | null> {
		const cat = await this.prisma.assetCategory.findUnique({
			where: { id },
			include: this.assetCategoryInclude,
		});
		return cat ? toAssetCategory(cat) : null;
	}

	async createAssetCategory(
		input: Asset.CreateAssetCategoryInput,
	): Promise<Asset.AssetCategory> {
		const existing = await this.prisma.assetCategory.findUnique({
			where: { name: input.name },
			select: { id: true },
		});
		if (existing) {
			throw new BadRequestException(
				`Asset category "${input.name}" already exists`,
			);
		}

		const cat = await this.prisma.assetCategory.create({
			data: {
				name: input.name,
				depreciationMethod: input.depreciationMethod ?? null,
				totalNumberOfDepreciations: input.totalNumberOfDepreciations ?? null,
				frequencyOfDepreciation: input.frequencyOfDepreciation ?? null,
				dailyProrataBased: input.dailyProrataBased ?? false,
				shiftBased: input.shiftBased ?? false,
				rateOfDepreciation: input.rateOfDepreciation ?? null,
				expectedValueAfterUsefulLife: input.expectedValueAfterUsefulLife
					? new Prisma.Decimal(input.expectedValueAfterUsefulLife)
					: null,
				nonDepreciableCategory: input.nonDepreciableCategory ?? false,
				enableCwipAccounting: input.enableCwipAccounting ?? false,
				financeBookDefaults: input.financeBooks?.length
					? {
							create: input.financeBooks.map((book) => ({
								financeBookId: book.financeBookId,
								depreciationMethod: book.depreciationMethod,
								totalNumberOfDepreciations: book.totalNumberOfDepreciations,
								frequencyOfDepreciation: book.frequencyOfDepreciation,
								dailyProrataBased: book.dailyProrataBased ?? false,
								shiftBased: book.shiftBased ?? false,
								rateOfDepreciation:
									book.rateOfDepreciation == null
										? null
										: new Prisma.Decimal(book.rateOfDepreciation),
								expectedValueAfterUsefulLife:
									book.expectedValueAfterUsefulLife == null
										? null
										: new Prisma.Decimal(book.expectedValueAfterUsefulLife),
							})),
						}
					: undefined,
				accounts: input.accounts?.length
					? {
							create: input.accounts.map((account) => ({
								companyId: account.companyId,
								fixedAssetAccount: account.fixedAssetAccount,
								accumulatedDepreciationAccount: normalizeOptionalText(
									account.accumulatedDepreciationAccount,
								),
								depreciationExpenseAccount: normalizeOptionalText(
									account.depreciationExpenseAccount,
								),
								capitalWorkInProgressAccount: normalizeOptionalText(
									account.capitalWorkInProgressAccount,
								),
							})),
						}
					: undefined,
			},
			include: this.assetCategoryInclude,
		});
		return toAssetCategory(cat);
	}

	async updateAssetCategory(
		input: Asset.UpdateAssetCategoryInput,
	): Promise<Asset.AssetCategory> {
		const existing = await this.prisma.assetCategory.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Asset category ${input.id} not found`);
		}

		const cat = await this.prisma.assetCategory.update({
			where: { id: input.id },
			data: {
				...(input.name !== undefined && { name: input.name }),
				...(input.depreciationMethod !== undefined && {
					depreciationMethod: input.depreciationMethod,
				}),
				...(input.totalNumberOfDepreciations !== undefined && {
					totalNumberOfDepreciations: input.totalNumberOfDepreciations,
				}),
				...(input.frequencyOfDepreciation !== undefined && {
					frequencyOfDepreciation: input.frequencyOfDepreciation,
				}),
				...(input.dailyProrataBased !== undefined && {
					dailyProrataBased: input.dailyProrataBased ?? false,
				}),
				...(input.shiftBased !== undefined && {
					shiftBased: input.shiftBased ?? false,
				}),
				...(input.rateOfDepreciation !== undefined && {
					rateOfDepreciation: input.rateOfDepreciation,
				}),
				...(input.expectedValueAfterUsefulLife !== undefined && {
					expectedValueAfterUsefulLife: input.expectedValueAfterUsefulLife
						? new Prisma.Decimal(input.expectedValueAfterUsefulLife)
						: null,
				}),
				...(input.nonDepreciableCategory !== undefined && {
					nonDepreciableCategory: input.nonDepreciableCategory,
				}),
				...(input.enableCwipAccounting !== undefined && {
					enableCwipAccounting: input.enableCwipAccounting,
				}),
				...(input.financeBooks !== undefined && {
					financeBookDefaults: {
						deleteMany: {},
						create: input.financeBooks.map((book) => ({
							financeBookId: book.financeBookId,
							depreciationMethod: book.depreciationMethod,
							totalNumberOfDepreciations: book.totalNumberOfDepreciations,
							frequencyOfDepreciation: book.frequencyOfDepreciation,
							dailyProrataBased: book.dailyProrataBased ?? false,
							shiftBased: book.shiftBased ?? false,
							rateOfDepreciation:
								book.rateOfDepreciation == null
									? null
									: new Prisma.Decimal(book.rateOfDepreciation),
							expectedValueAfterUsefulLife:
								book.expectedValueAfterUsefulLife == null
									? null
									: new Prisma.Decimal(book.expectedValueAfterUsefulLife),
						})),
					},
				}),
				...(input.accounts !== undefined && {
					accounts: {
						deleteMany: {},
						create: input.accounts.map((account) => ({
							companyId: account.companyId,
							fixedAssetAccount: account.fixedAssetAccount,
							accumulatedDepreciationAccount: normalizeOptionalText(
								account.accumulatedDepreciationAccount,
							),
							depreciationExpenseAccount: normalizeOptionalText(
								account.depreciationExpenseAccount,
							),
							capitalWorkInProgressAccount: normalizeOptionalText(
								account.capitalWorkInProgressAccount,
							),
						})),
					},
				}),
			},
			include: this.assetCategoryInclude,
		});
		return toAssetCategory(cat);
	}

	async deleteAssetCategory(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.assetCategory.findUnique({
			where: { id },
			select: { id: true, _count: { select: { assets: true } } },
		});
		if (!existing) {
			throw new NotFoundException(`Asset category ${id} not found`);
		}
		if (existing._count.assets > 0) {
			throw new BadRequestException(
				"Cannot delete an asset category that is assigned to assets",
			);
		}
		await this.prisma.assetCategory.delete({ where: { id } });
		return { success: true, id };
	}
}
