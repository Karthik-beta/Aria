import type { Asset } from "@aria/types";

export interface AssetActivityReportEntryInput {
	id: string;
	assetId: string;
	assetSeries: string;
	assetName: string;
	assetCategory: {
		id: string;
		name: string;
	} | null;
	company: string;
	assetStatus: Asset.AssetStatus;
	activity: string;
	user?: {
		id: string;
		name: string;
	} | null;
	userId?: string | null;
	userName?: string | null;
	createdAt: Date;
}

export interface BuildAssetActivityReportResultInput {
	activities: AssetActivityReportEntryInput[];
}

/**
 * Builds a formatted Asset Activity Report result with summary metrics from activity entries.
 *
 * @param input Raw activity entries retrieved for the report.
 * @returns Sorted report rows and summary statistics.
 */
export function buildAssetActivityReportResult(
	input: BuildAssetActivityReportResultInput,
): Asset.AssetActivityReportResult {
	const rows: Asset.AssetActivityReportRow[] = [...input.activities]
		.map((activity) => ({
			activityId: activity.id,
			assetId: activity.assetId,
			assetSeries: activity.assetSeries,
			assetName: activity.assetName,
			assetCategoryId: activity.assetCategory?.id ?? null,
			assetCategoryName: activity.assetCategory?.name ?? null,
			company: activity.company,
			assetStatus: activity.assetStatus,
			activity: activity.activity,
			userId: activity.user?.id ?? activity.userId ?? null,
			userName: activity.user?.name ?? activity.userName ?? null,
			createdAt: activity.createdAt,
		}))
		.sort((left, right) => {
			const byCreatedAt = right.createdAt.getTime() - left.createdAt.getTime();
			if (byCreatedAt !== 0) {
				return byCreatedAt;
			}

			const bySeries = left.assetSeries.localeCompare(right.assetSeries);
			if (bySeries !== 0) {
				return bySeries;
			}

			return right.activityId.localeCompare(left.activityId);
		});

	let firstActivityAt: Date | null = null;
	let lastActivityAt: Date | null = null;

	for (const row of rows) {
		if (
			lastActivityAt === null ||
			row.createdAt.getTime() > lastActivityAt.getTime()
		) {
			lastActivityAt = row.createdAt;
		}

		if (
			firstActivityAt === null ||
			row.createdAt.getTime() < firstActivityAt.getTime()
		) {
			firstActivityAt = row.createdAt;
		}
	}

	return {
		rows,
		summary: {
			rowCount: rows.length,
			distinctAssetCount: new Set(rows.map((row) => row.assetId)).size,
			firstActivityAt,
			lastActivityAt,
		},
	};
}
