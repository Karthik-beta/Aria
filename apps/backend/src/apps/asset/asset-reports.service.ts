/**
 * Asset Reports sub-service — Asset Activity, Asset Depreciation Ledger and
 * Asset Depreciations and Balances reports.
 *
 * Report builders live in the `asset-*-report.ts` files.
 *
 * @module AssetReportsService
 */
import type { Asset } from "@aria/types";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import { buildAssetActivityReportResult } from "./asset-activity-report";
import { buildAssetDepreciationLedgerResult } from "./asset-depreciation-ledger-report";
import { buildAssetDepreciationsAndBalancesResult } from "./asset-depreciations-and-balances-report";
import {
	businessDate,
	dateOnlyUtc,
	depreciationTimeZone,
} from "./depreciation/depreciation.config";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { DepreciationBarrierService } from "./depreciation/depreciation-barrier.service";

@Injectable()
export class AssetReportsService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly depreciationBarrier?: DepreciationBarrierService,
	) {}

	private async ensureReportDepreciation(
		toDate: Date,
		company?: string,
	): Promise<void> {
		const today = dateOnlyUtc(businessDate(depreciationTimeZone()));
		const throughDate = toDate < today ? toDate : today;
		await this.depreciationBarrier?.ensureDepreciationPosted({
			throughDate,
			...(company ? { company } : {}),
		});
	}

	async findAssetActivityReport(
		input: Asset.ListAssetActivityReportInput,
	): Promise<Asset.AssetActivityReportResult> {
		const fromDate = new Date(input.fromDate);
		fromDate.setHours(0, 0, 0, 0);

		const toDate = new Date(input.toDate);
		toDate.setHours(23, 59, 59, 999);

		const where: Prisma.AssetActivityWhereInput = {
			createdAt: {
				gte: fromDate,
				lte: toDate,
			},
		};

		if (input.activity) {
			where.activity = {
				contains: input.activity,
				mode: "insensitive",
			};
		}

		const assetWhere: Prisma.AssetWhereInput = {};

		if (input.company) {
			assetWhere.company = {
				contains: input.company,
				mode: "insensitive",
			};
		}

		if (input.asset) {
			assetWhere.OR = [
				{
					series: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
				{
					assetName: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
			];
		}

		if (input.assetCategory) {
			assetWhere.assetCategory = {
				is: {
					name: {
						contains: input.assetCategory,
						mode: "insensitive",
					},
				},
			};
		}

		if (Object.keys(assetWhere).length > 0) {
			where.asset = { is: assetWhere };
		}

		const activities = await this.prisma.assetActivity.findMany({
			where,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			select: {
				id: true,
				assetId: true,
				activity: true,
				createdAt: true,
				asset: {
					select: {
						id: true,
						series: true,
						assetName: true,
						company: true,
						status: true,
						assetCategory: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		});

		return buildAssetActivityReportResult({
			activities: activities.map((activity) => ({
				id: activity.id,
				assetId: activity.assetId,
				assetSeries: activity.asset.series,
				assetName: activity.asset.assetName,
				assetCategory: activity.asset.assetCategory
					? {
							id: activity.asset.assetCategory.id,
							name: activity.asset.assetCategory.name,
						}
					: null,
				company: activity.asset.company,
				assetStatus: activity.asset.status as Asset.AssetStatus,
				activity: activity.activity,
				createdAt: activity.createdAt,
			})),
		});
	}

	async findAssetDepreciationLedger(
		input: Asset.ListAssetDepreciationLedgerInput,
	): Promise<Asset.AssetDepreciationLedgerResult> {
		const fromDate = new Date(input.fromDate);
		fromDate.setHours(0, 0, 0, 0);

		const toDate = new Date(input.toDate);
		toDate.setHours(23, 59, 59, 999);
		await this.ensureReportDepreciation(toDate, input.company);

		const assetWhere: Prisma.AssetWhereInput = {};

		if (input.company) {
			assetWhere.company = {
				contains: input.company,
				mode: "insensitive",
			};
		}

		if (input.asset) {
			assetWhere.OR = [
				{
					series: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
				{
					assetName: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
			];
		}

		if (input.assetCategory) {
			assetWhere.assetCategory = {
				is: {
					name: {
						contains: input.assetCategory,
						mode: "insensitive",
					},
				},
			};
		}

		if (input.costCenter) {
			assetWhere.valueAdjustments = {
				some: {
					status: "SUBMITTED",
					adjustmentDate: { lte: toDate },
					costCenter: {
						contains: input.costCenter,
						mode: "insensitive",
					},
				},
			};
		}

		const assets = await this.prisma.asset.findMany({
			where: assetWhere,
			select: {
				id: true,
				series: true,
				assetName: true,
				company: true,
				purchaseDate: true,
				netPurchaseAmount: true,
				status: true,
				assetCategory: {
					select: {
						id: true,
						name: true,
					},
				},
				valueAdjustments: {
					where: {
						status: "SUBMITTED",
						adjustmentDate: { lte: toDate },
						...(input.costCenter
							? {
									costCenter: {
										contains: input.costCenter,
										mode: "insensitive" as const,
									},
								}
							: {}),
					},
					orderBy: [{ adjustmentDate: "asc" }, { createdAt: "asc" }],
					select: {
						id: true,
						series: true,
						adjustmentDate: true,
						costCenter: true,
						revaluationEntry: {
							select: {
								series: true,
							},
						},
						depreciationSchedule: {
							select: {
								id: true,
								revisionNumber: true,
								startDate: true,
								depreciationMethod: true,
								openingAccumulatedDepreciation: true,
								entries: {
									where: { posting: { is: { status: "POSTED" } } },
									orderBy: { sequence: "asc" },
									select: {
										id: true,
										sequence: true,
										scheduleDate: true,
										depreciationAmount: true,
										accumulatedDepreciationAmount: true,
										bookValueAfterDepreciation: true,
									},
								},
							},
						},
					},
				},
				depreciationSchedules: {
					where: {
						entries: { some: { posting: { is: { status: "POSTED" } } } },
					},
					orderBy: [{ startDate: "asc" }, { revisionNumber: "asc" }],
					select: {
						id: true,
						revisionNumber: true,
						startDate: true,
						depreciationMethod: true,
						openingAccumulatedDepreciation: true,
						adjustment: {
							select: {
								id: true,
								series: true,
								adjustmentDate: true,
								costCenter: true,
								revaluationEntry: { select: { series: true } },
							},
						},
						entries: {
							where: { posting: { is: { status: "POSTED" } } },
							orderBy: { sequence: "asc" },
							select: {
								id: true,
								sequence: true,
								scheduleDate: true,
								depreciationAmount: true,
								accumulatedDepreciationAmount: true,
								bookValueAfterDepreciation: true,
							},
						},
					},
				},
			},
		});

		return buildAssetDepreciationLedgerResult({
			fromDate,
			toDate,
			assets: assets.map((asset) => ({
				id: asset.id,
				series: asset.series,
				assetName: asset.assetName,
				company: asset.company,
				purchaseDate: asset.purchaseDate ?? null,
				netPurchaseAmount: asset.netPurchaseAmount
					? Number(asset.netPurchaseAmount)
					: null,
				status: asset.status as Asset.AssetStatus,
				assetCategory: asset.assetCategory
					? {
							id: asset.assetCategory.id,
							name: asset.assetCategory.name,
						}
					: null,
				adjustments: asset.depreciationSchedules.map((schedule) => ({
					id: schedule.adjustment?.id ?? schedule.id,
					series:
						schedule.adjustment?.series ??
						`DEP-SCHEDULE-${schedule.revisionNumber}`,
					adjustmentDate:
						schedule.adjustment?.adjustmentDate ?? schedule.startDate,
					costCenter: schedule.adjustment?.costCenter ?? null,
					revaluationEntrySeries:
						schedule.adjustment?.revaluationEntry?.series ?? null,
					schedule: {
						id: schedule.id,
						revisionNumber: schedule.revisionNumber,
						startDate: schedule.startDate,
						depreciationMethod:
							(schedule.depreciationMethod as Asset.DepreciationMethod | null) ??
							null,
						openingAccumulatedDepreciation: Number(
							schedule.openingAccumulatedDepreciation,
						),
						entries: schedule.entries.map((entry) => ({
							id: entry.id,
							sequence: entry.sequence,
							scheduleDate: entry.scheduleDate,
							depreciationAmount: Number(entry.depreciationAmount),
							accumulatedDepreciationAmount: Number(
								entry.accumulatedDepreciationAmount,
							),
							bookValueAfterDepreciation: Number(
								entry.bookValueAfterDepreciation,
							),
						})),
					},
				})),
			})),
		});
	}

	async findAssetDepreciationsAndBalances(
		input: Asset.ListAssetDepreciationsAndBalancesInput,
	): Promise<Asset.AssetDepreciationsAndBalancesResult> {
		const fromDate = new Date(input.fromDate);
		fromDate.setHours(0, 0, 0, 0);

		const toDate = new Date(input.toDate);
		toDate.setHours(23, 59, 59, 999);
		await this.ensureReportDepreciation(toDate, input.company);

		const assetWhere: Prisma.AssetWhereInput = {
			purchaseDate: {
				lte: toDate,
			},
		};

		if (input.company) {
			assetWhere.company = {
				contains: input.company,
				mode: "insensitive",
			};
		}

		if (input.asset) {
			assetWhere.OR = [
				{
					series: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
				{
					assetName: {
						contains: input.asset,
						mode: "insensitive",
					},
				},
			];
		}

		if (input.assetCategory) {
			assetWhere.assetCategory = {
				is: {
					name: {
						contains: input.assetCategory,
						mode: "insensitive",
					},
				},
			};
		}

		const assets = await this.prisma.asset.findMany({
			where: assetWhere,
			select: {
				id: true,
				series: true,
				assetName: true,
				company: true,
				purchaseDate: true,
				disposalDate: true,
				netPurchaseAmount: true,
				openingAccumulatedDepreciation: true,
				status: true,
				assetCategory: {
					select: {
						id: true,
						name: true,
					},
				},
				valueAdjustments: {
					where: {
						status: "SUBMITTED",
						adjustmentDate: { lte: toDate },
					},
					orderBy: [{ adjustmentDate: "asc" }, { createdAt: "asc" }],
					select: {
						id: true,
						adjustmentDate: true,
						differenceAmount: true,
						depreciationSchedule: {
							select: {
								id: true,
								revisionNumber: true,
								startDate: true,
								openingAccumulatedDepreciation: true,
								entries: {
									where: { posting: { is: { status: "POSTED" } } },
									orderBy: { sequence: "asc" },
									select: {
										id: true,
										sequence: true,
										scheduleDate: true,
										depreciationAmount: true,
										accumulatedDepreciationAmount: true,
										bookValueAfterDepreciation: true,
									},
								},
							},
						},
					},
				},
				depreciationSchedules: {
					where: {
						entries: { some: { posting: { is: { status: "POSTED" } } } },
					},
					orderBy: [{ startDate: "asc" }, { revisionNumber: "asc" }],
					select: {
						id: true,
						revisionNumber: true,
						startDate: true,
						openingAccumulatedDepreciation: true,
						entries: {
							where: { posting: { is: { status: "POSTED" } } },
							orderBy: { sequence: "asc" },
							select: {
								id: true,
								sequence: true,
								scheduleDate: true,
								depreciationAmount: true,
								accumulatedDepreciationAmount: true,
								bookValueAfterDepreciation: true,
							},
						},
					},
				},
			},
		});

		return buildAssetDepreciationsAndBalancesResult({
			fromDate,
			toDate,
			groupBy: input.groupBy,
			assets: assets.map((asset) => ({
				id: asset.id,
				series: asset.series,
				assetName: asset.assetName,
				company: asset.company,
				purchaseDate: asset.purchaseDate,
				disposalDate: asset.disposalDate ?? null,
				netPurchaseAmount: Number(asset.netPurchaseAmount ?? 0),
				openingAccumulatedDepreciation: Number(
					asset.openingAccumulatedDepreciation ?? 0,
				),
				status: asset.status as Asset.AssetStatus,
				assetCategory: asset.assetCategory
					? {
							id: asset.assetCategory.id,
							name: asset.assetCategory.name,
						}
					: null,
				adjustments: [
					...asset.valueAdjustments.map((adjustment) => ({
						id: adjustment.id,
						adjustmentDate: adjustment.adjustmentDate,
						differenceAmount: Number(adjustment.differenceAmount),
						schedule: null,
					})),
					...asset.depreciationSchedules.map((schedule) => ({
						id: schedule.id,
						adjustmentDate: schedule.startDate,
						differenceAmount: 0,
						schedule: {
							id: schedule.id,
							revisionNumber: schedule.revisionNumber,
							startDate: schedule.startDate,
							openingAccumulatedDepreciation: Number(
								schedule.openingAccumulatedDepreciation,
							),
							entries: schedule.entries.map((entry) => ({
								id: entry.id,
								sequence: entry.sequence,
								scheduleDate: entry.scheduleDate,
								depreciationAmount: Number(entry.depreciationAmount),
								accumulatedDepreciationAmount: Number(
									entry.accumulatedDepreciationAmount,
								),
								bookValueAfterDepreciation: Number(
									entry.bookValueAfterDepreciation,
								),
							})),
						},
					})),
				],
			})),
		});
	}
}
