/**
 * Asset core sub-service — CRUD and lifecycle for Assets.
 *
 * Follows the ERPNext Asset module business logic:
 * - Series generated as AST-YYYY-NNNNN
 * - Status lifecycle: DRAFT → SUBMITTED → depreciation states / SOLD / SCRAPPED
 * - All amounts stored as Decimal(18,6) in DB, returned as number to clients
 *
 * Pure create/update helpers live in `asset-core.helpers.ts`.
 *
 * @module AssetCoreService
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
import {
	allocateDocumentSeries,
	getSeriesSeedValue,
} from "../../shared/document-series";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { toAsset } from "./asset.types";
import type { AssetCustodian } from "./asset-core.helpers";
import {
	custodianActivity,
	getLastDayOfMonth,
	validateDepreciationFields,
} from "./asset-core.helpers";
import { getOpeningAssetValue, LIST_TAKE_MAX } from "./asset-service.shared";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { AssetDepreciationLifecycleService } from "./depreciation/asset-depreciation-lifecycle.service";

@Injectable()
export class AssetCoreService {
	private readonly logger = new Logger(AssetCoreService.name);

	private readonly assetInclude = {
		assetCategory: { select: { id: true, name: true } },
		location: { select: { id: true, name: true } },
		custodian: {
			select: { id: true, employeeId: true, employeeName: true },
		},
		activities: { orderBy: { createdAt: "desc" as const } },
		financeBooks: {
			include: { financeBook: { select: { name: true } } },
			orderBy: { createdAt: "asc" as const },
		},
	} as const;

	constructor(
		private readonly prisma: PrismaService,
		private readonly depreciationLifecycle?: AssetDepreciationLifecycleService,
	) {}

	/**
	 * Generates a unique asset series in format AST-YYYY-NNNNN.
	 * Uses a database-backed counter to stay safe under concurrent creates.
	 */
	private async generateAssetSeries(date: Date): Promise<string> {
		const year = date.getFullYear();
		const prefix = `AST-${year}-`;
		const existingCounter = await this.prisma.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			return allocateDocumentSeries(this.prisma, prefix);
		}

		const last = await this.prisma.asset.findFirst({
			where: { series: { startsWith: prefix } },
			orderBy: { series: "desc" },
			select: { series: true },
		});

		return allocateDocumentSeries(
			this.prisma,
			prefix,
			5,
			getSeriesSeedValue(prefix, last?.series),
		);
	}

	/**
	 * Resolves the custodian Employee link, mirroring ERPNext's Link validation
	 * and Asset Movement's `validate_employee` company check.
	 */
	private async resolveCustodian(
		custodianId: string | null | undefined,
		company: string,
	): Promise<AssetCustodian | null> {
		if (!custodianId) return null;

		const employee = await this.prisma.employee.findUnique({
			where: { id: custodianId },
			select: {
				id: true,
				employeeId: true,
				employeeName: true,
				company: true,
			},
		});
		if (!employee) {
			throw new NotFoundException(`Employee ${custodianId} not found`);
		}
		if (employee.company && employee.company !== company) {
			throw new BadRequestException(
				`Employee ${employee.employeeId} does not belong to company ${company}`,
			);
		}

		return employee;
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
				expectedValueAfterUsefulLife: true,
			},
		});
	}

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
				{
					custodian: {
						employeeName: { contains: params.search, mode: "insensitive" },
					},
				},
				{
					custodian: {
						employeeId: { contains: params.search, mode: "insensitive" },
					},
				},
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

	async findAssetByBarcode(barcode: string): Promise<Asset.AssetItem | null> {
		const asset = await this.prisma.asset.findUnique({
			where: { barcode },
			include: this.assetInclude,
		});
		return asset ? toAsset(asset) : null;
	}

	async createAsset(input: Asset.CreateAssetInput): Promise<Asset.AssetItem> {
		if (input.status && input.status !== "DRAFT") {
			throw new BadRequestException(
				"Create the asset as a draft, then use the explicit submit action",
			);
		}
		if (input.barcode && input.barcode.trim().length > 0) {
			const existingWithBarcode = await this.prisma.asset.findUnique({
				where: { barcode: input.barcode.trim() },
				select: { id: true, assetName: true },
			});
			if (existingWithBarcode) {
				throw new ConflictException(
					`Barcode "${input.barcode}" is already registered to asset "${existingWithBarcode.assetName}"`,
				);
			}
		}

		const custodian = await this.resolveCustodian(
			input.custodianId,
			input.company,
		);

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
		const valueAfterDepreciation = getOpeningAssetValue(
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
		const expectedValueAfterUsefulLife =
			input.expectedValueAfterUsefulLife ??
			(categoryDefaults?.expectedValueAfterUsefulLife != null
				? Number(categoryDefaults.expectedValueAfterUsefulLife)
				: null);
		const availableForUseDate =
			input.availableForUseDate instanceof Date
				? input.availableForUseDate
				: null;
		const depreciationStartDate =
			input.depreciationStartDate ??
			(availableForUseDate ? getLastDayOfMonth(availableForUseDate) : null);

		validateDepreciationFields(
			netPurchaseAmount,
			expectedValueAfterUsefulLife,
			depreciationStartDate,
			purchaseDate,
			availableForUseDate,
			totalNumberOfDepreciations,
			frequencyOfDepreciation,
			openingAccumulatedDepreciation,
			input.openingNumberOfBookedDepreciations ?? null,
			calculateDepreciation,
		);

		const created = await this.prisma.asset.create({
			data: {
				series,
				assetName: input.assetName,
				itemCode: input.itemCode ?? "",
				barcode: input.barcode ?? null,
				assetCategoryId: input.assetCategoryId ?? null,
				company: input.company,
				locationId: input.locationId ?? null,
				custodianId: custodian?.id ?? null,
				department: input.department ?? null,
				purchaseDate,
				availableForUseDate,
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
				expectedValueAfterUsefulLife:
					expectedValueAfterUsefulLife?.toString() ?? null,
				depreciationStartDate,
				purchaseReceipt: input.purchaseReceipt ?? null,
				purchaseInvoice: input.purchaseInvoice ?? null,
				status: "DRAFT",
			},
		});

		await this.depreciationLifecycle?.configureAssetBooks(
			created.id,
			input.financeBooks,
		);

		await this.prisma.assetActivity.create({
			data: {
				assetId: created.id,
				activity: `Asset created with series ${series}`,
			},
		});

		if (custodian) {
			await this.prisma.assetActivity.create({
				data: {
					assetId: created.id,
					activity: custodianActivity(null, custodian),
				},
			});
		}

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
				company: true,
				assetCategoryId: true,
				custodian: {
					select: { id: true, employeeId: true, employeeName: true },
				},
				netPurchaseAmount: true,
				openingAccumulatedDepreciation: true,
				calculateDepreciation: true,
				depreciationMethod: true,
				totalNumberOfDepreciations: true,
				frequencyOfDepreciation: true,
				valueAfterDepreciation: true,
				isFullyDepreciated: true,
				openingNumberOfBookedDepreciations: true,
			},
		});
		if (!existing) throw new NotFoundException(`Asset ${input.id} not found`);

		if (input.barcode && input.barcode.trim().length > 0) {
			const existingWithBarcode = await this.prisma.asset.findUnique({
				where: { barcode: input.barcode.trim() },
				select: { id: true, assetName: true },
			});
			if (existingWithBarcode && existingWithBarcode.id !== input.id) {
				throw new ConflictException(
					`Barcode "${input.barcode}" is already registered to asset "${existingWithBarcode.assetName}"`,
				);
			}
		}

		if (existing.status === "CANCELLED") {
			throw new BadRequestException("Cannot update a cancelled asset");
		}

		const custodianChanged =
			input.custodianId !== undefined &&
			(input.custodianId ?? null) !== (existing.custodian?.id ?? null);
		const nextCustodian = custodianChanged
			? await this.resolveCustodian(
					input.custodianId,
					input.company ?? existing.company,
				)
			: null;

		const depreciationCriticalEdit = [
			input.assetCategoryId,
			input.company,
			input.purchaseDate,
			input.availableForUseDate,
			input.netPurchaseAmount,
			input.calculateDepreciation,
			input.openingAccumulatedDepreciation,
			input.openingNumberOfBookedDepreciations,
			input.depreciationMethod,
			input.totalNumberOfDepreciations,
			input.frequencyOfDepreciation,
			input.expectedValueAfterUsefulLife,
			input.depreciationStartDate,
			input.financeBooks,
		].some((value) => value !== undefined);
		if (existing.status !== "DRAFT" && depreciationCriticalEdit) {
			throw new BadRequestException(
				"Depreciation-critical fields cannot be edited after submission; use a supported rescheduling or value-adjustment workflow",
			);
		}
		if (input.status !== undefined) {
			throw new BadRequestException(
				"Use the explicit submit or cancel asset action to change lifecycle status",
			);
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
		const derivedValueAfterDepreciation = getOpeningAssetValue(
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
		const shouldInheritExpectedValueAfterUsefulLife =
			input.assetCategoryId !== undefined &&
			input.expectedValueAfterUsefulLife === undefined;
		const shouldInheritDepreciationStartDate =
			input.assetCategoryId !== undefined &&
			input.depreciationStartDate === undefined;
		const calculateDepreciation =
			input.calculateDepreciation ??
			(input.assetCategoryId !== undefined && categoryDefaults
				? !categoryDefaults.nonDepreciableCategory
				: existing.calculateDepreciation);
		const nextAvailableForUseDate =
			input.availableForUseDate instanceof Date
				? input.availableForUseDate
				: null;
		const nextDepreciationStartDate =
			input.depreciationStartDate ??
			(nextAvailableForUseDate
				? getLastDayOfMonth(nextAvailableForUseDate)
				: null);
		const nextExpectedValueAfterUsefulLife =
			input.expectedValueAfterUsefulLife ??
			(shouldInheritExpectedValueAfterUsefulLife &&
			categoryDefaults?.expectedValueAfterUsefulLife != null
				? Number(categoryDefaults.expectedValueAfterUsefulLife)
				: null);

		validateDepreciationFields(
			nextNetPurchaseAmount,
			nextExpectedValueAfterUsefulLife,
			nextDepreciationStartDate,
			input.purchaseDate instanceof Date ? input.purchaseDate : new Date(),
			nextAvailableForUseDate,
			input.totalNumberOfDepreciations ?? existing.totalNumberOfDepreciations,
			input.frequencyOfDepreciation ?? existing.frequencyOfDepreciation,
			nextOpeningAccumulatedDepreciation,
			input.openingNumberOfBookedDepreciations ??
				existing.openingNumberOfBookedDepreciations,
			calculateDepreciation,
		);

		const asset = await this.prisma.asset.update({
			where: { id: input.id },
			data: {
				...(input.assetName !== undefined && { assetName: input.assetName }),
				...(input.itemCode !== undefined && { itemCode: input.itemCode ?? "" }),
				...(input.barcode !== undefined && { barcode: input.barcode }),
				...(input.assetCategoryId !== undefined && {
					assetCategoryId: input.assetCategoryId,
				}),
				...(input.company !== undefined && { company: input.company }),
				...(input.locationId !== undefined && { locationId: input.locationId }),
				...(custodianChanged && { custodianId: nextCustodian?.id ?? null }),
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
				...(input.expectedValueAfterUsefulLife !== undefined && {
					expectedValueAfterUsefulLife:
						input.expectedValueAfterUsefulLife !== null
							? input.expectedValueAfterUsefulLife.toString()
							: null,
				}),
				...(shouldInheritExpectedValueAfterUsefulLife &&
				categoryDefaults?.expectedValueAfterUsefulLife != null
					? {
							expectedValueAfterUsefulLife:
								categoryDefaults.expectedValueAfterUsefulLife.toString(),
						}
					: {}),
				...(input.depreciationStartDate !== undefined && {
					depreciationStartDate:
						input.depreciationStartDate instanceof Date
							? input.depreciationStartDate
							: null,
				}),
				...(shouldInheritDepreciationStartDate && nextAvailableForUseDate
					? {
							depreciationStartDate: getLastDayOfMonth(nextAvailableForUseDate),
						}
					: {}),
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

		if (custodianChanged) {
			await this.prisma.assetActivity.create({
				data: {
					assetId: input.id,
					activity: custodianActivity(existing.custodian, nextCustodian),
				},
			});
		}

		if (existing.status === "DRAFT" && input.financeBooks !== undefined) {
			await this.depreciationLifecycle?.configureAssetBooks(
				input.id,
				input.financeBooks,
			);
			const refreshed = await this.prisma.asset.findUniqueOrThrow({
				where: { id: input.id },
				include: this.assetInclude,
			});
			return toAsset(refreshed);
		}

		return toAsset(asset);
	}

	/** Submits a draft asset and activates its precomputed schedules. */
	async submitAsset(id: string): Promise<Asset.AssetItem> {
		if (!this.depreciationLifecycle) {
			throw new Error("Depreciation lifecycle service is unavailable");
		}
		await this.depreciationLifecycle.submitAsset(id);
		const asset = await this.prisma.asset.findUniqueOrThrow({
			where: { id },
			include: this.assetInclude,
		});
		return toAsset(asset);
	}

	/** Cancels an unposted asset and cancels its open schedules. */
	async cancelAsset(id: string): Promise<Asset.AssetItem> {
		if (!this.depreciationLifecycle) {
			throw new Error("Depreciation lifecycle service is unavailable");
		}
		await this.depreciationLifecycle.cancelAsset(id);
		const asset = await this.prisma.asset.findUniqueOrThrow({
			where: { id },
			include: this.assetInclude,
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
}
