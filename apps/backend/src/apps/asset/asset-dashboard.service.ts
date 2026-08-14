/**
 * Asset Dashboard sub-service — aggregated metrics for the asset dashboard.
 *
 * Runs efficient Prisma queries to gather KPIs, status distribution,
 * depreciation trends, maintenance due items, and operational indicators
 * in a single request.
 *
 * @module AssetDashboardSubService
 */
import type { Asset } from "@aria/types";
import { Injectable } from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import {
	type AssetOrganizationId,
	assetWhereForOrganization,
} from "./asset-organization-scope";
import {
	addDateOnlyUtc,
	businessDate,
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
	depreciationTimeZone,
	differenceInDateOnlyDays,
} from "./depreciation/depreciation.config";

const ACTIVE_STATUSES: Asset.AssetStatus[] = [
	"SUBMITTED",
	"PARTIALLY_DEPRECIATED",
	"IN_MAINTENANCE",
	"OUT_OF_ORDER",
];

const NON_DISPOSED_STATUSES: Asset.AssetStatus[] = [
	...ACTIVE_STATUSES,
	"DRAFT",
	"FULLY_DEPRECIATED",
];

@Injectable()
export class AssetDashboardSubService {
	constructor(private readonly prisma: PrismaService) {}

	async getDashboardData(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardData> {
		const overviewData = await this.getDashboardOverviewData(organizationId);
		const [topChartsData, bottomChartsData] = await Promise.all([
			this.getDashboardTopChartsData(organizationId),
			this.getDashboardBottomChartsData(organizationId),
		]);

		return {
			...overviewData,
			...topChartsData,
			...bottomChartsData,
		};
	}

	async getDashboardOverviewData(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardOverviewData> {
		const today = businessDate(depreciationTimeZone());
		const now = dateOnlyUtc(today);
		const ninetyDaysFromNow = addDateOnlyUtc(today, 90);

		const [
			kpis,
			maintenanceDue,
			recentActivity,
			adjustmentSummary,
			insuranceExpiry,
		] = await Promise.all([
			this.getKpis(organizationId, now),
			this.getMaintenanceDue(organizationId, now, ninetyDaysFromNow),
			this.getRecentActivity(organizationId),
			this.getAdjustmentSummary(organizationId),
			this.getInsuranceExpiry(organizationId, now, ninetyDaysFromNow),
		]);

		return {
			kpis,
			maintenanceDue,
			recentActivity,
			adjustmentSummary,
			insuranceExpiry,
		};
	}

	async getDashboardTopChartsData(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardTopChartsData> {
		const [statusDistribution, depreciationTrend] = await Promise.all([
			this.getStatusDistribution(organizationId),
			this.getDepreciationTrend(organizationId),
		]);

		return {
			statusDistribution,
			depreciationTrend,
		};
	}

	async getDashboardBottomChartsData(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardBottomChartsData> {
		const [categoryValues, locationDistribution] = await Promise.all([
			this.getCategoryValues(organizationId),
			this.getLocationDistribution(organizationId),
		]);

		return {
			categoryValues,
			locationDistribution,
		};
	}

	private async getKpis(
		organizationId: AssetOrganizationId,
		today: Date,
	): Promise<Asset.AssetDashboardKpi> {
		const [
			totalAssets,
			activeAssets,
			valueAgg,
			maintenanceDueCount,
			pendingAdjustments,
			locationCount,
		] = await Promise.all([
			this.prisma.asset.count({
				where: assetWhereForOrganization(organizationId, {
					status: { in: NON_DISPOSED_STATUSES },
				}),
			}),
			this.prisma.asset.count({
				where: assetWhereForOrganization(organizationId, {
					status: { in: ACTIVE_STATUSES },
				}),
			}),
			this.prisma.asset.aggregate({
				where: assetWhereForOrganization(organizationId, {
					status: { in: NON_DISPOSED_STATUSES },
				}),
				_sum: {
					valueAfterDepreciation: true,
					netPurchaseAmount: true,
					openingAccumulatedDepreciation: true,
				},
			}),
			this.prisma.assetMaintenanceTask.count({
				where: {
					maintenance: {
						is: {
							asset: { is: assetWhereForOrganization(organizationId) },
						},
					},
					maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
					nextDueDate: {
						not: null,
						lt: addDateOnlyUtc(dateOnlyFromPersistedDateTime(today), 1),
					},
				},
			}),
			this.prisma.assetValueAdjustment.count({
				where: {
					status: "DRAFT",
					asset: { is: assetWhereForOrganization(organizationId) },
				},
			}),
			this.prisma.location.count({
				where: {
					isGroup: false,
					assets: {
						some: assetWhereForOrganization(organizationId, {
							status: { in: NON_DISPOSED_STATUSES },
						}),
					},
				},
			}),
		]);

		return {
			totalAssets,
			activeAssets,
			totalAssetValue: Math.round(
				Number(valueAgg._sum.valueAfterDepreciation ?? 0),
			),
			totalPurchaseValue: Math.round(
				Number(valueAgg._sum.netPurchaseAmount ?? 0),
			),
			totalDepreciation: Math.round(
				Number(valueAgg._sum.openingAccumulatedDepreciation ?? 0),
			),
			maintenanceDueCount,
			pendingAdjustments,
			locationCount,
		};
	}

	private async getStatusDistribution(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardStatusDistribution[]> {
		const groups = await this.prisma.asset.groupBy({
			by: ["status"],
			where: assetWhereForOrganization(organizationId),
			_count: true,
			_sum: { valueAfterDepreciation: true },
		});

		return groups
			.map((g) => ({
				status: g.status,
				count: g._count,
				value: Math.round(Number(g._sum.valueAfterDepreciation ?? 0)),
			}))
			.sort((a, b) => b.count - a.count);
	}

	private async getDepreciationTrend(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardDepreciationTrend[]> {
		const rows = await this.prisma.client.$queryRaw<
			Array<{ month: string; amount: number | null }>
		>(Prisma.sql`
			SELECT
				TO_CHAR(DATE_TRUNC('month', adse."scheduleDate"), 'YYYY-MM') AS "month",
				SUM(adse."depreciationAmount") AS "amount"
			FROM asset_depreciation_schedule_entries adse
			INNER JOIN asset_depreciation_schedules ads
				ON ads.id = adse."scheduleId"
			INNER JOIN assets a
				ON a.id = ads."assetId"
			INNER JOIN "Company" c
				ON c.id = a."companyId"
			WHERE ads.status = 'ACTIVE'
				AND c."organizationId" = ${organizationId}
			GROUP BY DATE_TRUNC('month', adse."scheduleDate")
			ORDER BY DATE_TRUNC('month', adse."scheduleDate") ASC
		`);

		return rows.map((row) => ({
			month: row.month,
			amount: Math.round(Number(row.amount ?? 0)),
		}));
	}

	private async getCategoryValues(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardCategoryValue[]> {
		const rows = await this.prisma.client.$queryRaw<
			Array<{
				category: string;
				purchaseValue: number | null;
				currentValue: number | null;
				assetCount: number | bigint;
			}>
		>(Prisma.sql`
			SELECT
				COALESCE(ac.name, 'Uncategorised') AS "category",
				SUM(a."netPurchaseAmount") AS "purchaseValue",
				SUM(a."valueAfterDepreciation") AS "currentValue",
				COUNT(*) AS "assetCount"
			FROM assets a
			INNER JOIN "Company" c ON c.id = a."companyId"
			LEFT JOIN asset_categories ac ON ac.id = a."assetCategoryId"
			WHERE a.status IN (${Prisma.join(NON_DISPOSED_STATUSES)})
				AND c."organizationId" = ${organizationId}
			GROUP BY COALESCE(ac.name, 'Uncategorised')
			ORDER BY SUM(a."valueAfterDepreciation") DESC
			LIMIT 10
		`);

		return rows.map((row) => ({
			category: row.category,
			purchaseValue: Math.round(Number(row.purchaseValue ?? 0)),
			currentValue: Math.round(Number(row.currentValue ?? 0)),
			assetCount: Number(row.assetCount),
		}));
	}

	private async getLocationDistribution(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardLocationDistribution[]> {
		const rows = await this.prisma.client.$queryRaw<
			Array<{
				location: string;
				assetCount: number | bigint;
				totalValue: number | null;
			}>
		>(Prisma.sql`
			SELECT
				COALESCE(l.name, 'Unassigned') AS "location",
				COUNT(*) AS "assetCount",
				SUM(a."valueAfterDepreciation") AS "totalValue"
			FROM assets a
			INNER JOIN "Company" c ON c.id = a."companyId"
			LEFT JOIN locations l ON l.id = a."locationId"
			WHERE a.status IN (${Prisma.join(NON_DISPOSED_STATUSES)})
				AND a."locationId" IS NOT NULL
				AND c."organizationId" = ${organizationId}
			GROUP BY COALESCE(l.name, 'Unassigned')
			ORDER BY SUM(a."valueAfterDepreciation") DESC
			LIMIT 10
		`);

		return rows.map((row) => ({
			location: row.location,
			assetCount: Number(row.assetCount),
			totalValue: Math.round(Number(row.totalValue ?? 0)),
		}));
	}

	private async getMaintenanceDue(
		organizationId: AssetOrganizationId,
		now: Date,
		to: Date,
	): Promise<Asset.AssetDashboardMaintenanceDue[]> {
		const tasks = await this.prisma.assetMaintenanceTask.findMany({
			where: {
				maintenance: {
					is: {
						asset: { is: assetWhereForOrganization(organizationId) },
					},
				},
				maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
				nextDueDate: {
					not: null,
					lt: addDateOnlyUtc(dateOnlyFromPersistedDateTime(to), 1),
				},
			},
			orderBy: { nextDueDate: "asc" },
			take: 15,
			select: {
				id: true,
				maintenanceTask: true,
				maintenanceType: true,
				assignToName: true,
				nextDueDate: true,
				periodicity: true,
				maintenance: {
					select: {
						asset: { select: { assetName: true } },
					},
				},
			},
		});

		return tasks.map((task) => ({
			taskId: task.id,
			assetName: task.maintenance.asset.assetName,
			maintenanceTask: task.maintenanceTask,
			maintenanceType: task.maintenanceType,
			assignToName: task.assignToName,
			nextDueDate: dateOnlyFromPersistedDateTime(task.nextDueDate ?? now),
			daysUntilDue: differenceInDateOnlyDays(
				dateOnlyFromPersistedDateTime(now),
				dateOnlyFromPersistedDateTime(task.nextDueDate ?? now),
			),
			periodicity: task.periodicity,
		}));
	}

	private async getRecentActivity(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardRecentActivity[]> {
		const activities = await this.prisma.assetActivity.findMany({
			where: { asset: { is: assetWhereForOrganization(organizationId) } },
			orderBy: { createdAt: "desc" },
			take: 10,
			select: {
				id: true,
				assetId: true,
				activity: true,
				createdAt: true,
				asset: { select: { assetName: true, series: true } },
			},
		});

		return activities.map((a) => ({
			id: a.id,
			assetId: a.assetId,
			assetName: a.asset.assetName,
			assetSeries: a.asset.series,
			activity: a.activity,
			createdAt: a.createdAt.toISOString(),
		}));
	}

	private async getAdjustmentSummary(
		organizationId: AssetOrganizationId,
	): Promise<Asset.AssetDashboardAdjustmentSummary[]> {
		const groups = await this.prisma.assetValueAdjustment.groupBy({
			by: ["status"],
			where: { asset: { is: assetWhereForOrganization(organizationId) } },
			_count: true,
			_sum: { differenceAmount: true },
		});

		return groups.map((g) => ({
			status: g.status,
			count: g._count,
			totalAmount: Math.round(Math.abs(Number(g._sum.differenceAmount ?? 0))),
		}));
	}

	private async getInsuranceExpiry(
		organizationId: AssetOrganizationId,
		now: Date,
		to: Date,
	): Promise<Asset.AssetDashboardInsuranceExpiry[]> {
		const assets = await this.prisma.asset.findMany({
			where: {
				...assetWhereForOrganization(organizationId),
				status: { in: NON_DISPOSED_STATUSES },
				insurer: { not: null },
				policyNumber: { not: null },
				insuranceEndDate: {
					not: null,
					lt: addDateOnlyUtc(dateOnlyFromPersistedDateTime(to), 1),
				},
			},
			orderBy: { insuranceEndDate: "asc" },
			take: 15,
			select: {
				id: true,
				assetName: true,
				insurer: true,
				policyNumber: true,
				insuredValue: true,
				insuranceEndDate: true,
			},
		});

		return assets.map((a) => ({
			assetId: a.id,
			assetName: a.assetName,
			insurer: a.insurer ?? "",
			policyNumber: a.policyNumber ?? "",
			insuredValue: Math.round(Number(a.insuredValue ?? 0)),
			insuranceEndDate: dateOnlyFromPersistedDateTime(
				a.insuranceEndDate ?? now,
			),
			daysUntilExpiry: differenceInDateOnlyDays(
				dateOnlyFromPersistedDateTime(now),
				dateOnlyFromPersistedDateTime(a.insuranceEndDate ?? now),
			),
		}));
	}
}
