import {
	type Asset,
	dateOnlyFromPersistedDateTime,
	dateOnlyUtc,
	normalizeDateOnly,
} from "@aria/types";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
// biome-ignore lint/style/useImportType: Nest resolves this dependency from emitted runtime metadata.
import { PrismaService } from "../../shared/prisma.service";
import {
	type AssetOrganizationId,
	assetWhereForOrganization,
} from "./asset-organization-scope";
import { dateOnlyUtcRange } from "./depreciation/depreciation.config";

const CURRENCY_SCALE = 6;

const roundCurrency = (value: number): number =>
	Number(value.toFixed(CURRENCY_SCALE));

/**
 * Service for generating the Fixed Asset Register report with Net Book Value calculations,
 * dynamic grouping (by Category or Location), and monthly stacked bar chart trend points.
 */
@Injectable()
export class FixedAssetRegisterReportService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Generates the Fixed Asset Register report for a given date range and filter criteria.
	 *
	 * @param input - Report parameters including date range, company, groupBy, category, and location filters.
	 * @returns High-level summary, tabular rows grouped by category/location, and monthly stacked bar chart points.
	 */
	async generateReport(
		input: Asset.ListFixedAssetRegisterReportInput,
		organizationId: AssetOrganizationId,
	): Promise<Asset.FixedAssetRegisterReportResult> {
		const reportWindow = dateOnlyUtcRange(input.fromDate, input.toDate);
		const fromDate = reportWindow.startInclusive;
		const endExclusive = reportWindow.endExclusive;
		const lastReportDate = dateOnlyUtc(normalizeDateOnly(input.toDate));

		const where: Prisma.AssetWhereInput = {
			purchaseDate: { gte: fromDate, lt: endExclusive },
			status: { notIn: ["DRAFT", "CANCELLED"] },
		};

		if (input.company) {
			where.company = {
				is: { name: { contains: input.company, mode: "insensitive" } },
			};
		}
		if (input.assetCategory) {
			where.assetCategory = {
				is: { name: { contains: input.assetCategory, mode: "insensitive" } },
			};
		}
		if (input.location) {
			where.location = {
				is: { name: { contains: input.location, mode: "insensitive" } },
			};
		}

		const assets = await this.prisma.asset.findMany({
			where: assetWhereForOrganization(organizationId, where),
			include: {
				assetCategory: { select: { id: true, name: true } },
				company: { select: { name: true } },
				location: { select: { id: true, name: true } },
				valueAdjustments: {
					where: {
						status: "SUBMITTED",
						adjustmentDate: { gte: fromDate, lt: endExclusive },
					},
					select: { differenceAmount: true, adjustmentDate: true },
				},
				depreciationSchedules: {
					include: {
						entries: {
							where: {
								postingId: { not: null },
								posting: { is: { status: "POSTED" } },
								scheduleDate: { gte: fromDate, lt: endExclusive },
							},
							select: {
								depreciationAmount: true,
								scheduleDate: true,
								postingId: true,
								posting: { select: { status: true } },
							},
						},
					},
				},
			},
			orderBy: { purchaseDate: "asc" },
		});

		const rows: Asset.FixedAssetRegisterRow[] = [];
		let totalPurchaseAmount = 0;
		let totalDepreciatedAmount = 0;
		let totalRevaluationAmount = 0;
		let totalNetBookValue = 0;

		// Map to aggregate monthly chart points
		const monthlyChartMap = new Map<
			string,
			{ assetValue: number; depreciatedAmount: number }
		>();

		const getMonthKey = (d: Date): string => {
			const year = d.getUTCFullYear();
			const month = String(d.getUTCMonth() + 1).padStart(2, "0");
			return `${year}-${month}`;
		};

		// Initialize chart map for each month between fromDate and toDate
		const currMonth = new Date(
			Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1),
		);
		const endMonth = new Date(
			Date.UTC(
				lastReportDate.getUTCFullYear(),
				lastReportDate.getUTCMonth(),
				1,
			),
		);
		while (currMonth <= endMonth) {
			monthlyChartMap.set(getMonthKey(currMonth), {
				assetValue: 0,
				depreciatedAmount: 0,
			});
			currMonth.setUTCMonth(currMonth.getUTCMonth() + 1);
		}

		for (const asset of assets) {
			const purchaseAmt = Number(asset.netPurchaseAmount ?? 0);
			const openingDep = Number(asset.openingAccumulatedDepreciation ?? 0);

			let depAmt = 0;
			for (const sched of asset.depreciationSchedules) {
				for (const entry of sched.entries) {
					if (
						!entry.postingId ||
						(entry.posting && entry.posting.status !== "POSTED") ||
						entry.scheduleDate < fromDate ||
						entry.scheduleDate >= endExclusive
					) {
						continue;
					}
					const entryDep = Number(entry.depreciationAmount ?? 0);
					depAmt += entryDep;

					const entryMonth = getMonthKey(entry.scheduleDate);
					const existing = monthlyChartMap.get(entryMonth);
					if (existing) {
						existing.depreciatedAmount += entryDep;
					}
				}
			}

			if (asset.purchaseDate) {
				const purchMonth = getMonthKey(asset.purchaseDate);
				const existing = monthlyChartMap.get(purchMonth);
				if (existing) {
					existing.assetValue += purchaseAmt;
				}
			}

			let revalAmt = 0;
			for (const adj of asset.valueAdjustments) {
				revalAmt += Number(adj.differenceAmount ?? 0);
			}

			// ERPNext fixed-asset-register semantics: opening balance plus
			// posted depreciation and submitted revaluations within the period.
			const nbv = purchaseAmt - openingDep - depAmt + revalAmt;

			let groupingKey = "UNGROUPED";
			let groupingLabel = "Ungrouped";

			if (input.groupBy === "ASSET_CATEGORY") {
				groupingKey = asset.assetCategory?.id ?? "UNCATEGORIZED";
				groupingLabel = asset.assetCategory?.name ?? "Uncategorized";
			} else if (input.groupBy === "LOCATION") {
				groupingKey = asset.location?.id ?? "UNALLOCATED";
				groupingLabel = asset.location?.name ?? "Unallocated";
			}

			rows.push({
				groupingKey,
				groupingLabel,
				assetId: asset.id,
				assetSeries: asset.series,
				assetName: asset.assetName,
				assetCategoryId: asset.assetCategory?.id ?? null,
				assetCategoryName: asset.assetCategory?.name ?? null,
				locationId: asset.location?.id ?? null,
				locationName: asset.location?.name ?? null,
				company: asset.company.name,
				purchaseDate: dateOnlyFromPersistedDateTime(asset.purchaseDate),
				availableForUseDate: asset.availableForUseDate
					? dateOnlyFromPersistedDateTime(asset.availableForUseDate)
					: null,
				status: asset.status as Asset.AssetStatus,
				netPurchaseAmount: roundCurrency(purchaseAmt),
				openingAccumulatedDepreciation: roundCurrency(openingDep),
				depreciatedAmount: roundCurrency(depAmt),
				revaluationAmount: roundCurrency(revalAmt),
				netBookValue: roundCurrency(nbv),
			});

			totalPurchaseAmount += purchaseAmt;
			totalDepreciatedAmount += depAmt;
			totalRevaluationAmount += revalAmt;
			totalNetBookValue += nbv;
		}

		const chartPoints: Asset.FixedAssetRegisterChartPoint[] = Array.from(
			monthlyChartMap.entries(),
		).map(([month, val]) => ({
			month,
			assetValue: roundCurrency(val.assetValue),
			depreciatedAmount: roundCurrency(val.depreciatedAmount),
		}));

		return {
			rows,
			chartPoints,
			summary: {
				totalAssets: rows.length,
				totalPurchaseAmount: roundCurrency(totalPurchaseAmount),
				totalDepreciatedAmount: roundCurrency(totalDepreciatedAmount),
				totalRevaluationAmount: roundCurrency(totalRevaluationAmount),
				totalNetBookValue: roundCurrency(totalNetBookValue),
			},
		};
	}
}
