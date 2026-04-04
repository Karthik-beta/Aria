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
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import {
	toAsset,
	toAssetCategory,
	toAssetLocation,
	toAssetMaintenance,
	toAssetMaintenanceLog,
	toAssetMaintenanceLogListItem,
	toAssetValueAdjustment,
	toMaintenanceTeam,
} from "./asset.types";
import {
	buildDepreciationSchedulePreview,
	buildRevaluationEntryLines,
	deriveFixedAssetAccount,
	getAssetValueAdjustmentDirection,
	getAssetValueAdjustmentResultState,
} from "./asset-value-adjustment.utils";

const LIST_TAKE_MAX = 250;
const CURRENCY_SCALE = 6;

@Injectable()
export class AssetService {
	private readonly logger = new Logger(AssetService.name);
	private readonly assetInclude = {
		assetCategory: { select: { id: true, name: true } },
		location: { select: { id: true, name: true } },
		activities: { orderBy: { createdAt: "desc" as const } },
	} as const;

	private readonly assetAdjustmentInclude = {
		asset: {
			select: {
				id: true,
				series: true,
				assetName: true,
				assetCategory: { select: { name: true } },
			},
		},
		revaluationEntry: {
			include: {
				lines: { orderBy: { createdAt: "asc" as const } },
			},
		},
		depreciationSchedule: {
			include: {
				entries: { orderBy: { sequence: "asc" as const } },
			},
		},
	} as const;

	private readonly assetAdjustmentContextSelect = {
		id: true,
		series: true,
		assetName: true,
		company: true,
		status: true,
		purchaseDate: true,
		availableForUseDate: true,
		netPurchaseAmount: true,
		openingAccumulatedDepreciation: true,
		openingNumberOfBookedDepreciations: true,
		isFullyDepreciated: true,
		valueAfterDepreciation: true,
		calculateDepreciation: true,
		depreciationMethod: true,
		totalNumberOfDepreciations: true,
		frequencyOfDepreciation: true,
		assetCategory: {
			select: {
				id: true,
				name: true,
				depreciationMethod: true,
				totalNumberOfDepreciations: true,
				frequencyOfDepreciation: true,
				nonDepreciableCategory: true,
			},
		},
		depreciationSchedules: {
			where: { status: "ACTIVE" as const },
			orderBy: { revisionNumber: "desc" as const },
			take: 1,
			select: { id: true, revisionNumber: true },
		},
	} as const;

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

