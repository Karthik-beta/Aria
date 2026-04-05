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
import type { PrismaService } from "../../shared/prisma.service";

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

export class AssetDashboardSubService {
	constructor(private readonly prisma: PrismaService) {}

	async getDashboardData(): Promise<Asset.AssetDashboardData> {
		const now = new Date();
		const ninetyDaysFromNow = new Date(now);
		ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

		const [
			kpis,
			statusDistribution,
			depreciationTrend,
			categoryValues,
			locationDistribution,
			maintenanceDue,
			recentActivity,
			adjustmentSummary,
			insuranceExpiry,
		] = await Promise.all([
			this.getKpis(),
			this.getStatusDistribution(),
			this.getDepreciationTrend(),
			this.getCategoryValues(),
			this.getLocationDistribution(),
			this.getMaintenanceDue(now, ninetyDaysFromNow),
			this.getRecentActivity(),
			this.getAdjustmentSummary(),
			this.getInsuranceExpiry(now, ninetyDaysFromNow),
		]);

		return {
			kpis,
			statusDistribution,
			depreciationTrend,
			categoryValues,
			locationDistribution,
			maintenanceDue,
			recentActivity,
			adjustmentSummary,
			insuranceExpiry,
		};
	}

	private async getKpis(): Promise<Asset.AssetDashboardKpi> {
		const [
			totalAssets,
			activeAssets,
			valueAgg,
			maintenanceDueCount,
			pendingAdjustments,
			locationCount,
		] = await Promise.all([
			this.prisma.asset.count({
				where: { status: { in: NON_DISPOSED_STATUSES } },
			}),
			this.prisma.asset.count({
				where: { status: { in: ACTIVE_STATUSES } },
			}),
			this.prisma.asset.aggregate({
				where: { status: { in: NON_DISPOSED_STATUSES } },
				_sum: {
					valueAfterDepreciation: true,
					netPurchaseAmount: true,
					openingAccumulatedDepreciation: true,
				},
			}),
			this.prisma.assetMaintenanceTask.count({
				where: {
					maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
					nextDueDate: { not: null, lte: new Date() },
				},
			}),
			this.prisma.assetValueAdjustment.count({
				where: { status: "DRAFT" },
			}),
			this.prisma.location.count({
				where: {
					isGroup: false,
					assets: { some: { status: { in: NON_DISPOSED_STATUSES } } },
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

	private async getStatusDistribution(): Promise<
		Asset.AssetDashboardStatusDistribution[]
	> {
		const groups = await this.prisma.asset.groupBy({
			by: ["status"],
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

	private async getDepreciationTrend(): Promise<
		Asset.AssetDashboardDepreciationTrend[]
	> {
		const entries = await this.prisma.assetDepreciationScheduleEntry.findMany({
			where: {
				schedule: { status: "ACTIVE" },
			},
			select: {
				scheduleDate: true,
				depreciationAmount: true,
			},
			orderBy: { scheduleDate: "asc" },
		});

		const monthMap = new Map<string, number>();
		for (const entry of entries) {
			const monthKey = entry.scheduleDate.toISOString().slice(0, 7);
			const existing = monthMap.get(monthKey) ?? 0;
			monthMap.set(monthKey, existing + Number(entry.depreciationAmount));
		}

		return Array.from(monthMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([month, amount]) => ({
				month,
				amount: Math.round(amount),
			}));
	}

	private async getCategoryValues(): Promise<
		Asset.AssetDashboardCategoryValue[]
	> {
		const assets = await this.prisma.asset.findMany({
			where: { status: { in: NON_DISPOSED_STATUSES } },
			select: {
				netPurchaseAmount: true,
				valueAfterDepreciation: true,
				assetCategory: { select: { name: true } },
			},
		});

		const categoryMap = new Map<
			string,
			{ purchaseValue: number; currentValue: number; assetCount: number }
		>();

		for (const asset of assets) {
			const category = asset.assetCategory?.name ?? "Uncategorised";
			const existing = categoryMap.get(category) ?? {
				purchaseValue: 0,
				currentValue: 0,
				assetCount: 0,
			};
			existing.purchaseValue += Number(asset.netPurchaseAmount);
			existing.currentValue += Number(asset.valueAfterDepreciation);
			existing.assetCount += 1;
			categoryMap.set(category, existing);
		}

		return Array.from(categoryMap.entries())
			.map(([category, data]) => ({
				category,
				purchaseValue: Math.round(data.purchaseValue),
				currentValue: Math.round(data.currentValue),
				assetCount: data.assetCount,
			}))
			.sort((a, b) => b.currentValue - a.currentValue)
			.slice(0, 10);
	}

	private async getLocationDistribution(): Promise<
		Asset.AssetDashboardLocationDistribution[]
	> {
		const assets = await this.prisma.asset.findMany({
			where: {
				status: { in: NON_DISPOSED_STATUSES },
				locationId: { not: null },
			},
			select: {
				valueAfterDepreciation: true,
				location: { select: { name: true } },
			},
		});

		const locationMap = new Map<
			string,
			{ assetCount: number; totalValue: number }
		>();

		for (const asset of assets) {
			const location = asset.location?.name ?? "Unassigned";
			const existing = locationMap.get(location) ?? {
				assetCount: 0,
				totalValue: 0,
			};
			existing.assetCount += 1;
			existing.totalValue += Number(asset.valueAfterDepreciation);
			locationMap.set(location, existing);
		}

		return Array.from(locationMap.entries())
			.map(([location, data]) => ({
				location,
				assetCount: data.assetCount,
				totalValue: Math.round(data.totalValue),
			}))
			.sort((a, b) => b.totalValue - a.totalValue)
			.slice(0, 10);
	}

	private async getMaintenanceDue(
		now: Date,
		to: Date,
	): Promise<Asset.AssetDashboardMaintenanceDue[]> {
		const tasks = await this.prisma.assetMaintenanceTask.findMany({
			where: {
				maintenanceStatus: { in: ["PLANNED", "OVERDUE"] },
				nextDueDate: { not: null, lte: to },
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

		const nowMs = now.getTime();

		return tasks.map((task) => ({
			taskId: task.id,
			assetName: task.maintenance.asset.assetName,
			maintenanceTask: task.maintenanceTask,
			maintenanceType: task.maintenanceType,
			assignToName: task.assignToName,
			nextDueDate: (task.nextDueDate ?? now).toISOString(),
			daysUntilDue: Math.ceil(
				((task.nextDueDate ?? now).getTime() - nowMs) / (1000 * 60 * 60 * 24),
			),
			periodicity: task.periodicity,
		}));
	}

	private async getRecentActivity(): Promise<
		Asset.AssetDashboardRecentActivity[]
	> {
		const activities = await this.prisma.assetActivity.findMany({
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

	private async getAdjustmentSummary(): Promise<
		Asset.AssetDashboardAdjustmentSummary[]
	> {
		const groups = await this.prisma.assetValueAdjustment.groupBy({
			by: ["status"],
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
		now: Date,
		to: Date,
	): Promise<Asset.AssetDashboardInsuranceExpiry[]> {
		const assets = await this.prisma.asset.findMany({
			where: {
				status: { in: NON_DISPOSED_STATUSES },
				insurer: { not: null },
				policyNumber: { not: null },
				insuranceEndDate: { not: null, lte: to },
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

		const nowMs = now.getTime();

		return assets.map((a) => ({
			assetId: a.id,
			assetName: a.assetName,
			insurer: a.insurer ?? "",
			policyNumber: a.policyNumber ?? "",
			insuredValue: Math.round(Number(a.insuredValue ?? 0)),
			insuranceEndDate: (a.insuranceEndDate ?? now).toISOString(),
			daysUntilExpiry: Math.ceil(
				((a.insuranceEndDate ?? now).getTime() - nowMs) / (1000 * 60 * 60 * 24),
			),
		}));
	}
}
