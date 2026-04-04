/**
 * Asset service — CRUD for Assets, Locations, and Asset Categories.
 *
 * Follows the ERPNext Asset module business logic:
 * - Series generated as AST-YYYY-NNNNN
 * - Status lifecycle: DRAFT → SUBMITTED → depreciation states / SOLD / SCRAPPED
 * - All amounts stored as Decimal(18,6) in DB, returned as number to clients
 *
 * @module AssetService
 * @see {@link https://docs.erpnext.com/docs/user/manual/en/asset | ERPNext Asset}
 */
import type { Asset } from "@aria/types";
import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { toAsset, toAssetCategory, toAssetLocation } from "./asset.types";

const LIST_TAKE_MAX = 250;

@Injectable()
export class AssetService {
	private readonly logger = new Logger(AssetService.name);

	constructor(private readonly prisma: PrismaService) {}

	// ============================================================================
	// Series Generation
	// ============================================================================

	/**
	 * Generates a unique asset series in format AST-YYYY-NNNNN.
	 * Retries up to 3 times on conflict.
	 */
	private async generateAssetSeries(date: Date): Promise<string> {
		const year = date.getFullYear();
		const prefix = `AST-${year}-`;

		for (let attempt = 0; attempt < 3; attempt++) {
			const last = await this.prisma.asset.findFirst({
				where: { series: { startsWith: prefix } },
				orderBy: { series: "desc" },
				select: { series: true },
			});

			let next = 1;
			if (last) {
				const num = parseInt(last.series.slice(prefix.length), 10);
				if (!Number.isNaN(num)) next = num + 1;
			}

			const candidate = `${prefix}${String(next).padStart(5, "0")}`;

			const exists = await this.prisma.asset.findUnique({
				where: { series: candidate },
				select: { id: true },
			});

			if (!exists) return candidate;
		}

		// Fallback: timestamp suffix
		return `${prefix}${Date.now()}`;
	}

	// ============================================================================
	// Asset Methods
	// ============================================================================