	private async generateAssetValueAdjustmentSeries(
		date: Date,
	): Promise<string> {
		const year = date.getFullYear();
		const prefix = `AVA-${year}-`;

		for (let attempt = 0; attempt < 3; attempt += 1) {
			const last = await this.prisma.assetValueAdjustment.findFirst({
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
			const exists = await this.prisma.assetValueAdjustment.findUnique({
				where: { series: candidate },
				select: { id: true },
			});

			if (!exists) return candidate;
		}

		return `${prefix}${Date.now()}`;
	}

	private async generateAssetRevaluationEntrySeries(
		date: Date,
	): Promise<string> {
		const year = date.getFullYear();
		const prefix = `JE-AVA-${year}-`;

		for (let attempt = 0; attempt < 3; attempt += 1) {
			const last = await this.prisma.assetRevaluationEntry.findFirst({
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
			const exists = await this.prisma.assetRevaluationEntry.findUnique({
				where: { series: candidate },
				select: { id: true },
			});

			if (!exists) return candidate;
		}

		return `${prefix}${Date.now()}`;
	}

	private roundCurrency(value: number): number {
		return Number(value.toFixed(CURRENCY_SCALE));
	}

	private normalizeOptionalText(
		value: string | null | undefined,
	): string | null {
		const trimmed = value?.trim();
		return trimmed ? trimmed : null;
	}

	private getOpeningAssetValue(
		netPurchaseAmount: number | null | undefined,
		openingAccumulatedDepreciation: number | null | undefined,
	): number {
		return Math.max(
			this.roundCurrency(
				(netPurchaseAmount ?? 0) - (openingAccumulatedDepreciation ?? 0),
			),
			0,
		);
	}

	private resolveCurrentAssetValue(asset: {
		valueAfterDepreciation: Prisma.Decimal | null;
		netPurchaseAmount: Prisma.Decimal | null;
		openingAccumulatedDepreciation: Prisma.Decimal | null;
	}): number {
		const explicitValue = Number(asset.valueAfterDepreciation ?? 0);
		if (explicitValue > 0) {
			return this.roundCurrency(explicitValue);
		}

		return this.getOpeningAssetValue(
			asset.netPurchaseAmount ? Number(asset.netPurchaseAmount) : 0,
			asset.openingAccumulatedDepreciation
				? Number(asset.openingAccumulatedDepreciation)
				: 0,
		);
	}

	private async getAssetCategoryDefaults(assetCategoryId?: string | null) {
		if (!assetCategoryId) {
			return null;
		}

		return this.prisma.assetCategory.findUnique({
			where: { id: assetCategoryId },
			select: {
				id: true,
				name: true,
				depreciationMethod: true,
				totalNumberOfDepreciations: true,
				frequencyOfDepreciation: true,
				nonDepreciableCategory: true,
			},
		});
	}

	private resolveDepreciationConfig(asset: {
		calculateDepreciation: boolean;
		depreciationMethod: Asset.DepreciationMethod | null;
		totalNumberOfDepreciations: number | null;
		frequencyOfDepreciation: number | null;
		assetCategory?: {
			depreciationMethod: Asset.DepreciationMethod | null;
			totalNumberOfDepreciations: number | null;
			frequencyOfDepreciation: number | null;
			nonDepreciableCategory?: boolean;
		} | null;
	}) {
		if (
			!asset.calculateDepreciation ||
			asset.assetCategory?.nonDepreciableCategory
		) {
			return {
				depreciationMethod: null,
				totalNumberOfDepreciations: null,
				frequencyOfDepreciation: null,
			};
		}

		return {
			depreciationMethod:
				asset.depreciationMethod ??
				asset.assetCategory?.depreciationMethod ??
				null,
			totalNumberOfDepreciations:
				asset.totalNumberOfDepreciations ??
				asset.assetCategory?.totalNumberOfDepreciations ??
				null,
			frequencyOfDepreciation:
				asset.frequencyOfDepreciation ??
				asset.assetCategory?.frequencyOfDepreciation ??
				null,
		};
	}

	private async getAssetAdjustmentContextOrThrow(assetId: string) {
		const asset = await this.prisma.asset.findUnique({
			where: { id: assetId },
			select: this.assetAdjustmentContextSelect,
		});

		if (!asset) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}

		return {
			id: asset.id,
			series: asset.series,
			assetName: asset.assetName,
			company: asset.company,
			status: asset.status as Asset.AssetStatus,
			purchaseDate: asset.purchaseDate,
			availableForUseDate: asset.availableForUseDate ?? null,
			netPurchaseAmount: asset.netPurchaseAmount,
			openingAccumulatedDepreciation: asset.openingAccumulatedDepreciation,
			openingNumberOfBookedDepreciations:
				asset.openingNumberOfBookedDepreciations,
			isFullyDepreciated: asset.isFullyDepreciated,
			valueAfterDepreciation: asset.valueAfterDepreciation,
			calculateDepreciation: asset.calculateDepreciation,
			depreciationMethod:
				(asset.depreciationMethod as Asset.DepreciationMethod | null) ?? null,
			totalNumberOfDepreciations: asset.totalNumberOfDepreciations ?? null,
			frequencyOfDepreciation: asset.frequencyOfDepreciation ?? null,
			assetCategory: asset.assetCategory
				? {
						id: asset.assetCategory.id,
						name: asset.assetCategory.name,
						depreciationMethod:
							(asset.assetCategory
								.depreciationMethod as Asset.DepreciationMethod | null) ?? null,
						totalNumberOfDepreciations:
							asset.assetCategory.totalNumberOfDepreciations ?? null,
						frequencyOfDepreciation:
							asset.assetCategory.frequencyOfDepreciation ?? null,
						nonDepreciableCategory: asset.assetCategory.nonDepreciableCategory,
					}
				: null,
			activeDepreciationSchedule: asset.depreciationSchedules[0] ?? null,
		};
	}

	private assertAssetValueAdjustmentPreviewIsValid(
		preview: Asset.AssetValueAdjustmentPreview,
	): void {
		if (preview.validationMessages.length > 0) {
			throw new BadRequestException(preview.validationMessages[0]);
		}
	}

	private buildAssetValueAdjustmentPreview(
		asset: {
			id: string;
			series: string;
			assetName: string;
			company: string;
			status: Asset.AssetStatus;
			purchaseDate: Date;
			netPurchaseAmount: Prisma.Decimal | null;
			openingAccumulatedDepreciation: Prisma.Decimal | null;
			openingNumberOfBookedDepreciations: number;
			isFullyDepreciated: boolean;
			valueAfterDepreciation: Prisma.Decimal | null;
			calculateDepreciation: boolean;
			depreciationMethod: Asset.DepreciationMethod | null;
			totalNumberOfDepreciations: number | null;
			frequencyOfDepreciation: number | null;
			assetCategory: {
				name: string;
				depreciationMethod: Asset.DepreciationMethod | null;
				totalNumberOfDepreciations: number | null;
				frequencyOfDepreciation: number | null;
				nonDepreciableCategory: boolean;
			} | null;
		},
		input: Pick<
			Asset.PreviewAssetValueAdjustmentInput,
			"adjustmentDate" | "newAssetValue"
		>,
	): Asset.AssetValueAdjustmentPreview {
		const currentAssetValue = this.resolveCurrentAssetValue(asset);
		const differenceAmount = this.roundCurrency(
			input.newAssetValue - currentAssetValue,
		);
		const depreciationConfig = this.resolveDepreciationConfig({
			calculateDepreciation: asset.calculateDepreciation,
			depreciationMethod: asset.depreciationMethod,
			totalNumberOfDepreciations: asset.totalNumberOfDepreciations,
			frequencyOfDepreciation: asset.frequencyOfDepreciation,
			assetCategory: asset.assetCategory
				? {
						depreciationMethod:
							(asset.assetCategory
								.depreciationMethod as Asset.DepreciationMethod | null) ?? null,
						totalNumberOfDepreciations:
							asset.assetCategory.totalNumberOfDepreciations ?? null,
						frequencyOfDepreciation:
							asset.assetCategory.frequencyOfDepreciation ?? null,
						nonDepreciableCategory: asset.assetCategory.nonDepreciableCategory,
					}
				: null,
		});
		const schedulePreview = asset.calculateDepreciation
			? buildDepreciationSchedulePreview({
					adjustmentDate: input.adjustmentDate,
					currentAssetValue,
					newAssetValue: input.newAssetValue,
					purchaseAmount: asset.netPurchaseAmount
						? Number(asset.netPurchaseAmount)
						: 0,
					openingAccumulatedDepreciation: asset.openingAccumulatedDepreciation
						? Number(asset.openingAccumulatedDepreciation)
						: 0,
					bookedDepreciations: asset.openingNumberOfBookedDepreciations ?? 0,
					depreciationMethod: depreciationConfig.depreciationMethod,
					totalNumberOfDepreciations:
						depreciationConfig.totalNumberOfDepreciations,
					frequencyOfDepreciation: depreciationConfig.frequencyOfDepreciation,
				})
			: null;
		const resultState = getAssetValueAdjustmentResultState(
			asset.status,
			input.newAssetValue,
		);
		const validationMessages: string[] = [];

		if (
			asset.status === "DRAFT" ||
			asset.status === "CANCELLED" ||
			asset.status === "SOLD" ||
			asset.status === "SCRAPPED"
		) {
			validationMessages.push(
				"Only active assets can be adjusted. Draft, cancelled, sold, and scrapped assets are not eligible.",
			);
		}

		if (input.adjustmentDate < asset.purchaseDate) {
			validationMessages.push(
				"The adjustment date cannot be earlier than the asset purchase date.",
			);
		}

		if (input.newAssetValue < 0) {
			validationMessages.push("The new asset value must be zero or greater.");
		}

		if (differenceAmount === 0) {
			validationMessages.push(
				"The new asset value must be different from the current carrying value.",
			);
		}

		if (asset.calculateDepreciation && !schedulePreview) {
			validationMessages.push(
				"This asset requires depreciation settings before a value adjustment can be submitted.",
			);
		}

		return {
			assetId: asset.id,
			assetSeries: asset.series,
			assetName: asset.assetName,
			assetCategoryName: asset.assetCategory?.name ?? null,
			company: asset.company,
			adjustmentDate: input.adjustmentDate,
			currentAssetValue,
			newAssetValue: this.roundCurrency(input.newAssetValue),
			differenceAmount,
			direction: getAssetValueAdjustmentDirection(differenceAmount),
			fixedAssetAccount: deriveFixedAssetAccount(asset.assetCategory?.name),
			resultingStatus: resultState.status,
			resultingIsFullyDepreciated: resultState.isFullyDepreciated,
			validationMessages,
			depreciationSchedule: schedulePreview,
		};
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
				include: this.assetInclude,
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
			include: this.assetInclude,
		});
		return asset ? toAsset(asset) : null;
	}

	async createAsset(input: Asset.CreateAssetInput): Promise<Asset.AssetItem> {
		const purchaseDate =
			input.purchaseDate instanceof Date ? input.purchaseDate : new Date();
		const series = await this.generateAssetSeries(purchaseDate);
		const categoryDefaults = await this.getAssetCategoryDefaults(
			input.assetCategoryId,
		);

		if (input.assetCategoryId && !categoryDefaults) {
			throw new NotFoundException(
				`Asset category ${input.assetCategoryId} not found`,
			);
		}

		const calculateDepreciation =
			input.calculateDepreciation ??
			(categoryDefaults ? !categoryDefaults.nonDepreciableCategory : false);
		const openingAccumulatedDepreciation =
			input.openingAccumulatedDepreciation ?? 0;
		const netPurchaseAmount = input.netPurchaseAmount ?? 0;
		const valueAfterDepreciation = this.getOpeningAssetValue(
			netPurchaseAmount,
			openingAccumulatedDepreciation,
		);
		const depreciationMethod =
			input.depreciationMethod ??
			(categoryDefaults?.depreciationMethod as Asset.DepreciationMethod | null) ??
			null;
		const totalNumberOfDepreciations =
			input.totalNumberOfDepreciations ??
			categoryDefaults?.totalNumberOfDepreciations ??
			null;
		const frequencyOfDepreciation =
			input.frequencyOfDepreciation ??
			categoryDefaults?.frequencyOfDepreciation ??
			null;

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
				netPurchaseAmount: netPurchaseAmount.toString(),
				assetQuantity: input.assetQuantity ?? 1,
				calculateDepreciation,
				openingAccumulatedDepreciation:
					openingAccumulatedDepreciation.toString(),
				openingNumberOfBookedDepreciations:
					input.openingNumberOfBookedDepreciations ?? undefined,
				isFullyDepreciated:
					input.isFullyDepreciated ?? valueAfterDepreciation <= 0,
				valueAfterDepreciation: valueAfterDepreciation.toString(),
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
				depreciationMethod,
				totalNumberOfDepreciations,
				frequencyOfDepreciation,
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
			include: this.assetInclude,
		});

