/**
 * Asset Value Adjustment sub-service — preview, create, update, submit,
 * cancel and delete of asset value adjustments (revaluations).
 *
 * Follows the ERPNext Asset Value Adjustment doctype. Static query shapes
 * and pure helpers live in `asset-value-adjustment.helpers.ts`.
 *
 * @module AssetValueAdjustmentService
 */
import type { Asset } from "@aria/types";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import {
	allocateDocumentSeries,
	getSeriesSeedValue,
} from "../../shared/document-series";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { FiscalYearService } from "../../shared/fiscal-year/fiscal-year.service";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { toAssetValueAdjustment } from "./asset.types";
import {
	LIST_TAKE_MAX,
	normalizeOptionalText,
	roundCurrency,
} from "./asset-service.shared";
import {
	assertAssetValueAdjustmentPreviewIsValid,
	assetAdjustmentContextSelect,
	assetAdjustmentInclude,
	resolveCurrentAssetValue,
	resolveDepreciationConfig,
} from "./asset-value-adjustment.helpers";
import {
	buildDepreciationSchedulePreview,
	buildRevaluationEntryLines,
	deriveFixedAssetAccount,
	getAssetValueAdjustmentDirection,
	getAssetValueAdjustmentResultState,
} from "./asset-value-adjustment.utils";

@Injectable()
export class AssetValueAdjustmentService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly fiscalYearService: FiscalYearService,
	) {}

	private async generateAssetValueAdjustmentSeries(
		date: Date,
	): Promise<string> {
		const year = date.getFullYear();
		const prefix = `AVA-${year}-`;
		const existingCounter = await this.prisma.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			return allocateDocumentSeries(this.prisma, prefix);
		}

		const last = await this.prisma.assetValueAdjustment.findFirst({
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

	private async generateAssetRevaluationEntrySeries(
		date: Date,
	): Promise<string> {
		const year = date.getFullYear();
		const prefix = `JE-AVA-${year}-`;
		const existingCounter = await this.prisma.documentSeriesCounter.findUnique({
			where: { key: prefix },
			select: { value: true },
		});

		if (existingCounter) {
			return allocateDocumentSeries(this.prisma, prefix);
		}

		const last = await this.prisma.assetRevaluationEntry.findFirst({
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

	private async getAssetAdjustmentContextOrThrow(assetId: string) {
		const asset = await this.prisma.asset.findUnique({
			where: { id: assetId },
			select: assetAdjustmentContextSelect,
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
						dailyProrataBased: asset.assetCategory.dailyProrataBased ?? null,
						shiftBased: asset.assetCategory.shiftBased ?? null,
						rateOfDepreciation: asset.assetCategory.rateOfDepreciation ?? null,
						expectedValueAfterUsefulLife:
							asset.assetCategory.expectedValueAfterUsefulLife ?? null,
						nonDepreciableCategory: asset.assetCategory.nonDepreciableCategory,
					}
				: null,
			activeDepreciationSchedule: asset.depreciationSchedules[0] ?? null,
			defaultAssetFinanceBook: asset.financeBooks?.[0] ?? null,
		};
	}

	private async buildAssetValueAdjustmentPreview(
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
				dailyProrataBased: boolean | null;
				shiftBased: boolean | null;
				rateOfDepreciation: number | null;
				expectedValueAfterUsefulLife: Prisma.Decimal | null;
				nonDepreciableCategory: boolean;
			} | null;
		},
		input: Pick<
			Asset.PreviewAssetValueAdjustmentInput,
			"adjustmentDate" | "newAssetValue"
		>,
	): Promise<Asset.AssetValueAdjustmentPreview> {
		const currentAssetValue = resolveCurrentAssetValue(asset);
		const differenceAmount = roundCurrency(
			input.newAssetValue - currentAssetValue,
		);
		const depreciationConfig = resolveDepreciationConfig({
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
						dailyProrataBased: asset.assetCategory.dailyProrataBased ?? null,
						shiftBased: asset.assetCategory.shiftBased ?? null,
						rateOfDepreciation: asset.assetCategory.rateOfDepreciation ?? null,
						expectedValueAfterUsefulLife:
							asset.assetCategory.expectedValueAfterUsefulLife ?? null,
						nonDepreciableCategory: asset.assetCategory.nonDepreciableCategory,
					}
				: null,
		});
		const schedulePreview = asset.calculateDepreciation
			? await buildDepreciationSchedulePreview({
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
					dailyProrataBased: depreciationConfig.dailyProrataBased,
					shiftBased: depreciationConfig.shiftBased,
					rateOfDepreciation: depreciationConfig.rateOfDepreciation,
					expectedValueAfterUsefulLife:
						depreciationConfig.expectedValueAfterUsefulLife,
					getFiscalYearEndDate: (date: Date) =>
						this.fiscalYearService.getFiscalYearEndDate(date),
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
			newAssetValue: roundCurrency(input.newAssetValue),
			differenceAmount,
			direction: getAssetValueAdjustmentDirection(differenceAmount),
			fixedAssetAccount: deriveFixedAssetAccount(asset.assetCategory?.name),
			resultingStatus: resultState.status,
			resultingIsFullyDepreciated: resultState.isFullyDepreciated,
			validationMessages,
			depreciationSchedule: schedulePreview,
		};
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
				include: assetAdjustmentInclude,
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
			include: assetAdjustmentInclude,
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
		const preview = await this.buildAssetValueAdjustmentPreview(asset, input);
		assertAssetValueAdjustmentPreviewIsValid(preview);

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
				costCenter: normalizeOptionalText(input.costCenter),
				notes: normalizeOptionalText(input.notes),
				status: "DRAFT",
				direction: preview.direction,
				previousAssetStatus: asset.status,
				previousIsFullyDepreciated: asset.isFullyDepreciated,
			},
			include: assetAdjustmentInclude,
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
		const preview = await this.buildAssetValueAdjustmentPreview(
			asset,
			draftInput,
		);
		assertAssetValueAdjustmentPreviewIsValid(preview);

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
						? normalizeOptionalText(input.costCenter)
						: existing.costCenter,
				notes:
					input.notes !== undefined
						? normalizeOptionalText(input.notes)
						: existing.notes,
				direction: preview.direction,
				previousAssetStatus: asset.status,
				previousIsFullyDepreciated: asset.isFullyDepreciated,
			},
			include: assetAdjustmentInclude,
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
		const preview = await this.buildAssetValueAdjustmentPreview(asset, {
			adjustmentDate: adjustment.adjustmentDate,
			newAssetValue: Number(adjustment.newAssetValue),
		});
		assertAssetValueAdjustmentPreviewIsValid(preview);

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
				const assetFinanceBookId =
					asset.activeDepreciationSchedule?.assetFinanceBookId ??
					asset.defaultAssetFinanceBook?.id;
				await tx.assetDepreciationSchedule.create({
					data: {
						adjustmentId: adjustment.id,
						assetId: asset.id,
						assetFinanceBookId,
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
							normalizeOptionalText(adjustment.notes) ??
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
				include: assetAdjustmentInclude,
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
				include: assetAdjustmentInclude,
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
}