	async findAllAssets(
		params?: Asset.ListAssetsInput,
	): Promise<Asset.AssetListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.status) where.status = params.status;
		if (params?.assetCategoryId) where.assetCategoryId = params.assetCategoryId;
		if (params?.locationId) where.locationId = params.locationId;
		if (params?.company)
			where.company = { contains: params.company, mode: "insensitive" };
		if (params?.search) {
			where.OR = [
				{ series: { contains: params.search, mode: "insensitive" } },
				{ assetName: { contains: params.search, mode: "insensitive" } },
				{ itemCode: { contains: params.search, mode: "insensitive" } },
				{ custodian: { contains: params.search, mode: "insensitive" } },
				{ department: { contains: params.search, mode: "insensitive" } },
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.asset.findMany({
				where,
				include: {
					assetCategory: { select: { id: true, name: true } },
					location: { select: { id: true, name: true } },
					activities: { orderBy: { createdAt: "desc" } },
				},
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.asset.count({ where }),
		]);

		return { items: items.map(toAsset), totalCount };
	}

	async findAssetById(id: string): Promise<Asset.AssetItem | null> {
		const asset = await this.prisma.asset.findUnique({
			where: { id },
			include: {
				assetCategory: { select: { id: true, name: true } },
				location: { select: { id: true, name: true } },
				activities: { orderBy: { createdAt: "desc" } },
			},
		});
		return asset ? toAsset(asset) : null;
	}

	async createAsset(input: Asset.CreateAssetInput): Promise<Asset.AssetItem> {
		const purchaseDate =
			input.purchaseDate instanceof Date ? input.purchaseDate : new Date();
		const series = await this.generateAssetSeries(purchaseDate);

		const created = await this.prisma.asset.create({
			data: {
				series,
				assetName: input.assetName,
				itemCode: input.itemCode ?? "",
				assetCategoryId: input.assetCategoryId ?? null,
				company: input.company,
				locationId: input.locationId ?? null,
				custodian: input.custodian ?? null,
				department: input.department ?? null,
				purchaseDate,
				availableForUseDate:
					input.availableForUseDate instanceof Date
						? input.availableForUseDate
						: null,
				netPurchaseAmount: input.netPurchaseAmount?.toString() ?? undefined,
				assetQuantity: input.assetQuantity ?? 1,
				calculateDepreciation: input.calculateDepreciation ?? false,
				openingAccumulatedDepreciation:
					input.openingAccumulatedDepreciation?.toString() ?? undefined,
				openingNumberOfBookedDepreciations:
					input.openingNumberOfBookedDepreciations ?? undefined,
				isFullyDepreciated: input.isFullyDepreciated ?? false,
				maintenanceRequired: input.maintenanceRequired ?? false,
				assetOwner: input.assetOwner ?? "COMPANY",
				assetOwnerCompany: input.assetOwnerCompany ?? null,
				supplier: input.supplier ?? null,
				customer: input.customer ?? null,
				policyNumber: input.policyNumber ?? null,
				insurer: input.insurer ?? null,
				insuredValue: input.insuredValue?.toString() ?? null,
				insuranceStartDate:
					input.insuranceStartDate instanceof Date
						? input.insuranceStartDate
						: null,
				insuranceEndDate:
					input.insuranceEndDate instanceof Date
						? input.insuranceEndDate
						: null,
				depreciationMethod: input.depreciationMethod ?? null,
				totalNumberOfDepreciations: input.totalNumberOfDepreciations ?? null,
				frequencyOfDepreciation: input.frequencyOfDepreciation ?? null,
				purchaseReceipt: input.purchaseReceipt ?? null,
				purchaseInvoice: input.purchaseInvoice ?? null,
				status: input.status ?? "DRAFT",
			},
		});

		await this.prisma.assetActivity.create({
			data: {
				assetId: created.id,
				activity: `Asset created with series ${series}`,
			},
		});

		const asset = await this.prisma.asset.findUniqueOrThrow({
			where: { id: created.id },
			include: {
				assetCategory: { select: { id: true, name: true } },
				location: { select: { id: true, name: true } },
				activities: { orderBy: { createdAt: "desc" } },
			},
		});

		this.logger.log(`Created asset ${series}`);
		return toAsset(asset);
	}

	async updateAsset(input: Asset.UpdateAssetInput): Promise<Asset.AssetItem> {
		const existing = await this.prisma.asset.findUnique({
			where: { id: input.id },
			select: { id: true, status: true },
		});
		if (!existing) throw new NotFoundException(`Asset ${input.id} not found`);

		if (existing.status === "CANCELLED") {
			throw new BadRequestException("Cannot update a cancelled asset");
		}

		const asset = await this.prisma.asset.update({
			where: { id: input.id },
			data: {
				...(input.assetName !== undefined && { assetName: input.assetName }),
				...(input.itemCode !== undefined && { itemCode: input.itemCode ?? "" }),
				...(input.assetCategoryId !== undefined && {
					assetCategoryId: input.assetCategoryId,
				}),
				...(input.company !== undefined && { company: input.company }),
				...(input.locationId !== undefined && { locationId: input.locationId }),
				...(input.custodian !== undefined && { custodian: input.custodian }),
				...(input.department !== undefined && { department: input.department }),
				...(input.purchaseDate instanceof Date && {
					purchaseDate: input.purchaseDate,
				}),
				...(input.availableForUseDate !== undefined && {
					availableForUseDate:
						input.availableForUseDate instanceof Date
							? input.availableForUseDate
							: null,
				}),
				...(input.disposalDate !== undefined && {
					disposalDate:
						input.disposalDate instanceof Date ? input.disposalDate : null,
				}),
				...(input.netPurchaseAmount !== undefined &&
					input.netPurchaseAmount !== null && {
						netPurchaseAmount: input.netPurchaseAmount.toString(),
					}),
				...(input.assetQuantity !== undefined && {
					assetQuantity: input.assetQuantity,
				}),
				...(input.calculateDepreciation !== undefined && {
					calculateDepreciation: input.calculateDepreciation,
				}),
				...(input.openingAccumulatedDepreciation !== undefined &&
					input.openingAccumulatedDepreciation !== null && {
						openingAccumulatedDepreciation:
							input.openingAccumulatedDepreciation.toString(),
					}),
				...(input.openingNumberOfBookedDepreciations !== undefined &&
					input.openingNumberOfBookedDepreciations !== null && {
						openingNumberOfBookedDepreciations:
							input.openingNumberOfBookedDepreciations,
					}),
				...(input.isFullyDepreciated !== undefined && {
					isFullyDepreciated: input.isFullyDepreciated,
				}),
				...(input.valueAfterDepreciation !== undefined &&
					input.valueAfterDepreciation !== null && {
						valueAfterDepreciation: input.valueAfterDepreciation.toString(),
					}),
				...(input.maintenanceRequired !== undefined && {
					maintenanceRequired: input.maintenanceRequired,
				}),
				...(input.assetOwner !== undefined && { assetOwner: input.assetOwner }),
				...(input.assetOwnerCompany !== undefined && {
					assetOwnerCompany: input.assetOwnerCompany,
				}),
				...(input.supplier !== undefined && { supplier: input.supplier }),
				...(input.customer !== undefined && { customer: input.customer }),
				...(input.policyNumber !== undefined && {
					policyNumber: input.policyNumber,
				}),
				...(input.insurer !== undefined && { insurer: input.insurer }),
				...(input.insuredValue !== undefined && {
					insuredValue:
						input.insuredValue !== null ? input.insuredValue.toString() : null,
				}),
				...(input.insuranceStartDate !== undefined && {
					insuranceStartDate:
						input.insuranceStartDate instanceof Date
							? input.insuranceStartDate
							: null,
				}),
				...(input.insuranceEndDate !== undefined && {
					insuranceEndDate:
						input.insuranceEndDate instanceof Date
							? input.insuranceEndDate
							: null,
				}),
				...(input.depreciationMethod !== undefined && {
					depreciationMethod: input.depreciationMethod,
				}),
				...(input.totalNumberOfDepreciations !== undefined && {
					totalNumberOfDepreciations: input.totalNumberOfDepreciations,
				}),
				...(input.frequencyOfDepreciation !== undefined && {
					frequencyOfDepreciation: input.frequencyOfDepreciation,
				}),
				...(input.purchaseReceipt !== undefined && {
					purchaseReceipt: input.purchaseReceipt,
				}),
				...(input.purchaseInvoice !== undefined && {
					purchaseInvoice: input.purchaseInvoice,
				}),
				...(input.status !== undefined && { status: input.status }),
			},
			include: {
				assetCategory: { select: { id: true, name: true } },
				location: { select: { id: true, name: true } },
				activities: { orderBy: { createdAt: "desc" } },
			},
		});

		await this.prisma.assetActivity.create({
			data: { assetId: input.id, activity: "Asset updated" },
		});

		return toAsset(asset);
	}

	async deleteAsset(id: string): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.asset.findUnique({
			where: { id },
			select: { id: true, status: true },
		});
		if (!existing) throw new NotFoundException(`Asset ${id} not found`);

		if (existing.status === "SUBMITTED") {
			throw new BadRequestException(
				"Cannot delete a submitted asset. Cancel it first.",
			);
		}

		await this.prisma.asset.delete({ where: { id } });
		return { success: true, id };
	}

	async deleteManyAssets(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const assets = await this.prisma.asset.findMany({
			where: { id: { in: ids } },
			select: { id: true, status: true },
		});

		const submitted = assets.filter((a) => a.status === "SUBMITTED");
		if (submitted.length > 0) {
			throw new BadRequestException(
				`Cannot delete submitted assets: ${submitted.map((a) => a.id).join(", ")}`,
			);
		}

		await this.prisma.asset.deleteMany({ where: { id: { in: ids } } });
		return { success: true, count: ids.length, ids };
	}

	// ============================================================================
	// Location Methods
	// ============================================================================

	async findAllLocations(
		params?: Asset.ListLocationsInput,
	): Promise<Asset.LocationListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.isGroup !== undefined) where.isGroup = params.isGroup;
		if (params?.search) {
			where.name = { contains: params.search, mode: "insensitive" };
		}

		const locationSelect = {
			id: true,
			name: true,
			parentLocationId: true,
			parentLocation: { select: { name: true } },
			isGroup: true,
			createdAt: true,
			updatedAt: true,
		} as const;

		const [items, totalCount] = await Promise.all([
			this.prisma.location.findMany({
				where,
				select: locationSelect,
				orderBy: { name: "asc" },
				skip,
				take,
			}),
			this.prisma.location.count({ where }),
		]);

		return { items: items.map(toAssetLocation), totalCount };
	}

	async findLocationById(id: string): Promise<Asset.Location | null> {
		const loc = await this.prisma.location.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				parentLocationId: true,
				parentLocation: { select: { name: true } },
				isGroup: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		return loc ? toAssetLocation(loc) : null;
	}

	async createLocation(
		input: Asset.CreateLocationInput,
	): Promise<Asset.Location> {
		const existing = await this.prisma.location.findUnique({
			where: { name: input.name },
			select: { id: true },
		});
		if (existing) {
			throw new BadRequestException(
				`Location with name "${input.name}" already exists`,
			);
		}

		const locationSelectFields = {
			id: true,
			name: true,
			parentLocationId: true,
			parentLocation: { select: { name: true } },
			isGroup: true,
			createdAt: true,
			updatedAt: true,
		} as const;

		const loc = await this.prisma.location.create({
			data: {
				name: input.name,
				parentLocationId: input.parentLocationId ?? null,
				isGroup: input.isGroup ?? false,
			},
			select: locationSelectFields,
		});
		return toAssetLocation(loc);
	}

	async updateLocation(
		input: Asset.UpdateLocationInput,
	): Promise<Asset.Location> {
		const existing = await this.prisma.location.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing)
			throw new NotFoundException(`Location ${input.id} not found`);

		const loc = await this.prisma.location.update({
			where: { id: input.id },
			data: {
				...(input.name !== undefined && { name: input.name }),
				...(input.parentLocationId !== undefined && {
					parentLocationId: input.parentLocationId,
				}),
				...(input.isGroup !== undefined && { isGroup: input.isGroup }),
			},
			select: {
				id: true,
				name: true,
				parentLocationId: true,
				parentLocation: { select: { name: true } },
				isGroup: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		return toAssetLocation(loc);
	}

	async deleteLocation(id: string): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.location.findUnique({
			where: { id },
			select: { id: true, _count: { select: { assets: true } } },
		});
		if (!existing) throw new NotFoundException(`Location ${id} not found`);
		if (existing._count.assets > 0) {
			throw new BadRequestException(
				"Cannot delete a location that is assigned to assets",
			);
		}
		await this.prisma.location.delete({ where: { id } });
		return { success: true, id };
	}

	// ============================================================================
	// Asset Category Methods
	// ============================================================================

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
				orderBy: { name: "asc" },
				skip,
				take,
			}),
			this.prisma.assetCategory.count({ where }),
		]);

		return { items: items.map(toAssetCategory), totalCount };
	}

	async findAssetCategoryById(id: string): Promise<Asset.AssetCategory | null> {
		const cat = await this.prisma.assetCategory.findUnique({ where: { id } });
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
				nonDepreciableCategory: input.nonDepreciableCategory ?? false,
				enableCwipAccounting: input.enableCwipAccounting ?? false,
			},
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
				...(input.nonDepreciableCategory !== undefined && {
					nonDepreciableCategory: input.nonDepreciableCategory,
				}),
				...(input.enableCwipAccounting !== undefined && {
					enableCwipAccounting: input.enableCwipAccounting,
				}),
			},
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