		this.logger.log(`Created asset ${series}`);
		return toAsset(asset);
	}

	async updateAsset(input: Asset.UpdateAssetInput): Promise<Asset.AssetItem> {
		const existing = await this.prisma.asset.findUnique({
			where: { id: input.id },
			select: {
				id: true,
				status: true,
				assetCategoryId: true,
				netPurchaseAmount: true,
				openingAccumulatedDepreciation: true,
				calculateDepreciation: true,
				depreciationMethod: true,
				totalNumberOfDepreciations: true,
				frequencyOfDepreciation: true,
				valueAfterDepreciation: true,
				isFullyDepreciated: true,
			},
		});
		if (!existing) throw new NotFoundException(`Asset ${input.id} not found`);

		if (existing.status === "CANCELLED") {
			throw new BadRequestException("Cannot update a cancelled asset");
		}

		const categoryDefaults = await this.getAssetCategoryDefaults(
			input.assetCategoryId !== undefined
				? input.assetCategoryId
				: existing.assetCategoryId,
		);

		if (input.assetCategoryId && !categoryDefaults) {
			throw new NotFoundException(
				`Asset category ${input.assetCategoryId} not found`,
			);
		}

		const nextNetPurchaseAmount =
			input.netPurchaseAmount ?? Number(existing.netPurchaseAmount);
		const nextOpeningAccumulatedDepreciation =
			input.openingAccumulatedDepreciation ??
			Number(existing.openingAccumulatedDepreciation);
		const shouldRecalculateValueAfterDepreciation =
			input.valueAfterDepreciation === undefined &&
			(input.netPurchaseAmount !== undefined ||
				input.openingAccumulatedDepreciation !== undefined);
		const derivedValueAfterDepreciation = this.getOpeningAssetValue(
			nextNetPurchaseAmount,
			nextOpeningAccumulatedDepreciation,
		);
		const nextValueAfterDepreciation =
			input.valueAfterDepreciation ??
			(shouldRecalculateValueAfterDepreciation
				? derivedValueAfterDepreciation
				: Number(existing.valueAfterDepreciation));
		const shouldInheritDepreciationSettings =
			input.assetCategoryId !== undefined &&
			input.depreciationMethod === undefined;
		const shouldInheritTotalDepreciations =
			input.assetCategoryId !== undefined &&
			input.totalNumberOfDepreciations === undefined;
		const shouldInheritFrequency =
			input.assetCategoryId !== undefined &&
			input.frequencyOfDepreciation === undefined;
		const calculateDepreciation =
			input.calculateDepreciation ??
			(input.assetCategoryId !== undefined && categoryDefaults
				? !categoryDefaults.nonDepreciableCategory
				: existing.calculateDepreciation);

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
				...(input.calculateDepreciation !== undefined ||
				input.assetCategoryId !== undefined
					? {
							calculateDepreciation,
						}
					: {}),
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
				...(input.isFullyDepreciated !== undefined ||
				shouldRecalculateValueAfterDepreciation
					? {
							isFullyDepreciated:
								input.isFullyDepreciated ?? nextValueAfterDepreciation <= 0,
						}
					: {}),
				...(input.valueAfterDepreciation !== undefined ||
				shouldRecalculateValueAfterDepreciation
					? {
							valueAfterDepreciation: nextValueAfterDepreciation.toString(),
						}
					: {}),
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
				...(shouldInheritDepreciationSettings && {
					depreciationMethod:
						(categoryDefaults?.depreciationMethod as Asset.DepreciationMethod | null) ??
						null,
				}),
				...(input.totalNumberOfDepreciations !== undefined && {
					totalNumberOfDepreciations: input.totalNumberOfDepreciations,
				}),
				...(shouldInheritTotalDepreciations && {
					totalNumberOfDepreciations:
						categoryDefaults?.totalNumberOfDepreciations ?? null,
				}),
				...(input.frequencyOfDepreciation !== undefined && {
					frequencyOfDepreciation: input.frequencyOfDepreciation,
				}),
				...(shouldInheritFrequency && {
					frequencyOfDepreciation:
						categoryDefaults?.frequencyOfDepreciation ?? null,
				}),
				...(input.purchaseReceipt !== undefined && {
					purchaseReceipt: input.purchaseReceipt,
				}),
				...(input.purchaseInvoice !== undefined && {
					purchaseInvoice: input.purchaseInvoice,
				}),
				...(input.status !== undefined && { status: input.status }),
			},
			include: this.assetInclude,
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

	async findAllAssetValueAdjustments(
		params?: Asset.ListAssetValueAdjustmentsInput,
	): Promise<Asset.AssetValueAdjustmentListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Prisma.AssetValueAdjustmentWhereInput = {};
		if (params?.status) where.status = params.status;
		if (params?.assetId) where.assetId = params.assetId;
		if (params?.company) {
			where.companySnapshot = {
				contains: params.company,
				mode: "insensitive",
			};
		}
		if (params?.direction) where.direction = params.direction;
		if (params?.search) {
			where.OR = [
				{ series: { contains: params.search, mode: "insensitive" } },
				{
					asset: {
						assetName: { contains: params.search, mode: "insensitive" },
					},
				},
				{
					asset: {
						series: { contains: params.search, mode: "insensitive" },
					},
				},
				{
					differenceAccount: { contains: params.search, mode: "insensitive" },
				},
				{
					fixedAssetAccount: { contains: params.search, mode: "insensitive" },
				},
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetValueAdjustment.findMany({
				where,
				include: this.assetAdjustmentInclude,
				orderBy: [{ adjustmentDate: "desc" }, { createdAt: "desc" }],
				skip,
				take,
			}),
			this.prisma.assetValueAdjustment.count({ where }),
		]);

		return {
			items: items.map(toAssetValueAdjustment),
			totalCount,
		};
	}

	async findAssetValueAdjustmentById(
		id: string,
	): Promise<Asset.AssetValueAdjustmentItem | null> {
		const adjustment = await this.prisma.assetValueAdjustment.findUnique({
			where: { id },
			include: this.assetAdjustmentInclude,
		});

		return adjustment ? toAssetValueAdjustment(adjustment) : null;
	}

	async previewAssetValueAdjustment(
		input: Asset.PreviewAssetValueAdjustmentInput,
	): Promise<Asset.AssetValueAdjustmentPreview> {
		const asset = await this.getAssetAdjustmentContextOrThrow(input.assetId);
		return this.buildAssetValueAdjustmentPreview(asset, input);
	}

	async createAssetValueAdjustment(
		input: Asset.CreateAssetValueAdjustmentInput,
	): Promise<Asset.AssetValueAdjustmentItem> {
		const asset = await this.getAssetAdjustmentContextOrThrow(input.assetId);
		const preview = this.buildAssetValueAdjustmentPreview(asset, input);
		this.assertAssetValueAdjustmentPreviewIsValid(preview);

		const created = await this.prisma.assetValueAdjustment.create({
			data: {
				series: await this.generateAssetValueAdjustmentSeries(
					input.adjustmentDate,
				),
				assetId: asset.id,
				assetCategorySnapshot: asset.assetCategory?.name ?? null,
				companySnapshot: asset.company,
				adjustmentDate: input.adjustmentDate,
				currentAssetValue: preview.currentAssetValue.toString(),
				newAssetValue: preview.newAssetValue.toString(),
				differenceAmount: preview.differenceAmount.toString(),
				differenceAccount: input.differenceAccount.trim(),
				fixedAssetAccount: preview.fixedAssetAccount,
				costCenter: this.normalizeOptionalText(input.costCenter),
				notes: this.normalizeOptionalText(input.notes),
				status: "DRAFT",
				direction: preview.direction,
				previousAssetStatus: asset.status,
				previousIsFullyDepreciated: asset.isFullyDepreciated,
			},
			include: this.assetAdjustmentInclude,
		});

		return toAssetValueAdjustment(created);
	}

	async updateAssetValueAdjustment(
		input: Asset.UpdateAssetValueAdjustmentInput,
	): Promise<Asset.AssetValueAdjustmentItem> {
		const existing = await this.prisma.assetValueAdjustment.findUnique({
			where: { id: input.id },
			select: {
				id: true,
				status: true,
				assetId: true,
				adjustmentDate: true,
				newAssetValue: true,
				differenceAccount: true,
				costCenter: true,
				notes: true,
			},
		});

		if (!existing) {
			throw new NotFoundException(
				`Asset value adjustment ${input.id} not found`,
			);
		}
		if (existing.status !== "DRAFT") {
			throw new BadRequestException(
				"Only draft asset value adjustments can be edited.",
			);
		}

		const asset = await this.getAssetAdjustmentContextOrThrow(
			input.assetId ?? existing.assetId,
		);
		const draftInput = {
			adjustmentDate: input.adjustmentDate ?? existing.adjustmentDate,
			newAssetValue: input.newAssetValue ?? Number(existing.newAssetValue),
		};
		const preview = this.buildAssetValueAdjustmentPreview(asset, draftInput);
		this.assertAssetValueAdjustmentPreviewIsValid(preview);

		const updated = await this.prisma.assetValueAdjustment.update({
			where: { id: input.id },
			data: {
				assetId: asset.id,
				assetCategorySnapshot: asset.assetCategory?.name ?? null,
				companySnapshot: asset.company,
				adjustmentDate: draftInput.adjustmentDate,
				currentAssetValue: preview.currentAssetValue.toString(),
				newAssetValue: preview.newAssetValue.toString(),
				differenceAmount: preview.differenceAmount.toString(),
				differenceAccount:
					input.differenceAccount?.trim() ?? existing.differenceAccount,
				fixedAssetAccount: preview.fixedAssetAccount,
				costCenter:
					input.costCenter !== undefined
						? this.normalizeOptionalText(input.costCenter)
						: existing.costCenter,
				notes:
					input.notes !== undefined
						? this.normalizeOptionalText(input.notes)
						: existing.notes,
				direction: preview.direction,
				previousAssetStatus: asset.status,
				previousIsFullyDepreciated: asset.isFullyDepreciated,
			},
			include: this.assetAdjustmentInclude,
		});

		return toAssetValueAdjustment(updated);
	}

	async submitAssetValueAdjustment(
		input: Asset.SubmitAssetValueAdjustmentInput,
	): Promise<Asset.AssetValueAdjustmentItem> {
		const adjustment = await this.prisma.assetValueAdjustment.findUnique({
			where: { id: input.id },
			select: {
				id: true,
				series: true,
				assetId: true,
				adjustmentDate: true,
				currentAssetValue: true,
				newAssetValue: true,
				differenceAccount: true,
				costCenter: true,
				notes: true,
				status: true,
			},
		});

		if (!adjustment) {
			throw new NotFoundException(
				`Asset value adjustment ${input.id} not found`,
			);
		}
		if (adjustment.status !== "DRAFT") {
			throw new BadRequestException(
				"Only draft asset value adjustments can be submitted.",
			);
		}

		const asset = await this.getAssetAdjustmentContextOrThrow(
			adjustment.assetId,
		);
		const preview = this.buildAssetValueAdjustmentPreview(asset, {
			adjustmentDate: adjustment.adjustmentDate,
			newAssetValue: Number(adjustment.newAssetValue),
		});
		this.assertAssetValueAdjustmentPreviewIsValid(preview);

		if (
			Math.abs(
				Number(adjustment.currentAssetValue) - preview.currentAssetValue,
			) > 0.000001
		) {
			throw new ConflictException(
				"The asset carrying value changed while this adjustment was in draft. Refresh the draft before submitting it.",
			);
		}

		const entrySeries = await this.generateAssetRevaluationEntrySeries(
			adjustment.adjustmentDate,
		);
		const now = new Date();
		const revaluationLines = buildRevaluationEntryLines({
			differenceAmount: preview.differenceAmount,
			fixedAssetAccount: preview.fixedAssetAccount,
			differenceAccount: adjustment.differenceAccount,
			costCenter: adjustment.costCenter ?? null,
		});

		const updated = await this.prisma.$transaction(async (tx) => {
			if (asset.activeDepreciationSchedule) {
				await tx.assetDepreciationSchedule.update({
					where: { id: asset.activeDepreciationSchedule.id },
					data: { status: "CANCELLED" },
				});
			}

			await tx.assetRevaluationEntry.create({
				data: {
					series: entrySeries,
					adjustmentId: adjustment.id,
					assetId: asset.id,
					company: asset.company,
					postingDate: adjustment.adjustmentDate,
					remarks: `Asset revaluation for ${asset.series} via ${adjustment.series}`,
					lines: {
						create: revaluationLines.map((line) => ({
							lineType: line.lineType,
							account: line.account,
							debitAmount: line.debitAmount.toString(),
							creditAmount: line.creditAmount.toString(),
							costCenter: line.costCenter,
						})),
					},
				},
			});

			if (preview.depreciationSchedule) {
				await tx.assetDepreciationSchedule.create({
					data: {
						adjustmentId: adjustment.id,
						assetId: asset.id,
						previousScheduleId: asset.activeDepreciationSchedule?.id ?? null,
						revisionNumber:
							(asset.activeDepreciationSchedule?.revisionNumber ?? 0) + 1,
						status: "ACTIVE",
						startDate: adjustment.adjustmentDate,
						depreciationMethod: preview.depreciationSchedule.depreciationMethod,
						totalNumberOfDepreciations:
							preview.depreciationSchedule.totalNumberOfDepreciations,
						frequencyOfDepreciation:
							preview.depreciationSchedule.frequencyOfDepreciation,
						bookedDepreciations:
							preview.depreciationSchedule.bookedDepreciations,
						remainingDepreciations:
							preview.depreciationSchedule.remainingDepreciations,
						openingAccumulatedDepreciation:
							(asset.openingAccumulatedDepreciation
								? Number(asset.openingAccumulatedDepreciation)
								: 0
							).toString(),
						baseAssetValue: preview.newAssetValue.toString(),
						notes:
							this.normalizeOptionalText(adjustment.notes) ??
							`Projected from adjustment ${adjustment.series}`,
						entries: {
							create: preview.depreciationSchedule.entries.map((entry) => ({
								sequence: entry.sequence,
								scheduleDate: entry.scheduleDate,
								depreciationAmount: entry.depreciationAmount.toString(),
								accumulatedDepreciationAmount:
									entry.accumulatedDepreciationAmount.toString(),
								bookValueAfterDepreciation:
									entry.bookValueAfterDepreciation.toString(),
							})),
						},
					},
				});
			}

			await tx.asset.update({
				where: { id: asset.id },
				data: {
					valueAfterDepreciation: preview.newAssetValue.toString(),
					isFullyDepreciated: preview.resultingIsFullyDepreciated,
					status: preview.resultingStatus,
				},
			});

			await tx.assetActivity.create({
				data: {
					assetId: asset.id,
					activity: `Asset value adjustment ${adjustment.series} submitted. Carrying value changed from ${preview.currentAssetValue.toFixed(2)} to ${preview.newAssetValue.toFixed(2)} via ${entrySeries}.`,
				},
			});

			return tx.assetValueAdjustment.update({
				where: { id: adjustment.id },
				data: {
					currentAssetValue: preview.currentAssetValue.toString(),
					newAssetValue: preview.newAssetValue.toString(),
					differenceAmount: preview.differenceAmount.toString(),
					fixedAssetAccount: preview.fixedAssetAccount,
					direction: preview.direction,
					previousAssetStatus: asset.status,
					previousIsFullyDepreciated: asset.isFullyDepreciated,
					status: "SUBMITTED",
					submittedAt: now,
					cancelledAt: null,
				},
				include: this.assetAdjustmentInclude,
			});
		});

		return toAssetValueAdjustment(updated);
	}

	async cancelAssetValueAdjustment(
		input: Asset.CancelAssetValueAdjustmentInput,
	): Promise<Asset.AssetValueAdjustmentItem> {
		const adjustment = await this.prisma.assetValueAdjustment.findUnique({
			where: { id: input.id },
			select: {
				id: true,
				series: true,
				assetId: true,
				currentAssetValue: true,
				status: true,
				previousAssetStatus: true,
				previousIsFullyDepreciated: true,
				submittedAt: true,
				revaluationEntry: { select: { id: true } },
				depreciationSchedule: {
					select: { id: true, previousScheduleId: true },
				},
			},
		});

		if (!adjustment) {
			throw new NotFoundException(
				`Asset value adjustment ${input.id} not found`,
			);
		}
		if (adjustment.status !== "SUBMITTED") {
			throw new BadRequestException(
				"Only submitted asset value adjustments can be cancelled.",
			);
		}

		const newerSubmittedAdjustments =
			await this.prisma.assetValueAdjustment.count({
				where: {
					assetId: adjustment.assetId,
					status: "SUBMITTED",
					submittedAt: { gt: adjustment.submittedAt ?? new Date(0) },
				},
			});

		if (newerSubmittedAdjustments > 0) {
			throw new BadRequestException(
				"Only the latest submitted asset value adjustment can be cancelled.",
			);
		}

		if (!adjustment.revaluationEntry) {
			throw new BadRequestException(
				"The revaluation entry for this asset value adjustment is missing.",
			);
		}

		const revaluationEntryId = adjustment.revaluationEntry.id;

		const updated = await this.prisma.$transaction(async (tx) => {
			await tx.assetRevaluationEntry.update({
				where: { id: revaluationEntryId },
				data: {
					status: "REVERSED",
					reversedAt: new Date(),
				},
			});

			if (adjustment.depreciationSchedule) {
				await tx.assetDepreciationSchedule.update({
					where: { id: adjustment.depreciationSchedule.id },
					data: { status: "CANCELLED" },
				});

				if (adjustment.depreciationSchedule.previousScheduleId) {
					await tx.assetDepreciationSchedule.update({
						where: { id: adjustment.depreciationSchedule.previousScheduleId },
						data: { status: "ACTIVE" },
					});
				}
			}

			await tx.asset.update({
				where: { id: adjustment.assetId },
				data: {
					valueAfterDepreciation: Number(
						adjustment.currentAssetValue,
					).toString(),
					status: adjustment.previousAssetStatus,
					isFullyDepreciated: adjustment.previousIsFullyDepreciated,
				},
			});

			await tx.assetActivity.create({
				data: {
					assetId: adjustment.assetId,
					activity: `Asset value adjustment ${adjustment.series} cancelled and the previous carrying value was restored.`,
				},
			});

			return tx.assetValueAdjustment.update({
				where: { id: adjustment.id },
				data: {
					status: "CANCELLED",
					cancelledAt: new Date(),
				},
				include: this.assetAdjustmentInclude,
			});
		});

		return toAssetValueAdjustment(updated);
	}

	async deleteAssetValueAdjustment(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.assetValueAdjustment.findUnique({
			where: { id },
			select: { id: true, status: true },
		});

		if (!existing) {
			throw new NotFoundException(`Asset value adjustment ${id} not found`);
		}
		if (existing.status !== "DRAFT") {
			throw new BadRequestException(
				"Only draft asset value adjustments can be deleted.",
			);
		}

		await this.prisma.assetValueAdjustment.delete({ where: { id } });
		return { success: true, id };
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

	// ============================================================================
	// Asset Maintenance Team Methods
	// ============================================================================

	async findAllMaintenanceTeams(
		params?: Asset.ListMaintenanceTeamsInput,
	): Promise<Asset.AssetMaintenanceTeamListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.company)
			where.company = { contains: params.company, mode: "insensitive" };
		if (params?.search) {
			where.OR = [
				{ name: { contains: params.search, mode: "insensitive" } },
				{
					maintenanceManager: { contains: params.search, mode: "insensitive" },
				},
				{
					maintenanceManagerName: {
						contains: params.search,
						mode: "insensitive",
					},
				},
				{ company: { contains: params.search, mode: "insensitive" } },
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetMaintenanceTeam.findMany({
				where,
				include: { members: { orderBy: { createdAt: "asc" } } },
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.assetMaintenanceTeam.count({ where }),
		]);

		return { items: items.map(toMaintenanceTeam), totalCount };
	}

	async findMaintenanceTeamById(
		id: string,
	): Promise<Asset.AssetMaintenanceTeam | null> {
		const team = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { id },
			include: { members: { orderBy: { createdAt: "asc" } } },
		});
		return team ? toMaintenanceTeam(team) : null;
	}

	async createMaintenanceTeam(
		input: Asset.CreateAssetMaintenanceTeamInput,
	): Promise<Asset.AssetMaintenanceTeam> {
		const existing = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { name: input.name },
			select: { id: true },
		});
		if (existing) {
			throw new BadRequestException(
				`A maintenance team with the name "${input.name}" already exists`,
			);
		}

		const team = await this.prisma.assetMaintenanceTeam.create({
			data: {
				name: input.name,
				maintenanceManager: input.maintenanceManager ?? null,
				maintenanceManagerName: input.maintenanceManagerName ?? null,
				company: input.company,
				members: {
					create: input.members.map((m) => ({
						teamMember: m.teamMember,
						fullName: m.fullName,
						maintenanceRole: m.maintenanceRole,
					})),
				},
			},
			include: { members: { orderBy: { createdAt: "asc" } } },
		});

		this.logger.log(`Created maintenance team "${team.name}"`);
		return toMaintenanceTeam(team);
	}

	async updateMaintenanceTeam(
		input: Asset.UpdateAssetMaintenanceTeamInput,
	): Promise<Asset.AssetMaintenanceTeam> {
		const existing = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Maintenance team ${input.id} not found`);
		}

		if (input.name !== undefined) {
			const nameConflict = await this.prisma.assetMaintenanceTeam.findUnique({
				where: { name: input.name },
				select: { id: true },
			});
			if (nameConflict && nameConflict.id !== input.id) {
				throw new BadRequestException(
					`A maintenance team with the name "${input.name}" already exists`,
				);
			}
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			await tx.assetMaintenanceTeam.update({
				where: { id: input.id },
				data: {
					...(input.name !== undefined && { name: input.name }),
					...(input.maintenanceManager !== undefined && {
						maintenanceManager: input.maintenanceManager,
					}),
					...(input.maintenanceManagerName !== undefined && {
						maintenanceManagerName: input.maintenanceManagerName,
					}),
					...(input.company !== undefined && { company: input.company }),
				},
			});

			if (input.members !== undefined) {
				const keptIds = input.members
					.filter((m): m is typeof m & { id: string } => Boolean(m.id))
					.map((m) => m.id);

				if (keptIds.length > 0) {
					const owned = await tx.assetMaintenanceTeamMember.findMany({
						where: { id: { in: keptIds }, teamId: input.id },
						select: { id: true },
					});
					const ownedIds = new Set(owned.map((m) => m.id));
					const foreignId = keptIds.find((mid) => !ownedIds.has(mid));
					if (foreignId) {
						throw new BadRequestException(
							`Team member with ID ${foreignId} does not belong to this team`,
						);
					}
				}

				if (keptIds.length === 0) {
					await tx.assetMaintenanceTeamMember.deleteMany({
						where: { teamId: input.id },
					});
				} else {
					await tx.assetMaintenanceTeamMember.deleteMany({
						where: { teamId: input.id, id: { notIn: keptIds } },
					});
				}

				for (const member of input.members) {
					if (member.id) {
						await tx.assetMaintenanceTeamMember.update({
							where: { id: member.id },
							data: {
								teamMember: member.teamMember,
								fullName: member.fullName,
								maintenanceRole: member.maintenanceRole,
							},
						});
					} else {
						await tx.assetMaintenanceTeamMember.create({
							data: {
								teamId: input.id,
								teamMember: member.teamMember,
								fullName: member.fullName,
								maintenanceRole: member.maintenanceRole,
							},
						});
					}
				}
			}

			return tx.assetMaintenanceTeam.findUniqueOrThrow({
				where: { id: input.id },
				include: { members: { orderBy: { createdAt: "asc" } } },
			});
		});

		return toMaintenanceTeam(updated);
	}

	async deleteMaintenanceTeam(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Maintenance team ${id} not found`);
		}
		await this.prisma.assetMaintenanceTeam.delete({ where: { id } });
		return { success: true, id };
	}

	async deleteManyMaintenanceTeams(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const unique = [...new Set(ids)];
		const result = await this.prisma.assetMaintenanceTeam.deleteMany({
			where: { id: { in: unique } },
		});
		return { success: true, count: result.count, ids: unique };
	}

	// ============================================================================
	// Asset Maintenance Methods
	// ============================================================================

	/**
	 * Calculates the next due date based on the periodicity and reference date.
	 *
	 * @remarks
	 * Mirrors ERPNext calculate_next_due_date:
	 * - Uses lastCompletionDate as base if it is more recent than startDate.
	 * - Returns null when the calculated date would exceed endDate or when
	 *   startDate >= endDate.
	 */
	calculateNextDueDate(
		periodicity: Asset.AssetMaintenancePeriodicity,
		startDate: Date,
		endDate: Date | null | undefined,
		lastCompletionDate: Date | null | undefined,
	): Date | null {
		const base =
			lastCompletionDate && lastCompletionDate > startDate
				? lastCompletionDate
				: startDate;

		if (endDate && base >= endDate) return null;

		let next: Date;
		const d = new Date(base);

		switch (periodicity) {
			case "DAILY":
				next = new Date(d.setDate(d.getDate() + 1));
				break;
			case "WEEKLY":
				next = new Date(d.setDate(d.getDate() + 7));
				break;
			case "MONTHLY":
				next = new Date(d.setMonth(d.getMonth() + 1));
				break;
			case "QUARTERLY":
				next = new Date(d.setMonth(d.getMonth() + 3));
				break;
			case "HALF_YEARLY":
				next = new Date(d.setMonth(d.getMonth() + 6));
				break;
			case "YEARLY":
				next = new Date(d.setFullYear(d.getFullYear() + 1));
				break;
			case "TWO_YEARLY":
				next = new Date(d.setFullYear(d.getFullYear() + 2));
				break;
			case "THREE_YEARLY":
				next = new Date(d.setFullYear(d.getFullYear() + 3));
				break;
			default:
				return null;
		}

		if (endDate && next >= endDate) return null;
		return next;
	}

	private readonly maintenanceInclude = {
		asset: {
			select: {
				assetName: true,
				itemCode: true,
				assetCategory: { select: { name: true } },
			},
		},
		maintenanceTeam: { select: { name: true } },
		tasks: { orderBy: { createdAt: "asc" as const } },
	};

	async findAllAssetMaintenances(
		params?: Asset.ListAssetMaintenancesInput,
	): Promise<Asset.AssetMaintenanceListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.company)
			where.company = { contains: params.company, mode: "insensitive" };
		if (params?.maintenanceTeamId)
			where.maintenanceTeamId = params.maintenanceTeamId;
		if (params?.status)
			where.tasks = { some: { maintenanceStatus: params.status } };
		if (params?.search) {
			where.OR = [
				{ company: { contains: params.search, mode: "insensitive" } },
				{
					asset: {
						assetName: { contains: params.search, mode: "insensitive" },
					},
				},
				{
					maintenanceTeam: {
						name: { contains: params.search, mode: "insensitive" },
					},
				},
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetMaintenance.findMany({
				where,
				include: this.maintenanceInclude,
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.assetMaintenance.count({ where }),
		]);

		return { items: items.map(toAssetMaintenance), totalCount };
	}

	async findAssetMaintenanceById(
		id: string,
	): Promise<Asset.AssetMaintenanceRecord | null> {
		const record = await this.prisma.assetMaintenance.findUnique({
			where: { id },
			include: this.maintenanceInclude,
		});
		return record ? toAssetMaintenance(record) : null;
	}

	async findAssetMaintenanceByAssetId(
		assetId: string,
	): Promise<Asset.AssetMaintenanceRecord | null> {
		const record = await this.prisma.assetMaintenance.findUnique({
			where: { assetId },
			include: this.maintenanceInclude,
		});
		return record ? toAssetMaintenance(record) : null;
	}

	async findAssetMaintenanceLogs(
		maintenanceId: string,
	): Promise<Asset.AssetMaintenanceLogItem[]> {
		const logs = await this.prisma.assetMaintenanceLog.findMany({
			where: { maintenanceId },
			orderBy: { createdAt: "desc" },
		});
		return logs.map(toAssetMaintenanceLog);
	}

	private readonly logWithContextInclude = {
		maintenance: {
			select: {
				id: true,
				assetId: true,
				company: true,
				asset: { select: { id: true, assetName: true } },
			},
		},
		task: {
			select: {
				id: true,
				maintenanceTask: true,
				maintenanceType: true,
				periodicity: true,
				assignToName: true,
				nextDueDate: true,
			},
		},
	} as const;

	async findAllAssetMaintenanceLogs(
		params?: Asset.ListAssetMaintenanceLogsInput,
	): Promise<Asset.AssetMaintenanceLogListResult> {
		const skip = Math.max(params?.skip ?? 0, 0);
		const take = Math.min(
			Math.max(params?.take ?? LIST_TAKE_MAX, 1),
			LIST_TAKE_MAX,
		);

		const where: Record<string, unknown> = {};
		if (params?.maintenanceId) where.maintenanceId = params.maintenanceId;
		if (params?.status) where.maintenanceStatus = params.status;
		if (params?.search) {
			where.OR = [
				{
					maintenance: {
						asset: {
							assetName: {
								contains: params.search,
								mode: "insensitive",
							},
						},
					},
				},
				{
					task: {
						maintenanceTask: {
							contains: params.search,
							mode: "insensitive",
						},
					},
				},
				{
					maintenance: {
						company: {
							contains: params.search,
							mode: "insensitive",
						},
					},
				},
			];
		}

		const [items, totalCount] = await Promise.all([
			this.prisma.assetMaintenanceLog.findMany({
				where,
				include: this.logWithContextInclude,
				orderBy: { createdAt: "desc" },
				skip,
				take,
			}),
			this.prisma.assetMaintenanceLog.count({ where }),
		]);

		return {
			items: items.map(toAssetMaintenanceLogListItem),
			totalCount,
		};
	}

	async cancelAssetMaintenanceLog(
		input: Asset.CancelAssetMaintenanceLogInput,
	): Promise<Asset.AssetMaintenanceLogItem> {
		const log = await this.prisma.assetMaintenanceLog.findUnique({
			where: { id: input.logId },
			select: {
				id: true,
				taskId: true,
				maintenanceStatus: true,
			},
		});
		if (!log)
			throw new NotFoundException(`Maintenance log ${input.logId} not found`);
		if (log.maintenanceStatus === "COMPLETED") {
			throw new BadRequestException(
				"Cannot cancel a completed maintenance log",
			);
		}
		if (log.maintenanceStatus === "CANCELLED") {
			throw new BadRequestException("Maintenance log is already cancelled");
		}

		const updated = await this.prisma.$transaction(async (tx) => {
			const cancelled = await tx.assetMaintenanceLog.update({
				where: { id: input.logId },
				data: { maintenanceStatus: "CANCELLED" },
			});

			await tx.assetMaintenanceTask.update({
				where: { id: log.taskId },
				data: { maintenanceStatus: "CANCELLED" },
			});

			return cancelled;
		});

		return toAssetMaintenanceLog(updated);
	}

	async createAssetMaintenance(
		input: Asset.CreateAssetMaintenanceInput,
	): Promise<Asset.AssetMaintenanceRecord> {
		// Verify asset exists and is not already assigned to a maintenance record
		const asset = await this.prisma.asset.findUnique({
			where: { id: input.assetId },
			select: {
				id: true,
				assetName: true,
				itemCode: true,
				maintenance: { select: { id: true } },
			},
		});
		if (!asset) throw new NotFoundException(`Asset ${input.assetId} not found`);
		if (asset.maintenance) {
			throw new BadRequestException(
				`Asset "${asset.assetName}" already has a maintenance record`,
			);
		}

		// Verify team exists
		const team = await this.prisma.assetMaintenanceTeam.findUnique({
			where: { id: input.maintenanceTeamId },
			select: { id: true },
		});
		if (!team) {
			throw new NotFoundException(
				`Maintenance team ${input.maintenanceTeamId} not found`,
			);
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Validate tasks
		for (const task of input.tasks) {
			if (task.endDate && task.startDate >= task.endDate) {
				throw new BadRequestException(
					`Start date must be before end date for task "${task.maintenanceTask}"`,
				);
			}
		}

		const maintenance = await this.prisma.$transaction(async (tx) => {
			const created = await tx.assetMaintenance.create({
				data: {
					assetId: input.assetId,
					company: input.company,
					maintenanceTeamId: input.maintenanceTeamId,
					maintenanceManager: input.maintenanceManager ?? null,
					maintenanceManagerName: input.maintenanceManagerName ?? null,
				},
			});

			for (const taskInput of input.tasks) {
				const nextDueDate =
					taskInput.nextDueDate ??
					this.calculateNextDueDate(
						taskInput.periodicity,
						taskInput.startDate,
						taskInput.endDate ?? null,
						taskInput.lastCompletionDate ?? null,
					);

				const isOverdue = nextDueDate && nextDueDate < today;
				const status = isOverdue ? "OVERDUE" : taskInput.maintenanceStatus;

				const task = await tx.assetMaintenanceTask.create({
					data: {
						maintenanceId: created.id,
						maintenanceTask: taskInput.maintenanceTask,
						maintenanceType: taskInput.maintenanceType ?? null,
						maintenanceStatus: status,
						startDate: taskInput.startDate,
						periodicity: taskInput.periodicity,
						endDate: taskInput.endDate ?? null,
						certificateRequired: taskInput.certificateRequired ?? false,
						assignTo: taskInput.assignTo ?? null,
						assignToName: taskInput.assignToName ?? null,
						nextDueDate: nextDueDate ?? null,
						lastCompletionDate: taskInput.lastCompletionDate ?? null,
						description: taskInput.description ?? null,
					},
				});

				// Create initial maintenance log for this task
				await tx.assetMaintenanceLog.create({
					data: {
						maintenanceId: created.id,
						taskId: task.id,
						maintenanceStatus: isOverdue ? "OVERDUE" : "PLANNED",
					},
				});
			}

			return tx.assetMaintenance.findUniqueOrThrow({
				where: { id: created.id },
				include: this.maintenanceInclude,
			});
		});

		this.logger.log(`Created asset maintenance for asset ${input.assetId}`);
		return toAssetMaintenance(maintenance);
	}

	async updateAssetMaintenance(
		input: Asset.UpdateAssetMaintenanceInput,
	): Promise<Asset.AssetMaintenanceRecord> {
		const existing = await this.prisma.assetMaintenance.findUnique({
			where: { id: input.id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Asset maintenance ${input.id} not found`);
		}

		if (input.maintenanceTeamId !== undefined) {
			const team = await this.prisma.assetMaintenanceTeam.findUnique({
				where: { id: input.maintenanceTeamId },
				select: { id: true },
			});
			if (!team) {
				throw new NotFoundException(
					`Maintenance team ${input.maintenanceTeamId} not found`,
				);
			}
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		if (input.tasks) {
			for (const task of input.tasks) {
				if (task.endDate && task.startDate >= task.endDate) {
					throw new BadRequestException(
						`Start date must be before end date for task "${task.maintenanceTask}"`,
					);
				}
			}
		}

		const maintenance = await this.prisma.$transaction(async (tx) => {
			await tx.assetMaintenance.update({
				where: { id: input.id },
				data: {
					...(input.company !== undefined && { company: input.company }),
					...(input.maintenanceTeamId !== undefined && {
						maintenanceTeamId: input.maintenanceTeamId,
					}),
					...(input.maintenanceManager !== undefined && {
						maintenanceManager: input.maintenanceManager,
					}),
					...(input.maintenanceManagerName !== undefined && {
						maintenanceManagerName: input.maintenanceManagerName,
					}),
				},
			});

			if (input.tasks !== undefined) {
				const keptIds = input.tasks
					.filter((t): t is typeof t & { id: string } => Boolean(t.id))
					.map((t) => t.id);

				// Verify kept task IDs belong to this maintenance record
				if (keptIds.length > 0) {
					const ownedTasks = await tx.assetMaintenanceTask.findMany({
						where: { id: { in: keptIds }, maintenanceId: input.id },
						select: { id: true },
					});
					const ownedIds = new Set(ownedTasks.map((t) => t.id));
					const foreignId = keptIds.find((tid) => !ownedIds.has(tid));
					if (foreignId) {
						throw new BadRequestException(
							`Task with ID ${foreignId} does not belong to this maintenance record`,
						);
					}
				}

				// Identify removed tasks and cancel their open logs
				const removedTasks =
					keptIds.length === 0
						? await tx.assetMaintenanceTask.findMany({
								where: { maintenanceId: input.id },
								select: { id: true },
							})
						: await tx.assetMaintenanceTask.findMany({
								where: { maintenanceId: input.id, id: { notIn: keptIds } },
								select: { id: true },
							});

				for (const rt of removedTasks) {
					await tx.assetMaintenanceLog.updateMany({
						where: {
							taskId: rt.id,
							maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
						},
						data: { maintenanceStatus: "CANCELLED" },
					});
				}

				if (keptIds.length === 0) {
					await tx.assetMaintenanceTask.deleteMany({
						where: { maintenanceId: input.id },
					});
				} else {
					await tx.assetMaintenanceTask.deleteMany({
						where: { maintenanceId: input.id, id: { notIn: keptIds } },
					});
				}

				for (const taskInput of input.tasks) {
					const nextDueDate =
						taskInput.nextDueDate ??
						this.calculateNextDueDate(
							taskInput.periodicity,
							taskInput.startDate,
							taskInput.endDate ?? null,
							taskInput.lastCompletionDate ?? null,
						);

					const isOverdue = nextDueDate && nextDueDate < today;
					const status = isOverdue ? "OVERDUE" : taskInput.maintenanceStatus;

					if (taskInput.id) {
						// Update existing task
						await tx.assetMaintenanceTask.update({
							where: { id: taskInput.id },
							data: {
								maintenanceTask: taskInput.maintenanceTask,
								maintenanceType: taskInput.maintenanceType ?? null,
								maintenanceStatus: status,
								startDate: taskInput.startDate,
								periodicity: taskInput.periodicity,
								endDate: taskInput.endDate ?? null,
								certificateRequired: taskInput.certificateRequired ?? false,
								assignTo: taskInput.assignTo ?? null,
								assignToName: taskInput.assignToName ?? null,
								nextDueDate: nextDueDate ?? null,
								lastCompletionDate: taskInput.lastCompletionDate ?? null,
								description: taskInput.description ?? null,
							},
						});

						// Ensure there is an open log for this task; create if missing
						const openLog = await tx.assetMaintenanceLog.findFirst({
							where: {
								taskId: taskInput.id,
								maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
							},
						});
						if (!openLog) {
							await tx.assetMaintenanceLog.create({
								data: {
									maintenanceId: input.id,
									taskId: taskInput.id,
									maintenanceStatus: isOverdue ? "OVERDUE" : "PLANNED",
								},
							});
						} else {
							await tx.assetMaintenanceLog.update({
								where: { id: openLog.id },
								data: { maintenanceStatus: isOverdue ? "OVERDUE" : "PLANNED" },
							});
						}
					} else {
						// Create new task
						const newTask = await tx.assetMaintenanceTask.create({
							data: {
								maintenanceId: input.id,
								maintenanceTask: taskInput.maintenanceTask,
								maintenanceType: taskInput.maintenanceType ?? null,
								maintenanceStatus: status,
								startDate: taskInput.startDate,
								periodicity: taskInput.periodicity,
								endDate: taskInput.endDate ?? null,
								certificateRequired: taskInput.certificateRequired ?? false,
								assignTo: taskInput.assignTo ?? null,
								assignToName: taskInput.assignToName ?? null,
								nextDueDate: nextDueDate ?? null,
								lastCompletionDate: taskInput.lastCompletionDate ?? null,
								description: taskInput.description ?? null,
							},
						});

						await tx.assetMaintenanceLog.create({
							data: {
								maintenanceId: input.id,
								taskId: newTask.id,
								maintenanceStatus: isOverdue ? "OVERDUE" : "PLANNED",
							},
						});
					}
				}
			}

			return tx.assetMaintenance.findUniqueOrThrow({
				where: { id: input.id },
				include: this.maintenanceInclude,
			});
		});

		return toAssetMaintenance(maintenance);
	}

	async deleteAssetMaintenance(
		id: string,
	): Promise<{ success: boolean; id: string }> {
		const existing = await this.prisma.assetMaintenance.findUnique({
			where: { id },
			select: { id: true },
		});
		if (!existing) {
			throw new NotFoundException(`Asset maintenance ${id} not found`);
		}
		await this.prisma.assetMaintenance.delete({ where: { id } });
		return { success: true, id };
	}

	async deleteManyAssetMaintenances(
		ids: string[],
	): Promise<{ success: boolean; count: number; ids: string[] }> {
		const unique = [...new Set(ids)];
		const result = await this.prisma.assetMaintenance.deleteMany({
			where: { id: { in: unique } },
		});
		return { success: true, count: result.count, ids: unique };
	}

	async completeAssetMaintenanceLog(
		input: Asset.CompleteAssetMaintenanceLogInput,
	): Promise<Asset.AssetMaintenanceLogItem> {
		const log = await this.prisma.assetMaintenanceLog.findUnique({
			where: { id: input.logId },
			select: {
				id: true,
				maintenanceId: true,
				taskId: true,
				maintenanceStatus: true,
			},
		});
		if (!log)
			throw new NotFoundException(`Maintenance log ${input.logId} not found`);
		if (log.maintenanceStatus === "COMPLETED") {
			throw new BadRequestException("Maintenance log is already completed");
		}
		if (log.maintenanceStatus === "CANCELLED") {
			throw new BadRequestException(
				"Cannot complete a cancelled maintenance log",
			);
		}

		const updatedLog = await this.prisma.$transaction(async (tx) => {
			// Mark log as completed
			const completed = await tx.assetMaintenanceLog.update({
				where: { id: input.logId },
				data: {
					maintenanceStatus: "COMPLETED",
					completionDate: input.completionDate,
					actionsPerformed: input.actionsPerformed ?? null,
					hasCertificate: input.hasCertificate ?? false,
					certificateAttachment: input.certificateAttachment ?? null,
				},
			});

			// Update task's lastCompletionDate and recalculate nextDueDate
			const task = await tx.assetMaintenanceTask.findUniqueOrThrow({
				where: { id: log.taskId },
			});

			const newNextDueDate = this.calculateNextDueDate(
				task.periodicity as Asset.AssetMaintenancePeriodicity,
				task.startDate,
				task.endDate ?? null,
				input.completionDate,
			);

			await tx.assetMaintenanceTask.update({
				where: { id: log.taskId },
				data: {
					lastCompletionDate: input.completionDate,
					nextDueDate: newNextDueDate ?? null,
					maintenanceStatus: newNextDueDate ? "PLANNED" : "CANCELLED",
				},
			});

			// Create next open log if there is a next due date
			if (newNextDueDate) {
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				await tx.assetMaintenanceLog.create({
					data: {
						maintenanceId: log.maintenanceId,
						taskId: log.taskId,
						maintenanceStatus: newNextDueDate < today ? "OVERDUE" : "PLANNED",
					},
				});
			}

			return completed;
		});

		return toAssetMaintenanceLog(updatedLog);
	}
}
